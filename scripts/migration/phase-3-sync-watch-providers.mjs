#!/usr/bin/env node

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import {
  WATCH_AVAILABILITY_TYPES,
  getArg,
  hasArg,
  mapWithConcurrency,
  normalizeWatchProviderForPostgres,
  nowIso,
  parseIntegerArg,
  parseListArg,
  writeJsonFile,
} from "./phase-3-common.mjs";

const PROVIDER_COLUMNS = ["provider_id", "provider_name", "logo_path", "display_priority", "raw_tmdb"];
const MOVIE_PROVIDER_COLUMNS = ["movie_slug", "tmdb_id", "region", "provider_id", "availability_type", "tmdb_link", "fetched_at", "raw_tmdb"];

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-3-sync-watch-providers.mjs

Backfills TMDB Watch Providers data into Neon Postgres for Phase 3.

Options:
  --region US           Watch-provider region. Defaults to US
  --limit N             Movies to refresh in this run. Defaults to 100
  --offset N            Offset into movie list. Defaults to 0
  --movie-slugs A,B     Refresh explicit movie slugs instead of limit/offset
  --concurrency N       Concurrent TMDB movie requests. Defaults to 2
  --catalog-only        Only refresh watch_providers catalog
  --skip-catalog        Do not refresh watch_providers catalog before movies
  --dry-run             Fetch and report without writing to Postgres
  --report PATH         Write a JSON report. Defaults to docs/migration/phase-3-watch-provider-sync-report.json
  --help                Show this help
`);
}

function createSql() {
  return postgres(getDatabaseUrl({ direct: true }), {
    ssl: "require",
    prepare: false,
  });
}

function tmdbHeaders() {
  if (!process.env.TMDB_AUTH_TOKEN) {
    throw new Error("TMDB_AUTH_TOKEN is not set");
  }

  return {
    Authorization: `Bearer ${process.env.TMDB_AUTH_TOKEN}`,
    Accept: "application/json",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTmdbJson(url, { maxRetries = 5 } = {}) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    const response = await fetch(url, { headers: tmdbHeaders() });

    if (response.ok) {
      return response.json();
    }

    const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") || "", 10);
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt > maxRetries) {
      const text = await response.text().catch(() => "");
      throw new Error(`TMDB returned ${response.status} for ${url}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }

    const backoffMs = Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : Math.min(30000, 1000 * 2 ** (attempt - 1));
    await sleep(backoffMs);
  }
}

async function fetchProviderCatalog(region) {
  const url = `https://api.themoviedb.org/3/watch/providers/movie?language=en-US&watch_region=${encodeURIComponent(region)}`;
  const body = await fetchTmdbJson(url);
  return Array.isArray(body.results) ? body.results : [];
}

async function upsertProviderCatalog(sql, providers, dryRun) {
  const rows = providers
    .map(normalizeWatchProviderForPostgres)
    .filter((provider) => provider.provider_id && provider.provider_name)
    .map((provider) => ({
      ...provider,
      raw_tmdb: JSON.stringify(provider.raw_tmdb),
    }));

  if (dryRun || rows.length === 0) return rows.length;

  await sql`
    insert into public.watch_providers ${sql(rows, PROVIDER_COLUMNS)}
    on conflict (provider_id) do update set
      provider_name = excluded.provider_name,
      logo_path = excluded.logo_path,
      display_priority = excluded.display_priority,
      raw_tmdb = excluded.raw_tmdb,
      updated_at = now()
  `;

  return rows.length;
}

async function initializeSyncState(sql, region, dryRun) {
  if (dryRun) return null;

  const result = await sql`
    insert into public.movie_watch_provider_sync_state (movie_slug, tmdb_id, region, status)
    select movie_slug, tmdb_id, ${region}, 'never_fetched'
    from public.movies
    where tmdb_id is not null
    on conflict (movie_slug, region) do update set
      tmdb_id = excluded.tmdb_id
  `;

  return result.count ?? result.length;
}

async function selectMovies(sql, { region, limit, offset, movieSlugs }) {
  const params = [];
  const clauses = ["tmdb_id is not null"];

  if (movieSlugs.length > 0) {
    const placeholders = movieSlugs.map((slug) => {
      params.push(slug);
      return `$${params.length}`;
    });
    clauses.push(`movie_slug in (${placeholders.join(", ")})`);
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;
  params.push(offset);
  const offsetPlaceholder = `$${params.length}`;

  const rows = await sql.unsafe(
    `
      select movie_slug, tmdb_id
      from public.movies
      where ${clauses.join(" and ")}
      order by movie_slug
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
    `,
    params
  );

  return rows.map((row) => ({
    movie_slug: row.movie_slug,
    tmdb_id: Number(row.tmdb_id),
    region,
  }));
}

async function fetchMovieAvailability(tmdbId) {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`;
  return fetchTmdbJson(url);
}

function buildAvailabilityRows(movie, body, region, fetchedAt) {
  const regionPayload = body.results?.[region] ?? null;
  const rows = [];

  if (!regionPayload) {
    return {
      status: "not_available",
      tmdb_link: null,
      rows,
    };
  }

  for (const availabilityType of WATCH_AVAILABILITY_TYPES) {
    const providers = Array.isArray(regionPayload[availabilityType]) ? regionPayload[availabilityType] : [];
    for (const provider of providers) {
      const providerId = Number.parseInt(provider.provider_id, 10);
      if (!Number.isFinite(providerId)) continue;

      rows.push({
        movie_slug: movie.movie_slug,
        tmdb_id: movie.tmdb_id,
        region,
        provider_id: providerId,
        availability_type: availabilityType,
        tmdb_link: regionPayload.link ?? null,
        fetched_at: fetchedAt,
        raw_tmdb: JSON.stringify(provider),
      });
    }
  }

  return {
    status: "ok",
    tmdb_link: regionPayload.link ?? null,
    rows,
  };
}

async function updateErrorState(sql, movie, region, error, dryRun) {
  if (dryRun) return;

  await sql`
    insert into public.movie_watch_provider_sync_state
      (movie_slug, tmdb_id, region, fetched_at, status, provider_count, last_error)
    values
      (${movie.movie_slug}, ${movie.tmdb_id}, ${region}, now(), 'error', 0, ${error.message})
    on conflict (movie_slug, region) do update set
      tmdb_id = excluded.tmdb_id,
      fetched_at = excluded.fetched_at,
      status = excluded.status,
      provider_count = excluded.provider_count,
      last_error = excluded.last_error
  `;
}

async function replaceMovieAvailability(sql, movie, region, availability, dryRun) {
  if (dryRun) return;

  await sql.begin(async (tx) => {
    await tx`
      delete from public.movie_watch_providers
      where movie_slug = ${movie.movie_slug}
        and region = ${region}
    `;

    if (availability.rows.length > 0) {
      await tx`
        insert into public.movie_watch_providers ${tx(availability.rows, MOVIE_PROVIDER_COLUMNS)}
        on conflict (movie_slug, region, provider_id, availability_type) do update set
          tmdb_id = excluded.tmdb_id,
          tmdb_link = excluded.tmdb_link,
          fetched_at = excluded.fetched_at,
          raw_tmdb = excluded.raw_tmdb
      `;
    }

    await tx`
      insert into public.movie_watch_provider_sync_state
        (movie_slug, tmdb_id, region, fetched_at, status, provider_count, last_error)
      values
        (${movie.movie_slug}, ${movie.tmdb_id}, ${region}, ${availability.fetched_at}, ${availability.status}, ${availability.rows.length}, null)
      on conflict (movie_slug, region) do update set
        tmdb_id = excluded.tmdb_id,
        fetched_at = excluded.fetched_at,
        status = excluded.status,
        provider_count = excluded.provider_count,
        last_error = null
    `;
  });
}

async function refreshMovie(sql, movie, region, dryRun) {
  try {
    const body = await fetchMovieAvailability(movie.tmdb_id);
    const fetchedAt = nowIso();
    const availability = {
      ...buildAvailabilityRows(movie, body, region, fetchedAt),
      fetched_at: fetchedAt,
    };

    await replaceMovieAvailability(sql, movie, region, availability, dryRun);

    return {
      movie_slug: movie.movie_slug,
      tmdb_id: movie.tmdb_id,
      status: availability.status,
      provider_count: availability.rows.length,
      tmdb_link: availability.tmdb_link,
    };
  } catch (error) {
    await updateErrorState(sql, movie, region, error, dryRun);
    return {
      movie_slug: movie.movie_slug,
      tmdb_id: movie.tmdb_id,
      status: "error",
      provider_count: 0,
      error: error.message,
    };
  }
}

async function startRun(sql, region, dryRun) {
  if (dryRun) return null;
  const rows = await sql`
    insert into public.watch_provider_sync_runs (region, status)
    values (${region}, 'running')
    returning id
  `;
  return rows[0].id;
}

async function finishRun(sql, runId, { status, moviesChecked, moviesUpdated, error }, dryRun) {
  if (dryRun || !runId) return;
  await sql`
    update public.watch_provider_sync_runs
    set finished_at = now(),
        status = ${status},
        movies_checked = ${moviesChecked},
        movies_updated = ${moviesUpdated},
        error = ${error ?? null}
    where id = ${runId}
  `;
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const region = getArg("--region", "US").toUpperCase();
  const limit = parseIntegerArg("--limit", 100);
  const offset = parseIntegerArg("--offset", 0);
  const movieSlugs = parseListArg("--movie-slugs", []);
  const concurrency = parseIntegerArg("--concurrency", 2);
  const catalogOnly = hasArg("--catalog-only");
  const skipCatalog = hasArg("--skip-catalog");
  const dryRun = hasArg("--dry-run");
  const reportPath = getArg("--report", "docs/migration/phase-3-watch-provider-sync-report.json");

  const sql = createSql();
  let runId = null;
  let runError = null;
  let movieResults = [];
  let providerCatalogCount = null;
  let initializedSyncRows = null;

  try {
    if (!skipCatalog) {
      console.log(`Fetching TMDB watch-provider catalog for ${region}...`);
      const providers = await fetchProviderCatalog(region);
      providerCatalogCount = await upsertProviderCatalog(sql, providers, dryRun);
      console.log(`  ${dryRun ? "checked" : "upserted"} ${providerCatalogCount} providers`);
    }

    if (!catalogOnly) {
      initializedSyncRows = await initializeSyncState(sql, region, dryRun);
      if (initializedSyncRows !== null) {
        console.log(`Initialized or refreshed ${initializedSyncRows} sync-state rows`);
      }

      const movies = await selectMovies(sql, { region, limit, offset, movieSlugs });
      console.log(`Refreshing ${movies.length} movies for ${region} availability...`);

      runId = await startRun(sql, region, dryRun);
      movieResults = await mapWithConcurrency(movies, concurrency, async (movie, index) => {
        const result = await refreshMovie(sql, movie, region, dryRun);
        console.log(`  ${index + 1}/${movies.length} ${movie.movie_slug}: ${result.status} (${result.provider_count})`);
        return result;
      });
    }
  } catch (error) {
    runError = error;
    throw error;
  } finally {
    const moviesUpdated = movieResults.filter((result) => result.status !== "error").length;
    await finishRun(
      sql,
      runId,
      {
        status: runError ? "error" : "finished",
        moviesChecked: movieResults.length,
        moviesUpdated,
        error: runError?.message,
      },
      dryRun
    ).catch(() => {});

    await sql.end({ timeout: 5 }).catch(() => {});
  }

  const report = {
    generated_at: nowIso(),
    phase: "phase-3-data-migration",
    dry_run: dryRun,
    region,
    limit,
    offset,
    movie_slugs: movieSlugs,
    provider_catalog_count: providerCatalogCount,
    initialized_sync_rows: initializedSyncRows,
    movie_results: movieResults,
    summary: {
      checked: movieResults.length,
      succeeded: movieResults.filter((result) => result.status !== "error").length,
      errored: movieResults.filter((result) => result.status === "error").length,
      provider_rows: movieResults.reduce((count, result) => count + (result.provider_count || 0), 0),
    },
  };
  await writeJsonFile(reportPath, report);
  console.log(`Wrote watch-provider sync report to ${reportPath}`);
}

main().catch((error) => {
  console.error(`Phase 3 watch-provider sync failed: ${error.message}`);
  process.exit(1);
});
