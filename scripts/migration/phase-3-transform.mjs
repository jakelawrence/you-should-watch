#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_RAW_DIR,
  DEFAULT_TRANSFORMED_DIR,
  ensureDirectory,
  getArg,
  hasArg,
  normalizeMovieForPostgres,
  normalizeSavedMovieForPostgres,
  normalizeUserForPostgres,
  nowIso,
  pathExists,
  readAllJsonRows,
  summarizeRows,
  tableFileName,
  writeJsonFile,
  writeNdjson,
} from "./phase-3-common.mjs";

const TRANSFORMS = [
  {
    sourceTable: "movies",
    targetFile: "movies.ndjson",
    keyField: "movie_slug",
    normalize: normalizeMovieForPostgres,
    dedupeKey: (row) => row.movie_slug,
    requiredFields: ["movie_slug"],
  },
  {
    sourceTable: "users",
    targetFile: "users.ndjson",
    keyField: "username",
    normalize: normalizeUserForPostgres,
    dedupeKey: (row) => row.username,
    requiredFields: ["username", "email"],
  },
  {
    sourceTable: "user-saved-movies",
    targetFile: "user_saved_movies.ndjson",
    keyField: "username",
    normalize: normalizeSavedMovieForPostgres,
    dedupeKey: (row) => `${row.username}\u0000${row.movie_slug}`,
    requiredFields: ["username", "movie_slug"],
  },
];

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-3-transform.mjs

Transforms Phase 3 DynamoDB exports into Postgres-shaped NDJSON.

Options:
  --raw-dir PATH      Input export directory. Defaults to ${DEFAULT_RAW_DIR}
  --out-dir PATH      Output directory. Defaults to ${DEFAULT_TRANSFORMED_DIR}
  --strict            Exit non-zero if any required row is skipped
  --help              Show this help
`);
}

async function findSourceFile(rawDir, tableName) {
  const ndjsonPath = path.join(rawDir, tableFileName(tableName, "ndjson"));
  if (await pathExists(ndjsonPath)) return ndjsonPath;

  const jsonPath = path.join(rawDir, tableFileName(tableName, "json"));
  if (await pathExists(jsonPath)) return jsonPath;

  throw new Error(`Missing export for ${tableName}; expected ${ndjsonPath} or ${jsonPath}`);
}

function transformRows(rawRows, transform) {
  const deduped = new Map();
  const skipped = [];

  for (const [index, rawRow] of rawRows.entries()) {
    const row = transform.normalize(rawRow);
    const missingFields = transform.requiredFields.filter((field) => !row[field]);

    if (missingFields.length > 0) {
      skipped.push({
        source_index: index,
        reason: `missing ${missingFields.join(", ")}`,
        row,
      });
      continue;
    }

    deduped.set(transform.dedupeKey(row), row);
  }

  return {
    rows: [...deduped.values()],
    skipped,
    duplicate_count: rawRows.length - skipped.length - deduped.size,
  };
}

async function transformTable(rawDir, outDir, transform) {
  const sourceFile = await findSourceFile(rawDir, transform.sourceTable);
  const rawRows = await readAllJsonRows(sourceFile);
  const { rows, skipped, duplicate_count } = transformRows(rawRows, transform);
  const outPath = path.join(outDir, transform.targetFile);

  await writeNdjson(outPath, rows);

  return {
    source_table: transform.sourceTable,
    source_file: sourceFile,
    target_file: outPath,
    ...summarizeRows(rows, transform.keyField),
    source_row_count: rawRows.length,
    duplicate_count,
    skipped_count: skipped.length,
    skipped,
  };
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const rawDir = getArg("--raw-dir", DEFAULT_RAW_DIR);
  const outDir = getArg("--out-dir", DEFAULT_TRANSFORMED_DIR);
  const strict = hasArg("--strict");

  await ensureDirectory(outDir);

  const tables = [];
  for (const transform of TRANSFORMS) {
    console.log(`Transforming ${transform.sourceTable}...`);
    const result = await transformTable(rawDir, outDir, transform);
    tables.push(result);
    console.log(`  wrote ${result.row_count} rows to ${result.target_file}`);
    if (result.skipped_count > 0) {
      console.warn(`  skipped ${result.skipped_count} rows`);
    }
  }

  const report = {
    generated_at: nowIso(),
    phase: "phase-3-data-migration",
    raw_dir: rawDir,
    out_dir: outDir,
    tables,
  };
  const reportPath = path.join(outDir, "phase-3-transform-report.json");
  await writeJsonFile(reportPath, report);
  console.log(`Wrote transform report to ${reportPath}`);

  const skippedCount = tables.reduce((count, table) => count + table.skipped_count, 0);
  if (strict && skippedCount > 0) {
    throw new Error(`Strict transform failed: ${skippedCount} required rows were skipped`);
  }
}

main().catch((error) => {
  console.error(`Phase 3 transform failed: ${error.message}`);
  process.exit(1);
});
