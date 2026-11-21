# You Should Watch

You Should Watch is a Next.js movie discovery app for finding something good to watch without browsing an endless catalog. It combines direct movie search, guided scenarios, semantic recommendations, mood/vibe filters, saved movies, streaming-provider preferences, and a random picker for a user's own watchlist.

Live site: https://youshouldwatch.app/

## What the App Does

- Search the movie catalog by title, keyword, or semantic query.
- Start from one or more movies and get similar recommendations from pgvector embeddings.
- Browse scenario shortcuts such as Date Night, Cozy Sunday, Adrenaline Rush, Hidden Gems, and World Cinema Night.
- Filter discovery and recommendations by genre, vibe, runtime, decade, rating, and streaming availability.
- Create an account, save movies, manage streaming services, and view saved movie details.
- Use Spin to pick a random saved movie from a filtered pool.
- Use admin pages to add movies, manage streaming providers, and inspect basic catalog stats.

## Tech Stack

- Next.js 15 App Router
- React 19
- Tailwind CSS
- Amazon Cognito (AWS Amplify Gen 2) for email/password and Google sign-in
- AWS Amplify Hosting (production deploys from `main`)
- Neon/Postgres via `postgres`
- pgvector and pg_trgm for semantic and fuzzy search
- TMDB provider data for streaming availability
- In-memory API caching with `node-cache`

## App Routes

- `/` - home page with hero search and featured scenarios
- `/discover` - searchable/filterable movie discovery page
- `/scenarios` - full scenario directory
- `/login` - sign in/sign up entry point
- `/profile` - account overview
- `/profile/saved-movies` - saved movie library with sort/filter controls
- `/profile/streaming-service` - user streaming-service preferences
- `/spin` - random picker for saved movies
- `/admin` - admin dashboard
- `/admin/add-movies`, `/admin/add-providers`, `/admin/edit-providers` - admin tools

## API Surface

- `GET /api/movies` - catalog search, slug lookup, filtering, sorting, pagination, and semantic search
- `POST /api/suggestions` - recommendation endpoint for `collaborative`, `mood`, and `surprise` modes
- `GET /api/providers` - streaming provider list
- `GET|POST|DELETE /api/user/saved-movies` - saved movie library
- `GET|POST /api/user/streaming-services` - saved provider preferences
- `GET /api/user/profile` - profile metadata and counts
- `GET /api/auth/me` - the signed-in user, read from the Cognito session
- `/api/admin/*` - admin check, stats, movies, and provider management (requires the `admins` group)

## Recommendation and Search

The current recommender is embedding-first. `POST /api/suggestions` calls `getMultiSeedEmbeddingRecommendations()` for collaborative recommendations, using one or more seed movie slugs and a configurable candidate limit.

Other recommendation modes are intentionally simple:

- `mood` maps tone/style/popularity/duration/pace/emotion options to movie fields, then sorts by rating and randomizes the top slice.
- `surprise` samples movies from popularity windows so results span mainstream titles and less obvious picks.
- Server-side filters can narrow recommendations by genre, vibe, runtime, decade, minimum rating, and the signed-in user's streaming services.

`GET /api/movies` supports keyword title search and semantic search. Semantic search generates a query embedding when `searchMode=semantic` and requires the optional embedding environment variables below.

## Local Setup

Requirements:

- Node.js 18+
- npm
- A Neon/Postgres database with the app schema and movie data

Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Create `.env.local` from `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require&channel_binding=require"
NEON_DATABASE_URL_DIRECT="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require&channel_binding=require"
```

Sign-in uses Amazon Cognito, so there are no auth secrets in `.env.local`. To run sign-in locally, start your own test backend with your AWS credentials:

```bash
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
npx ampx sandbox secret set DATABASE_URL   # used by the user-migration Lambda
npx ampx sandbox
```

The sandbox writes `amplify_outputs.json` (gitignored), which the app reads at build and run time. Run `npm run dev` in a second terminal.

Optional integrations:

```env
QUERY_EMBEDDING_PROVIDER="openai"
QUERY_EMBEDDING_MODEL="text-embedding-3-small"
QUERY_EMBEDDING_DIMENSIONS="384"
OPENAI_API_KEY=""

TMDB_AUTH_TOKEN=""
```

## Database

The app expects Postgres tables for:

- `public.movies`
- `public.users`
- `public.user_saved_movies`
- `public.watch_providers`
- `public.movie_watch_providers`
- `public.movie_watch_provider_sync_state`
- `public.watch_provider_sync_runs`

The phase 2 schema migration is in `db/migrations/20260608222000_phase_2_schema.sql`. It adds user tables, provider tables, pgvector/pg_trgm extensions, movie vibe columns, and supporting indexes. Runtime code tolerates missing watch-provider tables by returning empty provider lists, but full streaming filters need those tables populated.

Useful migration/data scripts:

```bash
npm run inventory:phase1
npm run db:semantic-inventory
npm run migrate:phase3:export
npm run migrate:phase3:transform
npm run migrate:phase3:load
npm run sync:providers
npm run migrate:phase3:validate
npm run sync:posters
npm run audit:tmdb-ids
```

## Project Structure

```text
src/
  app/
    api/                 API routes and server-side repositories
    admin/               Admin pages
    components/          Shared UI and feature components
    discover/            Search and discovery UI
    profile/             User profile, saved movies, streaming services
    spin/                Saved-movie random picker
  auth.js                Server-side session helper (Cognito ID token -> app user)
  middleware.js          Protects signed-in and admin routes
amplify/
  auth/                  Cognito user pool, identity pool, Google sign-in, SES email
  functions/migrate-user Lambda that moves existing users into Cognito on first sign-in
  backend.ts             Backend definition and Cognito overrides
scripts/
  admin/                 One-off account/admin helpers
  maintenance/           Ongoing Neon/TMDB diagnostics and sync jobs
  migration/             Historical DynamoDB-to-Postgres cutover scripts
  reviews/               Review parsing utilities
docs/migration/          Migration reports and handoff docs
db/migrations/           Postgres schema migrations
public/                  Fonts, images, placeholder assets
```

## Scripts

- `npm run dev` - start the local Next.js dev server
- `npm run build` - build the app
- `npm run start` - run the production build on port 3000
- `npm run lint` - run Next lint
- `npm run admin:create` - legacy: creates a user row in Neon (admin access now comes from the Cognito `admins` group)
- `npm run sync:providers` - refresh TMDB watch providers in Neon
- `npm run sync:posters` - refresh TMDB poster URLs in Neon
- `npm run audit:tmdb-ids` - audit and repair movie TMDB metadata

## Deployment

AWS Amplify Hosting builds each connected branch with `amplify.yml`: it deploys that branch's Cognito backend (`npx ampx pipeline-deploy`), writes runtime settings from SSM Parameter Store (`scripts/amplify/write-runtime-env.mjs`), then builds Next.js. Pushes to `main` deploy production at https://youshouldwatch.app. See `docs/aws-amplify-phase-1-runbook.md`.

To make someone an admin, add their Cognito user to the `admins` group. They need to sign out and back in afterwards.

## Notes

- Anonymous/authenticated suggestion rate-limit helpers exist, but the current suggestions route only computes the limit state and does not enforce it.
- The app is `private: true`; there is no packaged public library API.
