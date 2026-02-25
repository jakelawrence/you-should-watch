import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

const tmdbOptions = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${process.env.TMDB_AUTH_TOKEN}`,
  },
};

// Rate limiting: TMDB allows 50 requests per second
const BATCH_SIZE = 40;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second
const DELAY_BETWEEN_REQUESTS = 50; // 50ms between individual requests

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchKeywordsFromTMDB(tmdbId) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}/keywords`;
    const response = await fetch(url, tmdbOptions);

    if (!response.ok) {
      console.error(`Failed to fetch keywords for TMDB ID ${tmdbId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.keywords || [];
  } catch (error) {
    console.error(`Error fetching keywords for TMDB ID ${tmdbId}:`, error.message);
    return null;
  }
}

async function scanAllMovies() {
  console.log("\n📊 Scanning movies table...\n");

  const allMovies = [];
  let lastEvaluatedKey = null;
  let pageCount = 0;

  do {
    const command = new ScanCommand({
      TableName: "movies",
      ProjectionExpression: "slug, tmdbId, title, #yr",
      ExpressionAttributeNames: {
        "#yr": "year", // 'year' might be a reserved word
      },
      ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
    });

    try {
      const result = await dynamodb.send(command);

      if (result.Items && result.Items.length > 0) {
        const items = result.Items.map((item) => unmarshall(item));
        allMovies.push(...items);
        pageCount++;

        console.log(`📄 Page ${pageCount}: Found ${items.length} movies (Total: ${allMovies.length})`);
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
    } catch (error) {
      console.error("❌ Error scanning movies:", error.message);
      throw error;
    }
  } while (lastEvaluatedKey);

  console.log(`\n✅ Scan complete: Found ${allMovies.length} total movies\n`);
  return allMovies;
}

async function updateMovieWithKeywords(slug, keywords) {
  try {
    const keywordIds = keywords.map((k) => k.id);
    const keywordNames = keywords.map((k) => k.name);

    const updateCommand = new UpdateItemCommand({
      TableName: "movies",
      Key: marshall({ slug }),
      UpdateExpression: "SET keywordIds = :ids, keywordNames = :names, updatedAt = :updatedAt",
      ExpressionAttributeValues: marshall({
        ":ids": keywordIds,
        ":names": keywordNames,
        ":updatedAt": new Date().toISOString(),
      }),
    });

    await dynamodb.send(updateCommand);
    return true;
  } catch (error) {
    console.error(`Error updating movie ${slug}:`, error.message);
    return false;
  }
}

async function processBatch(movies) {
  const results = {
    success: 0,
    failed: 0,
    noKeywords: 0,
    skipped: 0,
  };

  for (const movie of movies) {
    if (!movie.tmdbId) {
      console.log(`⚠️  Skipping ${movie.title} - no TMDB ID`);
      results.skipped++;
      continue;
    }

    console.log(`Fetching keywords for: ${movie.title} (${movie.year || "N/A"}) - TMDB ID: ${movie.tmdbId}`);

    const keywords = await fetchKeywordsFromTMDB(movie.tmdbId);

    if (keywords === null) {
      results.failed++;
      continue;
    }

    if (keywords.length === 0) {
      console.log(`  ℹ️  No keywords found`);
      results.noKeywords++;
      // Still update with empty array
      await updateMovieWithKeywords(movie.slug, []);
      continue;
    }

    console.log(
      `  ✅ Found ${keywords.length} keywords: ${keywords
        .slice(0, 3)
        .map((k) => k.name)
        .join(", ")}${keywords.length > 3 ? "..." : ""}`
    );

    const updated = await updateMovieWithKeywords(movie.slug, keywords);
    if (updated) {
      results.success++;
    } else {
      results.failed++;
    }

    // Small delay between individual requests
    await sleep(DELAY_BETWEEN_REQUESTS);
  }

  return results;
}

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("🎬 Fetching Keywords from TMDB");
  console.log("=".repeat(70) + "\n");

  const startTime = Date.now();

  try {
    // Get all movies from DynamoDB
    const movies = await scanAllMovies();

    if (movies.length === 0) {
      console.log("No movies found. Exiting.");
      return;
    }

    // Filter movies that have TMDB IDs
    const moviesWithTMDB = movies.filter((m) => m.tmdbId);
    const moviesWithoutTMDB = movies.length - moviesWithTMDB.length;

    console.log(`\nℹ️  Movies with TMDB ID: ${moviesWithTMDB.length}`);
    console.log(`ℹ️  Movies without TMDB ID: ${moviesWithoutTMDB} (will be skipped)\n`);

    if (moviesWithTMDB.length === 0) {
      console.log("No movies with TMDB IDs found. Exiting.");
      return;
    }

    // Process in batches
    const totalBatches = Math.ceil(moviesWithTMDB.length / BATCH_SIZE);
    const overallResults = {
      success: 0,
      failed: 0,
      noKeywords: 0,
      skipped: 0,
    };

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, moviesWithTMDB.length);
      const batch = moviesWithTMDB.slice(start, end);

      console.log(`\n📦 Processing batch ${i + 1}/${totalBatches} (movies ${start + 1}-${end})`);
      console.log("─".repeat(70));

      const batchResults = await processBatch(batch);

      // Aggregate results
      overallResults.success += batchResults.success;
      overallResults.failed += batchResults.failed;
      overallResults.noKeywords += batchResults.noKeywords;
      overallResults.skipped += batchResults.skipped;

      console.log("\nBatch Summary:");
      console.log(`  ✅ Success: ${batchResults.success}`);
      console.log(`  ❌ Failed: ${batchResults.failed}`);
      console.log(`  ℹ️  No keywords: ${batchResults.noKeywords}`);
      console.log(`  ⚠️  Skipped: ${batchResults.skipped}`);

      // Wait between batches (except for last batch)
      if (i < totalBatches - 1) {
        console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Final summary
    console.log("\n" + "=".repeat(70));
    console.log("🎉 PROCESS COMPLETE!");
    console.log("=".repeat(70));
    console.log(`Total movies processed: ${moviesWithTMDB.length}`);
    console.log(`  ✅ Successfully updated: ${overallResults.success}`);
    console.log(`  ❌ Failed: ${overallResults.failed}`);
    console.log(`  ℹ️  No keywords found: ${overallResults.noKeywords}`);
    console.log(`  ⚠️  Skipped (no TMDB ID): ${overallResults.skipped + moviesWithoutTMDB}`);
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ PROCESS FAILED:", error);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log("✨ Script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
