#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import sqlite3 from "sqlite3";
import { open as openSqlite } from "sqlite";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

dotenv.config({ path: ".env.local", quiet: true });

const DEFAULT_SAMPLE_SLUGS = ["the-night-of-the-hunter"];
const REQUIRED_DYNAMODB_TABLES = ["movies", "users", "user-saved-movies"];
const OPTIONAL_DYNAMODB_TABLES = ["providers"];
const POSTGRES_TABLES = [
  "movies",
  "reviews",
  "users",
  "user_saved_movies",
  "watch_providers",
  "movie_watch_providers",
  "movie_watch_provider_sync_state",
  "watch_provider_sync_runs",
];
const REQUIRED_POSTGRES_TABLES = ["movies", "users", "user_saved_movies"];
const SQLITE_TABLES = ["movies", "genres", "nanogenres", "directors", "actors", "likes", "favorites"];

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasArg(name) {
  return process.argv.includes(name);
}

function parseListArg(name, fallback = []) {
  const raw = getArg(name);
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-1-inventory.mjs --out docs/migration/phase-1-inventory.json

Options:
  --out PATH              Write the inventory report to PATH. Prints JSON when omitted.
  --sample-slugs A,B      Slugs to compare across DynamoDB and Postgres.
  --sqlite PATH           SQLite database path. Defaults to movies.db.
  --include-tmdb          Query the TMDB watch-provider catalog count.
  --strict                Exit non-zero when required remote sources cannot be inventoried.
  --help                  Show this help.
`);
}

function nowIso() {
  return new Date().toISOString();
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

function columnExpression(columns, columnName, fallbackType = "text") {
  if (columns.has(columnName)) return quoteIdentifier(columnName);
  return `null::${fallbackType} as ${quoteIdentifier(columnName)}`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(rootDir) {
  if (!(await pathExists(rootDir))) return [];

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function compactMovie(item = null) {
  if (!item) return null;

  return {
    slug: item.slug ?? item.movie_slug ?? null,
    title: item.title ?? item.name ?? null,
    director: item.director ?? null,
    year: item.year ?? item.release_year ?? null,
    duration: item.duration ?? item.duration_minutes ?? item.runtime_minutes ?? null,
    rating: item.rating ?? item.content_rating ?? null,
    avgRating: item.avgRating ?? item.averageRating ?? item.letterboxd_avg_rating ?? null,
    popularity: item.popularity ?? item.popularityRanking ?? item.letterboxd_popularity ?? null,
    genres: item.genres ?? item.genreNames ?? null,
    nanogenres: item.nanogenres ?? null,
    posterUrl: item.posterUrl ?? item.poster_url ?? null,
    tmdbId: item.tmdbId ?? item.tmdb_id ?? null,
    streamingProvidersCount: Array.isArray(item.streamingProviders) ? item.streamingProviders.length : null,
    darknessLevel: item.darknessLevel ?? item.darkness_level ?? null,
    funninessLevel: item.funninessLevel ?? item.funniness_level ?? null,
    slownessLevel: item.slownessLevel ?? item.slowness_level ?? null,
    intensenessLevel: item.intensenessLevel ?? item.intenseness_level ?? null,
  };
}

function compareMovies(dynamoMovie, postgresMovie) {
  if (!dynamoMovie || !postgresMovie) {
    return {
      status: "skipped",
      reason: !dynamoMovie && !postgresMovie ? "missing both sample rows" : !dynamoMovie ? "missing DynamoDB row" : "missing Postgres row",
    };
  }

  const fieldPairs = [
    ["slug", "slug"],
    ["title", "title"],
    ["year", "year"],
    ["duration", "duration"],
    ["rating", "rating"],
    ["avgRating", "avgRating"],
    ["posterUrl", "posterUrl"],
    ["darknessLevel", "darknessLevel"],
    ["funninessLevel", "funninessLevel"],
    ["slownessLevel", "slownessLevel"],
    ["intensenessLevel", "intensenessLevel"],
  ];

  const mismatches = fieldPairs
    .map(([leftField, rightField]) => ({
      field: leftField,
      dynamodb: dynamoMovie[leftField] ?? null,
      postgres: postgresMovie[rightField] ?? null,
    }))
    .filter(({ dynamodb, postgres }) => JSON.stringify(dynamodb) !== JSON.stringify(postgres));

  return {
    status: mismatches.length === 0 ? "matched" : "diff",
    mismatches,
  };
}

async function scanCount(docClient, tableName) {
  let rowCount = 0;
  let scannedCount = 0;
  let lastEvaluatedKey = undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      })
    );

    rowCount += result.Count ?? 0;
    scannedCount += result.ScannedCount ?? 0;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return { row_count: rowCount, scanned_count: scannedCount };
}

async function getDynamoMovie(docClient, slug) {
  const result = await docClient.send(
    new GetCommand({
      TableName: "movies",
      Key: { slug },
    })
  );

  return result.Item ?? null;
}

async function inventoryDynamoDB(sampleSlugs) {
  const region = process.env.AWS_REGION || "us-east-2";
  const hasStaticCredentials = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  if (!hasStaticCredentials) {
    return {
      status: "skipped",
      reason: "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set",
      row_counts: [],
      sample_movies: {},
    };
  }

  const client = new DynamoDBClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const docClient = DynamoDBDocumentClient.from(client);
  const rowCounts = [];
  const sampleMovies = {};

  for (const tableName of [...REQUIRED_DYNAMODB_TABLES, ...OPTIONAL_DYNAMODB_TABLES]) {
    try {
      rowCounts.push({
        table: tableName,
        source: "dynamodb",
        required: REQUIRED_DYNAMODB_TABLES.includes(tableName),
        status: "ok",
        ...(await scanCount(docClient, tableName)),
      });
    } catch (error) {
      rowCounts.push({
        table: tableName,
        source: "dynamodb",
        required: REQUIRED_DYNAMODB_TABLES.includes(tableName),
        status: "error",
        error: error.message,
      });
    }
  }

  for (const slug of sampleSlugs) {
    try {
      sampleMovies[slug] = compactMovie(await getDynamoMovie(docClient, slug));
    } catch (error) {
      sampleMovies[slug] = { status: "error", error: error.message };
    }
  }

  const requiredErrors = rowCounts.filter((row) => row.required && row.status !== "ok");

  return {
    status: requiredErrors.length === 0 ? "ok" : "partial",
    region,
    row_counts: rowCounts,
    sample_movies: sampleMovies,
  };
}

async function inventoryPostgres(sampleSlugs) {
  let databaseUrl;
  try {
    databaseUrl = getDatabaseUrl({ direct: true });
  } catch (error) {
    return {
      status: "skipped",
      reason: error.message,
      row_counts: [],
      sample_movies: {},
    };
  }

  let postgres;
  try {
    postgres = (await import("postgres")).default;
  } catch {
    return {
      status: "skipped",
      reason: "The optional postgres package is not installed yet",
      row_counts: [],
      sample_movies: {},
    };
  }

  const sql = postgres(databaseUrl, {
    ssl: "require",
    prepare: false,
  });
  const rowCounts = [];
  const sampleMovies = {};

  try {
    for (const tableName of POSTGRES_TABLES) {
      const regclass = await sql`select to_regclass(${`public.${tableName}`}) as name`;
      if (!regclass[0]?.name) {
        rowCounts.push({
          table: tableName,
          source: "postgres",
          status: "missing",
          row_count: null,
        });
        continue;
      }

      const rows = await sql.unsafe(`select count(*)::bigint as row_count from public.${quoteIdentifier(tableName)}`);
      rowCounts.push({
        table: tableName,
        source: "postgres",
        status: "ok",
        row_count: Number(rows[0].row_count),
      });
    }

    if (sampleSlugs.length > 0) {
      const columnRows = await sql`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'movies'
      `;
      const columns = new Set(columnRows.map((row) => row.column_name));
      const selectList = [
        columnExpression(columns, "movie_slug"),
        `${columnExpression(columns, "movie_slug")} as slug`,
        columnExpression(columns, "title"),
        columnExpression(columns, "director"),
        columnExpression(columns, "release_year", "integer"),
        columnExpression(columns, "duration_minutes", "integer"),
        columnExpression(columns, "runtime_minutes", "integer"),
        columnExpression(columns, "content_rating"),
        columnExpression(columns, "letterboxd_avg_rating", "double precision"),
        columnExpression(columns, "letterboxd_popularity", "integer"),
        columnExpression(columns, "genres", "text[]"),
        columnExpression(columns, "nanogenres", "text[]"),
        columnExpression(columns, "poster_url"),
        columnExpression(columns, "tmdb_id", "integer"),
        columnExpression(columns, "darkness_level", "smallint"),
        columnExpression(columns, "funniness_level", "smallint"),
        columnExpression(columns, "slowness_level", "smallint"),
        columnExpression(columns, "intenseness_level", "smallint"),
      ];
      const rows = await sql.unsafe(
        `
          select ${selectList.join(", ")}
          from public.movies
          where movie_slug = any($1)
        `,
        [sampleSlugs]
      );

      for (const row of rows) {
        sampleMovies[row.movie_slug] = compactMovie(row);
      }
      for (const slug of sampleSlugs) {
        sampleMovies[slug] ??= null;
      }
    }

    const missingRequired = rowCounts.filter((row) => REQUIRED_POSTGRES_TABLES.includes(row.table) && row.status !== "ok");

    return {
      status: missingRequired.length === 0 ? "ok" : "partial",
      row_counts: rowCounts,
      sample_movies: sampleMovies,
    };
  } catch (error) {
    return {
      status: "error",
      reason: error.message,
      row_counts: rowCounts,
      sample_movies: sampleMovies,
    };
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

async function inventorySqlite(sqlitePath) {
  if (!(await pathExists(sqlitePath))) {
    return {
      status: "skipped",
      reason: `${sqlitePath} does not exist`,
      row_counts: [],
      movies_columns: [],
    };
  }

  const db = await openSqlite({
    filename: sqlitePath,
    driver: sqlite3.Database,
  });
  const rowCounts = [];

  try {
    const tables = await db.all("select name from sqlite_master where type = 'table' order by name");
    const tableNames = new Set(tables.map((table) => table.name));

    for (const tableName of SQLITE_TABLES) {
      if (!tableNames.has(tableName)) {
        rowCounts.push({
          table: tableName,
          source: "sqlite",
          status: "missing",
          row_count: null,
        });
        continue;
      }

      const rows = await db.all(`select count(*) as row_count from ${quoteIdentifier(tableName)}`);
      rowCounts.push({
        table: tableName,
        source: "sqlite",
        status: "ok",
        row_count: rows[0].row_count,
      });
    }

    const moviesColumns = tableNames.has("movies") ? await db.all("pragma table_info(movies)") : [];

    return {
      status: "ok",
      database_path: sqlitePath,
      row_counts: rowCounts,
      movies_columns: moviesColumns.map((column) => ({
        name: column.name,
        type: column.type,
        not_null: Boolean(column.notnull),
        primary_key: Boolean(column.pk),
      })),
      note: "Local SQLite is a legacy source and should only be used if it has data not present in DynamoDB or Neon.",
    };
  } finally {
    await db.close();
  }
}

async function inventoryReviewSources() {
  const rootDir = path.join("scripts", "reviews");
  const files = await listFiles(rootDir);
  const embeddingRelatedFiles = files.filter((filePath) => /embed|embedding|vector/i.test(path.basename(filePath)));

  return {
    status: files.length > 0 ? "ok" : "missing",
    root_dir: rootDir,
    files,
    embedding_related_files: embeddingRelatedFiles,
    note:
      embeddingRelatedFiles.length === 0
        ? "No embedding-generation script was found under scripts/reviews; current source is review HTML parsing only."
        : "Embedding-related review scripts were found under scripts/reviews.",
  };
}

function summarizeTmdbAvailability(regionPayload) {
  const availabilityTypes = ["flatrate", "free", "ads", "rent", "buy"];
  return Object.fromEntries(availabilityTypes.map((type) => [type, Array.isArray(regionPayload?.[type]) ? regionPayload[type].length : 0]));
}

async function inventoryTmdbWatchProviders(includeTmdb, sampleSlugs = [], postgresSampleMovies = {}, dynamoSampleMovies = {}) {
  if (!includeTmdb) {
    return {
      status: "skipped",
      reason: "Pass --include-tmdb to query the TMDB provider catalog.",
      region: "US",
      provider_catalog_count: null,
      per_movie_availability_count: null,
      sample_availability: {},
    };
  }

  if (!process.env.TMDB_AUTH_TOKEN) {
    return {
      status: "skipped",
      reason: "TMDB_AUTH_TOKEN is not set",
      region: "US",
      provider_catalog_count: null,
      per_movie_availability_count: null,
      sample_availability: {},
    };
  }

  const response = await fetch("https://api.themoviedb.org/3/watch/providers/movie?language=en-US&watch_region=US", {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_AUTH_TOKEN}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return {
      status: "error",
      reason: `TMDB returned ${response.status}`,
      region: "US",
      provider_catalog_count: null,
      per_movie_availability_count: null,
      sample_availability: {},
    };
  }

  const body = await response.json();
  const sampleAvailability = {};

  for (const slug of sampleSlugs) {
    const tmdbId = postgresSampleMovies?.[slug]?.tmdbId ?? dynamoSampleMovies?.[slug]?.tmdbId ?? null;

    if (!tmdbId) {
      sampleAvailability[slug] = {
        status: "skipped",
        reason: "sample movie has no tmdb_id",
        tmdb_id: null,
      };
      continue;
    }

    const availabilityResponse = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`, {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_AUTH_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!availabilityResponse.ok) {
      sampleAvailability[slug] = {
        status: "error",
        reason: `TMDB returned ${availabilityResponse.status}`,
        tmdb_id: tmdbId,
      };
      continue;
    }

    const availabilityBody = await availabilityResponse.json();
    const regionPayload = availabilityBody.results?.US ?? null;
    sampleAvailability[slug] = {
      status: regionPayload ? "ok" : "missing_region",
      tmdb_id: tmdbId,
      region: "US",
      tmdb_link: regionPayload?.link ?? null,
      counts_by_type: summarizeTmdbAvailability(regionPayload),
    };
  }

  return {
    status: "ok",
    region: "US",
    provider_catalog_count: Array.isArray(body.results) ? body.results.length : null,
    per_movie_availability_count: Object.values(sampleAvailability).filter((sample) => sample.status === "ok").length,
    sample_availability: sampleAvailability,
    note: "Per-movie availability is sampled for the configured slugs only; the full backfill belongs to Phase 3.",
  };
}

function buildComparisons(sampleSlugs, dynamodb, postgres) {
  return sampleSlugs.map((slug) => {
    const dynamoMovie = dynamodb.sample_movies?.[slug] && !dynamodb.sample_movies[slug].error ? dynamodb.sample_movies[slug] : null;
    const postgresMovie = postgres.sample_movies?.[slug] && !postgres.sample_movies[slug].error ? postgres.sample_movies[slug] : null;

    return {
      slug,
      ...compareMovies(dynamoMovie, postgresMovie),
    };
  });
}

function summarizeAcceptance(report) {
  const hasRequiredDynamoCounts =
    report.sources.dynamodb.status === "ok" &&
    REQUIRED_DYNAMODB_TABLES.every((table) =>
      report.sources.dynamodb.row_counts.some((row) => row.table === table && row.status === "ok" && Number.isFinite(row.row_count))
    );
  const hasPostgresMovieCounts =
    Array.isArray(report.sources.postgres.row_counts) &&
    REQUIRED_POSTGRES_TABLES.every((table) =>
      report.sources.postgres.row_counts.some((row) => row.table === table && row.status === "ok" && Number.isFinite(row.row_count))
    );
  const hasTmdbWatchProviderInventory =
    report.sources.tmdb_watch_providers.status === "ok" && Number.isFinite(report.sources.tmdb_watch_providers.provider_catalog_count);
  const hasSampleComparison = report.sample_comparisons.some((comparison) => comparison.status === "matched" || comparison.status === "diff");

  return {
    table_by_table_inventory: hasRequiredDynamoCounts && hasPostgresMovieCounts && hasTmdbWatchProviderInventory ? "complete" : "partial",
    dynamodb_required_row_counts: hasRequiredDynamoCounts ? "complete" : "incomplete",
    postgres_core_row_counts: hasPostgresMovieCounts ? "complete" : "incomplete",
    tmdb_watch_provider_inventory: hasTmdbWatchProviderInventory ? "complete" : "incomplete",
    field_mapping_documented: "complete in docs/migration/phase-1-schema-mapping.md",
    sample_movie_comparison: hasSampleComparison ? "complete" : "incomplete",
  };
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const outPath = getArg("--out");
  const sqlitePath = getArg("--sqlite", "movies.db");
  const sampleSlugs = parseListArg("--sample-slugs", DEFAULT_SAMPLE_SLUGS);
  const includeTmdb = hasArg("--include-tmdb");
  const strict = hasArg("--strict");

  const dynamodb = await inventoryDynamoDB(sampleSlugs);
  const postgres = await inventoryPostgres(sampleSlugs);
  const sqlite = await inventorySqlite(sqlitePath);
  const tmdbWatchProviders = await inventoryTmdbWatchProviders(includeTmdb, sampleSlugs, postgres.sample_movies, dynamodb.sample_movies);
  const reviewSources = await inventoryReviewSources();

  const report = {
    generated_at: nowIso(),
    phase: "phase-1-inventory-and-schema-mapping",
    sample_slugs: sampleSlugs,
    sources: {
      dynamodb,
      postgres,
      sqlite,
      tmdb_watch_providers: tmdbWatchProviders,
      review_sources: reviewSources,
    },
    sample_comparisons: [],
    acceptance: {},
  };

  report.sample_comparisons = buildComparisons(sampleSlugs, report.sources.dynamodb, report.sources.postgres);
  report.acceptance = summarizeAcceptance(report);

  const json = `${JSON.stringify(report, null, 2)}\n`;

  if (outPath) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, json, "utf8");
    console.log(`Wrote ${outPath}`);
  } else {
    process.stdout.write(json);
  }

  if (
    strict &&
    (report.acceptance.dynamodb_required_row_counts !== "complete" ||
      report.acceptance.postgres_core_row_counts !== "complete" ||
      report.acceptance.tmdb_watch_provider_inventory !== "complete" ||
      report.acceptance.sample_movie_comparison !== "complete")
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
