#!/usr/bin/env node

import path from "node:path";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

import {
  DEFAULT_RAW_DIR,
  DYNAMODB_EXPORT_TABLES,
  ensureDirectory,
  getArg,
  hasArg,
  nowIso,
  parseIntegerArg,
  parseListArg,
  tableFileName,
  writeJsonFile,
  writeNdjson,
} from "./phase-3-common.mjs";

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-3-export-dynamodb.mjs

Exports DynamoDB source tables for Phase 3 into local migration artifacts.

Options:
  --out-dir PATH       Output directory. Defaults to ${DEFAULT_RAW_DIR}
  --tables A,B         Tables to export. Defaults to ${DYNAMODB_EXPORT_TABLES.join(",")}
  --format ndjson|json Output format. Defaults to ndjson
  --page-size N        DynamoDB scan page size. Defaults to 1000
  --limit N            Maximum rows per table, useful for rehearsal runs
  --help               Show this help
`);
}

function createDynamoClient() {
  const options = {
    region: process.env.AWS_REGION || "us-east-2",
  };

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    options.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  return DynamoDBDocumentClient.from(new DynamoDBClient(options));
}

async function scanTable(docClient, tableName, { limit, pageSize }) {
  const rows = [];
  let lastEvaluatedKey = undefined;
  let scannedCount = 0;
  const hasLimit = Number.isFinite(limit);

  do {
    const remaining = hasLimit ? limit - rows.length : pageSize;
    if (hasLimit && remaining <= 0) break;

    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        Limit: Math.min(pageSize, remaining),
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      })
    );

    rows.push(...(result.Items || []));
    scannedCount += result.ScannedCount || 0;
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey && (!hasLimit || rows.length < limit));

  return {
    rows: hasLimit ? rows.slice(0, limit) : rows,
    scannedCount,
    complete: !lastEvaluatedKey,
  };
}

async function exportTable(docClient, tableName, options) {
  const { outDir, format, limit, pageSize } = options;
  const extension = format === "json" ? "json" : "ndjson";
  const filePath = path.join(outDir, tableFileName(tableName, extension));
  const startedAt = nowIso();

  const { rows, scannedCount, complete } = await scanTable(docClient, tableName, { limit, pageSize });

  if (format === "json") {
    await writeJsonFile(filePath, rows);
  } else {
    await writeNdjson(filePath, rows);
  }

  return {
    table: tableName,
    status: "ok",
    file: filePath,
    format,
    row_count: rows.length,
    scanned_count: scannedCount,
    complete,
    started_at: startedAt,
    finished_at: nowIso(),
  };
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const outDir = getArg("--out-dir", DEFAULT_RAW_DIR);
  const tables = parseListArg("--tables", DYNAMODB_EXPORT_TABLES);
  const format = getArg("--format", "ndjson");
  const pageSize = parseIntegerArg("--page-size", 1000);
  const limit = parseIntegerArg("--limit", null);

  if (!["ndjson", "json"].includes(format)) {
    throw new Error("--format must be ndjson or json");
  }

  await ensureDirectory(outDir);
  const docClient = createDynamoClient();
  const exports = [];

  for (const tableName of tables) {
    console.log(`Exporting DynamoDB table ${tableName}...`);
    exports.push(await exportTable(docClient, tableName, { outDir, format, limit, pageSize }));
    const latest = exports.at(-1);
    console.log(`  wrote ${latest.row_count} rows to ${latest.file}`);
  }

  const manifest = {
    generated_at: nowIso(),
    phase: "phase-3-data-migration",
    source: "dynamodb",
    region: process.env.AWS_REGION || "us-east-2",
    exports,
  };
  const manifestPath = path.join(outDir, "dynamodb-export-manifest.json");
  await writeJsonFile(manifestPath, manifest);
  console.log(`Wrote manifest to ${manifestPath}`);
}

main().catch((error) => {
  console.error(`Phase 3 DynamoDB export failed: ${error.message}`);
  process.exit(1);
});
