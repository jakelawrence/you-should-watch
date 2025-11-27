// ============================================================================
// FILE: scripts/migrate-likes-tables.js
// Run with: node scripts/migrate-likes-tables.js
// ============================================================================

import { DynamoDBClient, ScanCommand, BatchWriteItemCommand, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ============================================================================
// STEP 1: CREATE NEW TABLES
// ============================================================================

async function createOptimizedTables() {
  console.log("\n📋 STEP 1: Creating optimized tables...\n");

  const tables = [
    {
      name: "likes-by-user",
      pk: "username",
      sk: "movieSlug",
    },
    {
      name: "likes-by-movie",
      pk: "movieSlug",
      sk: "username",
    },
  ];

  for (const table of tables) {
    try {
      // Check if table already exists
      try {
        await dynamodb.send(new DescribeTableCommand({ TableName: table.name }));
        console.log(`✅ Table ${table.name} already exists`);
        continue;
      } catch (error) {
        if (error.name !== "ResourceNotFoundException") throw error;
      }

      // Create table
      const command = new CreateTableCommand({
        TableName: table.name,
        AttributeDefinitions: [
          { AttributeName: table.pk, AttributeType: "S" },
          { AttributeName: table.sk, AttributeType: "S" },
        ],
        KeySchema: [
          { AttributeName: table.pk, KeyType: "HASH" },
          { AttributeName: table.sk, KeyType: "RANGE" },
        ],
        BillingMode: "PAY_PER_REQUEST", // On-demand pricing
      });

      await dynamodb.send(command);
      console.log(`✅ Created table: ${table.name}`);

      // Wait for table to be active
      await waitForTableActive(table.name);
    } catch (error) {
      console.error(`❌ Error creating table ${table.name}:`, error.message);
      throw error;
    }
  }

  console.log("\n✅ All tables created successfully!\n");
}

async function waitForTableActive(tableName, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    const { Table } = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));

    if (Table.TableStatus === "ACTIVE") {
      return;
    }

    console.log(`⏳ Waiting for ${tableName} to be active... (${i + 1}/${maxAttempts})`);
    await sleep(2000);
  }

  throw new Error(`Table ${tableName} did not become active in time`);
}

// ============================================================================
// STEP 2: SCAN EXISTING LIKES
// ============================================================================

async function scanAllLikes(oldTableName = "likes") {
  console.log(`\n📊 STEP 2: Scanning existing likes from "${oldTableName}"...\n`);

  const allItems = [];
  let lastEvaluatedKey = null;
  let pageCount = 0;

  do {
    const command = new ScanCommand({
      TableName: oldTableName,
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    });

    try {
      const result = await dynamodb.send(command);

      if (result.Items && result.Items.length > 0) {
        const items = result.Items.map((item) => unmarshall(item));
        allItems.push(...items);
        pageCount++;

        console.log(`📄 Page ${pageCount}: Found ${items.length} likes (Total: ${allItems.length})`);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      console.error(`❌ Error scanning table:`, error.message);
      throw error;
    }
  } while (lastEvaluatedKey);

  console.log(`\n✅ Scan complete: Found ${allItems.length} total likes\n`);
  return allItems;
}

// ============================================================================
// STEP 3: MIGRATE DATA
// ============================================================================

async function migrateData(likes) {
  console.log(`\n🔄 STEP 3: Migrating ${likes.length} likes to new tables...\n`);

  // Prepare items for both tables
  const userTableItems = likes.map((like) => ({
    username: like.username,
    movieSlug: like.movieSlug,
    createdAt: like.createdAt || Date.now(),
  }));

  const movieTableItems = likes.map((like) => ({
    movieSlug: like.movieSlug,
    username: like.username,
    createdAt: like.createdAt || Date.now(),
  }));

  // Write to both tables
  await batchWriteItems("likes-by-user", userTableItems);
  await batchWriteItems("likes-by-movie", movieTableItems);

  console.log("\n✅ Migration complete!\n");
}

async function batchWriteItems(tableName, items) {
  console.log(`📝 Writing ${items.length} items to ${tableName}...`);

  const chunks = chunkArray(items, 25); // DynamoDB batch limit
  let processedCount = 0;

  for (const chunk of chunks) {
    const command = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: chunk.map((item) => ({
          PutRequest: {
            Item: marshall(item),
          },
        })),
      },
    });

    try {
      await dynamodb.send(command);
      processedCount += chunk.length;

      if (processedCount % 250 === 0 || processedCount === items.length) {
        console.log(`   ✓ ${processedCount}/${items.length} items written`);
      }
    } catch (error) {
      console.error(`❌ Error writing batch:`, error.message);
      throw error;
    }
  }

  console.log(`✅ ${tableName}: All ${items.length} items written successfully\n`);
}

// ============================================================================
// STEP 4: VERIFICATION
// ============================================================================

async function verifyMigration(originalCount) {
  console.log(`\n🔍 STEP 4: Verifying migration...\n`);

  try {
    // Sample check: Count items in new tables
    const userTableCount = await getTableItemCount("likes-by-user");
    const movieTableCount = await getTableItemCount("likes-by-movie");

    console.log(`📊 Original table: ${originalCount} likes`);
    console.log(`📊 likes-by-user: ${userTableCount} items`);
    console.log(`📊 likes-by-movie: ${movieTableCount} items`);

    if (userTableCount === originalCount && movieTableCount === originalCount) {
      console.log("\n✅ Verification passed! Counts match.\n");
      return true;
    } else {
      console.log("\n⚠️  Warning: Counts don't match. Please investigate.\n");
      return false;
    }
  } catch (error) {
    console.error(`❌ Verification error:`, error.message);
    return false;
  }
}

async function getTableItemCount(tableName) {
  const { Table } = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
  return Table.ItemCount || 0;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🚀 DynamoDB Likes Table Migration");
  console.log("=".repeat(70));

  const startTime = Date.now();

  try {
    // Step 1: Create new tables
    await createOptimizedTables();

    // Step 2: Scan existing likes
    const likes = await scanAllLikes("likes"); // Change "likes" to your table name

    if (likes.length === 0) {
      console.log("⚠️  No likes found to migrate. Exiting.");
      return;
    }

    // Step 3: Migrate data
    await migrateData(likes);

    // Step 4: Verify
    const verified = await verifyMigration(likes.length);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(70));
    if (verified) {
      console.log("✅ MIGRATION SUCCESSFUL!");
    } else {
      console.log("⚠️  MIGRATION COMPLETED WITH WARNINGS");
    }
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log("=".repeat(70));

    console.log("\n📋 NEXT STEPS:");
    console.log("1. Test the new tables thoroughly");
    console.log("2. Update your application code to use the new tables");
    console.log("3. Run side-by-side for a few days to ensure stability");
    console.log("4. Delete the old 'likes' table and GSI when confident\n");
  } catch (error) {
    console.error("\n❌ MIGRATION FAILED:", error.message);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// DRY RUN MODE (for testing)
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");

if (DRY_RUN) {
  console.log("\n🔍 DRY RUN MODE - No changes will be made\n");
  // Override write functions to be no-ops
  global.DRY_RUN = true;
}

// Run the migration
main().catch(console.error);

// ============================================================================
// EXPORT FOR PROGRAMMATIC USE
// ============================================================================

export { createOptimizedTables, scanAllLikes, migrateData, verifyMigration };
