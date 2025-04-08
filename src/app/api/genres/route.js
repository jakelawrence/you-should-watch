import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { cache } from "../lib/cache";

export async function GET(request) {
  console.log("genres route");
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit")) || 3;
  // const cacheKey = `genres-${limit}`;

  try {
    // Check cache first
    // const cachedGenres = cache.get(cacheKey);
    // if (cachedGenres) {
    //   return NextResponse.json({ genres: cachedGenres });
    // }

    const db = await openDb();
    const genres = await db.all(`SELECT DISTINCT 
        g.genre,
        COUNT(DISTINCT g.movieSlug) as movieCount,
        GROUP_CONCAT(DISTINCT m.name) as examples
      FROM genres g
      JOIN movies m ON g.movieSlug = m.slug
      GROUP BY g.genre
      HAVING movieCount >= 3
      ORDER BY movieCount DESC`);
    await db.close();
    const processedGenres = genres.map((g) => ({
      ...g,
      examples: g.examples.split(",").slice(0, limit),
    }));
    // cache.set(cacheKey, processedGenres);
    return NextResponse.json({ genres: processedGenres });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch genres" }, { status: 500 });
  }
}
