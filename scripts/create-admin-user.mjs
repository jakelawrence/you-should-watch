// scripts/create-admin-user.js
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import readline from "readline";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const dynamodb = DynamoDBDocumentClient.from(client);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAdminUser() {
  console.log("\n🔐 Create Admin User\n");
  console.log("=".repeat(50));

  const email = await question("Enter admin email: ");
  const password = await question("Enter admin password: ");
  const confirmPassword = await question("Confirm password: ");

  if (password !== confirmPassword) {
    console.error("\n❌ Passwords do not match!");
    rl.close();
    return;
  }

  if (password.length < 8) {
    console.error("\n❌ Password must be at least 8 characters!");
    rl.close();
    return;
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user object
    const adminUser = {
      userId: `user_${Date.now()}`,
      email: email.toLowerCase().trim(),
      passwordHash,
      isAdmin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to DynamoDB
    const command = new PutCommand({
      TableName: "users", // Change to your users table name
      Item: adminUser,
      ConditionExpression: "attribute_not_exists(email)", // Prevent duplicates
    });

    await dynamodb.send(command);

    console.log("\n✅ Admin user created successfully!");
    console.log("\nUser Details:");
    console.log(`  Email: ${email}`);
    console.log(`  User ID: ${adminUser.userId}`);
    console.log(`  Admin: Yes`);
    console.log("\n⚠️  Keep your credentials safe!");
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      console.error("\n❌ User with this email already exists!");
    } else {
      console.error("\n❌ Error creating admin user:", error.message);
    }
  } finally {
    rl.close();
  }
}

createAdminUser();
