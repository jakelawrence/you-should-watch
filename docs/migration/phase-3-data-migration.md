# Phase 3 Data Migration Runbook

This runbook implements Phase 3 of `SUPABASE_POSTGRES_MIGRATION_PLAN.md`: export DynamoDB source data, transform it into the Supabase Postgres schema, load it, backfill TMDB Watch Providers, and validate the result.

Raw and transformed payloads are written under `data/migration/phase-3/` by default. That directory is ignored by git because it can contain user data and password hashes.

## Prerequisites

- Phase 2 SQL has been applied to Supabase.
- `.env.local` has `DATABASE_URL`.
- `.env.local` has AWS credentials and `AWS_REGION` for DynamoDB export.
- `.env.local` has `TMDB_AUTH_TOKEN` for watch-provider catalog and availability sync.

## 1. Export DynamoDB

```sh
npm run migrate:phase3:export
```

This exports:

- `movies`
- `users`
- `user-saved-movies`

Use a small rehearsal export when checking credentials or shape:

```sh
npm run migrate:phase3:export -- --limit 25
```

## 2. Transform

```sh
npm run migrate:phase3:transform -- --strict
```

The transform maps DynamoDB camelCase fields into Postgres snake_case fields:

- `slug` to `movie_slug`
- `year` to `release_year`
- `duration` to `duration_minutes`
- `rating` to `content_rating`
- `avgRating` / `averageRating` to `letterboxd_avg_rating`
- `posterUrl` to `poster_url`
- `darknessLevel`, `funninessLevel`, `slownessLevel`, and `intensenessLevel` to the Phase 2 mood columns
- `passwordHash`, `isAdmin`, and `streamingServices` to the `users` columns
- `movieSlug` and `savedAt` to `user_saved_movies`

It intentionally omits likes, favorites, actors, legacy genre ID tables, and `movies.streamingProviders`.

## 3. Load Postgres

Dry-run the transformed files first:

```sh
npm run migrate:phase3:load -- --dry-run
```

Then load:

```sh
npm run migrate:phase3:load -- --skip-invalid-refs
```

The loader upserts in this order by default:

1. `movies`
2. `users`
3. `user_saved_movies`

Movie upserts preserve existing Supabase values when the transformed DynamoDB value is `null`. Saved movie rows can be filtered with `--skip-invalid-refs` when an exported saved row references a user or movie that is not present in Postgres.

## 4. Sync TMDB Watch Providers

Refresh the provider catalog only:

```sh
npm run migrate:phase3:sync-providers -- --catalog-only
```

Refresh a first movie availability chunk:

```sh
npm run migrate:phase3:sync-providers -- --region US --limit 100 --concurrency 2
```

Refresh a specific set of slugs:

```sh
npm run migrate:phase3:sync-providers -- --movie-slugs the-night-of-the-hunter --region US
```

For each movie-region refresh, the script replaces existing `movie_watch_providers` rows inside a transaction and updates `movie_watch_provider_sync_state`. This prevents stale availability rows after TMDB changes. Keep concurrency low and rerun with `--offset` for subsequent chunks.

## 5. Validate

```sh
npm run migrate:phase3:validate -- --strict --sample-slugs the-night-of-the-hunter --provider-movie the-night-of-the-hunter
```

The validation report is written to `docs/migration/phase-3-validation.json` by default. It checks:

- transformed source row counts against Postgres table counts
- sample movie fields
- `embedding_overall is not null` count
- the single-movie vector similarity query
- at least one user with saved movie and streaming preference data
- watch-provider catalog rows
- sample movie watch availability rows for the selected region

The validator does not call TMDB. Route-level checks that `/api/movies` and `/api/suggestions` avoid request-time TMDB calls belong to the Phase 4 and Phase 5 cutover work.
