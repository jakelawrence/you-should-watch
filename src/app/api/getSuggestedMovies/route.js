import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../../api/lib/db";
import { logger } from "../lib/logger";
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
  queryAllItems,
} from "../lib/dynamodb";

// Constants for scoring calculations
const FAVORITE_MULTIPLIER = 50;
const LIKE_MULTIPLIER = 10;
const SHARED_GENRE_MULTIPLIER = 5;
//the higher the divider, the more movies let in
const MOVIE_REVIEW_THRESHOLD_DIVIDER = 5;
const DIRECTOR_MULTIPLIER = 5;
const ACTOR_MULTIPLIER = 2;
const DECADE_MULTIPLIER = 2;
const RUNTIME_SIMILARITY_FACTOR = 1.5;
const NUM_OF_RECOMMENDATIONS = 5;
const RECENCY_DECAY_FACTOR = 0.95; // Decay per year
const CURRENT_YEAR = new Date().getFullYear();
const BAYESIAN_WEIGHT = 50; // Weight for prior in Bayesian average

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
  logger.log("🚀 generateRecommendations started");
  logger.log("📥 Input movie slugs:", inputMovieSlugs);

  if (!inputMovieSlugs || inputMovieSlugs.length === 0) {
    logger.warn("⚠️ No input movie slugs provided, returning empty array");
    return [];
  }

  try {
    async function getDirectorsForMovie(movieSlug) {
      logger.debug("🎬 Getting directors for movie:", movieSlug);
      let filters = [];
      let params = {};

      // Add search by movieSlug
      filters.push(`movieSlug = :movieSlug`);
      params[":movieSlug"] = movieSlug;

      const directors = await query("directors", filters, params);
      logger.debug(
        `🎬 Found ${directors.length} directors for ${movieSlug}:`,
        directors.map((row) => row.directorSlug)
      );
      return directors.map((row) => row.directorSlug);
    }

    async function getUserFavoritesOfMovies(movieSlugs) {
      logger.debug("❤️ Getting user favorites for movies:", movieSlugs);
      var [filters, params] = formatList("movieSlug", movieSlugs);

      const favorites = await query("favorites", filters, params, names);
      logger.debug(`❤️ Found ${favorites.length} favorite records`);
      return favorites;
    }

    async function getActorsForMovie(movieSlug) {
      logger.debug("🎭 Getting actors for movie:", movieSlug);
      let filters = [];
      let params = {};

      // Add search by movieSlug
      filters.push(`movieSlug = :movieSlug`);
      params[":movieSlug"] = movieSlug;

      const actors = await query("actors", filters, params);
      logger.debug(
        `🎭 Found ${actors.length} actors for ${movieSlug}:`,
        actors.map((row) => row.actorSlug)
      );
      return actors.map((row) => row.actorSlug);
    }

    async function getMovieLikeCounts() {
      logger.info("👍 Getting movie like counts");
      let movieLikeCounts = new Map();

      // Get ALL likes using pagination
      const likes = await queryAllItems("likes");
      logger.info(`👍 Processing ${likes.length} like records`);

      likes.forEach((likeRecord) => {
        const movieSlug = likeRecord.movieSlug; // Adjust field name if needed
        if (movieSlug) {
          if (!movieLikeCounts.has(movieSlug)) movieLikeCounts.set(movieSlug, 0);
          let movieCount = movieLikeCounts.get(movieSlug);
          movieCount += 1;
          movieLikeCounts.set(movieSlug, movieCount);
        }
      });

      logger.info(`👍 Generated like counts for ${movieLikeCounts.size} movies`);
      logger.info(
        "👍 Top 5 most liked movies:",
        Array.from(movieLikeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
      );
      return movieLikeCounts;
    }

    async function getMovieDetails(movieSlug) {
      logger.debug("📋 Getting movie details for:", movieSlug);
      const movie = await getMovie(movieSlug);
      if (!movie) {
        logger.warn("⚠️ Movie not found:", movieSlug);
        return null;
      }

      const genres = await getMovieGenres(movieSlug);
      const directors = await getMovieDirectors(movieSlug);
      const actors = await getMovieActors(movieSlug);

      logger.debug(`📋 Movie details for ${movieSlug}:`, {
        title: movie.title,
        genreCount: genres.length,
        directorCount: directors.length,
        actorCount: actors.length,
      });

      return {
        ...movie,
        genres,
        directors,
        actors,
      };
    }

    logger.info("🔧 Initializing recommendation algorithm variables");
    const userScores = {};
    const userInteractionCounts = {}; // Track how many input movies each user liked or favorited
    const movieLikeCounts = await getMovieLikeCounts(); // Track the total likes for each movie
    logger.info("movieLikeCounts=" + movieLikeCounts);
    const inputGenres = new Set(); // Collect genres from input films
    const inputDirectors = new Set(); // Collect directors from input films
    const inputActors = new Set(); // Collect actors from input films

    // Track unique user-movie interactions
    const processedFavorites = new Set();
    const processedLikes = new Set();

    logger.info("📊 Collecting input movie metadata");
    const inputMovieDetails = [];
    let totalReleaseYears = 0;
    let totalRuntimes = 0;
    let validYearCount = 0;
    let validRuntimeCount = 0;

    for (const slug of inputMovieSlugs) {
      logger.info(`📊 Processing input movie: ${slug}`);
      const details = await getMovieDetails(slug);
      if (details) {
        inputMovieDetails.push(details);

        // Collect genres
        logger.debug(`🏷️ Genres for ${slug}:`, details.genres);
        details.genres.forEach((genre) => inputGenres.add(genre));

        // Collect directors
        logger.debug(`🎬 Directors for ${slug}:`, details.directors);
        details.directors.forEach((director) => inputDirectors.add(director));

        // Collect actors
        logger.debug(`🎭 Actors for ${slug}:`, details.actors);
        details.actors.forEach((actor) => inputActors.add(actor));

        // Sum up release years and runtimes for averaging
        if (details.year) {
          totalReleaseYears += parseInt(details.year);
          validYearCount++;
          logger.debug(`📅 Release year for ${slug}: ${details.year}`);
        }

        if (details.length) {
          totalRuntimes += parseInt(details.length);
          validRuntimeCount++;
          logger.debug(`⏰ Runtime for ${slug}: ${details.length} minutes`);
        }
      } else {
        logger.warn(`⚠️ Could not get details for ${slug}`);
      }
    }

    logger.info("📊 Input movie analysis summary:");
    logger.info(`📊 Valid movies processed: ${inputMovieDetails.length}/${inputMovieSlugs.length}`);
    logger.info(`🏷️ Unique input genres (${inputGenres.size}):`, Array.from(inputGenres));
    logger.info(`🎬 Unique input directors (${inputDirectors.size}):`, Array.from(inputDirectors).slice(0, 10));
    logger.info(`🎭 Unique input actors (${inputActors.size}):`, Array.from(inputActors).slice(0, 10));

    const indices = inputMovieDetails.map((row) => row.numberOfReviews || 0);
    logger.info("📈 Number of reviews indices:", indices);

    let comparisonIndex;
    if (indices.length > 5) {
      // Median Index
      indices.sort((a, b) => a - b); // Sort numerically
      const medianIndex = indices[Math.floor(indices.length / 2)];
      comparisonIndex = medianIndex;
      logger.info("📈 Using median numberOfReviews:", comparisonIndex);
    } else if (indices.length > 0) {
      // Average Index
      const averageIndex = Math.floor(indices.reduce((sum, index) => sum + index, 0) / indices.length);
      comparisonIndex = averageIndex;
      logger.info("📈 Using average numberOfReviews:", comparisonIndex);
    } else {
      // Default if no valid indices
      comparisonIndex = 0;
      logger.info("📈 Using default numberOfReviews:", comparisonIndex);
    }

    // Calculate average release year and runtime
    const averageYear = validYearCount > 0 ? Math.floor(totalReleaseYears / validYearCount) : null;
    const averageRuntime = validRuntimeCount > 0 ? Math.floor(totalRuntimes / validRuntimeCount) : null;

    logger.info("📊 Calculated averages:");
    logger.info("📊 Input movie analysis summary:");
    logger.info(`📅 Total Release Years: ${totalReleaseYears}`);
    logger.info(`⏰ Average runtime: ${averageRuntime} minutes`);

    // Calculate average number of likes across all movies for Bayesian averaging
    const totalLikeCounts = Array.from(movieLikeCounts.values()).reduce((sum, count) => sum + count, 0);
    const averageLikes = totalLikeCounts / movieLikeCounts.size || 1;
    logger.info(`👍 Average likes per movie: ${averageLikes.toFixed(2)} (from ${totalLikeCounts} total likes across ${movieLikeCounts.size} movies)`);

    logger.info("👥 Finding users who interacted with input movies");
    // Find all users who favorited or liked the input films and count their interactions
    let userFavorites = [];
    for await (const movieSlug of inputMovieSlugs) {
      logger.debug(`❤️ Getting users who favorited: ${movieSlug}`);
      let favoritedUsers = await getMovieFavoritedUsers(movieSlug);
      logger.debug(`❤️ Found ${favoritedUsers.length} users who favorited ${movieSlug}`);

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
      logger.debug(`👍 Getting users who liked: ${movieSlug}`);
      let likedUsers = await getMovieLikedUsers(movieSlug);
      logger.debug(`👍 Found ${likedUsers.length} users who liked ${movieSlug}`);

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
    logger.info(`👥 Found ${usernames.length} unique users who interacted with input movies`);
    logger.info(
      "👥 Top 10 users by interaction count:",
      Object.entries(userInteractionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    );

    logger.info("🔍 Getting other movies liked/favorited by these users");
    const usersOtherLikes = await getUsersLikes(usernames);
    const usersOtherFavorites = await getUsersFavorites(usernames);
    logger.info(`🔍 Got other likes data for ${usersOtherLikes.size} users`);
    logger.info(`🔍 Got other favorites data for ${usersOtherFavorites.size} users`);

    logger.info("🎯 Calculating collaborative filtering scores");
    // Score movies based on user favorites and likes, weighted by interaction counts
    for (const username of usernames) {
      const interactionMultiplier = userInteractionCounts[username];

      const userOtherFavorites = usersOtherFavorites.get(username) || [];
      if (userOtherFavorites.length > 0) {
        logger.debug(`❤️ User ${username} has ${userOtherFavorites.length} other favorites (interaction multiplier: ${interactionMultiplier})`);
      }

      userOtherFavorites.forEach((movieSlug) => {
        const interactionKey = `${username}:${movieSlug}`;
        if (!processedFavorites.has(interactionKey) && !inputMovieSlugs.includes(movieSlug)) {
          let multiplier = FAVORITE_MULTIPLIER * interactionMultiplier;
          userScores[movieSlug] = (userScores[movieSlug] || 0) + multiplier;
          processedFavorites.add(interactionKey);
        }
      });

      const userOtherLikes = usersOtherLikes.get(username) || [];
      if (userOtherLikes.length > 0) {
        logger.debug(`👍 User ${username} has ${userOtherLikes.length} other likes`);
      }

      userOtherLikes.forEach((movieSlug) => {
        const interactionKey = `${username}:${movieSlug}`;
        if (!processedFavorites.has(interactionKey) && !inputMovieSlugs.includes(movieSlug)) {
          let multiplier = LIKE_MULTIPLIER * interactionMultiplier;
          userScores[movieSlug] = (userScores[movieSlug] || 0) + multiplier;
          processedFavorites.add(interactionKey);
        }
      });
    }

    logger.info(`🎯 Generated initial scores for ${Object.keys(userScores).length} candidate movies`);
    logger.info(
      `🎯 Top ${NUM_OF_RECOMMENDATIONS} initial scores:`,
      Object.entries(userScores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, NUM_OF_RECOMMENDATIONS)
    );

    logger.info("📊 Adjusting scores based on like ratios");
    // Adjust scores based on like ratios (normalized popularity)
    Object.keys(userScores).forEach((slug) => {
      const originalScore = userScores[slug];
      const totalLikes = movieLikeCounts.get(slug) || 1; // Avoid division by zero
      const likeRatio = userScores[slug] / totalLikes;
      userScores[slug] *= likeRatio;

      if (originalScore !== userScores[slug]) {
        logger.debug(
          `📊 Score adjustment for ${slug}: ${originalScore.toFixed(2)} -> ${userScores[slug].toFixed(2)} (ratio: ${likeRatio.toFixed(3)})`
        );
      }
    });

    logger.info("🎨 Applying content-based filtering and enhanced scoring");
    const enhancedScores = {};
    const movieSlugs = Object.keys(userScores);
    logger.info(`🎨 Processing ${movieSlugs.length} candidate movies for content filtering`);

    const movieDetails = await getMovies(movieSlugs);
    const movieGenres = await getGenresOfMovies(movieSlugs);
    logger.info(`🎨 Got details for ${movieDetails.size} movies and genres for ${movieGenres.size} movies`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const [movieSlug, movieDetail] of movieDetails) {
      processedCount++;
      if (processedCount % 100 === 0) {
        logger.info(`🎨 Processed ${processedCount}/${movieDetails.size} movies for content filtering`);
      }

      if (!movieDetail) {
        logger.warn(`⚠️ No details found for ${movieSlug}, skipping`);
        skippedCount++;
        continue;
      }

      let filmGenres = movieGenres.get(movieSlug) || [];
      let releaseYear = movieDetail.year;
      let numberOfReviews = movieDetail.numberOfReviews || 0;

      logger.debug(`🎨 Processing ${movieSlug}: genres=${filmGenres.length}, year=${releaseYear}, numberOfReviews=${numberOfReviews}`);

      // Skip movies that don't meet basic criteria - only include movies with at least as many reviews as our comparison threshold
      if (!filmGenres.length || numberOfReviews < comparisonIndex / MOVIE_REVIEW_THRESHOLD_DIVIDER) {
        logger.debug(
          `⚠️ Skipping ${movieSlug}: genres=${filmGenres.length}, numberOfReviews=${numberOfReviews} < ${
            comparisonIndex / MOVIE_REVIEW_THRESHOLD_DIVIDER
          }`
        );
        skippedCount++;
        continue;
      }

      // Base score from collaborative filtering
      let score = userScores[movieSlug] || 0;
      const originalScore = score;

      // Apply content-based filtering factors:

      // 1. Genre overlap (existing logic enhanced)
      const sharedGenres = filmGenres.filter((genre) => inputGenres.has(genre));
      if (sharedGenres.length === 0) {
        // Require at least one shared genre
        logger.debug(`⚠️ Skipping ${movieSlug}: no shared genres (movie: ${filmGenres.join(", ")} vs input: ${Array.from(inputGenres).join(", ")})`);
        skippedCount++;
        continue;
      }

      const genreMultiplier = 1 + sharedGenres.length * SHARED_GENRE_MULTIPLIER;
      score *= genreMultiplier;
      logger.debug(
        `🏷️ Genre boost for ${movieSlug}: shared ${sharedGenres.length} genres (${sharedGenres.join(", ")}), multiplier: ${genreMultiplier.toFixed(
          2
        )}`
      );

      // 5. Year/decade similarity
      if (averageYear && releaseYear) {
        const yearDifference = Math.abs(releaseYear - averageYear);
        if (yearDifference <= 10) {
          const yearMultiplier = 1 + DECADE_MULTIPLIER * (1 - yearDifference / 10);
          score *= yearMultiplier;
          logger.debug(`📅 Year similarity boost for ${movieSlug}: ${yearDifference} years difference, multiplier: ${yearMultiplier.toFixed(2)}`);
        }

        // Apply recency bias adjustment
        const yearsSinceRelease = CURRENT_YEAR - releaseYear;
        const recencyFactor = Math.pow(RECENCY_DECAY_FACTOR, yearsSinceRelease);
        const recencyMultiplier = 1 + recencyFactor;
        score *= recencyMultiplier;
        logger.debug(`📅 Recency adjustment for ${movieSlug}: ${yearsSinceRelease} years old, multiplier: ${recencyMultiplier.toFixed(2)}`);
      }

      // Apply Bayesian averaging to handle movies with few ratings more fairly
      const totalLikes = movieLikeCounts.get(movieSlug) || 1;
      const bayesianScore = (score * totalLikes + averageLikes * BAYESIAN_WEIGHT) / (totalLikes + BAYESIAN_WEIGHT);

      logger.debug(
        `🎯 Final scoring for ${movieSlug}: ${originalScore.toFixed(2)} -> ${score.toFixed(2)} -> ${bayesianScore.toFixed(
          2
        )} (Bayesian with ${totalLikes} likes)`
      );

      // Store the final adjusted score
      enhancedScores[movieSlug] = bayesianScore;
    }

    logger.info(`🎨 Content filtering complete: processed ${processedCount} movies, skipped ${skippedCount}`);
    logger.info(`🎯 Final candidate count: ${Object.keys(enhancedScores).length} movies`);
    logger.info(`🎯 Enhanced Scores: ${JSON.stringify(enhancedScores)}`);
    logger.info("🏆 Generating final recommendations");
    // Get movie details for top recommendations
    const topSlugs = Object.entries(enhancedScores)
      .sort((a, b) => b[1] - a[1]) // Sort by score descending
      .slice(0, NUM_OF_RECOMMENDATIONS) // Get twice as many for diversity function
      .map(([slug]) => slug);

    logger.info("🏆 Top recommendation slugs:", topSlugs);

    let rankedMovies = [];

    if (topSlugs.length > 0) {
      logger.info(`🏆 Formatting ${topSlugs.length} top recommendations`);
      // Add scores and format genres
      rankedMovies = topSlugs.map((movieSlug) => {
        const movie = movieDetails.get(movieSlug);
        const genres = movieGenres.has(movieSlug) ? movieGenres.get(movieSlug) : [];
        const score = enhancedScores[movieSlug];

        logger.info(`🏆 Recommendation: ${movie?.title || movieSlug} (score: ${score.toFixed(2)}, genres: ${genres.join(", ")})`);

        return {
          ...movie,
          score: score,
          genres: genres,
          actors: [],
        };
      });

      // Sort by score
      rankedMovies.sort((a, b) => b.score - a.score);

      logger.info("🏆 Final ranked recommendations:");
      rankedMovies.forEach((movie, index) => {
        logger.info(`${index + 1}. ${movie.title} (score: ${movie.score.toFixed(2)}, year: ${movie.year}, genres: ${movie.genres.join(", ")})`);
      });
    } else {
      logger.warn("⚠️ No recommendations generated");
    }

    logger.info("✅ generateRecommendations completed successfully");
    logger.info(`📊 Final stats: ${rankedMovies.length} recommendations from ${inputMovieSlugs.length} input movies`);

    return rankedMovies;
  } catch (error) {
    logger.error("❌ Error in generateRecommendations:", error);
    logger.error("❌ Error stack:", error.stack);
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
export async function POST(req) {
  try {
    console.log("Processing enhanced recommendation request");
    const requestBody = await req.json();
    console.log("Request body:", requestBody);
    const inputSlugs = requestBody.inputSlugs || [];
    console.log("Input slugs:", inputSlugs);

    if (inputSlugs.length === 0) {
      return Response.json({ error: "No valid movie slugs provided" }, { status: 400 });
    }

    const recommendations = await generateRecommendations(inputSlugs);
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
