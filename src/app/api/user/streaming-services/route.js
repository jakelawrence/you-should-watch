import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { UpdateCommand, GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getUserSelectedStreamingServces } from "../../lib/dynamodb";
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

// GET - Load user's streaming services
export async function GET() {
  try {
    const user = await getUserFromToken();

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
    const user = await getUserFromToken();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("Authenticated user:", user);
    const { streamingServices } = await req.json();

    const command = new UpdateCommand({
      TableName: "users",
      Key: { email: user.email },
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
