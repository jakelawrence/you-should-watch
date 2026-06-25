import { NextResponse } from "next/server";
import { getMovieCount } from "../../lib/movieRepository";
import { getProviderCount } from "../../lib/providerRepository";
import { getUserCount } from "../../lib/userRepository";

export async function GET() {
  try {
    const movieCount = await getMovieCount();
    const providerCount = await getProviderCount();
    const userCount = await getUserCount();

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
