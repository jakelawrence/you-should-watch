// ============================================================================
// FILE: scripts/add-mood-levels.js
// Reads movies from DynamoDB, calculates mood levels based on genres,
// and updates each movie with funninessLevel, slownessLevel, intensenessLevel
// Run with: node scripts/add-mood-levels.js
// ============================================================================

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { DynamoDBClient, ScanCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamodb = new DynamoDBClient({ region: process.env.AWS_REGION });

// ============================================================================
// FUNNINESS CONFIGURATION (0-10 scale)
// ============================================================================
const GENRE_FUNNINESS_MAP = {
  // Very Funny (8-10)
  Comedy: 9,
  Musical: 7,

  // Moderately Funny (5-7)
  Animation: 6,
  Family: 6,
  Adventure: 4,
  Romance: 5,

  // Neutral (3-5)
  Fantasy: 4,
  "Science Fiction": 3,
  Music: 5,

  // Serious (1-3)
  Drama: 2,
  Action: 3,
  Western: 3,
  Mystery: 2,
  Biography: 2,
  History: 2,
  Documentary: 2,

  // Very Serious (0-1)
  War: 1,
  Crime: 1,
  Thriller: 1,
  Horror: 0,
  "Film-Noir": 0,
};

const FUNNINESS_KEYWORDS = {
  // Funny keywords (add funniness)
  hilarious: +3,
  funny: +2,
  comedy: +2,
  laugh: +2,
  witty: +2,
  satire: +1,
  parody: +2,
  slapstick: +2,
  romantic_comedy: +2,

  // Serious keywords (reduce funniness)
  serious: -2,
  dark: -2,
  tragic: -3,
  brutal: -3,
  disturbing: -3,
  gritty: -2,
};

// ============================================================================
// SLOWNESS CONFIGURATION (0-10 scale)
// 0 = Very fast-paced, 10 = Very slow/contemplative
// ============================================================================
const GENRE_SLOWNESS_MAP = {
  // Very Slow (8-10)
  Drama: 7,
  Documentary: 8,
  "Film-Noir": 7,
  Romance: 6,

  // Moderately Slow (5-7)
  Mystery: 6,
  Biography: 6,
  History: 6,
  Western: 5,

  // Neutral (3-5)
  "Science Fiction": 4,
  Fantasy: 4,
  Crime: 4,
  Horror: 5,

  // Fast (1-3)
  Action: 2,
  Adventure: 3,
  Thriller: 2,
  Comedy: 3,

  // Very Fast (0-1)
  Animation: 2,
  Family: 3,
  Music: 3,
  Musical: 3,
  War: 2,
};

const SLOWNESS_KEYWORDS = {
  // Slow keywords (add slowness)
  slow_burn: +3,
  contemplative: +3,
  meditative: +3,
  atmospheric: +2,
  character_driven: +2,
  introspective: +2,
  subtle: +2,

  // Fast keywords (reduce slowness)
  fast_paced: -3,
  action_packed: -3,
  thrilling: -2,
  explosive: -3,
  high_octane: -3,
  adrenaline: -2,
  chase: -2,
};

// ============================================================================
// INTENSENESS CONFIGURATION (0-10 scale)
// 0 = Relaxed/light, 10 = Very intense/stressful
// ============================================================================
const GENRE_INTENSENESS_MAP = {
  // Very Intense (8-10)
  Thriller: 9,
  Horror: 9,
  War: 10,
  Crime: 8,

  // Moderately Intense (5-7)
  Action: 7,
  Mystery: 6,
  "Film-Noir": 7,
  Drama: 6,

  // Neutral (3-5)
  "Science Fiction": 5,
  Adventure: 5,
  Western: 5,
  Biography: 4,
  History: 5,

  // Light (1-3)
  Fantasy: 3,
  Romance: 3,
  Documentary: 3,
  Music: 2,

  // Very Light (0-1)
  Comedy: 2,
  Family: 1,
  Animation: 1,
  Musical: 2,
};

const INTENSENESS_KEYWORDS = {
  // Intense keywords (add intenseness)
  intense: +3,
  brutal: +3,
  violent: +3,
  disturbing: +3,
  psychological: +2,
  suspenseful: +2,
  tension: +2,
  gripping: +2,
  edge_of_your_seat: +3,
  nail_biting: +3,

  // Light keywords (reduce intenseness)
  light: -2,
  relaxing: -3,
  feel_good: -3,
  wholesome: -3,
  heartwarming: -2,
  gentle: -3,
  calming: -3,
};

const GENRE_DARKNESS_MAP = {
  // Very Dark (8-10)
  Horror: 9,
  War: 8,
  Thriller: 7,

  // Moderately Dark (6-7)
  Crime: 7,
  Mystery: 6,
  "Film-Noir": 8,
  Western: 6,

  // Neutral (4-6)
  Drama: 5,
  Action: 5,
  "Science Fiction": 5,
  Fantasy: 4,
  Adventure: 4,
  Biography: 5,
  History: 5,

  // Light (2-4)
  Comedy: 3,
  Romance: 4,
  Music: 3,
  Documentary: 5,

  // Very Light (0-2)
  Family: 2,
  Animation: 2,
  Musical: 2,
};

/**
 * Keyword modifiers - adjust darkness based on title/description
 * These boost or reduce the darkness score
 */
const DARKNESS_KEYWORDS = {
  // Dark keywords (add darkness)
  dark: +2,
  disturbing: +3,
  brutal: +2,
  violent: +2,
  psychological: +1,
  tragic: +1,
  noir: +2,
  gore: +3,
  twisted: +2,

  // Light keywords (reduce darkness)
  feel_good: -2,
  heartwarming: -2,
  uplifting: -2,
  wholesome: -3,
  family_friendly: -3,
  fun: -1,
  lighthearted: -2,
  whimsical: -2,
};

const NANOGENRE_TOKEN_WEIGHTS = {
  // FUNNINESS
  hilarious: { funniness: +3 },
  funny: { funniness: +2 },
  witty: { funniness: +2 },
  silly: { funniness: +2 },
  goofy: { funniness: +2 },
  slapstick: { funniness: +3 },
  charming: { funniness: +2 },
  sweet: { funniness: +1 },

  // INTENSENESS
  intense: { intenseness: +3 },
  brutal: { intenseness: +3, darkness: +2 },
  violent: { intenseness: +3, darkness: +2 },
  terrifying: { intenseness: +3, darkness: +3 },
  suspense: { intenseness: +2 },
  thrilling: { intenseness: +2 },

  // DARKNESS
  dark: { darkness: +2 },
  disturbing: { darkness: +3 },
  creepy: { darkness: +2 },
  eerie: { darkness: +2 },
  gory: { darkness: +3 },
  twisted: { darkness: +2 },
  tragic: { darkness: +1 },

  // SLOWNESS
  contemplative: { slowness: +3 },
  meditative: { slowness: +3 },
  atmospheric: { slowness: +2 },
  slow: { slowness: +2 },
  subtle: { slowness: +2 },

  // SPEED UP
  action: { slowness: -2 },
  explosive: { slowness: -3 },
  chase: { slowness: -2 },
};

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

function calculateMetricLevel(movie, genreMap, keywordMap, metricName) {
  const genres = movie.genres || [];
  let baseLevel = 5;

  if (genres.length) {
    let total = 0;
    let count = 0;

    genres.forEach((g) => {
      if (genreMap[g] !== undefined) {
        total += genreMap[g];
        count++;
      }
    });

    baseLevel = count ? total / count : 5;
  }

  // Keyword modifiers (title + description)
  const text = `${movie.title || ""} ${movie.description || ""}`.toLowerCase();
  let keywordAdjustment = 0;

  Object.entries(keywordMap).forEach(([keyword, adj]) => {
    if (text.includes(keyword.replace(/_/g, " "))) {
      keywordAdjustment += adj;
    }
  });

  // Nanogenre modifiers
  const nanogenreAdjustments = getNanogenreAdjustments(movie);
  const nanogenreBoost = nanogenreAdjustments[metricName] || 0;

  let finalLevel = baseLevel + keywordAdjustment + nanogenreBoost;

  // Soft clamp (prevents extreme stacking)
  finalLevel = Math.max(0, Math.min(10, finalLevel));

  return Math.round(finalLevel * 10) / 10;
}

function getNanogenreAdjustments(movie) {
  const nanogenres = movie.nanogenres || [];
  const adjustments = {
    funniness: 0,
    slowness: 0,
    intenseness: 0,
    darkness: 0,
  };

  nanogenres.forEach((ng) => {
    ng.split("-").forEach((token) => {
      const weight = NANOGENRE_TOKEN_WEIGHTS[token];
      if (!weight) return;

      Object.keys(weight).forEach((metric) => {
        adjustments[metric] += weight[metric];
      });
    });
  });

  return adjustments;
}

function calculateFunninessLevel(movie) {
  return calculateMetricLevel(movie, GENRE_FUNNINESS_MAP, FUNNINESS_KEYWORDS, "funniness");
}

function calculateSlownessLevel(movie) {
  return calculateMetricLevel(movie, GENRE_SLOWNESS_MAP, SLOWNESS_KEYWORDS, "slowness");
}

function calculateIntensenessLevel(movie) {
  return calculateMetricLevel(movie, GENRE_INTENSENESS_MAP, INTENSENESS_KEYWORDS, "intenseness");
}

function calculateDarknessLevel(movie) {
  return calculateMetricLevel(movie, GENRE_DARKNESS_MAP, DARKNESS_KEYWORDS, "darkness");
}

function getCategory(level, metricName) {
  if (metricName === "funniness") {
    if (level >= 8) return "Hilarious";
    if (level >= 6) return "Funny";
    if (level >= 4) return "Neutral";
    if (level >= 2) return "Serious";
    return "Very Serious";
  } else if (metricName === "slowness") {
    if (level >= 8) return "Very Slow";
    if (level >= 6) return "Slow";
    if (level >= 4) return "Neutral";
    if (level >= 2) return "Fast";
    return "Very Fast";
  } else if (metricName === "intenseness") {
    if (level >= 8) return "Very Intense";
    if (level >= 6) return "Intense";
    if (level >= 4) return "Neutral";
    if (level >= 2) return "Light";
    return "Very Light";
  }
  return "Unknown";
}

// ============================================================================
// DYNAMODB OPERATIONS
// ============================================================================

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

async function updateMovieMoodLevels(slug, funninessLevel, slownessLevel, intensenessLevel, darknessLevel) {
  const command = new UpdateItemCommand({
    TableName: "movies",
    Key: marshall({ slug }),
    UpdateExpression: "SET funninessLevel = :funniness, slownessLevel = :slowness, intensenessLevel = :intenseness, darknessLevel = :darkness",
    ExpressionAttributeValues: marshall({
      ":funniness": funninessLevel,
      ":slowness": slownessLevel,
      ":intenseness": intensenessLevel,
      ":darkness": darknessLevel,
    }),
  });

  await dynamodb.send(command);
}

async function batchUpdateMovies(updates) {
  const chunks = chunkArray(updates, 25);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    const promises = chunk.map(({ slug, funninessLevel, slownessLevel, intensenessLevel, darknessLevel }) =>
      updateMovieMoodLevels(slug, funninessLevel, slownessLevel, intensenessLevel, darknessLevel)
    );

    await Promise.all(promises);

    if ((i + 1) % 10 === 0 || i === chunks.length - 1) {
      console.log(`   ✓ Updated ${Math.min((i + 1) * 25, updates.length)}/${updates.length} movies`);
    }
  }
}

// ============================================================================
// MAIN PROCESS
// ============================================================================

async function addMoodLevels() {
  console.log("\n" + "=".repeat(70));
  console.log("🎭 Adding Mood Levels to Movies");
  console.log("=".repeat(70));

  const startTime = Date.now();

  try {
    // Step 1: Scan all movies
    const movies = await scanAllMovies();

    if (movies.length === 0) {
      console.log("⚠️  No movies found. Exiting.");
      return;
    }

    // Step 2: Calculate mood levels
    console.log("🎨 Calculating mood levels...\n");

    const updates = [];

    movies.forEach((movie) => {
      const funninessLevel = calculateFunninessLevel(movie);
      const slownessLevel = calculateSlownessLevel(movie);
      const intensenessLevel = calculateIntensenessLevel(movie);
      const darknessLevel = calculateDarknessLevel(movie);

      updates.push({
        slug: movie.slug,
        title: movie.title,
        genres: movie.genres || [],
        funninessLevel,
        slownessLevel,
        intensenessLevel,
        darknessLevel,
        funninessCategory: getCategory(funninessLevel, "funniness"),
        slownessCategory: getCategory(slownessLevel, "slowness"),
        intensenessCategory: getCategory(intensenessLevel, "intenseness"),
        darknessCategory: getCategory(darknessLevel, "darkness"),
      });
    });

    // Show sample calculations
    console.log("📋 Sample mood calculations:\n");
    const samples = updates.slice(0, 10);
    samples.forEach(({ title, genres, funninessLevel, slownessLevel, intensenessLevel, darknessLevel }) => {
      console.log(`   ${title}`);
      console.log(`      Genres: ${genres.join(", ") || "None"}`);
      console.log(`      Funniness: ${funninessLevel}`);
      console.log(`      Slowness: ${slownessLevel}`);
      console.log(`      Intenseness: ${intensenessLevel}\n`);
      console.log(`      Darkness: ${darknessLevel}\n`);
    });

    // If running with --dry-run flag, stop here
    if (process.argv.includes("--dry-run")) {
      console.log("🔍 DRY RUN MODE - No changes made to database\n");

      // Show extremes for each metric
      console.log("😂 Top 10 Funniest Movies:");
      [...updates]
        .sort((a, b) => b.funninessLevel - a.funninessLevel)
        .slice(0, 10)
        .forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.title} (${m.funninessLevel})`);
        });

      console.log("\n🐌 Top 10 Slowest Movies:");
      [...updates]
        .sort((a, b) => b.slownessLevel - a.slownessLevel)
        .slice(0, 10)
        .forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.title} (${m.slownessLevel})`);
        });

      console.log("\n⚡ Top 10 Most Intense Movies:");
      [...updates]
        .sort((a, b) => b.intensenessLevel - a.intensenessLevel)
        .slice(0, 10)
        .forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.title} (${m.intensenessLevel})`);
        });
      [...updates]
        .sort((a, b) => b.darknessLevel - a.darknessLevel)
        .slice(0, 10)
        .forEach((m, i) => {
          console.log(`   ${i + 1}. ${m.title} (${m.darknessLevel})`);
        });

      return;
    }

    // Step 3: Update DynamoDB
    console.log("💾 Updating movies in DynamoDB...\n");
    await batchUpdateMovies(updates);
    console.log("\n✅ All movies updated successfully!\n");

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("=".repeat(70));
    console.log("✅ PROCESS COMPLETE!");
    console.log(`⏱️  Total time: ${duration} seconds`);
    console.log(`📊 Updated ${updates.length} movies with mood levels`);
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n❌ PROCESS FAILED:", error.message);
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

// ============================================================================
// CLI
// ============================================================================

console.log("\n💡 Usage:");
console.log("   node scripts/add-mood-levels.js           # Run for real");
console.log("   node scripts/add-mood-levels.js --dry-run # Preview without updating\n");

// Run the script
addMoodLevels().catch(console.error);
