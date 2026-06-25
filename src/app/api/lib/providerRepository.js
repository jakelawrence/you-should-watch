import { getSql } from "./postgres";

const AVAILABILITY_PRIORITY = {
  flatrate: 1,
  free: 2,
  ads: 3,
  rent: 4,
  buy: 5,
};

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProvider(row) {
  return {
    provider_id: row.provider_id,
    provider_name: row.provider_name,
    logo_path: row.logo_path,
    display_priority: row.display_priority,
    type: row.type ?? null,
  };
}

function normalizeWatchProvider(row) {
  return {
    provider_id: row.provider_id,
    provider_name: row.provider_name,
    logo_path: row.logo_path,
    display_priority: row.display_priority,
    raw_tmdb: row.raw_tmdb ?? null,
  };
}

function isMissingProviderTableError(error) {
  return error?.code === "42P01" && /watch_providers|movie_watch_providers/i.test(String(error.message || ""));
}

export async function getProviderCount() {
  const sql = getSql();
  try {
    const rows = await sql`select count(*)::int as count from public.watch_providers`;
    return Number(rows[0]?.count || 0);
  } catch (error) {
    if (isMissingProviderTableError(error)) return 0;
    throw error;
  }
}

export async function getProviders({ type = null, limit = null, region = "US" } = {}) {
  const sql = getSql();
  const values = [region];
  let typeClause = "";
  let limitClause = "";

  if (type) {
    values.push(type);
    typeClause = `where provider_type = $${values.length}`;
  }

  if (limit) {
    values.push(limit);
    limitClause = `limit $${values.length}`;
  }

  let rows;
  try {
    rows = await sql.unsafe(
      `
        with provider_types as (
          select
            wp.provider_id,
            wp.provider_name,
            wp.logo_path,
            wp.display_priority,
            wp.raw_tmdb,
            coalesce(nullif(wp.raw_tmdb->>'type', ''), availability.provider_type) as provider_type
          from public.watch_providers wp
          left join lateral (
            select mwp.availability_type as provider_type
            from public.movie_watch_providers mwp
            where mwp.provider_id = wp.provider_id
              and mwp.region = $1
            order by case mwp.availability_type
              when 'flatrate' then 1
              when 'free' then 2
              when 'ads' then 3
              when 'rent' then 4
              when 'buy' then 5
              else 99
            end
            limit 1
          ) availability on true
        )
        select
          provider_id,
          provider_name,
          logo_path,
          display_priority,
          provider_type as type
        from provider_types
        ${typeClause}
        order by coalesce(display_priority, 999999), provider_name
        ${limitClause}
      `,
      values
    );
  } catch (error) {
    if (isMissingProviderTableError(error)) return [];
    throw error;
  }

  return rows.map(normalizeProvider);
}

export async function saveProvider(provider) {
  const sql = getSql();
  const providerId = toInt(provider.provider_id);
  if (!providerId) {
    throw new Error("provider_id is required");
  }

  const rawTmdb = {
    ...(provider.raw_tmdb && typeof provider.raw_tmdb === "object" ? provider.raw_tmdb : {}),
    ...(provider.type ? { type: provider.type } : {}),
  };

  await sql`
    insert into public.watch_providers (
      provider_id,
      provider_name,
      logo_path,
      display_priority,
      raw_tmdb
    )
    values (
      ${providerId},
      ${provider.provider_name || null},
      ${provider.logo_path || null},
      ${toInt(provider.display_priority)},
      ${rawTmdb}
    )
    on conflict (provider_id) do update set
      provider_name = excluded.provider_name,
      logo_path = excluded.logo_path,
      display_priority = excluded.display_priority,
      raw_tmdb = excluded.raw_tmdb,
      updated_at = now()
  `;
}

export async function updateProvider(providerId, updates = {}) {
  const sql = getSql();
  const normalizedProviderId = toInt(providerId);
  if (!normalizedProviderId) {
    throw new Error("provider_id is required");
  }

  const rawTmdb = updates.type ? { type: updates.type } : null;
  const setParts = [];
  const values = [];

  const add = (sqlText, value) => {
    values.push(value);
    setParts.push(`${sqlText} = $${values.length}`);
  };

  if (updates.provider_name !== undefined) add("provider_name", updates.provider_name);
  if (updates.logo_path !== undefined) add("logo_path", updates.logo_path);
  if (updates.display_priority !== undefined) add("display_priority", toInt(updates.display_priority));
  if (rawTmdb) {
    values.push(rawTmdb);
    setParts.push(`raw_tmdb = coalesce(raw_tmdb, '{}'::jsonb) || $${values.length}::jsonb`);
  }

  if (setParts.length === 0) {
    return null;
  }

  values.push(normalizedProviderId);
  await sql.unsafe(
    `
      update public.watch_providers
      set ${setParts.join(", ")}
      where provider_id = $${values.length}
    `,
    values
  );

  return true;
}

export async function deleteProvider(providerId) {
  const sql = getSql();
  const normalizedProviderId = toInt(providerId);
  if (!normalizedProviderId) {
    throw new Error("provider_id is required");
  }

  await sql`delete from public.watch_providers where provider_id = ${normalizedProviderId}`;
}

export async function getStreamingProvidersForMovieSlugs(movieSlugs, region = "US") {
  const sql = getSql();
  if (!movieSlugs || movieSlugs.length === 0) {
    return new Map();
  }

  let rows;
  try {
    rows = await sql`
      select distinct on (mwp.movie_slug, wp.provider_id)
        mwp.movie_slug,
        wp.provider_id,
        wp.provider_name,
        wp.logo_path,
        mwp.availability_type as type,
        mwp.tmdb_link
      from public.movie_watch_providers mwp
      join public.watch_providers wp on wp.provider_id = mwp.provider_id
      where mwp.movie_slug = any(${movieSlugs})
        and mwp.region = ${region}
      order by
        mwp.movie_slug,
        wp.provider_id,
        case mwp.availability_type
          when 'flatrate' then 1
          when 'free' then 2
          when 'ads' then 3
          when 'rent' then 4
          when 'buy' then 5
          else 99
        end
    `;
  } catch (error) {
    if (isMissingProviderTableError(error)) return new Map();
    throw error;
  }

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.movie_slug)) {
      grouped.set(row.movie_slug, []);
    }
    grouped.get(row.movie_slug).push({
      provider_id: row.provider_id,
      provider_name: row.provider_name,
      logo_path: row.logo_path,
      type: row.type,
      region,
      link: row.tmdb_link,
      tmdb_link: row.tmdb_link,
    });
  }

  return grouped;
}

export async function getProviderRowsForMovies(movieSlugs, region = "US") {
  const sql = getSql();
  if (!movieSlugs || movieSlugs.length === 0) {
    return [];
  }

  let rows;
  try {
    rows = await sql`
      select distinct on (mwp.movie_slug, wp.provider_id)
        mwp.movie_slug,
        wp.provider_id,
        wp.provider_name,
        wp.logo_path,
        mwp.availability_type as type,
        mwp.tmdb_link
      from public.movie_watch_providers mwp
      join public.watch_providers wp on wp.provider_id = mwp.provider_id
      where mwp.movie_slug = any(${movieSlugs})
        and mwp.region = ${region}
      order by
        mwp.movie_slug,
        wp.provider_id,
        case mwp.availability_type
          when 'flatrate' then 1
          when 'free' then 2
          when 'ads' then 3
          when 'rent' then 4
          when 'buy' then 5
          else 99
        end
    `;
  } catch (error) {
    if (isMissingProviderTableError(error)) return [];
    throw error;
  }

  return rows;
}
