import { DatabaseError } from "../../api/lib/db";
import { logger } from "../lib/logger";
import { getMultiSeedEmbeddingRecommendations, getMoviesByFilter } from "../lib/movieRepository";
import { getUserSelectedStreamingServces, getUserSavedMovies } from "../lib/userRepository";
import { filterByStreamingServices } from "../lib/streamingFilters";
import { checkRateLimit, getRateLimitKey } from "../lib/rate-limiting";
import { getClientIp } from "../lib/utils";
import { cache } from "../lib/cache";
import { auth } from "@/auth";

// ============================================================================
// CONFIGURATIONS
// ============================================================================

const EMBEDDING_CANDIDATE_LIMIT = Number.parseInt(process.env.EMBEDDING_RECOMMENDER_CANDIDATE_LIMIT || "250", 10);

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

async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session.user;
}

function getDisplayTitle(movie) {
  return typeof movie?.title === "string" && movie.title.trim() ? movie.title.trim() : null;
}

// ============================================================================
// CORE LOGIC FUNCTIONS
// ============================================================================

async function runEmbeddingCollaborative(inputMovieSlugs, excludeSlugs = []) {
  const recommendations = await getMultiSeedEmbeddingRecommendations({
    seedSlugs: inputMovieSlugs,
    excludeSlugs,
    limit: Number.isFinite(EMBEDDING_CANDIDATE_LIMIT) ? EMBEDDING_CANDIDATE_LIMIT : 250,
    region: "US",
  });

  return {
    recommendations: recommendations
      .filter((movie) => getDisplayTitle(movie))
      .map((movie, index) => ({
        ...movie,
        recommendationScore: movie.recommendationScore ?? 1 / (index + 1),
        recommendationRank: index + 1,
      })),
    userInteractions: {},
  };
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
// CACHE HELPERS
// ============================================================================

function moodCacheKey(moodParams) {
  const sorted = Object.keys(moodParams)
    .sort()
    .reduce((acc, k) => {
      if (moodParams[k]) acc[k] = moodParams[k];
      return acc;
    }, {});
  return `mood:${JSON.stringify(sorted)}`;
}

function embeddingCacheKey(inputSlugs, excludeSlugs) {
  const input = [...inputSlugs].sort().join(",");
  const exclude = [...(excludeSlugs || [])].sort().join(",");
  return `embedding:${input}:${exclude}:${EMBEDDING_CANDIDATE_LIMIT}`;
}

function stripInternalRecommendationFields(movie) {
  const { embeddingDistance, _embeddingDistance, embedding_distance, ...publicMovie } = movie;
  return publicMovie;
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
      // NEW: Filter parameters
      genres = [],
      vibes = [],
      duration = null,
      decade = null,
      minRating = 0,
      filterStreamingServices = false,
    } = body;

    let recommendations = [];
    let userInteractions = {};

    switch (mode) {
      case "collaborative": {
        const cacheKey = embeddingCacheKey(inputSlugs, excludeSlugs);
        const cached = cache.get(cacheKey);
        if (cached) {
          ({ recommendations, userInteractions } = cached);
          logger.info(`Cache hit: ${cacheKey}`);
        } else {
          const result = await runEmbeddingCollaborative(inputSlugs, excludeSlugs || []);
          recommendations = result.recommendations;
          userInteractions = result.userInteractions;
          cache.set(cacheKey, { recommendations, userInteractions });
          logger.info(`Cache set: ${cacheKey}`);
        }
        break;
      }
      case "mood": {
        const cacheKey = moodCacheKey(moodParams);
        const cached = cache.get(cacheKey);
        if (cached) {
          recommendations = cached;
          logger.info(`Cache hit: ${cacheKey}`);
        } else {
          recommendations = await runMood(moodParams);
          cache.set(cacheKey, recommendations);
          logger.info(`Cache set: ${cacheKey}`);
        }
        break;
      }
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

    const user = await getAuthenticatedUser();
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
    if (filterStreamingServices && streamingServices && streamingServices.length > 0) {
      console.log("Applying streaming services filter:", streamingServices);
      recommendations = filterByStreamingServices(recommendations, streamingServices);
      afterCount = recommendations.length;
      console.log(`Filtered from ${beforeCount} to ${afterCount} movies by streaming services`);
    }

    recommendations = recommendations.slice(0, 50).map(stripInternalRecommendationFields); // Return more for /search page
    console.log(`Final recommendation count after all filters: ${recommendations.length}`);
    console.log(
      "Final recommendations:",
      recommendations.map((m) => ({ slug: m.slug, title: m.title })),
    );
    return Response.json({
      recommendations,
      filteredByStreaming: !!filterStreamingServices && streamingServices?.length > 0,
      originalCount: beforeCount,
      filteredCount: afterCount,
      userStreamingServices: streamingServices,
      excludedMoviesCount: excludeSlugs?.length || 0,
      userBookmarksCount: userBookmarkedSlugs.length,
      userInteractions,
      filtersApplied: {
        genres: genres.length,
        vibes: vibes.length,
        duration: !!duration,
        decade: !!decade,
        minRating: minRating > 0,
        streamingServices: !!filterStreamingServices,
      },
    });
  } catch (error) {
    logger.error("Route Error:", error);
    const status = error instanceof DatabaseError ? 503 : 500;
    return Response.json({ error: error.message || "Internal Server Error" }, { status });
  }
}
