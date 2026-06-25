import { NextResponse } from "next/server";
import { getUserByUsername, getUserSavedMovies } from "../../lib/userRepository";
import { auth } from "@/auth";

async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.username) {
    return null;
  }
  return session.user;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    console.log("Authenticated user:", user);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userData = await getUserByUsername(user.username);
    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userSavedMoviesRes = await getUserSavedMovies(userData.username);
    const userSavedMovies = userSavedMoviesRes?.savedMovies || [];
    // Return user profile data
    return NextResponse.json({
      user: {
        username: userData.username,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        streamingServices: userData.streamingServices || [],
        savedMovies: userSavedMovies || [],
        isAdmin: userData.isAdmin || false,
      },
      stats: {
        totalStreamingServices: (userData.streamingServices || []).length,
        totalSavedMovies: userSavedMovies ? userSavedMovies.length : 0,
        memberSince: userData.createdAt
          ? new Date(userData.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Unknown",
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}
