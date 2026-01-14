import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
const MAX_TMDB_PAGES = 40;
const PAGE_START_TMDB = 1;

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

const tmdbURL = `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=${PAGE_START_TMDB}&sort_by=vote_count.desc`;
const tmdbOptions = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization:
      `Bearer ${process.env.TMDB_AUTH_TOKEN}`,
  },
};

function normalizeKeyAggressive(key) {
  // \s matches all Unicode whitespace
  let normalized = key.replace(/[\u00A0\u200B\u200C\u200D\u2009\u200A\u2002\u2003\uFEFF]/g, " ");
  // Then replace ALL whitespace (including regular spaces) with underscores
  return normalized.replace(/\s+/g, "_").trim();
}

async function fetchTMDBMovies() {
  let tmdbMovies = [];
  try {
    console.log(`Fetching TMDB movies from page ${PAGE_START_TMDB}...`);
    console.log(tmdbURL);
    const response = await fetch(tmdbURL, tmdbOptions);
    if (!response.ok) {
      throw new Error(`TMDB API request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    while (data.page <= data.total_pages && data.page <= PAGE_START_TMDB + MAX_TMDB_PAGES) {
      tmdbMovies.push(...data.results);
      data.page++;

      // Fetch next page
      const nextPageResponse = await fetch(`${tmdbURL}&page=${data.page}`, tmdbOptions);
      if (!nextPageResponse.ok) {
        throw new Error(`TMDB API request failed: ${nextPageResponse.status} ${nextPageResponse.statusText}`);
      }
      Object.assign(data, await nextPageResponse.json());
    }
    return tmdbMovies;
  } catch (error) {
    console.error("Error fetching TMDB movies:", error.message);
    throw error;
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

async function addTMDBIds() {
  console.log("\n" + "=".repeat(70));
  console.log("🎭 Adding TMDB IDs to Movies");
  console.log("=".repeat(70));

  const startTime = Date.now();

  try {
    // Step 1: Fetch TMDB movies
    const tmdbMovies = await fetchTMDBMovies();
    console.log(`Fetched ${tmdbMovies.length} TMDB movies.`);

    // Step 2: Create a map of TMDB movies by title and year for quick lookup
    const tmdbMovieMap = new Map();
    tmdbMovies.forEach((movie) => {
      const key = `${normalizeKeyAggressive(movie.title.toLowerCase())}_${movie.release_date ? movie.release_date.slice(0, 4) : "unknown"}`;
      tmdbMovieMap.set(key, movie.id);
    });

    console.log(tmdbMovieMap);
    return;
    // Step 3: Scan all movies from DynamoDB
    const movies = await scanAllMovies();

    //Sort movies by popularity ascending to prioritize popular movies first
    movies.sort((a, b) => (a.popularity || 0) - (b.popularity || 0));

    // Step 4: Find movie TMDB by title and year, and assign to map
    let updateCount = 0;
    for (const movie of movies) {
      const key = `${normalizeKeyAggressive(movie.title.toLowerCase())}_${movie.year || "unknown"}`;
      const tmdbId = tmdbMovieMap.get(key);

      if (tmdbId) {
        // Update movie in DynamoDB with TMDB ID
        const updateCommand = new UpdateItemCommand({
          TableName: "movies",
          Key: marshall({ slug: movie.slug }),
          UpdateExpression: "SET tmdbId = :tmdbId",
          ExpressionAttributeValues: marshall({ ":tmdbId": tmdbId }),
        });

        try {
          await dynamodb.send(updateCommand);
          updateCount++;
          console.log(`✅ Updated movie "${movie.title}" (${movie.year}) with TMDB ID: ${tmdbId}`);
        } catch (error) {
          console.error(`❌ Error updating movie "${movie.title}":`, error.message);
        }
      } else {
        // console.log(`⚠️ No TMDB ID found for movie "${movie.title}" (${movie.year})`);
      }
    }

    // Step 5: Log number of movies missing TMDB IDs
    const moviesMissingTMDB = movies.filter((m) => !m.tmdbId);
    console.log(`\nℹ️  Movies missing TMDB IDs: ${moviesMissingTMDB.length}`);
    //Log most popular movies missing TMDB IDs (ascending)
    const popularMissing = moviesMissingTMDB
      .sort((a, b) => (a.popularity || 0) - (b.popularity || 0))
      .slice(0, 10)
      .map((m) => `"${m.title}" (${m.year}) - Popularity: ${m.popularity} - ${normalizeKeyAggressive(m.title.toLowerCase())}_${m.year || "unknown"}`);
    console.log("Top 10 most popular movies missing TMDB IDs:\n", popularMissing.join("\n"));

    let duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("=".repeat(70));
    console.log("✅ PROCESS COMPLETE!");
    console.log(`Total movies updated with TMDB IDs: ${updateCount}`);
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ PROCESS FAILED:", error);
    console.error("\nStack trace:", error.stack);
    process.exit(1);
  }
}

addTMDBIds().catch(console.error);
