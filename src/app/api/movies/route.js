import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { validateQueryParams } from "../lib/validation";
import { query, getMoviesOfGenres, getMovies } from "../lib/dynamodb";
import { cache } from "../lib/cache";
import { normalizeString, rankMovies } from "../lib/fuzzySearch";

const SORT_OPTIONS = ["popularity", "alphabetical", "rating", "year", "releaseDate", "popularityRanking", "views"];
const VALID_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];

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

    const offset = (page - 1) * limit;

    // Generate cache key based on query parameters
    const cacheKey = `movies:${sortBy}:${limit}:${page}:${genre}:${nanogenre}:${decade}:${minRating}:${rating}:${slug}:${title}`;

    // Check cache
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    let conditions = [];
    let filters = [];
    let params = {};
    let names = {};

    // Add search by slug
    if (slug) {
      conditions.push(`slug = :slug`);
      params[":slug"] = slug;
      names["#slug"] = "slug"; // needed if 'slug' is a reserved word
    }

    // Add search by title
    // NEW: We'll do broad search first, then apply fuzzy matching
    if (title) {
      console.log("Searching for title: " + title);

      // Normalize the search query
      const normalizedTitle = normalizeString(title);

      // Extract key words from the search (for broader initial search)
      const searchWords = normalizedTitle.split(" ").filter((word) => word.length > 2);

      if (searchWords.length > 0) {
        // Build a filter that checks if title contains ANY of the key words
        // This casts a wide net, then we'll use fuzzy matching to rank results
        const wordFilters = searchWords.map((word, idx) => {
          params[`:word${idx}`] = word;
          return `contains(titleLower, :word${idx})`;
        });

        // Use OR logic to be more permissive in initial filter
        filters.push(`(${wordFilters.join(" OR ")})`);
      } else {
        // Fallback for very short queries
        filters.push(`contains(titleLower, :titleLower)`);
        params[":titleLower"] = normalizedTitle;
      }
    }

    // Improved decade search
    if (decade) {
      filters.push(`#year >= :fromYear AND #year < :toYear`);
      params[":fromYear"] = decade;
      params[":toYear"] = decade + 10;
      names["#year"] = "year";
    }

    if (minRating) {
      filters.push(`avgRating >= :minRating`);
      params[":minRating"] = minRating;
    }

    if (rating) {
      filters.push(`rating = :rating`);
      params[":rating"] = rating;
    }

    let movies;
    console.log("filters=" + filters);

    if (genre) {
      let movieSlugs = await getMoviesOfGenres([genre]);
      movies = await getMovies(movieSlugs);
      movies = Array.from(movies.values());
    } else {
      movies = await query("movies", filters, params, names);
    }

    // NEW: Apply fuzzy search ranking if title search is being performed
    if (title) {
      console.log(`Before fuzzy search: ${movies.length} movies`);
      movies = rankMovies(movies, title, 0.65); // 0.65 threshold allows for typos
      console.log(`After fuzzy search: ${movies.length} movies`);
    } else {
      // Default sorting by popularity if no title search
      movies.sort((a, b) => (a.popularity || 999999) - (b.popularity || 999999));
    }

    // Apply pagination after fuzzy filtering
    const paginatedMovies = movies.slice(offset, offset + limit);

    const result = {
      movies: paginatedMovies,
      total: movies.length,
      page,
      limit,
      hasMore: offset + limit < movies.length,
    };

    // Cache the result
    cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error:", error);

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
