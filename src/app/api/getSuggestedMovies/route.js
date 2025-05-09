import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../../api/lib/db";

// Constants for scoring calculations
const FAVORITE_MULTIPLIER = 30;
const SHARED_GENRE_MULTIPLIER = 3;
const DIRECTOR_MULTIPLIER = 5;
const ACTOR_MULTIPLIER = 2;
const DECADE_MULTIPLIER = 2;
const RUNTIME_SIMILARITY_FACTOR = 1.5;
const NUM_OF_RECOMMENDATIONS = 10;
const RECENCY_DECAY_FACTOR = 0.95; // Decay per year
const CURRENT_YEAR = new Date().getFullYear();
const BAYESIAN_WEIGHT = 5; // Weight for prior in Bayesian average

/**
 * Generate top movie recommendations based on an inputted list of movies.
 * Enhanced with content-based filtering, temporal analysis, and Bayesian averaging.
 * @param {string[]} inputMovieSlugs - Array of film slugs provided by the user.
 * @returns {Object[]} - Array of recommended movies sorted by score.
 */
async function generateRecommendations(inputMovieSlugs) {
  if (!inputMovieSlugs || inputMovieSlugs.length === 0) {
    return [];
  }

  try {
    const db = await openDb();
    const userScores = {};
    const userInteractionCounts = {}; // Track how many input movies each user liked or favorited
    const filmLikeCounts = {}; // Track the total likes for each movie
    const inputGenres = new Set(); // Collect genres from input films
    const inputDirectors = new Set(); // Collect directors from input films
    const inputActors = new Set(); // Collect actors from input films

    // Track unique user-movie interactions
    const processedFavorites = new Set();
    const processedLikes = new Set();

    // Helper functions for retrieving movie metadata
    async function getGenresForFilm(movieSlug) {
      const genreRows = await db.all("SELECT genre FROM genres WHERE movieSlug = ?", [movieSlug]);
      return genreRows.map((row) => row.genre);
    }

    async function getDirectorsForFilm(movieSlug) {
      try {
        const directorRows = await db.all("SELECT directorSlug FROM directors WHERE movieSlug = ? LIMIT 2", [movieSlug]);
        return directorRows.map((row) => row.directorSlug);
      } catch (error) {
        // Handle case where directors table might not exist yet
        console.warn("Could not fetch directors, table may not exist:", error.message);
        return [];
      }
    }

    async function getActorsForFilm(movieSlug) {
      try {
        const actorRows = await db.all("SELECT actorSlug FROM actors WHERE movieSlug = ? LIMIT 5", [movieSlug]);
        return actorRows.map((row) => row.actorSlug);
      } catch (error) {
        // Handle case where actors table might not exist yet
        console.warn("Could not fetch actors, table may not exist:", error.message);
        return [];
      }
    }

    async function getMovieDetails(movieSlug) {
      const movie = await db.get("SELECT * FROM movies WHERE slug = ?", [movieSlug]);
      if (!movie) return null;

      const genres = await getGenresForFilm(movieSlug);
      const directors = await getDirectorsForFilm(movieSlug);
      const actors = await getActorsForFilm(movieSlug);

      return {
        ...movie,
        genres,
        directors,
        actors,
      };
    }

    // Calculate median or average popularity of input films
    const placeholders = inputMovieSlugs.map(() => "?").join(",");
    const inputFilmIndices = await db.all(`SELECT popularityRanking FROM movies WHERE slug IN (${placeholders})`, inputMovieSlugs);
    const indices = inputFilmIndices.map((row) => row.popularityRanking);

    let comparisonIndex;
    if (indices.length > 5) {
      // Median Index
      indices.sort((a, b) => a - b); // Sort numerically
      const medianIndex = indices[Math.floor(indices.length / 2)];
      comparisonIndex = medianIndex;
    } else if (indices.length > 0) {
      // Average Index
      const averageIndex = Math.floor(indices.reduce((sum, index) => sum + index, 0) / indices.length);
      comparisonIndex = averageIndex;
    } else {
      // Default if no valid indices
      comparisonIndex = 0;
    }

    // Collect metadata from input films for content-based filtering
    const inputMovieDetails = [];
    let totalReleaseYears = 0;
    let totalRuntimes = 0;
    let validYearCount = 0;
    let validRuntimeCount = 0;

    for (const slug of inputMovieSlugs) {
      const details = await getMovieDetails(slug);
      if (details) {
        inputMovieDetails.push(details);

        // Collect genres
        details.genres.forEach((genre) => inputGenres.add(genre));

        // Collect directors
        details.directors.forEach((director) => inputDirectors.add(director));

        // Collect actors
        details.actors.forEach((actor) => inputActors.add(actor));

        // Sum up release years and runtimes for averaging
        if (details.releaseYear) {
          totalReleaseYears += details.releaseYear;
          validYearCount++;
        }

        if (details.runtime) {
          totalRuntimes += details.runtime;
          validRuntimeCount++;
        }
      }
    }

    // Calculate average release year and runtime
    const averageYear = validYearCount > 0 ? Math.floor(totalReleaseYears / validYearCount) : null;
    const averageRuntime = validRuntimeCount > 0 ? Math.floor(totalRuntimes / validRuntimeCount) : null;

    // Count likes per movie for score normalization
    const likeCounts = await db.all("SELECT movieSlug, COUNT(*) as count FROM likes GROUP BY movieSlug");
    likeCounts.forEach((row) => {
      filmLikeCounts[row.movieSlug] = row.count;
    });

    // Calculate average number of likes across all movies for Bayesian averaging
    const totalLikeCounts = Object.values(filmLikeCounts).reduce((sum, count) => sum + count, 0);
    const averageLikes = totalLikeCounts / Object.keys(filmLikeCounts).length || 1;

    // Find all users who favorited or liked the input films and count their interactions
    const userFavorites = await db.all(
      `SELECT username, movieSlug FROM favorites 
       WHERE movieSlug IN (${placeholders})
       GROUP BY username, movieSlug`,
      inputMovieSlugs
    );

    userFavorites.forEach((fav) => {
      const interactionKey = `${fav.username}:${fav.movieSlug}`;
      if (!processedFavorites.has(interactionKey)) {
        userInteractionCounts[fav.username] = (userInteractionCounts[fav.username] || 0) + 1;
        processedFavorites.add(interactionKey);
      }
    });

    const userLikes = await db.all(
      `SELECT username, movieSlug FROM likes 
       WHERE movieSlug IN (${placeholders})
       GROUP BY username, movieSlug`,
      inputMovieSlugs
    );

    userLikes.forEach((like) => {
      const interactionKey = `${like.username}:${like.movieSlug}`;
      if (!processedLikes.has(interactionKey)) {
        userInteractionCounts[like.username] = (userInteractionCounts[like.username] || 0) + 1;
        processedLikes.add(interactionKey);
      }
    });

    // Score movies based on user favorites and likes, weighted by interaction counts
    for (const username of Object.keys(userInteractionCounts)) {
      const interactionMultiplier = userInteractionCounts[username];

      // Add weight for favorites (check for timestamp if available)
      let favoritesQuery = `SELECT movieSlug`;
      let favoritesParams = [username, ...inputMovieSlugs];

      try {
        // Check if timestamp column exists
        const tableInfo = await db.all("PRAGMA table_info(favorites)");
        const hasTimestamp = tableInfo.some((col) => col.name === "timestamp");

        if (hasTimestamp) {
          favoritesQuery = `SELECT movieSlug, timestamp FROM favorites 
                           WHERE username = ? 
                           AND movieSlug NOT IN (${placeholders})`;
        } else {
          favoritesQuery = `SELECT movieSlug FROM favorites 
                           WHERE username = ? 
                           AND movieSlug NOT IN (${placeholders})`;
        }

        const userOtherFavorites = await db.all(favoritesQuery, favoritesParams);

        userOtherFavorites.forEach((fav) => {
          const interactionKey = `${username}:${fav.movieSlug}`;
          if (!processedFavorites.has(interactionKey)) {
            let multiplier = FAVORITE_MULTIPLIER * interactionMultiplier;

            // Apply recency boost if timestamp is available
            if (fav.timestamp) {
              const now = Date.now();
              const daysSince = (now - fav.timestamp) / (1000 * 60 * 60 * 24);
              const MAX_DAYS_RECENT = 90;

              if (daysSince <= MAX_DAYS_RECENT) {
                // Boost recent interactions by up to 50%
                multiplier *= 1 + 0.5 * (1 - daysSince / MAX_DAYS_RECENT);
              }
            }

            userScores[fav.movieSlug] = (userScores[fav.movieSlug] || 0) + multiplier;
            processedFavorites.add(interactionKey);
          }
        });
      } catch (error) {
        console.warn("Error processing favorites with timestamps:", error.message);

        // Fallback to simpler query without timestamp
        const userOtherFavorites = await db.all(
          `SELECT movieSlug FROM favorites 
           WHERE username = ? 
           AND movieSlug NOT IN (${placeholders})`,
          [username, ...inputMovieSlugs]
        );

        userOtherFavorites.forEach((fav) => {
          const interactionKey = `${username}:${fav.movieSlug}`;
          if (!processedFavorites.has(interactionKey)) {
            userScores[fav.movieSlug] = (userScores[fav.movieSlug] || 0) + FAVORITE_MULTIPLIER * interactionMultiplier;
            processedFavorites.add(interactionKey);
          }
        });
      }

      // Similar approach for likes with timestamp if available
      let likesQuery = `SELECT movieSlug`;
      let likesParams = [username, ...inputMovieSlugs];

      try {
        const tableInfo = await db.all("PRAGMA table_info(likes)");
        const hasTimestamp = tableInfo.some((col) => col.name === "timestamp");

        if (hasTimestamp) {
          likesQuery = `SELECT movieSlug, timestamp FROM likes 
                       WHERE username = ? 
                       AND movieSlug NOT IN (${placeholders})`;
        } else {
          likesQuery = `SELECT movieSlug FROM likes 
                       WHERE username = ? 
                       AND movieSlug NOT IN (${placeholders})`;
        }

        const userOtherLikes = await db.all(likesQuery, likesParams);

        userOtherLikes.forEach((like) => {
          const interactionKey = `${username}:${like.movieSlug}`;
          if (!processedLikes.has(interactionKey)) {
            let multiplier = 1 * interactionMultiplier;

            if (like.timestamp) {
              const now = Date.now();
              const daysSince = (now - like.timestamp) / (1000 * 60 * 60 * 24);
              const MAX_DAYS_RECENT = 90;

              if (daysSince <= MAX_DAYS_RECENT) {
                multiplier *= 1 + 0.3 * (1 - daysSince / MAX_DAYS_RECENT);
              }
            }

            userScores[like.movieSlug] = (userScores[like.movieSlug] || 0) + multiplier;
            processedLikes.add(interactionKey);
          }
        });
      } catch (error) {
        console.warn("Error processing likes with timestamps:", error.message);

        // Fallback to simpler query
        const userOtherLikes = await db.all(
          `SELECT movieSlug FROM likes 
           WHERE username = ? 
           AND movieSlug NOT IN (${placeholders})`,
          [username, ...inputMovieSlugs]
        );

        userOtherLikes.forEach((like) => {
          const interactionKey = `${username}:${like.movieSlug}`;
          if (!processedLikes.has(interactionKey)) {
            userScores[like.movieSlug] = (userScores[like.movieSlug] || 0) + 1 * interactionMultiplier;
            processedLikes.add(interactionKey);
          }
        });
      }
    }

    // Adjust scores based on like ratios (normalized popularity)
    Object.keys(userScores).forEach((slug) => {
      const totalLikes = filmLikeCounts[slug] || 1; // Avoid division by zero
      const likeRatio = userScores[slug] / totalLikes;
      userScores[slug] *= likeRatio;
    });

    // Apply enhanced filtering and scoring based on content factors
    const enhancedScores = {};
    const movieSlugs = Object.keys(userScores);

    for (const slug of movieSlugs) {
      const movieDetails = await getMovieDetails(slug);

      if (!movieDetails) continue;

      const { genres: filmGenres, directors, actors, releaseYear, runtime, popularityRanking } = movieDetails;

      // Skip movies that don't meet basic criteria
      if (!filmGenres.length || !popularityRanking || popularityRanking < comparisonIndex) {
        continue;
      }

      // Base score from collaborative filtering
      let score = userScores[slug] || 0;

      // Apply content-based filtering factors:

      // 1. Genre overlap (existing logic enhanced)
      const sharedGenres = filmGenres.filter((genre) => inputGenres.has(genre));
      if (sharedGenres.length === 0) {
        // Require at least one shared genre
        continue;
      }
      score *= 1 + sharedGenres.length * SHARED_GENRE_MULTIPLIER;

      // 2. Director overlap
      if (directors && directors.length) {
        const sharedDirectors = directors.filter((director) => inputDirectors.has(director));
        if (sharedDirectors.length > 0) {
          score *= 1 + sharedDirectors.length * DIRECTOR_MULTIPLIER;
        }
      }

      // 3. Actor overlap
      if (actors && actors.length) {
        const sharedActors = actors.filter((actor) => inputActors.has(actor));
        if (sharedActors.length > 0) {
          score *= 1 + Math.min(sharedActors.length, 3) * ACTOR_MULTIPLIER;
        }
      }

      // 5. Year/decade similarity
      if (averageYear && releaseYear) {
        // Decade matching (within 10 years)
        const yearDifference = Math.abs(releaseYear - averageYear);
        if (yearDifference <= 10) {
          score *= 1 + DECADE_MULTIPLIER * (1 - yearDifference / 10);
        }

        // Apply recency bias adjustment
        const yearsSinceRelease = CURRENT_YEAR - releaseYear;
        const recencyFactor = Math.pow(RECENCY_DECAY_FACTOR, yearsSinceRelease);
        score *= 1 + recencyFactor; // Slightly boost newer films
      }

      // 6. Runtime similarity
      if (averageRuntime && runtime) {
        const runtimeDifference = Math.abs(runtime - averageRuntime);
        const runtimeSimilarity = Math.max(0, 1 - runtimeDifference / averageRuntime);
        score *= 1 + runtimeSimilarity * RUNTIME_SIMILARITY_FACTOR;
      }

      // Apply Bayesian averaging to handle movies with few ratings more fairly
      const totalLikes = filmLikeCounts[slug] || 1;
      const bayesianScore = (score * totalLikes + averageLikes * BAYESIAN_WEIGHT) / (totalLikes + BAYESIAN_WEIGHT);

      // Store the final adjusted score
      enhancedScores[slug] = bayesianScore;
    }

    // Get movie details for top recommendations
    const topSlugs = Object.entries(enhancedScores)
      .sort((a, b) => b[1] - a[1]) // Sort by score descending
      .slice(0, NUM_OF_RECOMMENDATIONS * 2) // Get twice as many for diversity function
      .map(([slug]) => slug);

    let rankedMovies = [];

    if (topSlugs.length > 0) {
      const slugPlaceholders = topSlugs.map(() => "?").join(",");
      rankedMovies = await db.all(
        `SELECT m.*, 
                GROUP_CONCAT(DISTINCT g.genre) as genres
         FROM movies m
         LEFT JOIN genres g ON m.slug = g.movieSlug
         WHERE m.slug IN (${slugPlaceholders})
         GROUP BY m.slug`,
        topSlugs
      );

      // Add scores and format genres
      rankedMovies = rankedMovies.map((movie) => ({
        ...movie,
        score: enhancedScores[movie.slug],
        genres: movie.genres ? movie.genres.split(",") : [],
      }));

      // Sort by score
      rankedMovies.sort((a, b) => b.score - a.score);

      // Apply diversity filter to ensure genre variety
      rankedMovies = diversifyRecommendations(rankedMovies);
    }

    await db.close();
    return rankedMovies;
  } catch (error) {
    console.error("Error generating recommendations:", error);
    throw new DatabaseError("Failed to generate recommendations", "RECOMMENDATION_ERROR");
  }
}

/**
 * Ensures diversity in recommendations by preventing any single genre from dominating
 * @param {Object[]} recommendations - Array of movie recommendations
 * @param {number} maxPerGenre - Maximum movies per genre (default: 3)
 * @returns {Object[]} - Diversified recommendations
 */
function diversifyRecommendations(recommendations, maxPerGenre = 3) {
  const result = [];
  const genreCounts = {};

  for (const movie of recommendations) {
    // Check if we should include this movie based on genre diversity
    let shouldInclude = true;

    for (const genre of movie.genres) {
      genreCounts[genre] = genreCounts[genre] || 0;
      if (genreCounts[genre] >= maxPerGenre) {
        shouldInclude = false;
        break;
      }
    }

    if (shouldInclude) {
      result.push(movie);
      // Increment genre counts
      for (const genre of movie.genres) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    }

    // Stop once we have enough recommendations
    if (result.length >= NUM_OF_RECOMMENDATIONS) {
      break;
    }
  }

  // If we don't have enough recommendations, add more from the original list
  if (result.length < NUM_OF_RECOMMENDATIONS) {
    const remaining = recommendations.filter((movie) => !result.includes(movie));
    result.push(...remaining.slice(0, NUM_OF_RECOMMENDATIONS - result.length));
  }

  return result.slice(0, NUM_OF_RECOMMENDATIONS);
}

/**
 * Handles HTTP GET requests for movie recommendations
 */
export async function GET(req) {
  try {
    console.log("Processing enhanced recommendation request");
    const searchParams = Object.fromEntries(new URL(req.url).searchParams);

    if (!searchParams.slugs) {
      return Response.json({ error: "No movie slugs provided" }, { status: 400 });
    }

    const slugs = searchParams.slugs.split(",").filter((slug) => slug.trim());

    if (slugs.length === 0) {
      return Response.json({ error: "No valid movie slugs provided" }, { status: 400 });
    }

    const recommendations = await generateRecommendations(slugs);
    console.log(`Generated ${recommendations.length} recommendations`);

    return Response.json(recommendations);
  } catch (error) {
    console.error("Recommendation error:", error);

    if (error instanceof DatabaseError) {
      return Response.json({ error: error.message, code: error.code }, { status: 503 });
    }

    return Response.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
