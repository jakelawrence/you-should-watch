# Supabase Postgres Migration Plan

## Goal

Move the application from its current DynamoDB-first data layer to a Supabase-hosted Postgres database, while preserving the existing API response shapes and adding review-embedding similarity queries through `pgvector`.

The first embedding-backed recommendation version should support one source movie at a time. The current app allows multiple input movies in several places, but the known working vector query compares every movie to one seed movie's `embedding_overall`.

## Current State

- Main app routes read data through `src/app/api/lib/dynamodb.js`.
- `src/app/api/lib/db.js` still opens the local `movies.db` SQLite file, but active movie and suggestion routes mostly use DynamoDB helpers.
- `/api/movies` scans DynamoDB for title, rating, decade, and genre filters, then performs fuzzy ranking in JavaScript.
- `/api/suggestions` supports:
  - legacy collaborative suggestions from likes/favorites tables
  - mood filtering
  - surprise sampling
  - server-side genre, vibe, duration, decade, rating, streaming, and saved-movie filters
- Likes and favorites are not part of the Supabase cutover scope. The first Postgres recommendation path should use review embeddings instead of migrating those interaction tables.
- Streaming availability should be treated as cached TMDB Watch Providers data in Postgres. Do not depend on live TMDB calls during recommendation requests.
- The homepage collection context caps selected movies at 4.
- `/search` says "Add up to 5 movies to anchor your search" and posts all selected slugs as `inputSlugs`.
- The embedding query currently works for one movie slug:

```sql
SELECT
  movie_slug,
  title,
  embedding_overall <=> (
    SELECT embedding_overall
    FROM movies
    WHERE movie_slug = 'the-night-of-the-hunter'
  ) AS distance
FROM movies
WHERE movie_slug != 'the-night-of-the-hunter'
  AND embedding_overall IS NOT NULL
ORDER BY distance
LIMIT 10;
```

## Architecture Choice

Use server-side Postgres access from Next.js route handlers. Do not expose the database connection string or service role credentials to client components.

Recommended initial client:

- Add the `postgres` package.
- Store the Supabase transaction pooler or session pooler URL in `DATABASE_URL`.
- If using the transaction pooler for serverless deployment, disable prepared statements in the client configuration.

Example target file:

```js
// src/app/api/lib/postgres.js
import postgres from "postgres";

export const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  prepare: false,
});
```

Keep authentication in the existing app-owned `users` table for the first migration. Moving to Supabase Auth can be a later project because it touches login, signup, sessions, saved movies, and profile flows.

## Phase 1 - Inventory And Schema Mapping

### Data sources to inventory

- DynamoDB `movies`
- DynamoDB `users`
- DynamoDB `user-saved-movies`
- TMDB Watch Providers data:
  - provider catalog from `/watch/providers/movie`
  - per-movie availability from `/movie/{movie_id}/watch/providers`
  - at minimum, the `US` region; keep region support in the schema for future expansion
- Local `movies.db`, only if it still contains source data not already represented in DynamoDB or Supabase
- Existing review embedding source files or scripts under `scripts/reviews/`

Do not inventory or migrate separate DynamoDB `genres`, `nanogenres`, `directors`, `actors`, `likes-by-movie`, `likes-by-user`, `favorites-by-movie`, or `favorites-by-user` tables for the first Supabase migration. Genre, nanogenre, and director metadata should come from the existing flat columns on `movies`; actors and likes/favorites are intentionally out of scope.

### Mapping rules

- Choose one canonical database naming convention. Prefer snake_case in Postgres.
- Preserve the app response shape by mapping database columns back to the current camelCase fields in repository helpers.
- Decide whether the canonical movie key is `movie_slug` or `slug`.
  - Supabase query examples currently use `movie_slug`.
  - The app currently expects `movie.slug`.
  - The compatibility layer should return `movie_slug AS slug`.
- Keep movie metadata denormalized for this migration:
  - `genres text[]` on `movies`, not a separate genres table.
  - `nanogenres text[]` on `movies`, not a separate nanogenres table.
  - `director text` on `movies`, not a separate directors table.
  - No actors table for the first cutover.
- Preserve the existing provider API shape, but back it with a TMDB Watch Providers table in Postgres.
- Use relational watch-provider availability as the canonical source:
  - `watch_providers` stores provider identity and logos.
  - `movie_watch_providers` stores which providers have each movie in each region and availability type.
  - API helpers should hydrate this back to the existing `movie.streamingProviders` array shape.
  - Do not use live TMDB requests inside `/api/suggestions` or `/api/movies`.

### Acceptance criteria

- A table-by-table inventory exists with row counts.
- Every field used by `src/app/api/lib/dynamodb.js` is mapped to a Postgres column or an intentional removal.
- A small sample of movie objects from DynamoDB and Postgres can be compared by slug.

## Phase 2 - Supabase Schema

Enable vector support:

```sql
create extension if not exists vector;
```

Optional but useful for title search:

```sql
create extension if not exists pg_trgm;
```

### Core tables

The `movies` and `reviews` tables already exist in Supabase and are populated (4,000 movies, 282,069 reviews). Do not recreate them. The schema below reflects the actual current state plus the columns that still need to be added from DynamoDB.

The embedding dimension is **384**.

#### `movies` — already exists, 4,000 rows

```sql
-- Already present in Supabase. Shown here for reference.
-- movie_slug text primary key
-- title text
-- director text                        -- single director string, not a junction table
-- release_year integer                 -- NOT "year"
-- duration_minutes integer             -- NOT "duration"
-- content_rating text                  -- NOT "rating" (e.g. "R", "PG-13")
-- letterboxd_avg_rating float          -- NOT "average_rating"
-- letterboxd_num_reviews integer
-- letterboxd_popularity integer        -- NOT "popularity"
-- genres text[]                        -- NOT genre_ids integer[]; names only, no integer IDs
-- nanogenres text[]                    -- already populated as flat array on movies
-- tagline text
-- description text
-- letterboxd_link text
-- poster_url text                      -- NOT "poster_path"
-- tmdb_id integer
-- tmdb_title text
-- tmdb_release_date date
-- collection_id integer
-- collection_name text
-- imdb_id text
-- tmdb_vote_average float
-- tmdb_vote_count integer
-- tmdb_popularity float
-- runtime_minutes integer
-- original_language text
-- origin_countries text[]
-- production_companies jsonb
-- pipeline_avg_rating float
-- embedding_review_count integer
-- embedding_total_weight float
-- embedding_overall vector(384)
-- embedding_thematic vector(384)
-- embedding_emotional vector(384)
-- embedding_stylistic vector(384)
-- embedding_performance vector(384)
-- embedding_technical vector(384)
-- embedding_audience vector(384)
-- embedding_semantic vector(384)
-- embedding_nanogenres vector(384)
-- vibe_period_texture float
-- vibe_pastoral_nature_presence float
-- vibe_folk_occult_texture float
-- vibe_modern_suburban_dread float
-- vibe_urban_pressure float
-- vibe_kinetic_momentum float
-- vibe_social_satire float
-- vibe_class_anxiety float
-- vibe_romantic_longing float
-- vibe_spiritual_austerity float
-- vibe_body_transgression float
-- vibe_surreal_identity_instability float
-- vibe_gentle_comfort float
-- vibe_auteur_signature_strength float
-- vibe_franchise_series_dependency float
-- vibe_tags text[]
-- vibe_negative_tags text[]
-- vibe_confidence float
-- vibe_rationale text
-- updated_at timestamptz
```

The following DynamoDB-only columns do not yet exist in Supabase. Add them before migrating app data:

```sql
alter table movies
  add column if not exists darkness_level smallint,
  add column if not exists funniness_level smallint,
  add column if not exists slowness_level smallint,
  add column if not exists intenseness_level smallint,
  add column if not exists title_lower text generated always as (lower(title)) stored;
```

Do not add `movies.streaming_providers` as the canonical availability source. The app can still return a `streamingProviders` array, but that should be hydrated from `movie_watch_providers` joined to `watch_providers`.

#### `reviews` — already exists, 282,069 rows

Full review text and per-review vector embeddings (384-dimensional) are already loaded. No import needed.

#### Metadata relationship tables — not needed for first cutover

Do not create separate `movie_genres`, `movie_nanogenres`, `movie_directors`, or `movie_actors` tables for the first migration. Use the existing `movies.genres`, `movies.nanogenres`, and `movies.director` columns directly. Actor data is intentionally omitted from this migration.

#### User tables — do not yet exist, migrate from DynamoDB

No user data has been migrated to Supabase. Create and populate `users` and `user_saved_movies` from DynamoDB exports.

```sql
create table users (
  username text primary key,
  email text not null unique,
  name text,
  password_hash text,
  is_admin boolean not null default false,
  streaming_services integer[] not null default '{}'::integer[],
  created_at timestamptz,
  updated_at timestamptz
);

create table user_saved_movies (
  username text not null references users(username) on delete cascade,
  movie_slug text references movies(movie_slug) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (username, movie_slug)
);
```

Keep authentication in the app-owned `users` table for this migration. Avoid changing auth semantics in the same cutover.

#### Watch providers — use TMDB Watch Providers

The current app's `providers` table is the same concept as TMDB Watch Providers. Store provider catalog data and per-movie availability separately. This lets recommendations and saved-movie screens filter by a user's streaming platforms without calling TMDB at request time.

```sql
create table watch_providers (
  provider_id integer primary key,
  provider_name text not null,
  logo_path text,
  display_priority integer,
  raw_tmdb jsonb,
  updated_at timestamptz not null default now()
);

create table movie_watch_providers (
  movie_slug text not null references movies(movie_slug) on delete cascade,
  tmdb_id integer not null,
  region text not null default 'US',
  provider_id integer not null references watch_providers(provider_id) on delete cascade,
  availability_type text not null check (availability_type in ('flatrate', 'free', 'ads', 'rent', 'buy')),
  tmdb_link text,
  fetched_at timestamptz not null default now(),
  raw_tmdb jsonb,
  primary key (movie_slug, region, provider_id, availability_type)
);

create table movie_watch_provider_sync_state (
  movie_slug text not null references movies(movie_slug) on delete cascade,
  tmdb_id integer not null,
  region text not null default 'US',
  fetched_at timestamptz,
  status text not null default 'never_fetched',
  provider_count integer not null default 0,
  last_error text,
  primary key (movie_slug, region)
);

create table watch_provider_sync_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  region text not null default 'US',
  movies_checked integer not null default 0,
  movies_updated integer not null default 0,
  error text
);
```

`watch_providers` answers "which platforms exist?" `movie_watch_providers` answers "which platforms currently have this movie?" `movie_watch_provider_sync_state` records refresh status even when TMDB returns no providers for a movie. Keep the existing `/api/providers` response shape by deriving `type` options from availability rows or by returning provider rows decorated with the user's selected availability category when needed.

### Indexes

The scalar and HNSW vector indexes below already exist in Supabase on the `movies` table. Do not recreate them. Run the user and watch-provider indexes after those tables are created.

```sql
-- Already exist on movies (do not recreate):
-- movies_release_year_idx on movies (release_year)
-- movies_collection_id_idx on movies (collection_id)
-- movies_director_idx on movies (director)
-- movies_language_idx on movies (original_language)
-- movies_genres_idx on movies using gin (genres)
-- movies_vibe_tags_idx on movies using gin (vibe_tags)
-- movies_emb_overall_idx on movies using hnsw (embedding_overall vector_cosine_ops)
-- movies_emb_thematic_idx on movies using hnsw (embedding_thematic vector_cosine_ops)
-- movies_emb_emotional_idx on movies using hnsw (embedding_emotional vector_cosine_ops)
-- movies_emb_stylistic_idx on movies using hnsw (embedding_stylistic vector_cosine_ops)
-- movies_emb_nanogenres_idx on movies using hnsw (embedding_nanogenres vector_cosine_ops)

-- Add these after title_lower column is added:
create index if not exists movies_title_lower_trgm_idx
  on movies using gin (title_lower gin_trgm_ops);

create index if not exists movies_letterboxd_popularity_idx
  on movies (letterboxd_popularity);

create index if not exists movies_release_year_idx
  on movies (release_year);  -- may already exist; use if not exists

create index if not exists movies_letterboxd_avg_rating_idx
  on movies (letterboxd_avg_rating);

-- Add these after user and watch-provider tables are created:
create index users_email_idx
  on users (email);

create index user_saved_movies_username_idx
  on user_saved_movies (username);

create index movie_watch_providers_provider_region_idx
  on movie_watch_providers (provider_id, region);

create index movie_watch_providers_movie_region_idx
  on movie_watch_providers (movie_slug, region);

create index movie_watch_providers_fetched_at_idx
  on movie_watch_providers (fetched_at);

create index movie_watch_provider_sync_state_stale_idx
  on movie_watch_provider_sync_state (region, fetched_at);
```

## Phase 3 - Data Migration

Implementation artifacts:

- `scripts/migration/phase-3-export-dynamodb.mjs` exports DynamoDB `movies`, `users`, and `user-saved-movies` to local NDJSON/JSON.
- `scripts/migration/phase-3-transform.mjs` maps DynamoDB fields to the Phase 2 Postgres schema and deduplicates load files.
- `scripts/migration/phase-3-load-postgres.mjs` batch-upserts transformed movie, user, and saved-movie data into Supabase Postgres.
- `scripts/migration/phase-3-sync-watch-providers.mjs` refreshes TMDB Watch Providers catalog and per-movie availability into relational Postgres tables in chunks.
- `scripts/migration/phase-3-validate.mjs` validates row counts, embeddings, one-seed vector similarity, saved movies, streaming preferences, and provider availability.
- `docs/migration/phase-3-data-migration.md` is the operator runbook.

### Export

- Export DynamoDB `movies`, `users`, and `user-saved-movies` to JSON or NDJSON.
- Export or refresh TMDB Watch Providers data. Do not treat DynamoDB `providers` as a separate domain model.
  - Load the provider catalog from TMDB `/watch/providers/movie`.
  - Backfill per-movie availability by calling `/movie/{tmdb_id}/watch/providers` for each movie with a `tmdb_id`.
  - Store only the regions the app supports initially, starting with `US`.
- Export or preserve local SQLite rows only if they contain data missing from DynamoDB.
- Export the generated movie embeddings with:
  - `movie_slug`
  - vector values
  - embedding model
  - embedding version
  - source review count or metadata, if available

### Transform

- Convert DynamoDB attribute names to Postgres column names using the mapping below:
  - `year` → `release_year`
  - `duration` → `duration_minutes`
  - `rating` (content rating) → `content_rating`
  - `avgRating` / `averageRating` → `letterboxd_avg_rating`
  - `popularity` → `letterboxd_popularity`
  - `genreIds` (integer[]) → no equivalent; genres are stored as `genres text[]` (names only)
  - `genreNames` → `genres`
  - `keywordNames` → no equivalent; omit or add a `keyword_names text[]` column
  - `posterUrl` → `poster_url` (no `poster_path` column exists)
  - `darknessLevel` → `darkness_level` (must be added via `alter table` first)
  - `funninessLevel` → `funniness_level` (must be added via `alter table` first)
  - `slownessLevel` → `slowness_level` (must be added via `alter table` first)
  - `intensenessLevel` → `intenseness_level` (must be added via `alter table` first)
  - `streamingProviders` → no canonical movie column; hydrate from `movie_watch_providers` joined to `watch_providers`
- Normalize movie key fields:
  - Store `movie_slug`.
  - Return `slug` from repository helpers.
- Convert provider IDs to integers consistently.
- Store provider catalog rows in `watch_providers`.
- Store per-movie availability rows in `movie_watch_providers`:
  - `movie_slug`
  - `tmdb_id`
  - `region`
  - `provider_id`
  - `availability_type` (`flatrate`, `free`, `ads`, `rent`, `buy`)
  - `tmdb_link`
  - `fetched_at`
  - optional `raw_tmdb`
- Store one sync-state row per movie and region in `movie_watch_provider_sync_state`, including movies with no provider availability.
- Convert user fields:
  - `passwordHash` → `password_hash`
  - `isAdmin` → `is_admin`
  - `streamingServices` → `streaming_services integer[]`
  - `createdAt` → `created_at`
  - `updatedAt` → `updated_at`
- Convert `user-saved-movies` fields:
  - `movieSlug` → `movie_slug`
  - `savedAt` → `saved_at`
- Do not transform or load likes/favorites data for the first cutover.
- Deduplicate rows before import, especially saved movie rows keyed by `(username, movie_slug)`.

### Load

- Use `COPY`, `psql`, or a Node migration script with batch inserts.
- Load `movies`, `users`, and `watch_providers` before `user_saved_movies` and `movie_watch_providers`.
- Initialize `movie_watch_provider_sync_state` for every movie with a `tmdb_id` and supported region.
- Backfill movie watch availability in chunks, not one giant run. Start with batches of 100-250 movies, record each run in `watch_provider_sync_runs`, and retry failed movies later.
- For each movie-region refresh, replace that movie-region's `movie_watch_providers` rows in a transaction, then update `movie_watch_provider_sync_state`. This removes stale provider rows when TMDB availability changes.
- Respect TMDB `429` responses with backoff and keep request concurrency low enough to avoid bulk-scraping behavior.
- Load embeddings after `movies` exists.
- Add vector index after embeddings are loaded.

### Validate

- Row counts match required source tables.
- Sample slugs return equivalent movie data.
- `embedding_overall is not null` count matches the embedding export.
- The single-movie similarity SQL returns expected neighbors for `the-night-of-the-hunter`.
- Saved movies and streaming service preferences load for at least one known user.
- Watch provider IDs and names match the TMDB Watch Providers source.
- A known movie with US streaming availability has matching rows in `movie_watch_providers`.
- Filtering recommendations by a selected provider uses Postgres rows only and does not call TMDB during the request.

## Phase 4 - Data Access Layer Refactor

Implementation artifacts:

- `src/app/api/lib/postgres.js` owns the shared Postgres connection.
- `src/app/api/lib/movieRepository.js` provides movie lookup, filtering, and provider hydration.
- `src/app/api/lib/userRepository.js` provides user lookup, signup, saved-movie, and streaming-service helpers.
- `src/app/api/lib/providerRepository.js` provides provider catalog CRUD and watch-provider hydration.
- `src/app/api/lib/auth-helpers.js`, `src/auth.js`, and the route handlers now use the Postgres-backed repositories for the supported tables.

Create a Postgres-backed compatibility layer before rewriting every route.

Target files:

- Add `src/app/api/lib/postgres.js`
- Add `src/app/api/lib/movieRepository.js`
- Add `src/app/api/lib/userRepository.js`
- Add `src/app/api/lib/providerRepository.js` backed by `watch_providers` and `movie_watch_providers`
- Add a watch-provider sync script or Edge Function, for example `scripts/metadata/sync-tmdb-watch-providers.js` first, then `supabase/functions/sync-watch-providers` when scheduled infrastructure is added
- Optionally keep `src/app/api/lib/dynamodb.js` as a temporary facade that re-exports Postgres implementations during cutover

### Functions to replace

From `src/app/api/lib/dynamodb.js`:

- `query`
- `queryAllItems`
- `getMovie`
- `getMovies`
- `getMoviesByFilter`
- `getTableCount`
- `getProviderCount`
- `getUserCount`
- `getUserByUsername`
- `getUserByEmail`
- `saveProvider`
- `getProviders`
- `updateProvider`
- `deleteProvider`
- `getUserSelectedStreamingServces`
- `getUserSavedMovies`
- `saveUserSavedMovie`
- `deleteUserSavedMovie`

Retire or delete the old DynamoDB helpers for separate genres, nanogenres, directors, actors, likes, and favorites once the routes no longer import them. They should not get replacement tables in Supabase for this migration.

### Movie normalizer

Every movie returned to existing UI should have the fields the app currently reads:

```js
function normalizeMovie(row) {
  return {
    ...row,
    slug: row.slug || row.movie_slug,
    title: row.title,
    // Rating: Supabase uses letterboxd_avg_rating; DynamoDB used avgRating/averageRating
    avgRating: row.avgRating ?? row.letterboxd_avg_rating ?? row.averageRating,
    averageRating: row.averageRating ?? row.letterboxd_avg_rating ?? row.avgRating,
    // Supabase uses poster_url; no poster_path column exists
    posterUrl: row.posterUrl ?? row.poster_url,
    // Supabase uses genres text[] (names only); no genre_ids integer[] column
    genreIds: row.genreIds ?? [],
    genreNames: row.genreNames ?? row.genres ?? [],
    keywordNames: row.keywordNames ?? row.keyword_names ?? [],
    // Hydrate from movie_watch_providers joined to watch_providers.
    streamingProviders: row.streamingProviders ?? [],
    // These columns must be added via alter table before they are available
    darknessLevel: row.darknessLevel ?? row.darkness_level,
    funninessLevel: row.funninessLevel ?? row.funniness_level,
    slownessLevel: row.slownessLevel ?? row.slowness_level,
    intensenessLevel: row.intensenessLevel ?? row.intenseness_level,
    // Supabase-specific fields the app can start using
    releaseYear: row.releaseYear ?? row.release_year,
    durationMinutes: row.durationMinutes ?? row.duration_minutes,
    contentRating: row.contentRating ?? row.content_rating,
  };
}
```

## Phase 5 - Route Migration

Implementation artifacts:

- `/api/movies` now uses SQL filters, SQL pagination, and a separate SQL count query while preserving the existing response shape.
- `src/app/api/lib/movieRepository.js` exposes `countSearchMovies` and `getEmbeddingRecommendations`.
- `/api/suggestions` uses the one-seed pgvector recommendation path when `RECOMMENDER_ENGINE=embedding`; the existing collaborative implementation remains available as the fallback.
- Movie normalization strips `embedding_*` columns from API responses and hydrates streaming providers from `movie_watch_providers`.

### `/api/movies`

Replace DynamoDB scans with SQL:

- `slug`: direct primary-key lookup on `movie_slug`.
- `title`: use `ILIKE`, trigram similarity, or full-text search on `title` or `title_lower`.
- `genre`: `$genre = any(genres)`.
- `nanogenre`: `$nanogenre = any(nanogenres)`.
- `decade`: `release_year >= $from and release_year < $to`.
- `minRating`: `letterboxd_avg_rating >= $min`.
- `rating`: `content_rating = $rating`.
- `sortBy`: use explicit SQL `order by` allowlists.
- Pagination: use `limit` and `offset` in SQL.
- Total count: run a separate `count(*)` query for the same filters.

Keep the existing JSON response:

```js
{
  movies,
  total,
  page,
  limit,
  hasMore
}
```

### `/api/suggestions`

Add a Postgres embedding recommendation helper:

```sql
select
  m.movie_slug as slug,
  m.title,
  m.embedding_overall <=> seed.embedding_overall as embedding_distance
from movies m
join movies seed on seed.movie_slug = $1
where m.movie_slug <> $1
  and m.embedding_overall is not null
  and seed.embedding_overall is not null
  and not (m.movie_slug = any($2::text[]))
order by embedding_distance asc
limit $3;
```

Then hydrate those rows through the same movie normalizer used by `/api/movies`.

Initial behavior:

- If `mode === "collaborative"` and embeddings are enabled, require `inputSlugs.length === 1`.
- Use `inputSlugs[0]` as the seed movie.
- Include `excludeSlugs` in the SQL exclusion list.
- Fetch more than the final UI count, then apply existing genre, vibe, duration, decade, rating, streaming, and saved-movie filters.
- Apply streaming filters with `movie_watch_providers`, not TMDB calls or stale JSON on `movies`.
- Return `embeddingDistance` or `similarityDistance` in debug/internal fields only. User-facing UI should not expose raw vector distance.

Example streaming filter shape:

```sql
and exists (
  select 1
  from movie_watch_providers mwp
  where mwp.movie_slug = m.movie_slug
    and mwp.region = coalesce($region, 'US')
    and mwp.provider_id = any($provider_ids::integer[])
    and mwp.availability_type = any($availability_types::text[])
)
```

Temporary fallback option:

- If multiple input movies are submitted during the migration, return a `400` with a clear message.

Do not silently use only the first movie from a multi-movie request at the API level. That makes user intent ambiguous and will be hard to debug.

### Mood and surprise modes

- Port `getMoviesByFilter` to SQL first so mood and surprise can continue working.
- For surprise mode, keep the current popularity-window approach with SQL filters.
- Avoid `order by random()` on large result sets unless the table is small enough; use popularity windows or sampled IDs.

### User and provider routes

Provider routes should keep returning `{ providers }` with `provider_id`, `provider_name`, `type`, and `logo_path`, but read provider identity from Postgres `watch_providers`. If the UI needs provider groups such as `flatrate` or `free`, derive those from `movie_watch_providers.availability_type` for the selected region or expose a controlled provider-category view.

Movie and suggestion routes should hydrate `streamingProviders` by grouping `movie_watch_providers` rows for each movie:

```js
{
  provider_id,
  provider_name,
  logo_path,
  type: availability_type,
  region,
  link: tmdb_link,
}
```

Do not call TMDB from user-facing route handlers except as an optional lazy refresh for a single movie when availability is missing or older than the TTL. Even then, return cached data first when possible.

Update imports or facade implementations for:

- `src/app/api/user/saved-movies/route.js`
- `src/app/api/user/streaming-services/route.js`
- `src/app/api/user/profile/route.js`
- `src/app/api/auth/login/route.js`
- `src/app/api/auth/signup/route.js`
- `src/app/api/admin/auth/login/route.js`
- `src/app/api/admin/stats/route.js`
- `src/app/api/providers/route.js`
- `src/app/api/admin/providers/route.js`
- `src/app/api/admin/providers/[id]/route.js`
- `src/app/api/lib/auth-helpers.js`

## Phase 6 - One-Movie Similarity UX

Because the embedding query supports one seed movie at a time, update the application behavior for the first release.

### `/search/page.js`

Change input movie logic:

- Limit `inputMovies` to one item while embedding recommendations are active.
- Replace "Add up to 5 movies to anchor your search" with one-movie copy.
- Disable or replace the current input movie when the user selects a second movie.
- Keep `excludeMovies` multi-select because the SQL query can exclude many slugs.
- Keep filters unchanged.
- Ensure the POST body sends exactly one `inputSlugs` entry.

### `src/app/context/MovieCollectionContext.jsx`

Change collection behavior while embedding recommendations are active:

- Cap `collectionItems` at one movie, or bypass the collection pattern and route directly to `/search?movie=<slug>&fromSearch=true`.
- Update the collection error message if the cap remains in the context.

### `src/app/suggestions/page.js`

- Treat `collectionItems[0]` as the only seed movie.
- If more than one movie somehow appears in context, show a recoverable error or redirect to `/search` with only one selected seed.
- Keep the header "based on {title}" behavior.

### API guard

Add a server-side guard in `/api/suggestions`:

```js
if (mode === "collaborative" && process.env.RECOMMENDER_ENGINE === "embedding") {
  if (!Array.isArray(inputSlugs) || inputSlugs.length !== 1) {
    return Response.json(
      { error: "Embedding recommendations currently support exactly one source movie." },
      { status: 400 },
    );
  }
}
```

## Phase 7 - Multi-Movie Embedding Support Later

Do not implement this until the one-movie version is verified.

Possible approaches:

- Centroid vector: average selected movie embeddings and compare all movies to that synthetic vector.
- Best-of match: score each candidate against each seed and keep the best distance.
- Weighted seed blend: weight each seed by user preference or recency.
- Reciprocal rank fusion: run one nearest-neighbor query per seed and merge ranks.
- Hybrid: use embedding neighbors for candidate generation, then re-rank by metadata and filter fit.

Validation needed before enabling:

- Results should not collapse into generic popular consensus movies.
- Results should make sense when selected movies are from different genres.
- Excluded movies should penalize similar candidates, not just exact slugs.

## Phase 8 - Cutover And Cleanup

### Feature flags

Add environment flags:

```env
DATABASE_URL=
RECOMMENDER_ENGINE=embedding
DATA_BACKEND=postgres
```

During migration:

- `DATA_BACKEND=dynamodb` keeps the old route helpers active.
- `DATA_BACKEND=postgres` uses the new helpers.
- `RECOMMENDER_ENGINE=embedding` enables one-movie vector recommendations.

### Watch-provider refresh infrastructure

Use the Postgres tables as a refreshable cache of TMDB Watch Providers data.

Recommended first implementation:

- Backfill all 4,000 movies once with a local script.
- Add a server-side sync entrypoint that can process a bounded chunk, for example 100-250 stale movies per invocation.
- Deploy it as a Supabase Edge Function or a protected Next.js route.
- Schedule it with Supabase Cron once Supabase is the database of record.
- Refresh provider catalog weekly.
- Refresh per-movie availability daily or every 2-3 days.
- Track progress and failures in `watch_provider_sync_runs`.
- Store per-movie refresh state in `movie_watch_provider_sync_state` and select stale movies by oldest `fetched_at`, with never-fetched movies first.
- Use low concurrency and exponential backoff for TMDB `429` responses.
- Keep the TMDB API token server-side only.

Avoid live TMDB calls in `/api/suggestions`, `/api/movies`, and saved-movie list requests. These hot paths need predictable latency and should be filterable entirely in SQL.

### Remove old dependencies after cutover

Only after production traffic is on Postgres and the old path is no longer needed:

- Remove `@aws-sdk/client-dynamodb`
- Remove `@aws-sdk/lib-dynamodb`
- Remove `aws-sdk`
- Remove `sqlite`
- Remove `sqlite3`
- Remove or archive `movies.db`
- Remove unused setup scripts or move them to `scripts/legacy/`

### Documentation updates

- Update `README.md` environment variables.
- Replace DynamoDB setup steps with Supabase setup steps.
- Document how to run migrations.
- Document how to re-import or refresh embeddings.

## Phase 9 - Testing Checklist

### Local route checks

```bash
npm run build
curl "http://127.0.0.1:3000/api/movies?limit=5&page=1"
curl "http://127.0.0.1:3000/api/movies?slug=the-night-of-the-hunter&limit=1"
curl "http://127.0.0.1:3000/api/movies?title=night%20hunter&limit=10"
```

### Similarity checks

Single seed should succeed:

```bash
curl -X POST "http://127.0.0.1:3000/api/suggestions" \
  -H "Content-Type: application/json" \
  -d '{"mode":"collaborative","inputSlugs":["the-night-of-the-hunter"],"excludeSlugs":[]}'
```

Multiple seeds should fail clearly while `RECOMMENDER_ENGINE=embedding`:

```bash
curl -X POST "http://127.0.0.1:3000/api/suggestions" \
  -H "Content-Type: application/json" \
  -d '{"mode":"collaborative","inputSlugs":["the-night-of-the-hunter","parasite-2019"],"excludeSlugs":[]}'
```

### App checks

- Search autocomplete returns movie results.
- Search page allows one seed movie and many excluded movies.
- Suggestions return similar movies for one seed.
- Genre, vibe, duration, decade, rating, streaming, and saved-movie filters still apply.
- Streaming filters work when selecting one provider and multiple providers.
- Movie details and saved-movie cards show providers from `movie_watch_providers`.
- No user-facing recommendation request calls TMDB.
- Watch-provider sync can process a small test batch and record success/failure in `watch_provider_sync_runs`.
- Saved movies can be added and removed.
- Login and signup still work.
- Admin watch-provider create, update, and delete still work.
- Admin stats load from Postgres counts.

## Open Questions

- ~~What is the exact embedding dimension in Supabase?~~ **384.**
- ~~Is the Supabase `movies` table already created, and does it use `movie_slug` or `slug`?~~ **Already created with `movie_slug` as the primary key. 4,000 rows loaded.**
- ~~Are all DynamoDB records already migrated into Supabase, or only movie embeddings?~~ **Movies and reviews are loaded. User tables (`users`, `user_saved_movies`) do not yet exist in Supabase and must be created and populated from DynamoDB exports. Likes/favorites and separate genre/nanogenre/director/actor tables are out of scope. Provider data should use TMDB Watch Providers, exposed through the existing provider API shape.**
- ~~Should raw review text live in Supabase, or only embeddings?~~ **Review text is already in Supabase. The `reviews` table has 282,069 rows with full text and 384-dimensional embeddings.**
- Should embedding recommendations replace collaborative recommendations immediately, or should they be launched behind a toggle?
- Is the app deployed to a serverless environment where Supabase transaction pooling is required?
- Which regions should watch-provider availability support beyond `US`?
- Is a 24-72 hour watch-provider freshness window acceptable for the product, or does any UI require same-day updates?

## Official References

- Supabase Postgres connection options: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Postgres.js client guide: https://supabase.com/docs/guides/database/postgres-js
- Supabase vector columns: https://supabase.com/docs/guides/ai/vector-columns
- Supabase vector indexes: https://supabase.com/docs/guides/ai/vector-indexes
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase scheduled Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- TMDB movie watch providers: https://developer.themoviedb.org/reference/movie-watch-providers
- TMDB movie provider list: https://developer.themoviedb.org/reference/watch-providers-movie-list
- TMDB rate limits: https://developer.themoviedb.org/docs/rate-limiting
