import fs from "node:fs/promises";
import path from "node:path";

import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

export const DEFAULT_RAW_DIR = path.join("data", "migration", "phase-3", "raw");
export const DEFAULT_TRANSFORMED_DIR = path.join("data", "migration", "phase-3", "transformed");
export const DYNAMODB_EXPORT_TABLES = ["movies", "users", "user-saved-movies"];
export const WATCH_AVAILABILITY_TYPES = ["flatrate", "free", "ads", "rent", "buy"];

export function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

export function hasArg(name) {
  return process.argv.includes(name);
}

export function parseListArg(name, fallback = []) {
  const raw = getArg(name);
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseIntegerArg(name, fallback) {
  const raw = getArg(name);
  if (raw === null || raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function nowIso() {
  return new Date().toISOString();
}

export function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

export async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function tableFileName(tableName, extension = "ndjson") {
  return `${tableName}.${extension}`;
}

export async function* readJsonRows(filePath) {
  if (!(await pathExists(filePath))) {
    throw new Error(`${filePath} does not exist`);
  }

  if (filePath.endsWith(".json")) {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${filePath} must contain a JSON array`);
    }
    for (const row of parsed) yield row;
    return;
  }

  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch (error) {
      throw new Error(`Invalid JSON on ${filePath}:${index + 1}: ${error.message}`);
    }
  }
}

export async function readAllJsonRows(filePath) {
  const rows = [];
  for await (const row of readJsonRows(filePath)) {
    rows.push(row);
  }
  return rows;
}

export async function writeNdjson(filePath, rows) {
  await ensureDirectory(path.dirname(filePath));
  const handle = await fs.open(filePath, "w");
  try {
    for (const row of rows) {
      await handle.write(`${JSON.stringify(row)}\n`);
    }
  } finally {
    await handle.close();
  }
}

export async function writeJsonFile(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function toInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toFloat(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toBoolean(value, fallback = false) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
  }
  return fallback;
}

export function toText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function toTextArray(value) {
  if (value === null || value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map(toText).filter(Boolean))];
}

export function toIntegerArray(value) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map(toInteger).filter((item) => item !== null))];
}

export function toTimestamp(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

export function pickFirst(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

export function normalizeMovieForPostgres(item) {
  const movieSlug = toText(pickFirst(item.movie_slug, item.slug, item.movieSlug));
  const sourceGenres = pickFirst(item.genreNames, item.genres);
  const sourceNanogenres = pickFirst(item.nanogenres);

  return {
    movie_slug: movieSlug,
    title: toText(pickFirst(item.title, item.name)),
    director: toText(item.director),
    release_year: toInteger(pickFirst(item.release_year, item.year)),
    duration_minutes: toInteger(pickFirst(item.duration_minutes, item.duration, item.runtime_minutes)),
    content_rating: toText(pickFirst(item.content_rating, item.rating)),
    letterboxd_avg_rating: toFloat(pickFirst(item.letterboxd_avg_rating, item.avgRating, item.averageRating)),
    letterboxd_popularity: toInteger(pickFirst(item.letterboxd_popularity, item.popularity, item.popularityRanking)),
    genres: sourceGenres === null ? null : toTextArray(sourceGenres),
    nanogenres: sourceNanogenres === null ? null : toTextArray(sourceNanogenres),
    tagline: toText(item.tagline),
    description: toText(pickFirst(item.description, item.overview)),
    letterboxd_link: toText(pickFirst(item.letterboxd_link, item.letterboxdLink, item.link)),
    poster_url: toText(pickFirst(item.poster_url, item.posterUrl)),
    tmdb_id: toInteger(pickFirst(item.tmdb_id, item.tmdbId)),
    darkness_level: toInteger(pickFirst(item.darkness_level, item.darknessLevel)),
    funniness_level: toInteger(pickFirst(item.funniness_level, item.funninessLevel)),
    slowness_level: toInteger(pickFirst(item.slowness_level, item.slownessLevel)),
    intenseness_level: toInteger(pickFirst(item.intenseness_level, item.intensenessLevel)),
    updated_at: toTimestamp(item.updatedAt ?? item.updated_at),
  };
}

export function normalizeUserForPostgres(item) {
  return {
    username: toText(item.username),
    email: toText(item.email)?.toLowerCase() ?? null,
    name: toText(item.name),
    password_hash: toText(pickFirst(item.password_hash, item.passwordHash)),
    is_admin: toBoolean(pickFirst(item.is_admin, item.isAdmin), false),
    streaming_services: toIntegerArray(pickFirst(item.streaming_services, item.streamingServices)),
    created_at: toTimestamp(pickFirst(item.created_at, item.createdAt)),
    updated_at: toTimestamp(pickFirst(item.updated_at, item.updatedAt)),
  };
}

export function normalizeSavedMovieForPostgres(item) {
  return {
    username: toText(item.username),
    movie_slug: toText(pickFirst(item.movie_slug, item.movieSlug, item.slug)),
    saved_at: toTimestamp(pickFirst(item.saved_at, item.savedAt, item.createdAt)) ?? nowIso(),
  };
}

export function normalizeWatchProviderForPostgres(item) {
  return {
    provider_id: toInteger(item.provider_id),
    provider_name: toText(item.provider_name),
    logo_path: toText(item.logo_path),
    display_priority: toInteger(item.display_priority),
    raw_tmdb: item,
  };
}

export function compactObject(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
}

export function chunkArray(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

export function summarizeRows(rows, keyField) {
  const missingKey = rows.filter((row) => !row[keyField]).length;
  return {
    row_count: rows.length,
    missing_key_count: missingKey,
  };
}
