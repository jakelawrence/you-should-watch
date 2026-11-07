# AWS Amplify Phase 0: Inventory and decisions

**Status:** repository inventory complete; architecture choices below are recommended defaults for review. No AWS resources or credentials were changed.

## Current application inventory

### Database

- The application uses PostgreSQL. The runtime dependency is `postgres`; SQL migrations are under `db/migrations/` and are PostgreSQL syntax.
- The configured database is Neon PostgreSQL: the code supports `NEON_DATABASE_URL`, `NEON_DATABASE_URL_DIRECT`, and `DATABASE_URL`. The runtime connection helper selects a Neon URL when available and supports pooled and direct connections.
- Database access is server-side through the `postgres` package. Do not expose any database URL to browser bundles.
- **First-release decision:** keep Neon and the current schema/migrations. Treat any database move as a separate migration with export, validation, backup, and rollback steps.

### Application routes and authentication

Current API route handlers (`src/app/api/`):

- Public movie data: `/api/movies`, `/api/movies/languages`, `/api/suggestions`.
- User data: `/api/user/profile`, `/api/user/saved-movies`, `/api/user/streaming-services`.
- Admin operations: `/api/admin/auth/login`, `/api/admin/auth/logout`, `/api/admin/providers`, `/api/admin/providers/[id]`, `/api/admin/movies/add`, `/api/admin/stats`.

The app already uses NextAuth (`next-auth` 5 beta) with Google, Apple, Facebook, and GitHub OAuth configuration, plus JWT/session secrets. Admin sign-in and user sign-in are separate route areas. No Amplify Auth/Cognito configuration is present in the repository.

### Background and maintenance work

No in-repository scheduled job or cron configuration was found in the inspected app/scripts paths. Maintenance work is exposed as manually run npm scripts, including provider/poster/language sync, TMDB ID audits, semantic inventory, admin creation, and migration export/transform/load/validation. `package.json` is the source of the script commands.

### External services and runtime configuration

Integration code references these services/configuration categories (names only; values intentionally omitted):

- TMDB API: `TMDB_AUTH_TOKEN` and related API URL configuration; used for movie/provider metadata, posters, and language refresh scripts.
- OpenAI: `OPENAI_API_KEY` for embedding/search workflows.
- OAuth: Google, Apple, Facebook, and GitHub client IDs/secrets for NextAuth.
- Session/security: `JWT_SECRET` and the provider-specific NextAuth configuration.
- PostgreSQL/Neon: `DATABASE_URL`, `NEON_DATABASE_URL`, `NEON_DATABASE_URL_DIRECT`, and PostgreSQL pool tuning variables.
- AWS SDK credentials/region are referenced by migration utilities; confirm whether these are still required before provisioning Amplify runtime access.
- Vercel-specific runtime detection/configuration is present.

Do not commit `.env` values or copy secret values into this document. For Amplify, keep production and non-production values separate and use managed secret/environment configuration.

## Initial authorization model

Recommended baseline based on the routes and current features:

| Data or operation | Access |
| --- | --- |
| Shared movie catalog, suggestions, language/provider reference data | Public read |
| Saved movies, profile, streaming-service preferences | Authenticated owner only; derive the owner from the verified server session |
| Movie/provider edits, admin stats, admin account operations | Administrator only |
| Database credentials, bulk syncs, migrations, and secret-backed integrations | Server-side or operator-only; never browser-side |

Account-required features should include saved movies/watchlists, profile/preferences, and streaming-service preferences. Shared catalog browsing and suggestions can remain public. Confirm whether ratings are a desired product feature; no ratings route was identified in this inventory.

## Recommended Phase 0 decisions

1. **Database:** keep Neon PostgreSQL for the first Amplify release; no data migration in the hosting phase.
2. **Authentication:** record NextAuth as the current provider. The plan’s Cognito/Amplify Auth direction would be a deliberate later migration; do not run two competing identity systems. Preserve existing account ownership and OAuth-provider behavior in that migration design.
3. **Authorization:** apply the initial public/user-owned/admin-only rules above. Enforce private ownership on the server using the authenticated identity, never a client-submitted owner ID.
4. **Branches:** use `main` as the production deployment branch. Use `develop` for the non-production Amplify environment if/when that branch is created; it is not currently present. Continue using pull-request branches for review previews.
5. **Secrets:** configure the runtime variable names listed above as per-environment values in Amplify. This inventory records names only. Audit which variables each deployed route/script actually needs before adding them.
6. **Background work:** keep maintenance scripts operator-run for the initial release. Add Lambda/EventBridge only for a specific recurring or long-running task with a defined schedule, permissions, and idempotency needs.

## Review items before Phase 1

- Confirm `main` is the intended production branch and whether to create `develop` for staging.
- Confirm the longer-term authentication choice: retain NextAuth or plan a Cognito migration.
- Verify the exact Neon connection variables required by the deployed Next.js runtime and which remaining secrets are needed by production code versus local/operator scripts.
- Confirm the AWS account/region and deployment permissions in Phase 1; no account details are stored here.


## Configuration and secrets strategy

Use separate stores based on how the value is consumed:

- **Server-side secrets:** Store database credentials, TMDB and OpenAI tokens, OAuth client secrets, and other private values as environment-scoped SSM Parameter Store SecureString parameters. Give the Amplify SSR compute role least-privilege read access to only the parameters for its branch/environment. The role provides temporary AWS credentials; do not put AWS access keys in application environment variables. Parameter Store does not provide automatic secret rotation. If automatic rotation becomes a requirement, evaluate AWS Secrets Manager.
- **Runtime-tunable non-secret settings:** Use AWS AppConfig for feature flags, operational toggles, provider limits, and similar settings that should change without a code deployment. The Next.js server must retrieve and cache AppConfig data; it does not automatically become a process environment variable.
- **Build-time and public configuration:** Keep values required during the Amplify build, and values intentionally exposed to browser code, in Amplify branch-specific environment variables. Treat browser-exposed values as public. Do not use AppConfig as a replacement for values embedded at build time.

Keep production and non-production parameter paths, AppConfig environments, and IAM permissions separate.

