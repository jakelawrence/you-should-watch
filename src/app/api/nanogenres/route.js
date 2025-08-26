import { NextResponse } from "next/server";
import { openDb, DatabaseError } from "../lib/db";
import { cache } from "../lib/cache";
import { query } from "../lib/dynamodb";

function getProcessedNanogenres(nanogenres) {
  let processedNanogenres = new Map();
  nanogenres.forEach(({ id, nanogenre, movieSlug, movieName }) => {
    let nanogenreObject;
    if (!processedNanogenres.has(nanogenre)) {
      nanogenreObject = {
        nanogenre: nanogenre,
        movieCount: 0,
        examples: [],
      };
    } else nanogenreObject = processedNanogenres.get(nanogenre);
    nanogenreObject.movieCount += 1;
    if (nanogenreObject.examples.length < 3) nanogenreObject.examples.push(movieName);
    processedNanogenres.set(nanogenre, nanogenreObject);
  });
  return Array.from(processedNanogenres.values());
}

export async function GET(request) {
  console.log("/api/nanogenres");
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit")) || 3;
  const cacheKey = `nanogenres-${limit}`;

  try {
    // Check cache first
    const cachedNanogenres = cache.get(cacheKey);
    if (cachedNanogenres) {
      return NextResponse.json({ nanogenres: cachedNanogenres });
    }
    let filters = [];
    let params = {};
    let names = {};

    const nanogenres = await query("nanogenres", filters, params, names);
    const processedNanogenres = getProcessedNanogenres(nanogenres);
    cache.set(cacheKey, processedNanogenres);
    return NextResponse.json({ nanogenres: processedNanogenres });
  } catch (error) {
    console.log(error);
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }
    return NextResponse.json({ error: "Failed to fetch nanogenres" }, { status: 500 });
  }
}
