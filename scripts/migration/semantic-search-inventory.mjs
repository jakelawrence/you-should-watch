#!/usr/bin/env node

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import { getArg, hasArg, nowIso, writeJsonFile } from "./phase-3-common.mjs";

const EMBEDDING_COLUMNS = [
  "embedding_overall",
  "embedding_thematic",
  "embedding_emotional",
  "embedding_stylistic",
  "embedding_performance",
  "embedding_technical",
  "embedding_audience",
  "embedding_semantic",
  "embedding_nanogenres",
];

function usage() {
  console.log(`
Usage:
  node scripts/migration/semantic-search-inventory.mjs

Checks Neon pgvector readiness for semantic movie search.

Options:
  --out PATH            Write JSON report. Defaults to docs/migration/semantic-search-inventory.json
  --sample-slug SLUG    Movie slug to use for a raw neighbor sample. Defaults to the-night-of-the-hunter
  --help                Show this help
`);
}

function createSql() {
  return postgres(getDatabaseUrl({ direct: true }), {
    ssl: "require",
    prepare: false,
  });
}

async function extensionSummary(sql) {
  const rows = await sql`
    select extname, extversion
    from pg_extension
    where extname in ('vector', 'pg_trgm')
    order by extname
  `;

  return Object.fromEntries(rows.map((row) => [row.extname, row.extversion]));
}

async function embeddingColumnSummary(sql) {
  const rows = await sql`
    select column_name, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'movies'
      and column_name = any(${EMBEDDING_COLUMNS})
    order by column_name
  `;

  return rows.map((row) => ({
    column: row.column_name,
    type: row.udt_name,
  }));
}

async function embeddingCoverage(sql) {
  const rows = await sql.unsafe(`
    select
      count(*)::int as total,
      ${EMBEDDING_COLUMNS.map(
        (column) => `count(*) filter (where ${column} is not null)::int as ${column}_count`,
      ).join(",\n      ")}
    from public.movies
  `);

  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    columns: Object.fromEntries(
      EMBEDDING_COLUMNS.map((column) => [
        column,
        {
          count: Number(row[`${column}_count`] || 0),
          coverage:
            Number(row.total || 0) > 0
              ? Number((Number(row[`${column}_count`] || 0) / Number(row.total || 0)).toFixed(4))
              : 0,
        },
      ]),
    ),
  };
}

async function vectorIndexes(sql) {
  return sql`
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'movies'
      and indexdef ilike '%vector%'
    order by indexname
  `;
}

async function candidateMetadataColumns(sql) {
  const rows = await sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'movies'
      and (
        column_name ilike '%embedding%model%'
        or column_name ilike '%embedding%version%'
        or column_name ilike '%model%'
      )
    order by column_name
  `;

  return rows;
}

async function sampleNeighbors(sql, sampleSlug) {
  const seedRows = await sql`
    select movie_slug, title, embedding_semantic is not null as has_semantic, embedding_overall is not null as has_overall
    from public.movies
    where movie_slug = ${sampleSlug}
    limit 1
  `;

  const seed = seedRows[0] || null;
  if (!seed) {
    return {
      status: "missing_seed",
      seed_slug: sampleSlug,
      neighbors: [],
    };
  }

  const column = seed.has_semantic ? "embedding_semantic" : seed.has_overall ? "embedding_overall" : null;
  if (!column) {
    return {
      status: "missing_seed_embedding",
      seed,
      neighbors: [],
    };
  }

  const rows = await sql.unsafe(
    `
      select movie_slug, title, ${column} <=> (
        select ${column}
        from public.movies
        where movie_slug = $1
        limit 1
      ) as distance
      from public.movies
      where movie_slug <> $1
        and ${column} is not null
      order by distance asc
      limit 10
    `,
    [sampleSlug],
  );

  return {
    status: "ok",
    seed,
    column,
    neighbors: rows.map((row) => ({
      movie_slug: row.movie_slug,
      title: row.title,
      distance: Number(row.distance),
    })),
  };
}

function pickRecommendedColumn({ coverage, indexes }) {
  const indexedColumns = new Set();
  for (const index of indexes) {
    for (const column of EMBEDDING_COLUMNS) {
      if (index.indexdef.includes(column)) {
        indexedColumns.add(column);
      }
    }
  }

  const semantic = coverage.columns.embedding_semantic;
  if (semantic?.count > 0 && indexedColumns.has("embedding_semantic")) {
    return "embedding_semantic";
  }

  const overall = coverage.columns.embedding_overall;
  if (overall?.count > 0 && indexedColumns.has("embedding_overall")) {
    return "embedding_overall";
  }

  return null;
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const outPath = getArg("--out", "docs/migration/semantic-search-inventory.json");
  const sampleSlug = getArg("--sample-slug", "the-night-of-the-hunter");
  const sql = createSql();

  try {
    const [extensions, columns, coverage, indexes, metadataColumns, sample] = await Promise.all([
      extensionSummary(sql),
      embeddingColumnSummary(sql),
      embeddingCoverage(sql),
      vectorIndexes(sql),
      candidateMetadataColumns(sql),
      sampleNeighbors(sql, sampleSlug),
    ]);

    const report = {
      generated_at: nowIso(),
      phase: "semantic-search-phase-1",
      embedding_dimension: 384,
      extensions,
      embedding_columns: columns,
      embedding_coverage: coverage,
      vector_indexes: indexes,
      candidate_embedding_metadata_columns: metadataColumns,
      recommended_embedding_column: pickRecommendedColumn({ coverage, indexes }),
      query_embedding_model_status:
        metadataColumns.length > 0
          ? "metadata_columns_present_review_values_manually"
          : "not_identified_in_schema_or_repo",
      sample_similarity: sample,
      acceptance: {
        vector_extension: extensions.vector ? "passed" : "failed",
        semantic_or_overall_coverage:
          (coverage.columns.embedding_semantic?.coverage || 0) >= 0.8 ||
          (coverage.columns.embedding_overall?.coverage || 0) >= 0.8
            ? "passed"
            : "failed",
        vector_index_available: indexes.length > 0 ? "passed" : "failed",
        sample_similarity: sample.status,
      },
    };

    await writeJsonFile(outPath, report);
    console.log(`Wrote semantic search inventory to ${outPath}`);
    console.log(`Recommended embedding column: ${report.recommended_embedding_column || "none"}`);
    console.log(`Query embedding model status: ${report.query_embedding_model_status}`);
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Semantic search inventory failed: ${error.message}`);
  process.exit(1);
});
