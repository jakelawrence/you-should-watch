import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { validateQueryParams } from "../lib/validation";
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
    // const cachedResult = cache.get(cacheKey);
    // if (cachedResult) {
    //   return NextResponse.json(cachedResult);
    // }

    const db = await openDb();

    // Build query dynamically based on filters
    let query = `
      SELECT m.*, 
             GROUP_CONCAT(DISTINCT g.genre) as genres,
             GROUP_CONCAT(DISTINCT ng.nanogenre) as nanogenres
      FROM movies m
      LEFT JOIN genres g ON m.slug = g.movieSlug
      LEFT JOIN nanogenres ng ON m.slug = ng.movieSlug
      WHERE 1=1
    `;

    const params = [];

    // Add search by slug
    if (slug) {
      query += ` AND m.slug = ?`;
      params.push(slug);
    }

    // Add search by name (case-insensitive partial match)
    if (name) {
      query += ` AND LOWER(m.name) LIKE LOWER(?)`;
      params.push(`%${name}%`);
    }

    if (genre) {
      query += ` AND EXISTS (
        SELECT 1 FROM genres g2 
        WHERE g2.movieSlug = m.slug 
        AND UPPER(g2.genre) = UPPER(?)
      )`;
      params.push(genre);
    }

    // Add nanogenre filtering
    if (nanogenre) {
      query += ` AND EXISTS (
        SELECT 1 FROM nanogenres ng2 
        WHERE ng2.movieSlug = m.slug 
        AND ng2.nanogenre = ?
      )`;
      params.push(nanogenre);
    }

    // Improved decade search
    if (decade) {
      query += ` AND year >= ? AND year < ?`;
      params.push(decade, decade + 10);
    }

    if (minRating) {
      query += ` AND avgRating >= ?`;
      params.push(minRating);
    }

    if (rating) {
      query += ` AND rating = ?`;
      params.push(rating);
    }

    query += ` GROUP BY m.slug`;
    console.log("sortBy=" + sortBy);

    // Add sorting
    switch (sortBy) {
      case "alphabetical":
        query += ` ORDER BY m.name`;
        break;
      case "rating":
        query += ` ORDER BY m.avgRating DESC`;
        break;
      case "year":
        query += ` ORDER BY m.year DESC`;
        break;
      case "popularityRanking":
        query += ` ORDER BY m.popularityRanking ASC`;
        break;
      case "views":
        query += ` ORDER BY m.views DESC`;
        break;
      default: // popularity - use original order in database (by rowid)
        query += ` ORDER BY m.rowid`;
    }

    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const movies = await db.all(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(1) as count 
      FROM movies m
      WHERE 1=1
    `;

    const countParams = [];

    if (slug) {
      countQuery += ` AND m.slug = ?`;
      countParams.push(slug);
    }

    if (name) {
      countQuery += ` AND LOWER(m.name) LIKE LOWER(?)`;
      countParams.push(`%${name}%`);
    }

    if (genre) {
      countQuery += ` AND EXISTS (SELECT 1 FROM genres g2 WHERE g2.movieSlug = m.slug AND LOWER(g2.genre) = LOWER(?))`;
      countParams.push(genre);
    }

    if (nanogenre) {
      countQuery += ` AND EXISTS (SELECT 1 FROM nanogenres ng2 WHERE ng2.movieSlug = m.slug AND LOWER(ng2.nanogenre) = LOWER(?))`;
      countParams.push(nanogenre);
    }

    if (decade) countQuery += ` AND year >= ? AND year < ?`;
    if (decade) countParams.push(decade, decade + 10);

    if (minRating) {
      countQuery += ` AND avgRating >= ?`;
      countParams.push(minRating);
    }

    if (rating) {
      countQuery += ` AND rating = ?`;
      countParams.push(rating);
    }

    const totalCount = await db.get(countQuery, countParams);
    await db.close();

    const result = {
      movies: movies.map((movie) => ({
        ...movie,
        genres: movie.genres ? movie.genres.split(",") : [],
        nanogenres: movie.nanogenres ? movie.nanogenres.split(",") : [],
      })),
      pagination: {
        total: totalCount ? totalCount.count : 3000,
        page,
        limit,
        totalPages: Math.ceil((totalCount ? totalCount.count : 3000) / limit),
      },
      filters: {
        sortBy,
        genre,
        nanogenre,
        decade,
        minRating,
        rating,
        slug,
        name,
      },
    };

    // Cache the result
    // cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error:", error);

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
