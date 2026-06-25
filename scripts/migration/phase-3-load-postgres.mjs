#!/usr/bin/env node

import path from "node:path";

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import {
  DEFAULT_TRANSFORMED_DIR,
  chunkArray,
  getArg,
  hasArg,
  nowIso,
  parseIntegerArg,
  parseListArg,
  quoteIdentifier,
  readAllJsonRows,
  writeJsonFile,
} from "./phase-3-common.mjs";

const MOVIE_COLUMNS = [
  "movie_slug",
  "title",
  "director",
  "release_year",
  "duration_minutes",
  "content_rating",
  "letterboxd_avg_rating",
  "letterboxd_popularity",
  "genres",
  "nanogenres",
  "tagline",
  "description",
  "letterboxd_link",
  "poster_url",
  "tmdb_id",
  "darkness_level",
  "funniness_level",
  "slowness_level",
  "intenseness_level",
  "updated_at",
];

const USER_COLUMNS = ["username", "email", "name", "password_hash", "is_admin", "streaming_services", "created_at", "updated_at"];
const SAVED_MOVIE_COLUMNS = ["username", "movie_slug", "saved_at"];
const DEFAULT_ENTITIES = ["movies", "users", "user_saved_movies"];

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-3-load-postgres.mjs

Loads transformed Phase 3 NDJSON artifacts into Neon Postgres.

Options:
  --in-dir PATH           Input directory. Defaults to ${DEFAULT_TRANSFORMED_DIR}
  --entities A,B          Entities to load. Defaults to ${DEFAULT_ENTITIES.join(",")}
  --batch-size N          Insert batch size. Defaults to 250
  --skip-invalid-refs     Skip saved-movie rows whose user or movie is absent
  --dry-run               Read and validate files without writing to Postgres
  --report PATH           Write a JSON load report
  --help                  Show this help
`);
}

function createSql() {
  return postgres(getDatabaseUrl({ direct: true }), {
    ssl: "require",
    prepare: false,
  });
}

function prepareRows(rows, columns) {
  return rows.map((row) => Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
}

function nullPreservingSet(tableName, columns, keyColumns = []) {
  return columns
    .filter((column) => !keyColumns.includes(column))
    .map((column) => {
      const quoted = quoteIdentifier(column);
      return `${quoted} = coalesce(excluded.${quoted}, public.${tableName}.${quoted})`;
    })
    .join(", ");
}

async function insertMovies(sql, rows, dryRun) {
  const preparedRows = prepareRows(rows, MOVIE_COLUMNS);
  const updateSet = nullPreservingSet("movies", MOVIE_COLUMNS, ["movie_slug"]);

  if (dryRun || preparedRows.length === 0) return;

  await sql`
    insert into public.movies ${sql(preparedRows, MOVIE_COLUMNS)}
    on conflict (movie_slug) do update set ${sql.unsafe(updateSet)}
  `;
}

async function insertUsers(sql, rows, dryRun) {
  const preparedRows = prepareRows(rows, USER_COLUMNS);
  const updateSet = [
    "email = excluded.email",
    "name = coalesce(excluded.name, public.users.name)",
    "password_hash = coalesce(excluded.password_hash, public.users.password_hash)",
    "is_admin = excluded.is_admin",
    "streaming_services = excluded.streaming_services",
    "created_at = coalesce(public.users.created_at, excluded.created_at)",
    "updated_at = coalesce(excluded.updated_at, public.users.updated_at, now())",
  ].join(", ");

  if (dryRun || preparedRows.length === 0) return;

  await sql`
    insert into public.users ${sql(preparedRows, USER_COLUMNS)}
    on conflict (username) do update set ${sql.unsafe(updateSet)}
  `;
}

async function insertSavedMovies(sql, rows, dryRun) {
  const preparedRows = prepareRows(rows, SAVED_MOVIE_COLUMNS);

  if (dryRun || preparedRows.length === 0) return;

  await sql`
    insert into public.user_saved_movies ${sql(preparedRows, SAVED_MOVIE_COLUMNS)}
    on conflict (username, movie_slug) do update set
      saved_at = coalesce(excluded.saved_at, public.user_saved_movies.saved_at)
  `;
}

async function existingValues(sql, tableName, columnName, values) {
  if (values.length === 0) return new Set();
  const found = new Set();

  for (const batch of chunkArray(values, 1000)) {
    const rows = await sql.unsafe(
      `select ${quoteIdentifier(columnName)} as value from public.${quoteIdentifier(tableName)} where ${quoteIdentifier(columnName)} in (${batch
        .map((_, index) => `$${index + 1}`)
        .join(", ")})`,
      batch
    );
    rows.forEach((row) => found.add(row.value));
  }

  return found;
}

async function filterSavedMovieRefs(sql, rows) {
  const usernames = [...new Set(rows.map((row) => row.username).filter(Boolean))];
  const movieSlugs = [...new Set(rows.map((row) => row.movie_slug).filter(Boolean))];
  const existingUsers = await existingValues(sql, "users", "username", usernames);
  const existingMovies = await existingValues(sql, "movies", "movie_slug", movieSlugs);
  const kept = [];
  const skipped = [];

  for (const row of rows) {
    if (!existingUsers.has(row.username) || !existingMovies.has(row.movie_slug)) {
      skipped.push(row);
      continue;
    }
    kept.push(row);
  }

  return { kept, skipped };
}

async function loadEntity(sql, entity, options) {
  const fileMap = {
    movies: "movies.ndjson",
    users: "users.ndjson",
    user_saved_movies: "user_saved_movies.ndjson",
  };
  const insertMap = {
    movies: insertMovies,
    users: insertUsers,
    user_saved_movies: insertSavedMovies,
  };

  if (!fileMap[entity]) {
    throw new Error(`Unknown entity "${entity}"`);
  }

  const filePath = path.join(options.inDir, fileMap[entity]);
  let rows = await readAllJsonRows(filePath);
  const sourceRowCount = rows.length;
  const startedAt = nowIso();
  let skippedInvalidRefs = 0;

  if (entity === "user_saved_movies" && options.skipInvalidRefs && !options.dryRun) {
    const filtered = await filterSavedMovieRefs(sql, rows);
    rows = filtered.kept;
    skippedInvalidRefs = filtered.skipped.length;
  }

  let loadedCount = 0;
  const batches = chunkArray(rows, options.batchSize);

  for (const [index, batch] of batches.entries()) {
    await insertMap[entity](sql, batch, options.dryRun);
    loadedCount += batch.length;
    console.log(`  ${entity}: batch ${index + 1}/${batches.length} (${loadedCount}/${rows.length})`);
  }

  return {
    entity,
    source_file: filePath,
    source_row_count: sourceRowCount,
    loaded_row_count: loadedCount,
    skipped_invalid_refs: skippedInvalidRefs,
    dry_run: options.dryRun,
    started_at: startedAt,
    finished_at: nowIso(),
  };
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const inDir = getArg("--in-dir", DEFAULT_TRANSFORMED_DIR);
  const entities = parseListArg("--entities", DEFAULT_ENTITIES);
  const batchSize = parseIntegerArg("--batch-size", 250);
  const dryRun = hasArg("--dry-run");
  const skipInvalidRefs = hasArg("--skip-invalid-refs");
  const reportPath = getArg("--report", path.join(inDir, "phase-3-load-report.json"));

  const sql = dryRun ? null : createSql();
  const results = [];

  try {
    for (const entity of entities) {
      console.log(`${dryRun ? "Checking" : "Loading"} ${entity}...`);
      results.push(await loadEntity(sql, entity, { inDir, batchSize, dryRun, skipInvalidRefs }));
    }
  } finally {
    await sql?.end({ timeout: 5 }).catch(() => {});
  }

  const report = {
    generated_at: nowIso(),
    phase: "phase-3-data-migration",
    in_dir: inDir,
    dry_run: dryRun,
    results,
  };
  await writeJsonFile(reportPath, report);
  console.log(`Wrote load report to ${reportPath}`);
}

main().catch((error) => {
  console.error(`Phase 3 Postgres load failed: ${error.message}`);
  process.exit(1);
});
