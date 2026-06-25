#!/usr/bin/env node

import postgres from "postgres";
import { getDatabaseUrl } from "../lib/postgres-url.mjs";

import {
  getArg,
  hasArg,
  mapWithConcurrency,
  nowIso,
  parseIntegerArg,
  parseListArg,
  writeJsonFile,
} from "./phase-3-common.mjs";

const TMDB_MOVIE_DETAILS_URL = "https://api.themoviedb.org/3/movie";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";
const DEFAULT_IMAGE_SIZE = "w500";

function usage() {
  console.log(`
Usage:
  node scripts/migration/phase-5-sync-tmdb-posters.mjs

Fetches TMDB movie details for movies with tmdb_id and updates public.movies.poster_url
from the returned poster_path.

Options:
  --limit N             Movies to refresh in this run. Defaults to 100
  --offset N            Offset into movie list. Defaults to 0
  --movie-slugs A,B     Refresh explicit movie slugs instead of limit/offset
  --concurrency N       Concurrent TMDB requests. Defaults to 2
  --only-missing        Only update rows where poster_url is null, empty, or an empty Letterboxd poster
  --store path          Store raw TMDB poster_path instead of a full image URL
  --image-size w500     TMDB image size when storing URLs. Defaults to w500
  --dry-run             Fetch and report without writing to Postgres
  --report PATH         Write a JSON report. Defaults to docs/migration/phase-5-tmdb-poster-sync-report.json
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

function isEmptyPosterUrl(posterUrl) {
  return !posterUrl || /\/empty-poster-/i.test(posterUrl);
}

function posterValueFromPath(posterPath, { store, imageSize }) {
  if (!posterPath) return null;
  if (store === "path") return posterPath;
  return `${TMDB_IMAGE_BASE_URL}/${imageSize}${posterPath}`;
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

async function selectMovies(sql, { limit, offset, movieSlugs, onlyMissing }) {
  const params = [];
  const clauses = ["tmdb_id is not null"];

  if (movieSlugs.length > 0) {
    const placeholders = movieSlugs.map((slug) => {
      params.push(slug);
      return `$${params.length}`;
    });
    clauses.push(`movie_slug in (${placeholders.join(", ")})`);
  }

  if (onlyMissing) {
    clauses.push(`(poster_url is null or poster_url = '' or poster_url ~* '/empty-poster-')`);
  }

  params.push(limit);
  const limitPlaceholder = `$${params.length}`;
  params.push(offset);
  const offsetPlaceholder = `$${params.length}`;

  return sql.unsafe(
    `
      select movie_slug, title, tmdb_id, poster_url
      from public.movies
      where ${clauses.join(" and ")}
      order by movie_slug
      limit ${limitPlaceholder}
      offset ${offsetPlaceholder}
    `,
    params,
  );
}

async function fetchMoviePoster(movie, options) {
  const url = `${TMDB_MOVIE_DETAILS_URL}/${movie.tmdb_id}?language=en-US`;
  const body = await fetchTmdbJson(url);
  const posterPath = typeof body.poster_path === "string" && body.poster_path.trim() ? body.poster_path.trim() : null;
  const posterUrl = posterValueFromPath(posterPath, options);

  return {
    movie_slug: movie.movie_slug,
    title: movie.title,
    tmdb_id: Number(movie.tmdb_id),
    previous_poster_url: movie.poster_url,
    poster_path: posterPath,
    poster_url: posterUrl,
    status: posterUrl ? "ok" : "missing_poster_path",
  };
}

async function updateMoviePoster(sql, result, dryRun) {
  if (dryRun || result.status !== "ok") {
    return;
  }

  await sql`
    update public.movies
    set poster_url = ${result.poster_url},
        updated_at = now()
    where movie_slug = ${result.movie_slug}
  `;
}

async function refreshMovie(sql, movie, options) {
  try {
    const result = await fetchMoviePoster(movie, options);
    await updateMoviePoster(sql, result, options.dryRun);
    return result;
  } catch (error) {
    return {
      movie_slug: movie.movie_slug,
      title: movie.title,
      tmdb_id: Number(movie.tmdb_id),
      previous_poster_url: movie.poster_url,
      status: "error",
      error: error.message,
    };
  }
}

async function main() {
  if (hasArg("--help")) {
    usage();
    return;
  }

  const limit = parseIntegerArg("--limit", 100);
  const offset = parseIntegerArg("--offset", 0);
  const movieSlugs = parseListArg("--movie-slugs", []);
  const concurrency = parseIntegerArg("--concurrency", 2);
  const onlyMissing = hasArg("--only-missing");
  const dryRun = hasArg("--dry-run");
  const store = getArg("--store", "url");
  const imageSize = getArg("--image-size", DEFAULT_IMAGE_SIZE);
  const reportPath = getArg("--report", "docs/migration/phase-5-tmdb-poster-sync-report.json");

  if (!["url", "path"].includes(store)) {
    throw new Error("--store must be either url or path");
  }

  const sql = createSql();
  let results = [];

  try {
    const movies = await selectMovies(sql, { limit, offset, movieSlugs, onlyMissing });
    console.log(`Refreshing TMDB posters for ${movies.length} movies...`);

    results = await mapWithConcurrency(movies, concurrency, async (movie, index) => {
      const result = await refreshMovie(sql, movie, { dryRun, store, imageSize });
      const changed = result.status === "ok" && result.previous_poster_url !== result.poster_url;
      console.log(`  ${index + 1}/${movies.length} ${movie.movie_slug}: ${result.status}${changed ? " updated" : ""}`);
      return result;
    });
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }

  const report = {
    generated_at: nowIso(),
    phase: "phase-5-tmdb-poster-sync",
    dry_run: dryRun,
    limit,
    offset,
    movie_slugs: movieSlugs,
    only_missing: onlyMissing,
    store,
    image_size: imageSize,
    summary: {
      checked: results.length,
      succeeded: results.filter((result) => result.status === "ok").length,
      missing_poster_path: results.filter((result) => result.status === "missing_poster_path").length,
      errored: results.filter((result) => result.status === "error").length,
      changed: results.filter((result) => result.status === "ok" && result.previous_poster_url !== result.poster_url).length,
      skipped_existing: onlyMissing ? results.filter((result) => !isEmptyPosterUrl(result.previous_poster_url)).length : 0,
    },
    movie_results: results,
  };

  await writeJsonFile(reportPath, report);
  console.log(`Wrote TMDB poster sync report to ${reportPath}`);
}

main().catch((error) => {
  console.error(`TMDB poster sync failed: ${error.message}`);
  process.exit(1);
});
