import { NextResponse } from "next/server";
import { DatabaseError } from "../../api/lib/db";
import { logger } from "../lib/logger";
import { getMovies, getMovieFavoritedUsers, getMovieLikedUsers, getUsersFavorites, getUsersLikes } from "../lib/dynamodb";

// ============================================================================
// ALGORITHM PARAMETERS
// ============================================================================

const CONFIG = {
  // Number of recommendations to return
  numRecommendations: 5,

  // User affinity weights (how much to boost based on user engagement)
  likedBothMoviesBoost: 3.0, // User liked 2+ input movies
  favoritedInputMovieBoost: 5.0, // User favorited an input movie
  combinedBoost: 8.0, // User favorited AND liked multiple (multiplicative)

  // How to weight favorites vs likes in final scoring
  favoriteWeight: 2.0, // Favorites count 2x more than likes

  // Obscurity control (0.0 = only popular, 1.0 = equal weight to all, 2.0 = favor obscure)
  obscurityBias: 1.5, // Adjust this to control recommendation obscurity

  // Minimum interactions for a movie to be recommended
  minInteractionsThreshold: 2, // Movie must have at least this many likes/favorites
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate obscurity-adjusted score
 * Note: Lower popularity number = more popular movie
 * - obscurityBias < 1.0: Favor popular movies (lower popularity numbers)
 * - obscurityBias = 1.0: No bias
 * - obscurityBias > 1.0: Favor obscure movies (higher popularity numbers)
 */
function applyObscurityBias(score, moviePopularityRank, avgPopularityRank, bias) {
  if (bias === 1.0) return score;

  // Since lower rank = more popular, we invert the ratio for obscure movies
  // For popular movies (low rank), we want to boost when bias < 1.0
  // For obscure movies (high rank), we want to boost when bias > 1.0
  const popularityRatio = moviePopularityRank / avgPopularityRank;
  const obscurityFactor = Math.pow(popularityRatio, bias - 1.0);

  return score * obscurityFactor;
}

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

async function generateRecommendations(inputMovieSlugs) {
  logger.log("🚀 Pure collaborative filtering started");
  logger.log("📥 Input movie slugs:", inputMovieSlugs);
  logger.log("⚙️ Config:", CONFIG);

  if (!inputMovieSlugs || inputMovieSlugs.length === 0) {
    logger.warn("⚠️ No input movie slugs provided");
    return [];
  }

  try {
    // ========================================================================
    // STEP 1: Gather users who liked/favorited input movies
    // ========================================================================
    logger.info("👥 STEP 1: Finding users who interacted with input movies");

    const userInteractions = {};
    // Structure: username -> {
    //   inputLikeCount: number,
    //   inputFavoriteCount: number,
    //   affinityScore: number,
    //   otherMovies: Map(slug -> 'like'|'favorite')
    // }

    // Get users who liked each input movie
    for (const movieSlug of inputMovieSlugs) {
      const likedUsers = await getMovieLikedUsers(movieSlug);
      logger.info(`👍 ${likedUsers.length} users liked ${movieSlug}`);

      likedUsers.forEach((username) => {
        if (!userInteractions[username]) {
          userInteractions[username] = {
            inputLikeCount: 0,
            inputFavoriteCount: 0,
            affinityScore: 1.0,
            otherMovies: new Map(),
          };
        }
        userInteractions[username].inputLikeCount++;
      });
    }

    // Get users who favorited each input movie
    for (const movieSlug of inputMovieSlugs) {
      const favoritedUsers = await getMovieFavoritedUsers(movieSlug);
      logger.info(`⭐ ${favoritedUsers.length} users favorited ${movieSlug}`);

      favoritedUsers.forEach((username) => {
        if (!userInteractions[username]) {
          userInteractions[username] = {
            inputLikeCount: 0,
            inputFavoriteCount: 0,
            affinityScore: 1.0,
            otherMovies: new Map(),
          };
        }
        userInteractions[username].inputFavoriteCount++;
      });
    }

    const totalUsers = Object.keys(userInteractions).length;
    logger.info(`👥 Total users who interacted: ${totalUsers}`);

    if (totalUsers === 0) {
      logger.warn("⚠️ No users found who interacted with input movies");
      return [];
    }

    // ========================================================================
    // STEP 2: Calculate user affinity scores
    // ========================================================================
    logger.info("📊 STEP 2: Calculating user affinity scores");

    for (const [username, data] of Object.entries(userInteractions)) {
      let affinityScore = 1.0;

      // Boost for liking multiple input movies
      if (data.inputLikeCount >= 2) {
        affinityScore *= CONFIG.likedBothMoviesBoost;
        logger.debug(`👤 ${username}: Liked ${data.inputLikeCount} inputs -> ${CONFIG.likedBothMoviesBoost}x boost`);
      }

      // Boost for favoriting any input movie
      if (data.inputFavoriteCount >= 1) {
        affinityScore *= CONFIG.favoritedInputMovieBoost;
        logger.debug(`👤 ${username}: Favorited ${data.inputFavoriteCount} inputs -> ${CONFIG.favoritedInputMovieBoost}x boost`);
      }

      // Combined boost (user both favorited AND liked multiple)
      if (data.inputFavoriteCount >= 1 && data.inputLikeCount >= 2) {
        affinityScore *= CONFIG.combinedBoost;
        logger.debug(`👤 ${username}: Combined engagement -> ${CONFIG.combinedBoost}x boost`);
      }

      data.affinityScore = affinityScore;
    }

    // Log top affinity users
    const topAffinityUsers = Object.entries(userInteractions)
      .sort((a, b) => b[1].affinityScore - a[1].affinityScore)
      .slice(0, 5);

    logger.info("🏆 Top affinity users:");
    topAffinityUsers.forEach(([username, data]) => {
      logger.info(`  ${username}: ${data.affinityScore.toFixed(2)}x (${data.inputLikeCount} likes, ${data.inputFavoriteCount} favorites)`);
    });

    // ========================================================================
    // STEP 3: Get other movies these users liked/favorited
    // ========================================================================
    logger.info("🎬 STEP 3: Fetching other movies from these users");

    const usernames = Object.keys(userInteractions);
    const usersOtherLikes = await getUsersLikes(usernames);
    const usersOtherFavorites = await getUsersFavorites(usernames);

    // Add to user interaction map
    for (const username of usernames) {
      const likes = usersOtherLikes.get(username) || [];
      const favorites = usersOtherFavorites.get(username) || [];

      likes.forEach((slug) => {
        if (!inputMovieSlugs.includes(slug)) {
          userInteractions[username].otherMovies.set(slug, "like");
        }
      });

      favorites.forEach((slug) => {
        if (!inputMovieSlugs.includes(slug)) {
          userInteractions[username].otherMovies.set(slug, "favorite");
        }
      });
    }

    // ========================================================================
    // STEP 4: Build candidate set and calculate scores
    // ========================================================================
    logger.info("🎯 STEP 4: Scoring candidate movies");

    const candidateScores = new Map(); // slug -> { score, likeCount, favoriteCount }

    for (const [username, data] of Object.entries(userInteractions)) {
      const { affinityScore, otherMovies } = data;

      for (const [movieSlug, interactionType] of otherMovies) {
        if (!candidateScores.has(movieSlug)) {
          candidateScores.set(movieSlug, {
            score: 0,
            likeCount: 0,
            favoriteCount: 0,
            totalInteractions: 0,
          });
        }

        const candidate = candidateScores.get(movieSlug);
        const baseScore = interactionType === "favorite" ? CONFIG.favoriteWeight : 1.0;
        const weightedScore = baseScore * affinityScore;

        candidate.score += weightedScore;
        candidate.totalInteractions++;

        if (interactionType === "favorite") {
          candidate.favoriteCount++;
        } else {
          candidate.likeCount++;
        }
      }
    }

    logger.info(`🎯 Found ${candidateScores.size} candidate movies`);

    // Filter by minimum interactions
    const filteredCandidates = Array.from(candidateScores.entries()).filter(([_, data]) => data.totalInteractions >= CONFIG.minInteractionsThreshold);

    logger.info(`✅ ${filteredCandidates.length} candidates after filtering (min ${CONFIG.minInteractionsThreshold} interactions)`);

    // ========================================================================
    // STEP 5: Get movie details to access popularity rankings
    // ========================================================================
    logger.info("📈 STEP 5: Fetching movie details for popularity rankings");

    const candidateSlugs = Array.from(candidateScores.keys());
    const candidateMovies = await getMovies(candidateSlugs);

    // Calculate average popularity rank
    let totalPopularityRank = 0;
    let moviesWithPopularity = 0;

    for (const [slug, movie] of candidateMovies) {
      if (movie && movie.popularity) {
        totalPopularityRank += movie.popularity;
        moviesWithPopularity++;
      }
    }

    const avgPopularityRank = moviesWithPopularity > 0 ? totalPopularityRank / moviesWithPopularity : 10000; // Default if no popularity data

    logger.info(`📈 Avg popularity rank: ${avgPopularityRank.toFixed(1)} (lower = more popular)`);

    // ========================================================================
    // STEP 6: Apply obscurity bias and rank
    // ========================================================================
    logger.info("🎨 STEP 6: Applying obscurity bias and ranking");

    const scoredCandidates = [];

    for (const [slug, data] of filteredCandidates) {
      const movie = candidateMovies.get(slug);
      if (!movie) {
        logger.warn(`⚠️ Movie not found: ${slug}`);
        continue;
      }

      const moviePopularityRank = movie.popularity || avgPopularityRank;
      const adjustedScore = applyObscurityBias(data.score, moviePopularityRank, avgPopularityRank, CONFIG.obscurityBias);

      scoredCandidates.push({
        slug,
        movie,
        score: adjustedScore,
        rawScore: data.score,
        popularityRank: moviePopularityRank,
        likeCount: data.likeCount,
        favoriteCount: data.favoriteCount,
        totalInteractions: data.totalInteractions,
      });
    }

    // Sort by adjusted score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // ========================================================================
    // STEP 7: Format final recommendations
    // ========================================================================
    logger.info("📚 STEP 7: Formatting final recommendations");

    const topCandidates = scoredCandidates.slice(0, CONFIG.numRecommendations);

    const finalRecommendations = topCandidates.map((candidate) => {
      return {
        ...candidate.movie,
        slug: candidate.slug,
        recommendationScore: candidate.score,
        scoreBreakdown: {
          rawScore: candidate.rawScore,
          adjustedScore: candidate.score,
          popularityRank: candidate.popularityRank,
          likeCount: candidate.likeCount,
          favoriteCount: candidate.favoriteCount,
          totalInteractions: candidate.totalInteractions,
        },
      };
    });

    logger.info("🏆 Final recommendations:");
    finalRecommendations.forEach((movie, i) => {
      logger.info(
        `${i + 1}. ${movie.title} (score: ${movie.recommendationScore.toFixed(2)}, popularity rank: ${movie.scoreBreakdown.popularityRank})`
      );
    });

    return finalRecommendations;
  } catch (error) {
    logger.error("❌ Error in generateRecommendations:", error);
    throw new DatabaseError("Failed to generate recommendations", "RECOMMENDATION_ERROR");
  }
}

// ============================================================================
// API ENDPOINT
// ============================================================================

export async function POST(req) {
  try {
    logger.log("Processing collaborative filtering recommendation request");
    const requestBody = await req.json();
    const inputSlugs = requestBody.inputSlugs || [];

    // Allow configuration overrides from request
    if (requestBody.obscurityBias !== undefined) {
      CONFIG.obscurityBias = requestBody.obscurityBias;
    }
    if (requestBody.numRecommendations !== undefined) {
      CONFIG.numRecommendations = requestBody.numRecommendations;
    }

    if (inputSlugs.length === 0) {
      return Response.json({ error: "No valid movie slugs provided" }, { status: 400 });
    }

    const recommendations = await generateRecommendations(inputSlugs);

    return Response.json({
      recommendations,
      metadata: {
        config: CONFIG,
        inputCount: inputSlugs.length,
      },
    });
  } catch (error) {
    logger.error("Recommendation error:", error);

    if (error instanceof DatabaseError) {
      return Response.json({ error: error.message, code: error.code }, { status: 503 });
    }

    return Response.json({ error: "Failed to generate recommendations" }, { status: 500 });
  }
}
