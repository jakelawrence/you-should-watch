const sqlite3 = require("sqlite3").verbose();
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

// Set up DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

// Open SQLite database
const db = new sqlite3.Database("../db/movies.db");

db.all("SELECT * FROM movies", async (err, rows) => {
  if (err) {
    console.error("Failed to read SQLite DB:", err);
    return;
  }

  console.log(`Uploading ${rows.length} movies to DynamoDB...`);

  for (const row of rows) {
    // Make sure row has a unique key field matching your DynamoDB table schema
    if (!row.id) {
      console.warn("Skipping row with no 'id':", row);
      continue;
    }

    try {
      await docClient.send(
        new PutCommand({
          TableName: "movies",
          Item: row,
        })
      );
      console.log(`Uploaded movie ID: ${row.id}`);
    } catch (e) {
      console.error(`Failed to upload movie ID: ${row.id}`, e);
    }
  }

  console.log("✅ Upload complete.");
  db.close();
});
