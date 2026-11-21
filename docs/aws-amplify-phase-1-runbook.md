# AWS Amplify Phase 1: Hosting runbook

**Status:** repository changes are ready. The AWS console steps below have not been run yet.

## Repository changes

- `amplify.yml` sets up the build: Node 22, `npm ci`, writes the runtime env file, then runs `next build`. The artifacts come from `.next`, and both `.next/cache` and the npm cache are cached between builds.
- `scripts/amplify/write-runtime-env.mjs` copies an allowlist of server-side variables into `.env.production` during the build. Amplify does not pass console environment variables to the SSR runtime, so they have to be written to that file. It reads Amplify branch environment variables and Amplify secrets (SSM Parameter Store). Secrets take precedence. It prints variable names but never their values. The build fails if `DATABASE_URL` (or `NEON_DATABASE_URL`), `AUTH_SECRET`, or `JWT_SECRET` is missing. If `AUTH_URL` is not set, it adds `AUTH_TRUST_HOST=true` so NextAuth accepts the CloudFront-forwarded host. Values with quotes, `$`, `#`, or newlines are kept intact.
- `src/app/api/lib/logger.js` now writes log files only in local development. Before, it tried to create `./logs` on any host other than Vercel, and that fails on Amplify's read-only SSR filesystem.

> `.env.production` exists only inside the build container. It is ignored by git (`.env*`) and is never sent to the browser. Only `NEXT_PUBLIC_*` variables reach client code, and none are used.

## Console steps

1. **Account and region.** Pick the AWS account and a region close to the Neon database (Neon's region is in the hostname of `DATABASE_URL`). Use an IAM Identity Center user or an IAM user with Amplify admin access. Do not use the root user.
2. **Connect the repository.** In Amplify, choose *Create new app* → GitHub → `jakelawrence/you-should-watch`. Install the Amplify GitHub App only on that repository. Amplify detects Next.js SSR and uses the `amplify.yml` from the repository.
3. **Non-production branch first.** Connect a non-production branch (`develop`, once it exists, or a release branch) before `main`.
4. **Server secrets.** Go to *Hosting → Secrets* (stored in SSM at `/amplify/<appId>/<branch>/`) and add:
   - Required: `DATABASE_URL` (pooled Neon URL), `AUTH_SECRET`, `JWT_SECRET`
   - As needed: `OPENAI_API_KEY`, and the OAuth client secrets for any provider you enable
   Use different values for the non-production branch and for `main`, and point non-production at a Neon branch, not the production database.
5. **Non-secret environment variables.** Under *Hosting → Environment variables*, set these per branch: `RECOMMENDER_ENGINE`, `SEMANTIC_SEARCH_EMBEDDING_COLUMN`, `QUERY_EMBEDDING_PROVIDER`, `QUERY_EMBEDDING_MODEL`, `QUERY_EMBEDDING_DIMENSIONS`, `POSTGRES_MAX_CONNECTIONS` (keep this low, around 3), the OAuth client IDs, and `AUTH_URL` once a stable domain exists. Do not add `NEON_DATABASE_URL_DIRECT`, `TMDB_AUTH_TOKEN`, or AWS access keys. Only the operator scripts use those.
6. **Deploy and check.** Use the smoke-test list below.
7. **Custom domain.** Add it under *Hosting → Custom domains*. Amplify provisions the ACM certificate and HTTPS. Then set `AUTH_URL=https://<domain>` and update the metadata URL in `src/app/layout.js`, which still points at `you-should-watch.vercel.app`.
8. **OAuth callbacks.** For each enabled provider, add `https://<host>/api/auth/callback/<provider>` for every Amplify host (the branch URLs and the custom domain).
9. **Production.** After the non-production branch passes, connect `main` with its own secrets and redeploy.

## Smoke test (run against each deployed branch)

- Pages: `/`, `/discover`, `/search`, `/spin`, `/scenarios`, `/login`
- Public API: `/api/movies`, `/api/movies/languages`, `/api/suggestions`, `/api/providers`
- Auth: email/password sign-in, at least one OAuth provider, sign-out, and a redirect from `/profile` to `/login` when signed out
- Signed in: `/profile`, `/profile/saved-movies` (save and remove a movie), `/profile/streaming-service`
- Admin: `/admin/login`, then the provider editor and stats

## Logs and rollback

- **Build logs:** Amplify console → app → branch → select the build → *Build* / *Deploy* steps.
- **Runtime (SSR and API) logs:** Amplify console → *Hosting → Monitoring → Hosting compute logs*. This links to the CloudWatch log group `/aws/amplify/<appId>`.
- **Redeploy a previous revision:** Branch → *Deployments*, pick the last good build, then *Redeploy this version*. If you also need to change code, revert the commit on the branch and push; that triggers a new build.
