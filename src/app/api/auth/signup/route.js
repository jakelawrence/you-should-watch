import { NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getUserByUsername } from "../../lib/dynamodb";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

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
    const { username, email, password } = await req.json();
    console.log("Sign up attempt for:", username, email);

    // Check if user already exists for username
    const existingUserByUsername = await getUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: "Username already registered" }, { status: 400 });
    }

    const existingUserByEmail = await getUserByEmail(email);
    if (existingUserByEmail) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in DynamoDB
    const user = {
      username,
      email,
      passwordHash,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      streamingServices: [], // Store user's streaming preferences
    };

    const command = new PutCommand({
      TableName: "users",
      Item: user,
    });

    await dynamodb.send(command);

    // Create JWT token
    const token = jwt.sign({ userId, email, isAdmin: false }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });

    const response = NextResponse.json({ success: true, userId });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 604800, // 7 days
    });

    return response;
  } catch (error) {
    console.error("Sign up error:", error);
    return NextResponse.json({ error: "Sign up failed" }, { status: 500 });
  }
}
