#!/usr/bin/env node

import path from "node:path";

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import {
  DEFAULT_TRANSFORMED_DIR,
  getArg,
  hasArg,
  nowIso,
  parseListArg,
  pathExists,
  quoteIdentifier,
  readAllJsonRows,
  writeJsonFile,
} from "./phase-3-common.mjs";

const REQUIRED_POSTGRES_TABLES = ["movies", "users", "user_saved_movies"];
const OPTIONAL_POSTGRES_TABLES = ["watch_providers", "movie_watch_providers", "movie_watch_provider_sync_state"];
const SOURCE_FILES = {
  movies: "movies.ndjson",
  users: "users.ndjson",
  user_saved_movies: "user_saved_movies.ndjson",
};

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-3-validate.mjs

Validates the Phase 3 data migration in Neon Postgres.

Options:
  --source-dir PATH       Transformed input directory. Defaults to ${DEFAULT_TRANSFORMED_DIR}
  --out PATH              JSON report path. Defaults to docs/migration/phase-3-validation.json
  --sample-slugs A,B      Sample slugs to inspect. Defaults to the-night-of-the-hunter
  --known-user USERNAME   User to validate saved movies and streaming preferences
  --provider-movie SLUG   Movie slug expected to have watch-provider rows
  --region US             Watch-provider region. Defaults to US
  --strict                Exit non-zero when required checks fail
  --help                  Show this help
`);
}

function createSql() {
  return postgres(getDatabaseUrl({ direct: true }), {
    ssl: "require",
    prepare: false,
  });
}

async function countTable(sql, tableName) {
  const exists = await sql`select to_regclass(${`public.${tableName}`}) as name`;
  if (!exists[0]?.name) {
    return { status: "missing", row_count: null };
  }

  const rows = await sql.unsafe(`select count(*)::bigint as row_count from public.${quoteIdentifier(tableName)}`);
  return { status: "ok", row_count: Number(rows[0].row_count) };
}

function columnExpression(columns, columnName, fallbackType = "text") {
  if (columns.has(columnName)) return quoteIdentifier(columnName);
  return `null::${fallbackType} as ${quoteIdentifier(columnName)}`;
}

async function readSourceCounts(sourceDir) {
  const counts = {};

  for (const [entity, fileName] of Object.entries(SOURCE_FILES)) {
    const filePath = path.join(sourceDir, fileName);
    if (!(await pathExists(filePath))) {
      counts[entity] = {
        status: "missing",
        file: filePath,
        row_count: null,
      };
      continue;
    }

    const rows = await readAllJsonRows(filePath);
    counts[entity] = {
      status: "ok",
      file: filePath,
      row_count: rows.length,
    };
  }

  return counts;
}

async function sampleMovies(sql, sampleSlugs) {
  if (sampleSlugs.length === 0) return [];
  const columnRows = await sql`
    select column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'movies'
  `;
  const columns = new Set(columnRows.map((row) => row.column_name));
  const selectList = [
    "movie_slug",
    "title",
    "release_year",
    "duration_minutes",
    "content_rating",
    "letterboxd_avg_rating",
    "genres",
    "nanogenres",
    "poster_url",
    "tmdb_id",
    columnExpression(columns, "darkness_level", "smallint"),
    columnExpression(columns, "funniness_level", "smallint"),
    columnExpression(columns, "slowness_level", "smallint"),
    columnExpression(columns, "intenseness_level", "smallint"),
    "embedding_overall is not null as has_embedding_overall",
  ];
  const placeholders = sampleSlugs.map((_, index) => `$${index + 1}`).join(", ");
  const rows = await sql.unsafe(
    `
      select ${selectList.join(", ")}
      from public.movies
      where movie_slug in (${placeholders})
      order by movie_slug
    `,
    sampleSlugs
  );

  return rows;
}

async function embeddingSummary(sql) {
  const rows = await sql`
    select
      count(*)::bigint as movie_count,
      count(*) filter (where embedding_overall is not null)::bigint as embedding_overall_count
    from public.movies
  `;

  return {
    movie_count: Number(rows[0].movie_count),
    embedding_overall_count: Number(rows[0].embedding_overall_count),
  };
}

async function similaritySample(sql, seedSlug) {
  const seedRows = await sql`
    select movie_slug, title, embedding_overall is not null as has_embedding
    from public.movies
    where movie_slug = ${seedSlug}
  `;

  if (seedRows.length === 0) {
    return {
      status: "missing_seed",
      seed_slug: seedSlug,
      rows: [],
    };
  }

  if (!seedRows[0].has_embedding) {
    return {
      status: "missing_seed_embedding",
      seed_slug: seedSlug,
      rows: [],
    };
  }

  const rows = await sql`
    select
      movie_slug,
      title,
      (embedding_overall <=> (
        select embedding_overall
        from public.movies
        where movie_slug = ${seedSlug}
      ))::float as distance
    from public.movies
    where movie_slug != ${seedSlug}
      and embedding_overall is not null
    order by distance
    limit 10
  `;

  return {
    status: rows.length > 0 ? "ok" : "empty",
    seed_slug: seedSlug,
    rows,
  };
}

async function userValidation(sql, knownUser) {
  if (knownUser) {
    const rows = await sql`
      select
        u.username,
        u.email,
        u.streaming_services,
        count(sm.movie_slug)::bigint as saved_movie_count
      from public.users u
      left join public.user_saved_movies sm on sm.username = u.username
      where u.username = ${knownUser}
      group by u.username, u.email, u.streaming_services
    `;

    return {
      mode: "known_user",
      username: knownUser,
      status: rows.length > 0 ? "ok" : "missing",
      row: rows[0] ?? null,
    };
  }

  const rows = await sql`
    select
      u.username,
      u.email,
      u.streaming_services,
      count(sm.movie_slug)::bigint as saved_movie_count
    from public.users u
    left join public.user_saved_movies sm on sm.username = u.username
    group by u.username, u.email, u.streaming_services
    order by saved_movie_count desc, u.username
    limit 1
  `;

  return {
    mode: "first_available_user",
    status: rows.length > 0 ? "ok" : "missing",
    row: rows[0] ?? null,
  };
}

async function providerValidation(sql, { providerMovie, region }) {
  const providerTable = await sql`select to_regclass('public.watch_providers') as name`;
  const availabilityTable = await sql`select to_regclass('public.movie_watch_providers') as name`;
  if (!providerTable[0]?.name || !availabilityTable[0]?.name) {
    return {
      catalog: {
        status: "not_loaded",
        provider_count: 0,
        named_provider_count: 0,
      },
      sample_movie: {
        status: "not_loaded",
        reason: "Watch-provider tables are not present in this Neon database.",
        availability_count: 0,
        rows: [],
      },
    };
  }

  const catalogRows = await sql`
    select
      count(*)::bigint as provider_count,
      count(*) filter (where provider_name is not null)::bigint as named_provider_count
    from public.watch_providers
  `;

  const availabilityRows = providerMovie
    ? await sql`
        select
          mwp.movie_slug,
          mwp.provider_id,
          wp.provider_name,
          mwp.availability_type,
          mwp.region,
          mwp.tmdb_link
        from public.movie_watch_providers mwp
        join public.watch_providers wp on wp.provider_id = mwp.provider_id
        where mwp.movie_slug = ${providerMovie}
          and mwp.region = ${region}
        order by mwp.availability_type, wp.provider_name
        limit 25
      `
    : [];

  return {
    catalog: {
      provider_count: Number(catalogRows[0].provider_count),
      named_provider_count: Number(catalogRows[0].named_provider_count),
    },
    sample_movie: providerMovie
      ? {
          movie_slug: providerMovie,
          region,
          availability_count: availabilityRows.length,
          rows: availabilityRows,
        }
      : {
          status: "skipped",
          reason: "No --provider-movie slug supplied",
        },
  };
}

function buildAcceptance({ sourceCounts, postgresCounts, samples, embeddings, similarity, user, providers }) {
  const countChecks = Object.entries(SOURCE_FILES).map(([entity]) => {
    const sourceCount = sourceCounts[entity]?.row_count;
    const postgresCount = postgresCounts[entity]?.row_count;
    if (!Number.isFinite(sourceCount)) {
      return { entity, status: "not_checked", reason: "source file missing" };
    }
    return {
      entity,
      source_count: sourceCount,
      postgres_count: postgresCount,
      status: sourceCount === postgresCount ? "matched" : "diff",
    };
  });

  const failedRequiredChecks = [
    ...REQUIRED_POSTGRES_TABLES.filter((table) => postgresCounts[table]?.status !== "ok").map((table) => ({
      status: "failed",
      reason: `required table public.${table} is ${postgresCounts[table]?.status || "unknown"}`,
    })),
    ...(samples.length > 0 ? [] : [{ status: "failed", reason: "sample movie missing" }]),
    ...(embeddings.embedding_overall_count > 0 ? [] : [{ status: "failed", reason: "no movie embeddings found" }]),
    ...(similarity.status === "ok" ? [] : [{ status: "failed", reason: `similarity query status ${similarity.status}` }]),
    ...(user.status === "ok" ? [] : [{ status: "failed", reason: "no user row available for validation" }]),
  ];

  return {
    row_count_checks: countChecks,
    sample_movie_data: samples.length > 0 ? "complete" : "incomplete",
    embedding_overall_count: embeddings.embedding_overall_count > 0 ? "complete" : "incomplete",
    single_movie_similarity: similarity.status,
    saved_movies_and_streaming_preferences: user.status,
    watch_provider_catalog: providers.catalog.provider_count > 0 ? "complete" : providers.catalog.status || "not_loaded",
    sample_movie_watch_availability: providers.sample_movie.availability_count > 0 ? "complete" : "not_checked_or_empty",
    request_time_tmdb_dependency: "not checked by this script; verify route code during Phase 4/5 cutover",
    status: failedRequiredChecks.length === 0 ? "passed" : "failed",
    failed_required_checks: failedRequiredChecks,
  };
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const sourceDir = getArg("--source-dir", DEFAULT_TRANSFORMED_DIR);
  const outPath = getArg("--out", "docs/migration/phase-3-validation.json");
  const sampleSlugs = parseListArg("--sample-slugs", ["the-night-of-the-hunter"]);
  const knownUser = getArg("--known-user", null);
  const providerMovie = getArg("--provider-movie", sampleSlugs[0] ?? null);
  const region = getArg("--region", "US").toUpperCase();
  const strict = hasArg("--strict");

  const sql = createSql();

  try {
    const sourceCounts = await readSourceCounts(sourceDir);
    const postgresCounts = {};
    for (const tableName of [...REQUIRED_POSTGRES_TABLES, ...OPTIONAL_POSTGRES_TABLES]) {
      postgresCounts[tableName] = await countTable(sql, tableName);
    }

    const samples = await sampleMovies(sql, sampleSlugs);
    const embeddings = await embeddingSummary(sql);
    const similarity = await similaritySample(sql, sampleSlugs[0]);
    const user = await userValidation(sql, knownUser);
    const providers = await providerValidation(sql, { providerMovie, region });

    const report = {
      generated_at: nowIso(),
      phase: "phase-3-data-migration",
      source_dir: sourceDir,
      region,
      source_counts: sourceCounts,
      postgres_counts: postgresCounts,
      samples,
      embeddings,
      similarity,
      user,
      providers,
      acceptance: {},
    };
    report.acceptance = buildAcceptance({ sourceCounts, postgresCounts, samples, embeddings, similarity, user, providers });

    await writeJsonFile(outPath, report);
    console.log(`Wrote Phase 3 validation report to ${outPath}`);
    console.log(`Acceptance status: ${report.acceptance.status}`);

    if (strict && report.acceptance.status !== "passed") {
      throw new Error("Strict validation failed");
    }
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Phase 3 validation failed: ${error.message}`);
  process.exit(1);
});
