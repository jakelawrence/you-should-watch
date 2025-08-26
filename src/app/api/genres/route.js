import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { cache } from "../lib/cache";
import { query } from "../lib/dynamodb";

function getProcessedGenres(genres) {
  let processedGenres = new Map();
  genres.forEach(({ id, genre, movieSlug, movieName }) => {
    let genreObject;
    if (!processedGenres.has(genre)) {
      genreObject = {
        genre: genre,
        movieCount: 0,
        examples: [],
      };
    } else genreObject = processedGenres.get(genre);
    genreObject.movieCount += 1;
    if (genreObject.examples.length < 3) genreObject.examples.push(movieName);
    processedGenres.set(genre, genreObject);
  });
  return Array.from(processedGenres.values());
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit")) || 3;
  const cacheKey = `genres-${limit}`;

  try {
    // Check cache first
    const cachedGenres = cache.get(cacheKey);
    if (cachedGenres) {
      return NextResponse.json({ genres: cachedGenres });
    }
    let filters = [];
    let params = {};
    let names = {};

    const genres = await query("genres", filters, params, names);
    const processedGenres = getProcessedGenres(genres);
    cache.set(cacheKey, processedGenres);
    return NextResponse.json({ genres: processedGenres });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch genres" }, { status: 500 });
  }
}
