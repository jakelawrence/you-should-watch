import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../../api/lib/db";

const FAVORITE_MULTIPLIER = 30;
const SHARED_GENRE_MULTIPLIER = 3;
const NUM_OF_RECOMMENDATIONS = 10;
/**
 * Generate top movie recommendations based on an inputted list of movies.
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
    const inputFilmLikeCounts = {}; // Track likes for films relevant to input movies
    const inputGenres = new Set(); // Collect genres from input films

    // Track unique user-movie interactions
    const processedFavorites = new Set();
    const processedLikes = new Set();

    // Helper to get genres for a movie from the database
    async function getGenresForFilm(movieSlug) {
      const genreRows = await db.all("SELECT genre FROM genres WHERE movieSlug = ?", [movieSlug]);
      return genreRows.map((row) => row.genre);
    }

    // Calculate median or average popularity of input films
    const placeholders = inputMovieSlugs.map(() => "?").join(",");
    const inputFilmIndices = await db.all(`SELECT popularityRanking FROM movies WHERE slug IN (${placeholders})`, inputMovieSlugs);
    const indices = inputFilmIndices.map((row) => row.popularityRanking);
    let comparisonIndex;
    if (indices.length > 5) {
      // Median Index
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

    // Collect genres of input films
    for (const slug of inputMovieSlugs) {
      const filmGenres = await getGenresForFilm(slug);
      filmGenres.forEach((genre) => inputGenres.add(genre));
    }

    // Count likes per movie
    const likeCounts = await db.all("SELECT movieSlug, COUNT(*) as count FROM likes GROUP BY movieSlug");
    likeCounts.forEach((row) => {
      filmLikeCounts[row.movieSlug] = row.count;
    });

    // Count likes for input movies
    if (inputMovieSlugs.length > 0) {
      const inputLikeCounts = await db.all(
        `SELECT movieSlug, COUNT(*) as count FROM likes 
         WHERE movieSlug IN (${placeholders})
         GROUP BY movieSlug`,
        inputMovieSlugs
      );
      inputLikeCounts.forEach((row) => {
        inputFilmLikeCounts[row.movieSlug] = row.count;
      });
    }

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

      // Add weight for favorites
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

      // Add weight for likes
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
    // Adjust scores based on like ratios
    Object.keys(userScores).forEach((slug) => {
      const totalLikes = filmLikeCounts[slug] || 1; // Avoid division by zero
      const likeRatio = userScores[slug] / totalLikes;
      userScores[slug] *= likeRatio;
    });
    // Filter movies by genre and adjust scores for genre overlap
    const filteredScores = {};
    const movieSlugs = Object.keys(userScores);

    for (const slug of movieSlugs) {
      const filmGenres = await getGenresForFilm(slug);
      // Get the movie's popularityRanking to compare with the comparison index
      const movieRowResult = await db.get("SELECT popularityRanking FROM movies WHERE slug = ?", [slug]);
      if (movieRowResult && filmGenres.length > 0 && movieRowResult.popularityRanking >= comparisonIndex) {
        // Check if the movie shares genres with the input films
        const sharedGenres = filmGenres.filter((genre) => inputGenres.has(genre));
        if (sharedGenres.length > 0) {
          // Increase score based on the number of shared genres
          filteredScores[slug] = userScores[slug] * (1 + sharedGenres.length * SHARED_GENRE_MULTIPLIER);
        }
      }
    }
    // Get movie details for top recommendations
    const topSlugs = Object.entries(filteredScores)
      .sort((a, b) => b[1] - a[1]) // Sort by score descending
      .slice(0, NUM_OF_RECOMMENDATIONS)
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
        score: filteredScores[movie.slug],
        genres: movie.genres ? movie.genres.split(",") : [],
      }));

      // Sort by score
      rankedMovies.sort((a, b) => b.score - a.score);
      console.log(rankedMovies);
    }

    await db.close();
    return rankedMovies;
  } catch (error) {
    console.error("Error generating recommendations:", error);
    throw new DatabaseError("Failed to generate recommendations", "RECOMMENDATION_ERROR");
  }
}

export async function GET(req) {
  try {
    console.log("Processing recommendation request");
    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const recommendations = await generateRecommendations(searchParams.slugs.split(","));
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
