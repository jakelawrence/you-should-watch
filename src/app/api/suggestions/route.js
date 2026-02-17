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
  getUserSavedMovies,
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
  excludedMoviePenalty: 0.3,
  excludedMovieWeight: 0.5,
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

// NEW: Filter configurations for server-side filtering
const VIBE_CONFIG = {
  dark: { field: "darknessLevel", op: ">", val: 6 },
  light: { field: "darknessLevel", op: "<", val: 4 },
  intense: { field: "intensenessLevel", op: ">", val: 6 },
  chill: { field: "intensenessLevel", op: "<", val: 4 },
  funny: { field: "funninessLevel", op: ">", val: 6 },
  "slow-burn": { field: "slownessLevel", op: ">", val: 6 },
  "fast-pace": { field: "slownessLevel", op: "<", val: 4 },
};

const DURATION_CONFIG = {
  short: { max: 90 },
  medium: { min: 90, max: 150 },
  long: { min: 150 },
};

const DECADE_CONFIG = {
  "2020s": { min: 2020 },
  "2010s": { min: 2010, max: 2019 },
  "2000s": { min: 2000, max: 2009 },
  "1990s": { min: 1990, max: 1999 },
  "1980s": { min: 1980, max: 1989 },
  classic: { max: 1979 },
};

// ============================================================================
// SHARED UTILITIES
// ============================================================================

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return null;

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
      boost: 0.3,
    };
  }

  const inputSet = new Set(inputGenreIds);
  const candidateSet = new Set(candidateGenreIds);

  const sharedGenres = [...inputSet].filter((g) => candidateSet.has(g));
  const sharedCount = sharedGenres.length;

  let matchType;
  let boost;

  if (inputSet.size === candidateSet.size && sharedCount === inputSet.size) {
    matchType = "exact";
    boost = 3.0;
  } else if (sharedCount === inputSet.size) {
    matchType = "input-subset";
    boost = 2.0;
  } else if (sharedCount === candidateSet.size) {
    matchType = "candidate-subset";
    boost = 1.5;
  } else if (sharedCount > 0) {
    matchType = "partial";
    const overlapPercent = sharedCount / Math.max(inputSet.size, candidateSet.size);
    boost = 1.0 + overlapPercent;
  } else {
    matchType = "none";
    boost = 0.3;
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

async function runCollaborative(inputMovieSlugs, excludeSlugs = [], overrides = {}) {
  const config = { ...COLLAB_CONFIG, ...overrides };
  if (!inputMovieSlugs?.length) return [];

  const userInteractions = {};
  const excludeUserInteractions = {};

  const inputMoviesMap = await getMovies(inputMovieSlugs);
  const inputMovies = Array.from(inputMoviesMap.values());

  // Step 1: Map Users for INPUT movies
  for (const slug of inputMovieSlugs) {
    const [likes, favorites] = await Promise.all([getMovieLikedUsers(slug), getMovieFavoritedUsers(slug)]);

    likes.forEach((u) => {
      userInteractions[u] = userInteractions[u] || {
        inputLikeCount: 0,
        inputFavoriteCount: 0,
        affinityScore: 1.0,
        otherMovies: new Map(),
        likedExcluded: false,
        excludedScore: 0,
      };
      userInteractions[u].inputLikeCount++;
    });

    favorites.forEach((u) => {
      userInteractions[u] = userInteractions[u] || {
        inputLikeCount: 0,
        inputFavoriteCount: 0,
        affinityScore: 1.0,
        otherMovies: new Map(),
        likedExcluded: false,
        excludedScore: 0,
      };
      userInteractions[u].inputFavoriteCount++;
    });
  }

  // Step 1b: Map Users for EXCLUDED movies
  if (excludeSlugs?.length > 0) {
    console.log(`Processing ${excludeSlugs.length} excluded movies for negative signals`);

    for (const slug of excludeSlugs) {
      const [likes, favorites] = await Promise.all([getMovieLikedUsers(slug), getMovieFavoritedUsers(slug)]);

      likes.forEach((u) => {
        excludeUserInteractions[u] = excludeUserInteractions[u] || { likeCount: 0, favoriteCount: 0 };
        excludeUserInteractions[u].likeCount++;
      });

      favorites.forEach((u) => {
        excludeUserInteractions[u] = excludeUserInteractions[u] || { likeCount: 0, favoriteCount: 0 };
        excludeUserInteractions[u].favoriteCount++;
      });
    }

    // Apply penalties
    Object.keys(userInteractions).forEach((u) => {
      if (excludeUserInteractions[u]) {
        userInteractions[u].likedExcluded = true;

        const excludeLikes = excludeUserInteractions[u].likeCount;
        const excludeFavorites = excludeUserInteractions[u].favoriteCount;

        const excludePenalty = (excludeLikes + excludeFavorites * config.favoriteWeight) * config.excludedMovieWeight;
        userInteractions[u].excludedScore = excludePenalty;

        userInteractions[u].affinityScore *= config.excludedMoviePenalty;

        console.log(`User ${u}: liked input & excluded movies, affinity reduced by ${(1 - config.excludedMoviePenalty) * 100}%`);
      }
    });
  }

  // Step 2 & 3: Affinity & Fetch other movies
  const usernames = Object.keys(userInteractions);
  if (!usernames.length) return [];

  const [allLikes, allFavorites] = await Promise.all([getUsersLikes(usernames), getUsersFavorites(usernames)]);

  usernames.forEach((u) => {
    let data = userInteractions[u];

    const boostMultiplier = data.likedExcluded ? 0.5 : 1.0;

    if (data.inputLikeCount >= 2) data.affinityScore *= Math.pow(config.likedBothMoviesBoost, boostMultiplier);
    if (data.inputFavoriteCount >= 1) data.affinityScore *= Math.pow(config.favoritedInputMovieBoost, boostMultiplier);
    if (data.inputFavoriteCount >= 1 && data.inputLikeCount >= 2) {
      data.affinityScore *= Math.pow(config.combinedBoost, boostMultiplier);
    }

    const excludeSet = new Set([...inputMovieSlugs, ...(excludeSlugs || [])]);

    (allLikes.get(u) || []).forEach((s) => {
      if (!excludeSet.has(s)) {
        data.otherMovies.set(s, "like");
      }
    });

    (allFavorites.get(u) || []).forEach((s) => {
      if (!excludeSet.has(s)) {
        data.otherMovies.set(s, "favorite");
      }
    });
  });

  // Step 4 & 5: Scoring
  const candidateScores = new Map();
  for (const [u, data] of Object.entries(userInteractions)) {
    for (const [slug, type] of data.otherMovies) {
      if (!candidateScores.has(slug)) {
        candidateScores.set(slug, {
          score: 0,
          total: 0,
          fromExcludedUsers: 0,
          fromCleanUsers: 0,
        });
      }

      const item = candidateScores.get(slug);
      const interactionScore = (type === "favorite" ? config.favoriteWeight : 1.0) * data.affinityScore;

      item.score += interactionScore;
      item.total++;

      if (data.likedExcluded) {
        item.fromExcludedUsers++;
      } else {
        item.fromCleanUsers++;
      }
    }
  }

  const filtered = Array.from(candidateScores.entries()).filter(([_, d]) => d.total >= config.minInteractionsThreshold);
  const details = await getMovies(filtered.map((f) => f[0]));
  const avgPop = 10000;
  const inputAvgDark = calculateAverageDarkness(inputMovies);

  const inputGenres = inputMovies.flatMap((m) => m.genreIds || []);
  const uniqueInputGenres = [...new Set(inputGenres)];

  return filtered
    .map(([slug, data]) => {
      const m = details.get(slug);

      const genreMatch = calculateGenreSimilarity(uniqueInputGenres, m?.genreIds || []);

      let finalScore = applyDarknessScoring(data.score, inputAvgDark, m?.darknessLevel, config);
      finalScore = applyObscurityBias(finalScore, m?.popularity || avgPop, avgPop, config.obscurityBias);
      finalScore *= genreMatch.boost;

      if (data.fromExcludedUsers > data.fromCleanUsers) {
        const excludeRatio = data.fromExcludedUsers / data.total;
        const excludePenalty = 1.0 - excludeRatio * 0.5;
        finalScore *= excludePenalty;
        console.log(
          `Movie ${slug}: ${data.fromExcludedUsers}/${data.total} from excluded users, applying ${((1 - excludePenalty) * 100).toFixed(1)}% penalty`,
        );
      }

      return {
        ...m,
        slug,
        recommendationScore: finalScore,
        genreMatchType: genreMatch.matchType,
        sharedGenres: genreMatch.sharedIds,
        genreBoost: genreMatch.boost,
        fromExcludedUsers: data.fromExcludedUsers,
        fromCleanUsers: data.fromCleanUsers,
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

    const userId = req.headers.get("x-user-id");
    const isAuthenticated = !!userId;

    const rateLimitKey = getRateLimitKey(ip, userId);
    const rateLimit = checkRateLimit(rateLimitKey, isAuthenticated);

    console.log(`Rate limit check for ${isAuthenticated ? "user " + userId : "IP " + ip}:`, rateLimit);

    const body = await req.json();
    const {
      mode,
      inputSlugs,
      excludeSlugs,
      moodParams,
      configOverrides,
      // NEW: Filter parameters
      genres = [],
      vibes = [],
      duration = null,
      decade = null,
      minRating = 0,
    } = body;

    let recommendations = [];

    switch (mode) {
      case "collaborative":
        recommendations = await runCollaborative(inputSlugs, excludeSlugs || [], configOverrides);
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
    console.log(`Before filtering: ${beforeCount} movies`);

    // ── Apply server-side filters ──────────────────────────────────────────

    // Genre filter
    if (genres.length > 0) {
      recommendations = recommendations.filter((m) => {
        const movieGenres = (m.genres || m.genreNames || []).map((g) => g.toLowerCase());
        return genres.some((g) => movieGenres.includes(g.toLowerCase()));
      });
      console.log(`After genre filter (${genres.join(", ")}): ${recommendations.length} movies`);
    }

    // Vibe filters
    if (vibes.length > 0) {
      vibes.forEach((vibeKey) => {
        const vibe = VIBE_CONFIG[vibeKey];
        if (!vibe) return;
        recommendations = recommendations.filter((m) => {
          const val = m[vibe.field] ?? 5;
          return vibe.op === ">" ? val > vibe.val : val < vibe.val;
        });
      });
      console.log(`After vibe filters (${vibes.join(", ")}): ${recommendations.length} movies`);
    }

    // Duration filter
    if (duration) {
      const dur = DURATION_CONFIG[duration];
      if (dur) {
        recommendations = recommendations.filter((m) => {
          if (dur.min && m.duration < dur.min) return false;
          if (dur.max && m.duration > dur.max) return false;
          return true;
        });
        console.log(`After duration filter (${duration}): ${recommendations.length} movies`);
      }
    }

    // Decade filter
    if (decade) {
      const dec = DECADE_CONFIG[decade];
      if (dec) {
        recommendations = recommendations.filter((m) => {
          const y = parseInt(m.year);
          if (dec.min && y < dec.min) return false;
          if (dec.max && y > dec.max) return false;
          return true;
        });
        console.log(`After decade filter (${decade}): ${recommendations.length} movies`);
      }
    }

    // Min rating filter
    if (minRating > 0) {
      recommendations = recommendations.filter((m) => (m.averageRating ?? 0) >= minRating);
      console.log(`After min rating filter (${minRating}+): ${recommendations.length} movies`);
    }

    // ── User bookmarks ──────────────────────────────────────────────────────

    const user = await getUserFromToken();
    console.log("Authenticated user for filtering:", user);

    let userBookmarkedSlugs = [];
    if (user && user.username) {
      try {
        const bookmarksData = await getUserSavedMovies(user.username);
        userBookmarkedSlugs = bookmarksData.savedMovies || [];
        console.log(`User has ${userBookmarkedSlugs.length} bookmarked movies`);
      } catch (error) {
        console.error("Failed to fetch user bookmarks:", error);
      }
    }

    const bookmarkedSet = new Set(userBookmarkedSlugs);
    recommendations = recommendations.map((movie) => ({
      ...movie,
      isBookmarkedByUser: bookmarkedSet.has(movie.slug),
    }));

    // ── Streaming service filter ────────────────────────────────────────────

    let streamingServices = [];
    if (user) {
      streamingServices = await getUserSelectedStreamingServces(user.email);
    }

    console.log("User streaming services for filtering:", streamingServices);

    let afterCount = recommendations.length;
    if (streamingServices && streamingServices.length > 0) {
      console.log("Applying streaming services filter:", streamingServices);
      recommendations = filterByStreamingServices(recommendations, streamingServices);
      afterCount = recommendations.length;
      console.log(`Filtered from ${beforeCount} to ${afterCount} movies by streaming services`);
    }

    recommendations = recommendations.slice(0, 50); // Return more for /search page

    return Response.json({
      recommendations,
      filteredByStreaming: streamingServices?.length > 0,
      originalCount: beforeCount,
      filteredCount: afterCount,
      userStreamingServices: streamingServices,
      excludedMoviesCount: excludeSlugs?.length || 0,
      userBookmarksCount: userBookmarkedSlugs.length,
      filtersApplied: {
        genres: genres.length,
        vibes: vibes.length,
        duration: !!duration,
        decade: !!decade,
        minRating: minRating > 0,
      },
    });
  } catch (error) {
    logger.error("Route Error:", error);
    const status = error instanceof DatabaseError ? 503 : 500;
    return Response.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
