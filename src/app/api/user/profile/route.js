import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getUserSavedMovies } from "../../lib/dynamodb";
import { auth } from "@/auth";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

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
