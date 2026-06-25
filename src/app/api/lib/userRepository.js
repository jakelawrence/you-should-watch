import crypto from "node:crypto";

import bcrypt from "bcryptjs";

import { getSql } from "./postgres";

function normalizeUser(row) {
  if (!row) return null;

  return {
    username: row.username,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    isAdmin: row.is_admin ?? false,
    streamingServices: row.streaming_services ?? [],
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function toIntArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const parsed = Number.parseInt(item, 10);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((item) => item !== null);
}

function deriveUsername(name, email) {
  const base = (name || email.split("@")[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .substring(0, 20)
    .replace(/^_+|_+$/g, "");

  return base || "user";
}

async function uniqueUsername(sql, baseUsername) {
  let username = baseUsername;
  let counter = 0;

  while (true) {
    const rows = await sql`select 1 from public.users where username = ${username} limit 1`;
    if (rows.length === 0) {
      return username;
    }
    counter += 1;
    username = `${baseUsername}_${crypto.randomBytes(2).toString("hex")}`;
    if (counter > 10) {
      username = `${baseUsername}_${Date.now().toString(36).slice(-6)}`;
    }
  }
}

export async function getUserCount() {
  const sql = getSql();
  const rows = await sql`select count(*)::int as count from public.users`;
  return Number(rows[0]?.count || 0);
}

export async function getUserByUsername(username) {
  const sql = getSql();
  const rows = await sql`
    select username, email, name, password_hash, is_admin, streaming_services, created_at, updated_at
    from public.users
    where username = ${username}
    limit 1
  `;

  return normalizeUser(rows[0] || null);
}

export async function getUserByEmail(email) {
  const sql = getSql();
  const rows = await sql`
    select username, email, name, password_hash, is_admin, streaming_services, created_at, updated_at
    from public.users
    where lower(email) = lower(${email})
    limit 1
  `;

  return normalizeUser(rows[0] || null);
}

export async function createUser({ username = null, name, email, passwordHash, isAdmin = false, streamingServices = [] }) {
  const sql = getSql();
  const normalizedEmail = String(email || "").toLowerCase();
  if (!normalizedEmail) {
    throw new Error("email is required");
  }

  const existingEmail = await getUserByEmail(normalizedEmail);
  if (existingEmail) {
    throw new Error("Email already registered");
  }

  const baseUsername = username || deriveUsername(name, normalizedEmail);
  const unique = await uniqueUsername(sql, baseUsername);
  const now = new Date().toISOString();
  await sql`
    insert into public.users (
      username,
      email,
      name,
      password_hash,
      is_admin,
      streaming_services,
      created_at,
      updated_at
    )
    values (
      ${unique},
      ${normalizedEmail},
      ${name || unique},
      ${passwordHash || null},
      ${Boolean(isAdmin)},
      ${toIntArray(streamingServices)},
      ${now},
      ${now}
    )
  `;

  return normalizeUser({
    username: unique,
    email: normalizedEmail,
    name: name || unique,
    password_hash: passwordHash || null,
    is_admin: Boolean(isAdmin),
    streaming_services: toIntArray(streamingServices),
    created_at: now,
    updated_at: now,
  });
}

export async function createOAuthUser({ email, name, provider }) {
  const sql = getSql();
  const normalizedEmail = String(email || "").toLowerCase();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return existing;
  }

  const baseUsername = deriveUsername(name, normalizedEmail);
  const username = await uniqueUsername(sql, baseUsername);
  const now = new Date().toISOString();

  await sql`
    insert into public.users (
      username,
      email,
      name,
      is_admin,
      streaming_services,
      created_at,
      updated_at
    )
    values (
      ${username},
      ${normalizedEmail},
      ${name || username},
      false,
      ${[]},
      ${now},
      ${now}
    )
  `;

  return normalizeUser({
    username,
    email: normalizedEmail,
    name: name || username,
    is_admin: false,
    streaming_services: [],
    created_at: now,
    updated_at: now,
    oauthProvider: provider,
  });
}

export async function getUserSelectedStreamingServces(email) {
  const sql = getSql();
  const rows = await sql`
    select streaming_services
    from public.users
    where lower(email) = lower(${email})
    limit 1
  `;

  return rows[0]?.streaming_services || [];
}

export async function updateUserStreamingServices(username, streamingServices) {
  const sql = getSql();
  const now = new Date().toISOString();
  const normalizedServices = toIntArray(streamingServices);

  await sql`
    update public.users
    set streaming_services = ${normalizedServices},
        updated_at = ${now}
    where username = ${username}
  `;

  return normalizedServices;
}

export async function getUserSavedMovies(username) {
  const sql = getSql();
  const rows = await sql`
    select movie_slug, saved_at
    from public.user_saved_movies
    where username = ${username}
    order by saved_at desc
  `;

  return {
    savedMovies: rows.map((row) => row.movie_slug),
  };
}

export async function saveUserSavedMovie(username, movieSlug) {
  const sql = getSql();
  const now = new Date().toISOString();
  await sql`
    insert into public.user_saved_movies (username, movie_slug, saved_at)
    values (${username}, ${movieSlug}, ${now})
    on conflict (username, movie_slug) do update set
      saved_at = excluded.saved_at
  `;
}

export async function deleteUserSavedMovie(username, movieSlug) {
  const sql = getSql();
  await sql`
    delete from public.user_saved_movies
    where username = ${username}
      and movie_slug = ${movieSlug}
  `;
}
