import { NextResponse } from "next/server";
import { getProviders } from "../lib/dynamodb";
import { cache } from "../lib/cache";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit")) || 10;
    const type = searchParams.get("type");
    // Generate cache key based on query parameters
    // const cacheKey = `pr:${type}:${limit}`;

    // // Check cache
    // const cachedResult = cache.get(cacheKey);
    // if (cachedResult) {
    //   return NextResponse.json(cachedResult);
    // }
    const result = await getProviders({ type, limit });

    // Store in cache
    // cache.set(cacheKey, result);
    console.log({ providers: result });
    return NextResponse.json({ providers: result });
  } catch (error) {
    console.error("Database error:", error);

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
    }

    return NextResponse.json({ error: "Failed to fetch movies" }, { status: 500 });
  }
}
