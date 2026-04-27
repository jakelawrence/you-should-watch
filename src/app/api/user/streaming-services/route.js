import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getUserSelectedStreamingServces } from "../../lib/dynamodb";
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
  if (!session?.user?.username || !session?.user?.email) {
    return null;
  }
  return session.user;
}

// GET - Load user's streaming services
export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let streamingServices = await getUserSelectedStreamingServces(user.email);

    return NextResponse.json({
      streamingServices,
    });
  } catch (error) {
    console.error("Error loading streaming services:", error);
    return NextResponse.json({ error: "Failed to load streaming services" }, { status: 500 });
  }
}

// POST - Save user's streaming services
export async function POST(req) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("Authenticated user:", user);
    const { streamingServices } = await req.json();

    const command = new UpdateCommand({
      TableName: "users",
      Key: { username: user.username },
      UpdateExpression: "SET streamingServices = :services, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":services": streamingServices,
        ":updatedAt": new Date().toISOString(),
      },
      ReturnValues: "ALL_NEW",
    });

    await dynamodb.send(command);

    return NextResponse.json({ success: true, streamingServices });
  } catch (error) {
    console.error("Error saving streaming services:", error);
    return NextResponse.json({ error: "Failed to save streaming services" }, { status: 500 });
  }
}
