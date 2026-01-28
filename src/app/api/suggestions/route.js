import { NextResponse } from "next/server";
import { DatabaseError } from "../../api/lib/db";
import { logger } from "../lib/logger";
import {
  getMovies,
  getMovieFavoritedUsers,
  getMovieLikedUsers,
  getUsersFavorites,
  getUsersLikes,
  getMoviesByFilter,
  getUserSelectedStreamingServces,
} from "../lib/dynamodb";
import { filterByStreamingServices } from "../lib/streamingFilters";
import { checkRateLimit, getRateLimitKey } from "../lib/rate-limiting";
import { getClientIp } from "../lib/utils";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

// ============================================================================
// CONFIGURATIONS
// ============================================================================

const COLLAB_CONFIG = {
  numRecommendations: 6,
  likedBothMoviesBoost: 5.0,
  favoritedInputMovieBoost: 5.0,
  combinedBoost: 10.0,
  favoriteWeight: 2.0,
  obscurityBias: 1.5,
  minInteractionsThreshold: 2,
  darknessMatchWeight: 1.0,
  darknessTolerance: 3.0,
};

const MOOD_FILTERS = {
  tone: {
    light: { field: "darknessLevel", operator: "<", value: 4 },
    dark: { field: "darknessLevel", operator: ">", value: 6 },
  },
  style: {
    serious: { field: "funninessLevel", operator: "<", value: 4 },
    comedy: { field: "funninessLevel", operator: ">", value: 6 },
  },
  popularity: {
    popular: { field: "popularity", operator: "<", value: 500 },
    "hidden-gem": { field: "popularity", operator: ">", value: 500 },
  },
  duration: {
    long: { field: "duration", operator: ">", value: 140 },
    short: { field: "duration", operator: "<", value: 100 },
  },
  pace: {
    fast: { field: "slownessLevel", operator: "<", value: 4 },
    slow: { field: "slownessLevel", operator: ">", value: 6 },
  },
  emotion: {
    uplifting: { field: "intensenessLevel", operator: "<", value: 4 },
    intense: { field: "intensenessLevel", operator: ">", value: 6 },
  },
};

// ============================================================================
// SHARED UTILITIES
// ============================================================================

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    console.log("Auth token from cookies:", token);

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    return decoded;
  } catch (error) {
    return null;
  }
}

function applyObscurityBias(score, moviePopularityRank, avgPopularityRank, bias) {
  if (bias === 1.0) return score;
  const popularityRatio = moviePopularityRank / avgPopularityRank;
  return score * Math.pow(popularityRatio, bias - 1.0);
}

function calculateAverageDarkness(inputMovies) {
  const darkLevels = inputMovies.map((m) => m.darknessLevel).filter((d) => d !== null && d !== undefined && !isNaN(d));
  return darkLevels.length === 0 ? 5.0 : darkLevels.reduce((a, b) => a + b, 0) / darkLevels.length;
}

function applyDarknessScoring(baseScore, inputDarkness, candidateDarkness, config) {
  if (config.darknessMatchWeight === 0 || candidateDarkness == null) return baseScore;
  const difference = Math.abs(inputDarkness - candidateDarkness);
  let similarity =
    difference <= config.darknessTolerance ? 1.0 : Math.max(0, 1.0 - (difference - config.darknessTolerance) / (4.0 - config.darknessTolerance));
  return baseScore * (1.0 + config.darknessMatchWeight * (2 * similarity - 1));
}

function calculateGenreSimilarity(inputGenreIds, candidateGenreIds) {
  if (!inputGenreIds?.length || !candidateGenreIds?.length) {
    return {
      matchType: "none",
      sharedCount: 0,
      sharedIds: [],
      boost: 0.3, // Heavy penalty for no genre overlap
    };
  }

  const inputSet = new Set(inputGenreIds);
  const candidateSet = new Set(candidateGenreIds);

  const sharedGenres = [...inputSet].filter((g) => candidateSet.has(g));
  const sharedCount = sharedGenres.length;

  // Determine match type
  let matchType;
  let boost;

  // Type 1: Exact same genres (both direction)
  if (inputSet.size === candidateSet.size && sharedCount === inputSet.size) {
    matchType = "exact";
    boost = 3.0; // 3x boost for exact match
  }
  // Type 2: Candidate contains all input genres (candidate is superset)
  else if (sharedCount === inputSet.size) {
    matchType = "input-subset";
    boost = 2.0; // 2x boost - candidate has all our genres plus more
  }
  // Type 3: Input contains all candidate genres (input is superset)
  else if (sharedCount === candidateSet.size) {
    matchType = "candidate-subset";
    boost = 1.5; // 1.5x boost - we have all their genres plus more
  }
  // Partial overlap
  else if (sharedCount > 0) {
    matchType = "partial";
    // Boost based on percentage of overlap
    const overlapPercent = sharedCount / Math.max(inputSet.size, candidateSet.size);
    boost = 1.0 + overlapPercent; // 1.0x to 2.0x based on overlap
  }
  // No overlap
  else {
    matchType = "none";
    boost = 0.3; // 70% penalty
  }

  return {
    matchType,
    sharedCount,
    sharedIds: sharedGenres,
    boost,
    inputGenreCount: inputSet.size,
    candidateGenreCount: candidateSet.size,
  };
}

// ============================================================================
// CORE LOGIC FUNCTIONS
// ============================================================================

async function runCollaborative(inputMovieSlugs, overrides = {}) {
  const config = { ...COLLAB_CONFIG, ...overrides };
  if (!inputMovieSlugs?.length) return [];

  const userInteractions = {};
  const inputMoviesMap = await getMovies(inputMovieSlugs);
  const inputMovies = Array.from(inputMoviesMap.values());

  // Step 1: Map Users
  for (const slug of inputMovieSlugs) {
    const [likes, favorites] = await Promise.all([getMovieLikedUsers(slug), getMovieFavoritedUsers(slug)]);
    likes.forEach((u) => {
      userInteractions[u] = userInteractions[u] || { inputLikeCount: 0, inputFavoriteCount: 0, affinityScore: 1.0, otherMovies: new Map() };
      userInteractions[u].inputLikeCount++;
    });
    favorites.forEach((u) => {
      userInteractions[u] = userInteractions[u] || { inputLikeCount: 0, inputFavoriteCount: 0, affinityScore: 1.0, otherMovies: new Map() };
      userInteractions[u].inputFavoriteCount++;
    });
  }

  // Step 2 & 3: Affinity & Fetch other movies
  const usernames = Object.keys(userInteractions);
  if (!usernames.length) return [];

  const [allLikes, allFavorites] = await Promise.all([getUsersLikes(usernames), getUsersFavorites(usernames)]);

  usernames.forEach((u) => {
    let data = userInteractions[u];
    if (data.inputLikeCount >= 2) data.affinityScore *= config.likedBothMoviesBoost;
    if (data.inputFavoriteCount >= 1) data.affinityScore *= config.favoritedInputMovieBoost;
    if (data.inputFavoriteCount >= 1 && data.inputLikeCount >= 2) data.affinityScore *= config.combinedBoost;

    (allLikes.get(u) || []).forEach((s) => !inputMovieSlugs.includes(s) && data.otherMovies.set(s, "like"));
    (allFavorites.get(u) || []).forEach((s) => !inputMovieSlugs.includes(s) && data.otherMovies.set(s, "favorite"));
  });

  // Step 4 & 5: Scoring
  const candidateScores = new Map();
  for (const [u, data] of Object.entries(userInteractions)) {
    for (const [slug, type] of data.otherMovies) {
      if (!candidateScores.has(slug)) candidateScores.set(slug, { score: 0, total: 0 });
      const item = candidateScores.get(slug);
      item.score += (type === "favorite" ? config.favoriteWeight : 1.0) * data.affinityScore;
      item.total++;
    }
  }

  const filtered = Array.from(candidateScores.entries()).filter(([_, d]) => d.total >= config.minInteractionsThreshold);
  const details = await getMovies(filtered.map((f) => f[0]));
  const avgPop = 10000; // Simplified for brevity, can calculate as in original
  const inputAvgDark = calculateAverageDarkness(inputMovies);

  // Get input movie keywords for comparison
  const inputGenres = inputMovies.flatMap((m) => m.genreIds || []);
  const uniqueInputGenres = [...new Set(inputGenres)];

  // Calculate scores with keyword matching
  return filtered
    .map(([slug, data]) => {
      const m = details.get(slug);

      // Calculate genre similarity
      const genreMatch = calculateGenreSimilarity(uniqueInputGenres, m?.genreIds || []);

      let finalScore = applyDarknessScoring(data.score, inputAvgDark, m?.darknessLevel, config);
      finalScore = applyObscurityBias(finalScore, m?.popularity || avgPop, avgPop, config.obscurityBias);
      finalScore *= genreMatch.boost; // Apply genre boost

      return {
        ...m,
        slug,
        recommendationScore: finalScore,
        genreMatchType: genreMatch.matchType,
        sharedGenres: genreMatch.sharedIds,
        genreBoost: genreMatch.boost,
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

async function runMood(moodParams) {
  const filters = {};
  Object.entries(moodParams).forEach(([cat, val]) => {
    if (MOOD_FILTERS[cat]?.[val]) {
      const cfg = MOOD_FILTERS[cat][val];
      filters[cfg.field] = { operator: cfg.operator, value: cfg.value };
    }
  });

  let matches = await getMoviesByFilter(filters);
  if (matches.length < 6) {
    delete filters.popularity;
    matches = await getMoviesByFilter(filters);
  }

  return matches
    .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    .slice(0, 200)
    .sort(() => 0.5 - Math.random());
}

async function runSurprise() {
  const final = [];
  const WINDOW = 200;
  for (let i = 0; i < 6; i++) {
    const movies = await getMoviesByFilter({
      popularity: { operator: "BETWEEN", value: [WINDOW * i, WINDOW * (i + 1)] },
    });
    if (movies.length) final.push(movies[Math.floor(Math.random() * movies.length)]);
  }
  return final;
}

// ============================================================================
// MAIN ROUTE HANDLER
// ============================================================================

export async function POST(req) {
  try {
    const ip = getClientIp(req);

    // Check if user is authenticated (you'll implement this with your auth system)
    const userId = req.headers.get("x-user-id"); // Or get from session/JWT
    const isAuthenticated = !!userId;

    // Rate limit check
    const rateLimitKey = getRateLimitKey(ip, userId);
    const rateLimit = checkRateLimit(rateLimitKey, isAuthenticated);

    console.log(`Rate limit check for ${isAuthenticated ? "user " + userId : "IP " + ip}:`, rateLimit);

    // if (!rateLimit.allowed) {
    //   return NextResponse.json(
    //     {
    //       error: "Rate limit exceeded",
    //       message: `You've reached your ${isAuthenticated ? "daily" : "free"} limit. ${
    //         isAuthenticated ? "Try again later." : "Create an account for more suggestions!"
    //       }`,
    //       retryAfter: rateLimit.retryAfter,
    //       requiresAuth: !isAuthenticated,
    //     },
    //     {
    //       status: 429,
    //       headers: {
    //         "X-RateLimit-Limit": isAuthenticated ? "50" : "30",
    //         "X-RateLimit-Remaining": rateLimit.remaining.toString(),
    //         "X-RateLimit-Reset": new Date(rateLimit.resetAt).toISOString(),
    //         "Retry-After": rateLimit.retryAfter.toString(),
    //       },
    //     }
    //   );
    // }

    const body = await req.json();
    const { mode, inputSlugs, moodParams, configOverrides } = body;

    let recommendations = [];

    switch (mode) {
      case "collaborative":
        recommendations = await runCollaborative(inputSlugs, configOverrides);
        break;
      case "mood":
        recommendations = await runMood(moodParams);
        break;
      case "surprise":
        recommendations = await runSurprise();
        break;
      default:
        return Response.json({ error: "Invalid recommendation mode" }, { status: 400 });
    }

    let beforeCount = recommendations.length;
    let afterCount;
    console.log(
      `Top 10 Before filtering (${beforeCount} total):`,
      recommendations.slice(0, 10).map((m) => m.slug)
    );

    const user = await getUserFromToken();
    console.log("Authenticated user for filtering:", user);
    let streamingServices = [];
    // if (user) {
    //   streamingServices = await getUserSelectedStreamingServces(user.email);
    // }
    console.log("User streaming services for filtering:", streamingServices);
    if (streamingServices && streamingServices.length > 0) {
      console.log("Applying streaming services filter:", streamingServices);
      beforeCount = recommendations.length;
      recommendations = filterByStreamingServices(recommendations, streamingServices);
      afterCount = recommendations.length;
      console.log(`Filtered from ${beforeCount} to ${afterCount} movies by streaming services`);
    }
    recommendations = recommendations.slice(0, 6);

    return Response.json({
      recommendations,
      filteredByStreaming: streamingServices?.length > 0,
      originalCount: beforeCount,
      filteredCount: afterCount,
      userStreamingServices: streamingServices,
    });
  } catch (error) {
    logger.error("Route Error:", error);
    const status = error instanceof DatabaseError ? 503 : 500;
    return Response.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
