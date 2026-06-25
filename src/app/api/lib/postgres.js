import postgres from "postgres";
import { DatabaseError } from "./db";

let sql;
const POSTGRES_CONNECTION_ERROR_CODES = new Set(["08000", "08001", "08003", "08004", "08006", "08007", "28P01", "28000"]);
const POSTGRES_CONNECTION_MESSAGE_PATTERNS = [
  "tenant/user",
  "enotfound",
  "econnrefused",
  "etimedout",
  "connection terminated",
  "connection refused",
  "password authentication failed",
];

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRuntimeDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

export function getSql() {
  const databaseUrl = getRuntimeDatabaseUrl();
  if (!databaseUrl) {
    throw new DatabaseError("DATABASE_URL or NEON_DATABASE_URL is not set", "DATABASE_URL_MISSING");
  }

  if (!sql) {
    sql = postgres(databaseUrl, {
      ssl: "require",
      prepare: false,
      max: parsePositiveInteger(process.env.POSTGRES_MAX_CONNECTIONS, 3),
      idle_timeout: parsePositiveInteger(process.env.POSTGRES_IDLE_TIMEOUT_SECONDS, 20),
      max_lifetime: parsePositiveInteger(process.env.POSTGRES_MAX_LIFETIME_SECONDS, 60 * 10),
    });
  }

  return sql;
}

export function isPostgresConnectionError(error) {
  if (!error) return false;

  if (POSTGRES_CONNECTION_ERROR_CODES.has(error.code)) {
    return true;
  }

  const message = String(error.message || error.cause?.message || "").toLowerCase();
  return POSTGRES_CONNECTION_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern));
}

export function toPostgresDatabaseError(error) {
  if (!isPostgresConnectionError(error)) return null;

  return new DatabaseError(
    "Database connection failed. Check DATABASE_URL or NEON_DATABASE_URL and Neon pooler settings.",
    "POSTGRES_CONNECTION_ERROR",
  );
}

export async function closeSql(timeout = 5) {
  if (!sql) return;
  await sql.end({ timeout }).catch(() => {});
  sql = null;
}
