import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../../api/lib/db";
import {
  query,
  getMovie,
  getMovies,
  getMovieGenres,
  getMovieDirectors,
  getMovieActors,
  getMovieFavoritedUsers,
  getMovieLikedUsers,
  getUserFavorites,
  getUsersFavorites,
  getUserLikes,
  getUsersLikes,
  getGenresOfMovies,
  getDirectorsOfMovies,
  getActorsOfMovies,
} from "../lib/dynamodb";

// Constants for scoring calculations
const FAVORITE_MULTIPLIER = 30;
const LIKE_MULTIPLIER = 30;
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

const formatList = (fieldName, valueArray, prefix = "val") => {
  // Handle empty array
  if (!Array.isArray(valueArray) || valueArray.length === 0) {
    throw new Error("valueArray must be a non-empty array");
  }

  // Generate placeholders for each value
  const placeholders = valueArray.map((_, index) => `:${prefix}${index}`);

  // Create the IN filter expression
  const filterExpression = `${fieldName} IN (${placeholders.join(", ")})`;

  // Create expression attribute values object
  const expressionAttributeValues = {};
  valueArray.forEach((value, index) => {
    expressionAttributeValues[`:${prefix}${index}`] = value;
  });

  return [filterExpression, expressionAttributeValues];
};

async function generateRecommendations(inputMovieSlugs) {
  if (!inputMovieSlugs || inputMovieSlugs.length === 0) {
    return [];
  }

  try {
    async function getDirectorsForMovie(movieSlug) {
      let filters = [];
      let params = {};

      // Add search by movieSlug
      filters.push(`movieSlug = :movieSlug`);
      params[":movieSlug"] = movieSlug;

      const directors = await query("directors", filters, params);
      return directors.map((row) => row.directorSlug);
    }

    async function getUserFavoritesOfMovies(movieSlugs) {
      var [filters, params] = formatList("movieSlug", movieSlugs);

      const favorites = await query("favorites", filters, params, names);
      return favorites;
    }

    async function getActorsForMovie(movieSlug) {
      let filters = [];
      let params = {};

      // Add search by movieSlug
      filters.push(`movieSlug = :movieSlug`);
      params[":movieSlug"] = movieSlug;

      const actors = await query("actors", filters, params);
      return actors.map((row) => row.actorSlug);
    }

    async function getMovieLikeCounts() {
      let movieLikeCounts = new Map();
      let filters = [];
      let params = {};
      let names = {};
      const likes = await query("likes", filters, params, names);
      likes.forEach((movieSlug) => {
        if (!movieLikeCounts.has(movieSlug)) movieLikeCounts.set(movieSlug, 0);
        let movieCount = movieLikeCounts.get(movieSlug);
        movieCount += 1;
        movieLikeCounts.set(movieSlug, movieCount);
      });
      return movieLikeCounts;
    }

    async function getMovieDetails(movieSlug) {
      const movie = await getMovie(movieSlug);
      if (!movie) return null;

      const genres = await getMovieGenres(movieSlug);
      const directors = await getMovieDirectors(movieSlug);
      const actors = await getMovieActors(movieSlug);

      return {
        ...movie,
        genres,
        directors,
        actors,
      };
    }

    //const db = await openDb();
    const userScores = {};
    const userInteractionCounts = {}; // Track how many input movies each user liked or favorited
    const movieLikeCounts = await getMovieLikeCounts(); // Track the total likes for each movie
    const inputGenres = new Set(); // Collect genres from input films
    const inputDirectors = new Set(); // Collect directors from input films
    const inputActors = new Set(); // Collect actors from input films

    // Track unique user-movie interactions
    const processedFavorites = new Set();
    const processedLikes = new Set();

    // Calculate median or average popularity of input films
    const placeholders = inputMovieSlugs.map(() => "?").join(",");
    console.log(inputMovieSlugs);
    // const inputFilmIndices = await db.all(`SELECT popularityRanking FROM movies WHERE slug IN (${placeholders})`, inputMovieSlugs);
    // const indices = inputFilmIndices.map((row) => row.popularityRanking);

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
    const indices = inputMovieDetails.map((row) => row.popularity);
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

    //console.log(inputMovieDetails);
    // Calculate average release year and runtime
    const averageYear = validYearCount > 0 ? Math.floor(totalReleaseYears / validYearCount) : null;
    const averageRuntime = validRuntimeCount > 0 ? Math.floor(totalRuntimes / validRuntimeCount) : null;

    // Calculate average number of likes across all movies for Bayesian averaging
    const totalLikeCounts = Object.values(movieLikeCounts).reduce((sum, count) => sum + count, 0);
    const averageLikes = totalLikeCounts / Object.keys(movieLikeCounts).length || 1;

    // Find all users who favorited or liked the input films and count their interactions
    let userFavorites = [];
    for await (const movieSlug of inputMovieSlugs) {
      let favoritedUsers = await getMovieFavoritedUsers(movieSlug);
      favoritedUsers.forEach((username) => {
        const interactionKey = `${username}:${movieSlug}`;
        if (!processedLikes.has(interactionKey)) {
          userInteractionCounts[username] = (userInteractionCounts[username] || 0) + 1;
          processedLikes.add(interactionKey);
        }
      });
      userFavorites.push(favoritedUsers);
    }

    let userLikes = [];
    for await (const movieSlug of inputMovieSlugs) {
      let likedUsers = await getMovieLikedUsers(movieSlug);
      likedUsers.forEach((username) => {
        const interactionKey = `${username}:${movieSlug}`;
        if (!processedLikes.has(interactionKey)) {
          userInteractionCounts[username] = (userInteractionCounts[username] || 0) + 1;
          processedLikes.add(interactionKey);
        }
      });
      userLikes.push(likedUsers);
    }

    let usernames = Object.keys(userInteractionCounts);
    const usersOtherLikes = await getUsersLikes(usernames);
    const usersOtherFavorites = await getUsersFavorites(usernames);

    // Score movies based on user favorites and likes, weighted by interaction counts
    for (const username of usernames) {
      const interactionMultiplier = userInteractionCounts[username];

      const userOtherFavorites = usersOtherFavorites.get(username);

      userOtherFavorites.forEach((movieSlug) => {
        const interactionKey = `${username}:${movieSlug}`;
        if (!processedFavorites.has(interactionKey) && !inputMovieSlugs.includes(movieSlug)) {
          let multiplier = FAVORITE_MULTIPLIER * interactionMultiplier;

          userScores[movieSlug] = (userScores[movieSlug] || 0) + multiplier;
          processedFavorites.add(interactionKey);
        }
      });

      const userOtherLikes = usersOtherLikes.get(username);

      userOtherLikes.forEach((movieSlug) => {
        const interactionKey = `${username}:${movieSlug}`;
        if (!processedFavorites.has(interactionKey) && !inputMovieSlugs.includes(movieSlug)) {
          let multiplier = LIKE_MULTIPLIER * interactionMultiplier;

          userScores[movieSlug] = (userScores[movieSlug] || 0) + multiplier;
          processedFavorites.add(interactionKey);
        }
      });
    }

    // Adjust scores based on like ratios (normalized popularity)
    Object.keys(userScores).forEach((slug) => {
      const totalLikes = movieLikeCounts[slug] || 1; // Avoid division by zero
      const likeRatio = userScores[slug] / totalLikes;
      userScores[slug] *= likeRatio;
    });

    // Apply enhanced filtering and scoring based on content factors
    const enhancedScores = {};
    const movieSlugs = Object.keys(userScores);
    const movieDetails = await getMovies(movieSlugs);
    const movieGenres = await getGenresOfMovies(movieSlugs);

    for (const [movieSlug, movieDetail] of movieDetails) {
      if (!movieDetail) continue;
      let filmGenres = movieGenres.get(movieSlug);
      let releaseYear = movieDetail.year;
      let popularityRanking = movieDetail.popularity;

      // Skip movies that don't meet basic criteria
      if (!filmGenres || !filmGenres.length || !popularityRanking || popularityRanking < comparisonIndex) {
        continue;
      }

      // Base score from collaborative filtering
      let score = userScores[movieSlug] || 0;

      // Apply content-based filtering factors:

      // 1. Genre overlap (existing logic enhanced)
      const sharedGenres = filmGenres.filter((genre) => inputGenres.has(genre));
      if (sharedGenres.length === 0) {
        // Require at least one shared genre
        continue;
      }
      score *= 1 + sharedGenres.length * SHARED_GENRE_MULTIPLIER;

      // 2. Director overlap
      // if (directors && directors.length) {
      //   const sharedDirectors = directors.filter((director) => inputDirectors.has(director));
      //   if (sharedDirectors.length > 0) {
      //     score *= 1 + sharedDirectors.length * DIRECTOR_MULTIPLIER;
      //   }
      // }

      // 3. Actor overlap
      // if (actors && actors.length) {
      //   const sharedActors = actors.filter((actor) => inputActors.has(actor));
      //   if (sharedActors.length > 0) {
      //     score *= 1 + Math.min(sharedActors.length, 3) * ACTOR_MULTIPLIER;
      //   }
      // }

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
      // if (averageRuntime && runtime) {
      //   const runtimeDifference = Math.abs(runtime - averageRuntime);
      //   const runtimeSimilarity = Math.max(0, 1 - runtimeDifference / averageRuntime);
      //   score *= 1 + runtimeSimilarity * RUNTIME_SIMILARITY_FACTOR;
      // }

      // Apply Bayesian averaging to handle movies with few ratings more fairly
      const totalLikes = movieLikeCounts[movieSlug] || 1;
      const bayesianScore = (score * totalLikes + averageLikes * BAYESIAN_WEIGHT) / (totalLikes + BAYESIAN_WEIGHT);

      // Store the final adjusted score
      enhancedScores[movieSlug] = bayesianScore;
    }

    // Get movie details for top recommendations
    const topSlugs = Object.entries(enhancedScores)
      .sort((a, b) => b[1] - a[1]) // Sort by score descending
      .slice(0, NUM_OF_RECOMMENDATIONS) // Get twice as many for diversity function
      .map(([slug]) => slug);
    let rankedMovies = [];

    if (topSlugs.length > 0) {
      // Add scores and format genres
      rankedMovies = topSlugs.map((movie) => ({
        ...movieDetails.get(movie),
        score: enhancedScores[movie],
        genres: movieGenres.has(movie) ? movieGenres.get(movie) : [],
        actors: [],
      }));

      // Sort by score
      rankedMovies.sort((a, b) => b.score - a.score);

      // Apply diversity filter to ensure genre variety
      //rankedMovies = diversifyRecommendations(rankedMovies);
    }
    //log(rankedMovies);
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
