import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
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

export async function GET() {
  try {
    const user = await getUserFromToken();
    console.log("Authenticated user:", user);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch full user data from DynamoDB
    const command = new GetCommand({
      TableName: "users",
      Key: { username: user.username },
    });

    const result = await dynamodb.send(command);

    if (!result.Item) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = result.Item;

    // Return user profile data
    return NextResponse.json({
      user: {
        username: userData.username,
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        streamingServices: userData.streamingServices || [],
        favoriteMovies: userData.favoriteMovies || [],
        likedMovies: userData.likedMovies || [],
        isAdmin: userData.isAdmin || false,
      },
      stats: {
        totalStreamingServices: (userData.streamingServices || []).length,
        totalFavorites: (userData.favoriteMovies || []).length,
        totalLikes: (userData.likedMovies || []).length,
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
