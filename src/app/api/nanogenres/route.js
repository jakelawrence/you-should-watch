import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { cache } from "../lib/cache";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit")) || 3;
  const cacheKey = `nanogenres-${limit}`;

  try {
    // Check cache first
    const cachedNanogenres = cache.get(cacheKey);
    if (cachedNanogenres) {
      return NextResponse.json({ nanogenres: cachedNanogenres });
    }

    const db = await openDb();
    const nanogenres = await db.all(`SELECT DISTINCT 
        n.nanogenre,
        COUNT(DISTINCT n.movieSlug) as movieCount,
        GROUP_CONCAT(DISTINCT m.name) as examples
      FROM nanogenres n
      JOIN movies m ON n.movieSlug = m.slug
      GROUP BY n.nanogenre
      HAVING movieCount >= 3
      ORDER BY movieCount DESC`);
    await db.close();
    const processedNanogenres = nanogenres.map((ng) => ({
      ...ng,
      examples: ng.examples.split(",").slice(0, limit),
    }));

    cache.set(cacheKey, processedNanogenres);
    return NextResponse.json({ nanogenres: processedNanogenres });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch nanogenres" }, { status: 500 });
  }
}
