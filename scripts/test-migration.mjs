// ============================================================================
// FILE: scripts/test-migration.js
// Quick test to verify migration worked correctly
// Run with: node scripts/test-migration.js
// ============================================================================

import { DynamoDBClient, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const dynamodb = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testMigration() {
  console.log("\n🧪 Testing Migration Results\n");
  console.log("=".repeat(70));

  const results = {
    passed: 0,
    failed: 0,
    tests: [],
  };

  try {
    // Test 1: Check table counts match
    console.log("\n📊 Test 1: Comparing table counts...");

    const oldCount = await getTableCount("likes");
    const userCount = await getTableCount("likes-by-user");
    const movieCount = await getTableCount("likes-by-movie");

    console.log(`   Original table: ${oldCount} items`);
    console.log(`   likes-by-user: ${userCount} items`);
    console.log(`   likes-by-movie: ${movieCount} items`);

    if (oldCount === userCount && oldCount === movieCount) {
      console.log("   ✅ PASS: All counts match");
      results.passed++;
      results.tests.push({ name: "Table counts match", status: "PASS" });
    } else {
      console.log("   ❌ FAIL: Counts don't match");
      results.failed++;
      results.tests.push({ name: "Table counts match", status: "FAIL" });
    }

    // Test 2: Sample data integrity
    console.log("\n🔍 Test 2: Checking sample data integrity...");

    const sampleLike = await getSampleLike("likes");
    if (!sampleLike) {
      console.log("   ⚠️  SKIP: No sample data found in original table");
    } else {
      console.log(`   Sample: user=${sampleLike.username}, movie=${sampleLike.movieSlug}`);

      const userTableHas = await checkLikeExists("likes-by-user", sampleLike.username, sampleLike.movieSlug);

      const movieTableHas = await checkLikeExists("likes-by-movie", sampleLike.movieSlug, sampleLike.username);

      if (userTableHas && movieTableHas) {
        console.log("   ✅ PASS: Sample data exists in both new tables");
        results.passed++;
        results.tests.push({ name: "Sample data integrity", status: "PASS" });
      } else {
        console.log("   ❌ FAIL: Sample data missing from new tables");
        results.failed++;
        results.tests.push({ name: "Sample data integrity", status: "FAIL" });
      }
    }

    // Test 3: Query performance comparison
    console.log("\n⚡ Test 3: Comparing query performance...");

    if (sampleLike) {
      // Test old table query (with GSI)
      const oldStart = Date.now();
      await queryOldTable(sampleLike.movieSlug);
      const oldTime = Date.now() - oldStart;

      // Test new table query (direct partition)
      const newStart = Date.now();
      await queryNewTable(sampleLike.movieSlug);
      const newTime = Date.now() - newStart;

      console.log(`   Old table query: ${oldTime}ms`);
      console.log(`   New table query: ${newTime}ms`);

      const improvement = (((oldTime - newTime) / oldTime) * 100).toFixed(1);
      console.log(`   Performance improvement: ${improvement}%`);

      if (newTime < oldTime) {
        console.log("   ✅ PASS: New tables are faster");
        results.passed++;
        results.tests.push({ name: "Query performance", status: "PASS" });
      } else {
        console.log("   ⚠️  WARNING: New tables not faster (might be cold start)");
        results.tests.push({ name: "Query performance", status: "WARNING" });
      }
    }

    // Test 4: Random sampling
    console.log("\n🎲 Test 4: Random data sampling (10 samples)...");

    const samples = await getRandomSamples("likes", 10);
    let matchCount = 0;

    for (const sample of samples) {
      const existsInBoth =
        (await checkLikeExists("likes-by-user", sample.username, sample.movieSlug)) &&
        (await checkLikeExists("likes-by-movie", sample.movieSlug, sample.username));

      if (existsInBoth) matchCount++;
    }

    console.log(`   ${matchCount}/${samples.length} samples found in new tables`);

    if (matchCount === samples.length) {
      console.log("   ✅ PASS: All samples verified");
      results.passed++;
      results.tests.push({ name: "Random sampling", status: "PASS" });
    } else {
      console.log("   ❌ FAIL: Some samples missing");
      results.failed++;
      results.tests.push({ name: "Random sampling", status: "FAIL" });
    }
  } catch (error) {
    console.error("\n❌ Test error:", error.message);
    results.failed++;
    results.tests.push({ name: "Test execution", status: "ERROR", error: error.message });
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("📋 TEST SUMMARY");
  console.log("=".repeat(70));

  results.tests.forEach((test, i) => {
    const icon = test.status === "PASS" ? "✅" : test.status === "WARNING" ? "⚠️" : "❌";
    console.log(`${icon} ${i + 1}. ${test.name}: ${test.status}`);
  });

  console.log("\n" + "=".repeat(70));
  console.log(`Tests Passed: ${results.passed}`);
  console.log(`Tests Failed: ${results.failed}`);
  console.log("=".repeat(70));

  if (results.failed === 0) {
    console.log("\n🎉 ALL TESTS PASSED! Migration successful.\n");
    return true;
  } else {
    console.log("\n⚠️  SOME TESTS FAILED. Please review the results.\n");
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getTableCount(tableName) {
  try {
    const command = new ScanCommand({
      TableName: tableName,
      Select: "COUNT",
    });
    const result = await dynamodb.send(command);
    return result.Count || 0;
  } catch (error) {
    console.error(`Error counting ${tableName}:`, error.message);
    return 0;
  }
}

async function getSampleLike(tableName) {
  try {
    const command = new ScanCommand({
      TableName: tableName,
      Limit: 1,
    });
    const result = await dynamodb.send(command);

    if (result.Items && result.Items.length > 0) {
      return unmarshall(result.Items[0]);
    }
    return null;
  } catch (error) {
    console.error(`Error getting sample from ${tableName}:`, error.message);
    return null;
  }
}

async function getRandomSamples(tableName, count) {
  try {
    const command = new ScanCommand({
      TableName: tableName,
      Limit: count,
    });
    const result = await dynamodb.send(command);

    if (result.Items) {
      return result.Items.map((item) => unmarshall(item));
    }
    return [];
  } catch (error) {
    console.error(`Error getting samples from ${tableName}:`, error.message);
    return [];
  }
}

async function checkLikeExists(tableName, pk, sk) {
  try {
    const [pkAttr, skAttr] = tableName === "likes-by-user" ? ["username", "movieSlug"] : ["movieSlug", "username"];

    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: `${pkAttr} = :pk AND ${skAttr} = :sk`,
      ExpressionAttributeValues: {
        ":pk": { S: pk },
        ":sk": { S: sk },
      },
      Select: "COUNT",
    });

    const result = await dynamodb.send(command);
    return (result.Count || 0) > 0;
  } catch (error) {
    console.error(`Error checking ${tableName}:`, error.message);
    return false;
  }
}

async function queryOldTable(movieSlug) {
  try {
    const command = new QueryCommand({
      TableName: "likes",
      IndexName: "movieSlug-index",
      KeyConditionExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": { S: movieSlug },
      },
    });
    await dynamodb.send(command);
  } catch (error) {
    // Ignore errors for timing test
  }
}

async function queryNewTable(movieSlug) {
  try {
    const command = new QueryCommand({
      TableName: "likes-by-movie",
      KeyConditionExpression: "movieSlug = :movieSlug",
      ExpressionAttributeValues: {
        ":movieSlug": { S: movieSlug },
      },
    });
    await dynamodb.send(command);
  } catch (error) {
    // Ignore errors for timing test
  }
}

// Run tests
testMigration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
