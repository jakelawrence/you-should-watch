export function getRuntimeDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

export function getDirectDatabaseUrl() {
  return process.env.NEON_DATABASE_URL_DIRECT || process.env.NEON_DIRECT_DATABASE_URL || getRuntimeDatabaseUrl();
}

export function getDatabaseUrl({ direct = false } = {}) {
  const databaseUrl = direct ? getDirectDatabaseUrl() : getRuntimeDatabaseUrl();
  if (!databaseUrl) {
    const names = direct
      ? "NEON_DATABASE_URL_DIRECT, NEON_DIRECT_DATABASE_URL, DATABASE_URL, or NEON_DATABASE_URL"
      : "DATABASE_URL or NEON_DATABASE_URL";
    throw new Error(`${names} is not set`);
  }
  return databaseUrl;
}
