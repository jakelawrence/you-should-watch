import { NextResponse } from "next/server";
import { getUserSavedMovies, saveUserSavedMovie, deleteUserSavedMovie } from "../../lib/userRepository";
import { getMovies } from "../../lib/movieRepository";
import { auth } from "@/auth";

async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.username) {
    return null;
  }
  return session.user;
}

export async function POST(req) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { movieSlug } = await req.json();

    await saveUserSavedMovie(user.username, movieSlug);

    return NextResponse.json({ message: "Movie saved successfully" });
  } catch (error) {
    console.error("Error saving movie:", error);
    return NextResponse.json({ error: "Failed to save movie" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const savedMovieData = await getUserSavedMovies(user.username);
    const savedMovieSlugs = savedMovieData?.savedMovies || [];

    if (savedMovieSlugs.length > 0) {
      const movies = await getMovies(savedMovieSlugs);
      const sortedMovies = savedMovieSlugs
        .map((slug) => movies.get(slug))
        .filter(Boolean);

      return NextResponse.json({
        savedMovies: sortedMovies,
      });
    }

    return NextResponse.json({
      savedMovies: [],
    });
  } catch (error) {
    console.error("Error loading saved movies:", error);
    return NextResponse.json({ error: "Failed to load saved movies" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { movieSlug } = await req.json();

    await deleteUserSavedMovie(user.username, movieSlug);

    return NextResponse.json({ message: "Saved movie deleted successfully" });
  } catch (error) {
    console.error("Error deleting saved movie:", error);
    return NextResponse.json({ error: "Failed to delete saved movie" }, { status: 500 });
  }
}
