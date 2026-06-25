import { NextResponse } from "next/server";
import { DatabaseError } from "../lib/db";
import { validateQueryParams } from "../lib/validation";
import { cache } from "../lib/cache";
import { generateQueryEmbedding, QueryEmbeddingError } from "../lib/queryEmbeddings";
import {
  countSearchMovies,
  countSemanticSearchMovies,
  getMovie,
  searchMovieTitles,
  searchMovies,
  semanticSearchMovies,
} from "../lib/movieRepository";
import { toPostgresDatabaseError } from "../lib/postgres";

const SORT_OPTIONS = ["popularity", "alphabetical", "rating", "year", "releaseDate", "popularityRanking", "views"];
const VALID_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];
const SEARCH_MODES = ["keyword", "semantic"];

function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/&/g, "and")
    .replace(/['']/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasMinimumSearchLength(value) {
  return normalizeSearchText(value).replace(/\s/g, "").length >= 2;
}

const querySchema = {
  sortBy: { type: "enum", values: SORT_OPTIONS },
  limit: { type: "integer", min: 1, max: 100 },
  page: { type: "integer", min: 1 },
  genre: { type: "string" },
  nanogenre: { type: "string" },
  decade: { type: "integer" },
  minRating: { type: "number", min: 0, max: 5 },
  rating: { type: "enum", values: VALID_RATINGS },
  slug: { type: "string" },
  name: { type: "string" },
  searchMode: { type: "enum", values: SEARCH_MODES },
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const validationErrors = validateQueryParams(searchParams, querySchema);
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: "Invalid parameters", details: validationErrors }, { status: 400 });
    }

    const sortBy = searchParams.get("sortBy") || "popularity";
    const limit = parseInt(searchParams.get("limit")) || 10;
    const page = parseInt(searchParams.get("page")) || 1;
    const genre = searchParams.get("genre");
    const nanogenre = searchParams.get("nanogenre");
    const decade = searchParams.get("decade");
    const minRating = parseFloat(searchParams.get("minRating"));
    const rating = searchParams.get("rating");
    const slug = searchParams.get("slug");
    const title = searchParams.get("title");
    const searchMode = searchParams.get("searchMode") || "keyword";

    const offset = (page - 1) * limit;

    // Generate cache key based on query parameters
    const cacheKey = `movies:${searchMode}:${sortBy}:${limit}:${page}:${genre}:${nanogenre}:${decade}:${minRating}:${rating}:${slug}:${title}`;

    // Check cache
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    // Slug lookup — direct GetItem by primary key, no scan needed
    if (slug) {
      const movie = await getMovie(slug);
      const result = {
        movies: movie ? [movie] : [],
        total: movie ? 1 : 0,
        page: 1,
        limit,
        hasMore: false,
      };
      cache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    if (searchMode === "semantic") {
      if (!title || !title.trim()) {
        return NextResponse.json({ error: "Semantic search requires a title query." }, { status: 400 });
      }

      if (!hasMinimumSearchLength(title)) {
        const result = {
          movies: [],
          total: 0,
          page,
          limit,
          hasMore: false,
        };
        cache.set(cacheKey, result);
        return NextResponse.json(result);
      }

      const { vector } = await generateQueryEmbedding(title);
      const semanticFilters = {
        genre,
        nanogenre,
        decade,
        minRating: Number.isFinite(minRating) ? minRating : null,
        rating,
      };
      const [semanticMovies, fuzzyTitleMatches, total] = await Promise.all([
        semanticSearchMovies({
          queryEmbedding: vector,
          title,
          ...semanticFilters,
          limit: limit + 5,
          offset,
          region: "US",
        }),
        searchMovieTitles({
          title,
          limit: 3,
          region: "US",
        }),
        countSemanticSearchMovies(semanticFilters),
      ]);
      const seenSlugs = new Set();
      const movies = [...fuzzyTitleMatches, ...semanticMovies]
        .filter((movie) => {
          const slug = movie.slug || movie.movie_slug;
          if (!slug || seenSlugs.has(slug)) return false;
          seenSlugs.add(slug);
          return true;
        })
        .slice(0, limit);

      const result = {
        movies,
        total,
        page,
        limit,
        hasMore: offset + limit < total,
      };

      cache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    if (title && !hasMinimumSearchLength(title)) {
      const result = {
        movies: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      };
      cache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    const hasSearchFilters = Boolean(genre || nanogenre || decade || Number.isFinite(minRating) || rating);
    if (title && !hasSearchFilters) {
      const movies = await searchMovieTitles({
        title,
        limit,
        region: "US",
      });
      const result = {
        movies,
        total: movies.length,
        page: 1,
        limit,
        hasMore: false,
      };

      cache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    const filters = {
      title,
      genre,
      nanogenre,
      decade,
      minRating: Number.isFinite(minRating) ? minRating : null,
      rating,
    };
    const [movies, total] = await Promise.all([
      searchMovies({
        ...filters,
        sortBy,
        limit,
        offset,
        region: "US",
      }),
      countSearchMovies(filters),
    ]);

    const result = {
      movies,
      total,
      page,
      limit,
      hasMore: offset + limit < total,
    };

    // Cache the result
    cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error:", error);

    const databaseError = error instanceof DatabaseError ? error : toPostgresDatabaseError(error);
    if (databaseError) {
      return NextResponse.json({ error: databaseError.message, code: databaseError.code }, { status: 503 });
    }

    if (error instanceof QueryEmbeddingError) {
      const status = ["EMPTY_QUERY", "QUERY_TOO_LONG", "INVALID_EMBEDDING_DIMENSIONS"].includes(error.code) ? 400 : 503;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
