#!/usr/bin/env node
/**
 * Audit and re-assign TMDB IDs for all movies in the database.
 *
 * Strategy:
 *   Pass 1 — movies with imdb_id: use TMDB /find/{id}?external_source=imdb_id (guaranteed correct)
 *   Pass 2 — movies without imdb_id: search by title, filter to ±1 year, pick highest vote_count
 *
 * Updates: tmdb_id, tmdb_title, tmdb_release_date, tmdb_vote_average, tmdb_vote_count,
 *          tmdb_popularity, imdb_id (if newly discovered), runtime_minutes
 */

import path from "node:path";

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });

import postgres from "postgres";
import { getDatabaseUrl } from "./lib/postgres-url.mjs";
import {
  getArg,
  hasArg,
  mapWithConcurrency,
  nowIso,
  parseIntegerArg,
  parseListArg,
  writeJsonFile,
} from "./migration/phase-3-common.mjs";

const TMDB_BASE = "https://api.themoviedb.org/3";
const DEFAULT_CONCURRENCY = 5;
const DEFAULT_REPORT_PATH = "docs/migration/tmdb-id-audit-report.json";

function usage() {
  console.log(`
Usage:
  node scripts/audit-tmdb-ids.mjs [options]

Audits and re-assigns TMDB IDs for all movies. Re-fetches metadata from TMDB
using IMDB ID (most accurate) or title search (fallback). Updates the database
with corrected tmdb_id and refreshed metadata columns.

Options:
  --dry-run             Fetch and report without writing to Postgres
  --limit N             Process only N movies (default: all)
  --offset N            Skip first N movies ordered by letterboxd_popularity desc
  --movie-slugs A,B,C   Process only these movie slugs
  --concurrency N       Concurrent TMDB requests (default: ${DEFAULT_CONCURRENCY})
  --report PATH         JSON report path (default: ${DEFAULT_REPORT_PATH})
  --help                Show this help
`);
}

// ---------------------------------------------------------------------------
// DB + TMDB helpers
// ---------------------------------------------------------------------------

function createSql() {
  return postgres(getDatabaseUrl({ direct: true }), { ssl: "require", prepare: false });
}

function tmdbHeaders() {
  if (!process.env.TMDB_AUTH_TOKEN) throw new Error("TMDB_AUTH_TOKEN is not set");
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
    if (response.ok) return response.json();

    const retryAfterSeconds = Number.parseInt(response.headers.get("retry-after") || "", 10);
    const shouldRetry = response.status === 429 || response.status >= 500;
    if (!shouldRetry || attempt > maxRetries) {
      const text = await response.text().catch(() => "");
      throw new Error(`TMDB ${response.status} for ${url}${text ? `: ${text.slice(0, 200)}` : ""}`);
    }
    const backoffMs = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : Math.min(30_000, 1000 * 2 ** (attempt - 1));
    await sleep(backoffMs);
  }
}

// ---------------------------------------------------------------------------
// TMDB lookup strategies
// ---------------------------------------------------------------------------

/**
 * Find a TMDB movie entry via IMDB ID. Returns the first movie_result or null.
 */
async function findByImdbId(imdbId) {
  const data = await fetchTmdbJson(
    `${TMDB_BASE}/find/${imdbId}?external_source=imdb_id`
  );
  const results = data.movie_results ?? [];
  return results[0] ?? null;
}

/**
 * Search TMDB by title, filter to ±yearTolerance of our DB year, return the result
 * with highest vote_count (our library = top films → highest votes wins).
 */
async function searchByTitleWithTolerance(title, dbYear, yearTolerance, includeAdult) {
  const encoded = encodeURIComponent(title);
  const adult = includeAdult ? "true" : "false";
  const data = await fetchTmdbJson(
    `${TMDB_BASE}/search/movie?query=${encoded}&include_adult=${adult}&language=en-US`
  );
  const results = (data.results ?? []).filter((r) => {
    const tmdbYear = r.release_date ? Number(r.release_date.slice(0, 4)) : null;
    return tmdbYear !== null && Math.abs(tmdbYear - dbYear) <= yearTolerance;
  });
  if (results.length === 0) return null;
  const exact = results.filter(
    (r) => r.title?.toLowerCase() === title.toLowerCase()
  );
  const pool = exact.length > 0 ? exact : results;
  return pool.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))[0];
}

/**
 * Try TMDB's server-side year filter which can surface movies the client-side
 * filter misses (e.g. "EverAfter" for query "Ever After").
 */
async function searchByTitleWithYearParam(title, dbYear) {
  const encoded = encodeURIComponent(title);
  const data = await fetchTmdbJson(
    `${TMDB_BASE}/search/movie?query=${encoded}&year=${dbYear}&include_adult=true&language=en-US`
  );
  const results = (data.results ?? []).filter((r) => {
    const tmdbYear = r.release_date ? Number(r.release_date.slice(0, 4)) : null;
    return tmdbYear !== null && Math.abs(tmdbYear - dbYear) <= 2;
  });
  if (results.length === 0) return null;
  const exact = results.filter((r) => r.title?.toLowerCase() === title.toLowerCase());
  const pool = exact.length > 0 ? exact : results;
  return pool.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))[0];
}

/**
 * Search TMDB by title with progressive fallback:
 *   1. ±1 year, no adult
 *   2. ±2 years, no adult  (catches festival-vs-release-date gaps)
 *   3. ±2 years, adult=true (catches adult-flagged classics)
 *   4. TMDB year= param filter with ±2 year client check (catches title variants)
 *   5. ±4 years, adult=true  (catches old films with re-release dates in TMDB)
 */
async function searchByTitle(title, dbYear) {
  return (
    (await searchByTitleWithTolerance(title, dbYear, 1, false)) ??
    (await searchByTitleWithTolerance(title, dbYear, 2, false)) ??
    (await searchByTitleWithTolerance(title, dbYear, 2, true)) ??
    (await searchByTitleWithYearParam(title, dbYear)) ??
    (await searchByTitleWithTolerance(title, dbYear, 4, true))
  );
}

// ---------------------------------------------------------------------------
// Process a single movie
// ---------------------------------------------------------------------------

async function resolveMovie(movie) {
  let tmdbResult = null;
  let strategy = null;

  if (movie.imdb_id) {
    try {
      tmdbResult = await findByImdbId(movie.imdb_id);
      strategy = "imdb";
    } catch (err) {
      // Fall through to title search
    }
  }

  if (!tmdbResult) {
    try {
      tmdbResult = await searchByTitle(movie.title, movie.release_year);
      strategy = "title_search";
    } catch (err) {
      return { status: "error", error: err.message, strategy: null };
    }
  }

  if (!tmdbResult) {
    return { status: "not_found", strategy };
  }

  const newTmdbId = tmdbResult.id;
  const newImdbId =
    tmdbResult.imdb_id ?? (strategy === "imdb" ? movie.imdb_id : null);
  const tmdbYear = tmdbResult.release_date
    ? Number(tmdbResult.release_date.slice(0, 4))
    : null;

  return {
    status: "found",
    strategy,
    tmdb_id: newTmdbId,
    imdb_id: newImdbId || movie.imdb_id || null,
    tmdb_title: tmdbResult.title ?? null,
    tmdb_release_date: tmdbResult.release_date ?? null,
    tmdb_vote_average: tmdbResult.vote_average ?? null,
    tmdb_vote_count: tmdbResult.vote_count ?? null,
    tmdb_popularity: tmdbResult.popularity ?? null,
    tmdb_year: tmdbYear,
    id_changed: newTmdbId !== movie.tmdb_id,
    year_mismatch: tmdbYear !== null && Math.abs(tmdbYear - movie.release_year) > 1,
  };
}

// ---------------------------------------------------------------------------
// DB update
// ---------------------------------------------------------------------------

async function updateMovie(sql, movie, resolved) {
  await sql`
    update public.movies
    set
      tmdb_id           = ${resolved.tmdb_id},
      imdb_id           = coalesce(${resolved.imdb_id}, imdb_id),
      tmdb_title        = ${resolved.tmdb_title},
      tmdb_release_date = ${resolved.tmdb_release_date ?? null},
      tmdb_vote_average = ${resolved.tmdb_vote_average ?? null},
      tmdb_vote_count   = ${resolved.tmdb_vote_count ?? null},
      tmdb_popularity   = ${resolved.tmdb_popularity ?? null},
      updated_at        = now()
    where movie_slug = ${movie.movie_slug}
  `;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function selectMovies(sql, { limit, offset, movieSlugs }) {
  if (movieSlugs.length > 0) {
    return sql`
      select movie_slug, title, release_year, tmdb_id, imdb_id
      from public.movies
      where movie_slug = any(${movieSlugs})
      order by coalesce(letterboxd_popularity, 0) desc
    `;
  }
  if (limit != null) {
    return sql`
      select movie_slug, title, release_year, tmdb_id, imdb_id
      from public.movies
      order by coalesce(letterboxd_popularity, 0) desc
      limit ${limit}
      offset ${offset}
    `;
  }
  return sql`
    select movie_slug, title, release_year, tmdb_id, imdb_id
    from public.movies
    order by coalesce(letterboxd_popularity, 0) desc
  `;
}

async function main() {
  if (hasArg("--help")) { usage(); return; }

  const dryRun = hasArg("--dry-run");
  const limit = parseIntegerArg("--limit", null);
  const offset = parseIntegerArg("--offset", 0);
  const movieSlugs = parseListArg("--movie-slugs", []);
  const concurrency = parseIntegerArg("--concurrency", DEFAULT_CONCURRENCY);
  const reportPath = getArg("--report", DEFAULT_REPORT_PATH);

  console.log("=".repeat(70));
  console.log("TMDB ID Audit" + (dryRun ? " [DRY RUN]" : ""));
  console.log("=".repeat(70));

  const sql = createSql();
  const results = [];
  const startTime = Date.now();

  try {
    const movies = await selectMovies(sql, { limit, offset, movieSlugs });
    console.log(`Processing ${movies.length} movies (concurrency=${concurrency})…\n`);

    await mapWithConcurrency(movies, concurrency, async (movie, index) => {
      const resolved = await resolveMovie(movie);

      const prefix = `  ${String(index + 1).padStart(5)}/${movies.length} ${movie.movie_slug}`;

      if (resolved.status === "error") {
        console.log(`${prefix} — ERROR: ${resolved.error}`);
      } else if (resolved.status === "not_found") {
        console.log(`${prefix} — NOT FOUND (${resolved.strategy ?? "no strategy"})`);
      } else {
        const changeFlag = resolved.id_changed ? " [ID CHANGED]" : "";
        const mismatchFlag = resolved.year_mismatch ? " [YEAR MISMATCH]" : "";
        console.log(
          `${prefix} — tmdb:${resolved.tmdb_id} votes:${resolved.tmdb_vote_count}${changeFlag}${mismatchFlag} (${resolved.strategy})`
        );
        if (!dryRun) {
          await updateMovie(sql, movie, resolved);
        }
      }

      results.push({
        movie_slug: movie.movie_slug,
        title: movie.title,
        release_year: movie.release_year,
        previous_tmdb_id: movie.tmdb_id,
        previous_imdb_id: movie.imdb_id,
        ...resolved,
      });
    });
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  const found = results.filter((r) => r.status === "found");
  const idChanged = found.filter((r) => r.id_changed);
  const yearMismatch = found.filter((r) => r.year_mismatch);
  const notFound = results.filter((r) => r.status === "not_found");
  const errored = results.filter((r) => r.status === "error");

  console.log("\n" + "=".repeat(70));
  console.log(`COMPLETE in ${duration}s`);
  console.log(`  found:       ${found.length}`);
  console.log(`  id changed:  ${idChanged.length}`);
  console.log(`  year mismatch: ${yearMismatch.length}`);
  console.log(`  not found:   ${notFound.length}`);
  console.log(`  errors:      ${errored.length}`);
  if (dryRun) console.log("  (dry run — no DB writes)");
  console.log("=".repeat(70));

  if (idChanged.length > 0) {
    console.log("\nID CHANGES:");
    for (const r of idChanged) {
      console.log(`  ${r.movie_slug}: ${r.previous_tmdb_id} → ${r.tmdb_id} (${r.strategy})`);
    }
  }

  const report = {
    generated_at: nowIso(),
    dry_run: dryRun,
    concurrency,
    summary: {
      total: results.length,
      found: found.length,
      id_changed: idChanged.length,
      year_mismatch: yearMismatch.length,
      not_found: notFound.length,
      errored: errored.length,
    },
    id_changes: idChanged.map((r) => ({
      movie_slug: r.movie_slug,
      title: r.title,
      release_year: r.release_year,
      old_tmdb_id: r.previous_tmdb_id,
      new_tmdb_id: r.tmdb_id,
      strategy: r.strategy,
      vote_count: r.tmdb_vote_count,
    })),
    not_found: notFound.map((r) => ({
      movie_slug: r.movie_slug,
      title: r.title,
      release_year: r.release_year,
      previous_tmdb_id: r.previous_tmdb_id,
      strategy: r.strategy,
    })),
    year_mismatches: yearMismatch.map((r) => ({
      movie_slug: r.movie_slug,
      title: r.title,
      db_year: r.release_year,
      tmdb_year: r.tmdb_year,
      tmdb_id: r.tmdb_id,
      strategy: r.strategy,
    })),
    all_results: results,
  };

  await writeJsonFile(reportPath, report);
  console.log(`\nReport written to ${reportPath}`);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
