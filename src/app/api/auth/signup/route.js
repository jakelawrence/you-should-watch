import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getUserByEmail, getUserByUsername } from "../../lib/dynamodb";
import bcrypt from "bcryptjs";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    // Derive a username from the display name
    const baseUsername = (name || email.split("@")[0])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .substring(0, 20)
      .replace(/^_+|_+$/g, "");

    let username = baseUsername || "user";
    const existingByUsername = await getUserByUsername(username);
    if (existingByUsername) {
      username = `${username}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const existingByEmail = await getUserByEmail(email);
    if (existingByEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
      username,
      email,
      name: name || username,
      passwordHash,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      streamingServices: [],
    };

    await dynamodb.send(new PutCommand({ TableName: "users", Item: user }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}
