import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getUserByUsername } from "./dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const dynamodb = DynamoDBDocumentClient.from(client);

/**
 * Creates a new user record in DynamoDB for OAuth sign-ups.
 * Email/password users are created via /api/auth/signup instead.
 */
export async function createOAuthUser({ email, name, provider }) {
  // Derive a username from the display name or email prefix
  const base = (name || email.split("@")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .substring(0, 20)
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores

  let username = base || "user";
  const existing = await getUserByUsername(username);
  if (existing) {
    username = `${username}_${Math.random().toString(36).substring(2, 6)}`;
  }

  const user = {
    username,
    email,
    name: name || username,
    isAdmin: false,
    createdAt: new Date().toISOString(),
    streamingServices: [],
    oauthProviders: [provider],
  };

  const command = new PutCommand({
    TableName: "users",
    Item: user,
  });

  await dynamodb.send(command);
  return user;
}
