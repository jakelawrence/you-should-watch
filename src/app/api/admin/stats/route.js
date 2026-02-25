import { NextResponse } from "next/server";
import { getTableCount } from "../../lib/dynamodb";

export async function GET() {
  try {
    // Fetch real stats from DynamoDB
    const movieCount = await getTableCount("movies");
    const providerCount = await getTableCount("providers");
    const userCount = await getTableCount("users");

    return NextResponse.json({
      totalMovies: movieCount,
      totalProviders: providerCount,
      totalUsers: userCount,
    });
  } catch (error) {
    console.error("Error fetching stats:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
