import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { validateQueryParams } from "../lib/validation";
import { query, getMoviesOfGenres, getMovies } from "../lib/dynamodb";
import { cache } from "../lib/cache";

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
    const name = searchParams.get("name");

    const offset = (page - 1) * limit;

    // Generate cache key based on query parameters
    const cacheKey = `movies:${sortBy}:${limit}:${page}:${genre}:${nanogenre}:${decade}:${minRating}:${rating}:${slug}:${name}`;

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

    // Add search by name (case-insensitive partial match)
    if (name) {
      filters.push(`begins_with(nameLower, :nameLower)`);
      params[":nameLower"] = name.toLocaleLowerCase();
    }

    // Improved decade search
    if (decade) {
      filters.push(`year >= :fromYear AND year < :toYear`);
      params.push(decade, decade + 10);
      params[":fromYear"] = decade;
      params[":toYear"] = decade + 10;
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
    if (genre) {
      let movieSlugs = await getMoviesOfGenres([genre]);
      movies = await getMovies(movieSlugs);
      movies = Array.from(movies.values());
    } else {
      movies = await query("movies", filters, params, names);
    }
    movies.sort((a, b) => a.popularity - b.popularity);
    // // Initialize default count
    // let totalMoviesCount = 0;

    // // Extract count from DynamoDB response
    // if (countResult && countResult.length > 0 && countResult[0]["Count(*)"]) {
    //   totalMoviesCount = parseInt(countResult[0]["Count(*)"].N, 10);
    // }

    // Use the count in your pagination info
    const result = {
      movies: movies,
      pagination: {
        // total: totalMoviesCount,
        total: 100,
        page,
        limit,
        // totalPages: Math.ceil(totalMoviesCount / limit),
        totalPages: 5,
      },
      // Rest of your result object...
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error:", error);

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
