import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getUserSavedMovies, saveUserSavedMovie, deleteUserSavedMovie, getMovies } from "../../lib/dynamodb";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

async function getUserFromToken() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromToken();

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
    const user = await getUserFromToken();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let savedMovieSlugs = await getUserSavedMovies(user.username);
    if (savedMovieSlugs.savedMovies.length > 0) {
      const movies = await getMovies(savedMovieSlugs.savedMovies);
      //sort by saved date, most recent first
      Array.from(movies.values()).sort((a, b) => {
        const aIndex = savedMovieSlugs.savedMovies.findIndex((slug) => slug === a.movieSlug);
        const bIndex = savedMovieSlugs.savedMovies.findIndex((slug) => slug === b.movieSlug);
        return bIndex - aIndex;
      });
      console.log("Movies found for saved slugs:", Array.from(movies.values()));
      return NextResponse.json({
        savedMovies: Array.from(movies.values()) || [],
      });
    } else {
      return NextResponse.json({
        savedMovies: [],
      });
    }
  } catch (error) {
    console.error("Error loading saved movies:", error);
    return NextResponse.json({ error: "Failed to load saved movies" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const user = await getUserFromToken();

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
