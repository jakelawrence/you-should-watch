# Phase 1 Schema Mapping

This document implements Phase 1 of `SUPABASE_POSTGRES_MIGRATION_PLAN.md`: inventory the current sources, choose naming conventions, and map the fields used by `src/app/api/lib/dynamodb.js` to Postgres columns or intentional removals.

Run the repeatable inventory with:

```sh
npm run inventory:phase1
```

That package command includes `--include-tmdb`, so it counts the TMDB US provider catalog and samples US availability for the configured sample slug when a `tmdb_id` is available.

Use strict mode when `DATABASE_URL` and AWS credentials are available and the report must fail on missing required remote counts:

```sh
npm run inventory:phase1:strict
```

The command writes `docs/migration/phase-1-inventory.json`.

## Canonical Decisions

- Postgres uses `snake_case` column names.
- The canonical movie key is `movies.movie_slug`.
- Repository helpers must return `slug` for existing UI compatibility, using `movie_slug as slug`.
- Movie metadata stays denormalized for this migration:
  - `movies.genres text[]`
  - `movies.nanogenres text[]`
  - `movies.director text`
- Actors, likes, and favorites are intentionally outside this migration.
- Streaming availability is not stored on `movies`. Existing `movie.streamingProviders` arrays should be hydrated from `movie_watch_providers` joined to `watch_providers`.
- App-owned auth stays on the `users` table. Supabase Auth is not part of this cutover.

## Source Inventory

The generated inventory report covers:

| Source | Required in Phase 1 | How inventory is collected |
| --- | --- | --- |
| DynamoDB `movies` | Yes | `ScanCommand` with `Select: "COUNT"` and sample `GetCommand` lookups |
| DynamoDB `users` | Yes | `ScanCommand` with `Select: "COUNT"` |
| DynamoDB `user-saved-movies` | Yes | `ScanCommand` with `Select: "COUNT"` |
| DynamoDB `providers` | Helpful legacy cache | Counted as optional because TMDB Watch Providers is the canonical source |
| Supabase/Postgres `movies` | Yes | Counted when `DATABASE_URL` is set |
| Supabase/Postgres `reviews` | Yes | Counted when `DATABASE_URL` is set |
| Supabase/Postgres user/watch-provider tables | Yes after Phase 2 | Counted if the tables exist |
| TMDB Watch Providers catalog | Yes for migration planning | Queried only with `--include-tmdb` to avoid accidental live API calls |
| TMDB per-movie availability | Yes for migration planning | Not bulk-fetched by the inventory script; this belongs to the Phase 3 backfill |
| Local `movies.db` | Secondary | Local row counts and `movies` columns are collected from SQLite |
| `scripts/reviews/` | Yes | Files are listed and embedding-related filenames are flagged |

Local SQLite currently has the legacy `movies`, `genres`, `nanogenres`, `directors`, `actors`, `likes`, and `favorites` tables. It should only be used if it contains data missing from DynamoDB or Supabase. The checked local database has old lightweight movie columns: `slug`, `name`, `avgRating`, `popularityRanking`, `posterUrl`, `link`, and `year`.

The review source currently present under `scripts/reviews/` is `parse-letterboxd-reviews.mjs`. No embedding-generation script is currently present in that folder; Supabase already has populated review and embedding columns per the migration plan.

## Movie Field Mapping

| Current app/DynamoDB field | Postgres column | Response compatibility | Notes |
| --- | --- | --- | --- |
| `slug` | `movie_slug` | return `slug` | Canonical Postgres primary key is `movie_slug`. |
| `title` | `title` | return `title` | Local SQLite used `name`, but active app expects `title`. |
| `name` | `title` | return `title` | Legacy SQLite/DynamoDB fallback only. |
| `year` | `release_year` | return `releaseYear`; keep `year` if existing route needs it | Route filters should move to `release_year`. |
| `duration` | `duration_minutes` | return `durationMinutes`; keep `duration` if existing route needs it | Supabase also has `runtime_minutes`; prefer `duration_minutes` for app parity. |
| `rating` | `content_rating` | return `contentRating`; keep `rating` if existing route needs it | This is MPAA-style content rating, not average score. |
| `avgRating` | `letterboxd_avg_rating` | return `avgRating` | Preserve current API shape. |
| `averageRating` | `letterboxd_avg_rating` | return `averageRating` | Preserve current API shape. |
| `popularity` | `letterboxd_popularity` | return if needed as `popularity` | Plan names this `letterboxd_popularity`, not `popularity`. |
| `popularityRanking` | `letterboxd_popularity` | return if needed as `popularityRanking` | Legacy SQLite field. |
| `genreIds` | none | return `genreIds: []` | Integer genre IDs are intentionally not migrated. |
| `genreNames` | `genres` | return `genreNames` and `genres` | Store names only in `text[]`. |
| `genres` | `genres` | return `genres` and `genreNames` | Canonical movie genre source. |
| `keywordIds` | none | omit | Not in first migration. |
| `keywordNames` | optional future `keyword_names` | return `keywordNames: []` until added | Current suggestion scoring reads it, but Phase 1 plan leaves it optional. |
| `nanogenres` | `nanogenres` | return `nanogenres` | Flat `text[]`, no relationship table. |
| `director` | `director` | return `director` | Single denormalized string. |
| `directorSlug` | none | intentional removal | Separate directors table is out of scope. |
| `actorSlug` | none | intentional removal | Actors are out of scope. |
| `posterUrl` | `poster_url` | return `posterUrl` | No `poster_path` column exists. |
| `link` | `letterboxd_link` | return if needed as `link` | Legacy SQLite used `link`. |
| `tmdbId` | `tmdb_id` | return `tmdbId` if needed | Use for watch-provider sync only, not live request-time lookup. |
| `darknessLevel` | `darkness_level` | return `darknessLevel` | Phase 2 must add this column. |
| `funninessLevel` | `funniness_level` | return `funninessLevel` | Phase 2 must add this column. |
| `slownessLevel` | `slowness_level` | return `slownessLevel` | Phase 2 must add this column. |
| `intensenessLevel` | `intenseness_level` | return `intensenessLevel` | Phase 2 must add this column. |
| `streamingProviders` | `movie_watch_providers` + `watch_providers` | return `streamingProviders` array | Hydrate from relational availability rows. |
| `createdAt` / `updatedAt` on movies | `updated_at` where relevant | return only if needed | Movie table has `updated_at`; source `createdAt` is not required. |
| `embedding_overall` | `embedding_overall` | not returned by default | Used for one-seed similarity queries. |

## User Field Mapping

| Current DynamoDB field | Postgres column | Response compatibility | Notes |
| --- | --- | --- | --- |
| `username` | `username` | return `username` | Primary key. |
| `email` | `email` | return `email` | Unique. |
| `name` | `name` | return `name` | Nullable. |
| `passwordHash` | `password_hash` | return `passwordHash` only inside auth helpers | Do not expose in public responses. |
| `isAdmin` | `is_admin` | return `isAdmin` | Preserve admin behavior. |
| `streamingServices` | `streaming_services integer[]` | return `streamingServices` | Provider IDs should be integers. |
| `createdAt` | `created_at` | return `createdAt` | Preserve profile response. |
| `updatedAt` | `updated_at` | return `updatedAt` | Preserve admin/profile behavior if read. |

## Saved Movie Mapping

| Current DynamoDB field | Postgres column | Response compatibility | Notes |
| --- | --- | --- | --- |
| `username` | `username` | return `username` if needed | References `users(username)`. |
| `movieSlug` | `movie_slug` | return `movieSlug` if needed | References `movies(movie_slug)`. |
| `savedAt` | `saved_at` | return `savedAt` | Used by saved-movies sorting. |

The Postgres primary key should be `(username, movie_slug)`. Deduplicate exported rows before import.

## Watch Provider Mapping

| Existing/current shape | Postgres column/table | Response compatibility | Notes |
| --- | --- | --- | --- |
| `provider_id` | `watch_providers.provider_id` | return `provider_id` | Store as integer. |
| `provider_name` | `watch_providers.provider_name` | return `provider_name` | TMDB provider name. |
| `logo_path` | `watch_providers.logo_path` | return `logo_path` | Keep TMDB logo path. |
| `display_priority` | `watch_providers.display_priority` | return `display_priority` | Region-specific priority can be revisited later. |
| provider raw payload | `watch_providers.raw_tmdb` | not returned by default | Useful for audit/replay. |
| movie provider availability | `movie_watch_providers` | hydrate into `movie.streamingProviders` | Keyed by `movie_slug`, `region`, `provider_id`, and `availability_type`. |
| `type`/availability kind | `movie_watch_providers.availability_type` | return provider decorated with type if needed | Allowed values: `flatrate`, `free`, `ads`, `rent`, `buy`. |
| TMDB provider URL | `movie_watch_providers.tmdb_link` | optional response field | Comes from per-movie watch providers response. |
| fetch status | `movie_watch_provider_sync_state` | not public | Tracks movies with no providers as well as successful refreshes. |

## `dynamodb.js` Function Mapping

| Function | Target Postgres implementation | Migration status |
| --- | --- | --- |
| `query` | Temporary compatibility helper over `movies` only, then remove | In scope only while routes are migrated. |
| `queryAllItems` | Temporary compatibility helper over `movies` only, then remove | In scope only while routes are migrated. |
| `getMovie` | `select ... from movies where movie_slug = $1` plus provider hydration | In scope. |
| `getMovies` | `select ... from movies where movie_slug = any($1)` plus provider hydration | In scope. |
| `getMoviesByFilter` | SQL filter builder against `movies` columns | In scope. |
| `getTableCount` | `select count(*) from allowlisted_table` | In scope for admin stats. |
| `getProviderCount` | `select count(*) from watch_providers` | In scope. |
| `getUserCount` | `select count(*) from users` | In scope. |
| `getUserByUsername` | `select ... from users where username = $1` | In scope. |
| `getUserByEmail` | `select ... from users where email = $1` | In scope. |
| `saveProvider` | Upsert into `watch_providers` | In scope for current admin UI. |
| `getProviders` | `select ... from watch_providers` | In scope. |
| `updateProvider` | Update allowlisted `watch_providers` columns | In scope. |
| `deleteProvider` | Delete from `watch_providers` | In scope, but watch availability references must be considered. |
| `getUserSelectedStreamingServces` | `select streaming_services from users where email = $1` | In scope; keep typo wrapper until callers are renamed. |
| `getUserSavedMovies` | `select movie_slug, saved_at from user_saved_movies where username = $1` | In scope. |
| `saveUserSavedMovie` | Insert into `user_saved_movies` with conflict handling | In scope. |
| `deleteUserSavedMovie` | Delete from `user_saved_movies` by `(username, movie_slug)` | In scope. |
| `getMovieGenres` | Read from `movies.genres` | Replace/remove; no separate table. |
| `getGenresOfMovies` | Read from `movies.genres` for each movie | Replace/remove; no separate table. |
| `getMoviesOfGenres` | `where $genre = any(genres)` | Replace/remove; no separate table. |
| `getMovieNanogenres` | Read from `movies.nanogenres` | Replace/remove; no separate table. |
| `getNanogenresOfMovies` | Read from `movies.nanogenres` for each movie | Replace/remove; no separate table. |
| `getMovieDirectors` | Read from `movies.director` | Replace/remove; no separate table. |
| `getDirectorsOfMovies` | Read from `movies.director` for each movie | Replace/remove; no separate table. |
| `getMovieActors` | none | Intentional removal; actors out of scope. |
| `getActorsOfMovies` | none | Intentional removal; actors out of scope. |
| `getMovieFavoritedUsers` | none | Intentional removal; favorites out of scope. |
| `getUsersFavorites` | none | Intentional removal; favorites out of scope. |
| `getMovieLikedUsers` | none | Intentional removal; likes out of scope. |
| `getUsersLikes` | none | Intentional removal; likes out of scope. |
| `getUserLikes` | none | Intentional removal; likes out of scope. |
| `scanUsersBatch` | none | Internal legacy helper for likes/favorites scans; remove. |

## Sample Comparison

The inventory script compares compact movie objects by slug when both DynamoDB and Postgres are available:

```sh
node scripts/migration/phase-1-inventory.mjs \
  --out docs/migration/phase-1-inventory.json \
  --sample-slugs the-night-of-the-hunter
```

The comparison intentionally uses the app-facing field names (`slug`, `title`, `avgRating`, `posterUrl`, mood levels) so differences map directly to compatibility-layer work in later phases.

## Phase 1 Open Items For Later Phases

- Keep `DATABASE_URL` configured before expecting Postgres row counts and sample comparisons from the inventory command.
- Add the Phase 2 mood columns and `title_lower` generated column before importing DynamoDB-only movie fields.
- Backfill TMDB Watch Providers as a Phase 3 job; do not call TMDB during `/api/movies` or `/api/suggestions`.
- Decide whether current `keywordNames` scoring should be removed or backed by a future `keyword_names text[]` column before the route cutover.
