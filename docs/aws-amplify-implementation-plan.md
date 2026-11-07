# AWS Amplify Implementation Plan

## Goal

Host the Next.js application with AWS Amplify and adopt AWS services in manageable steps. The plan covers hosting and CI/CD, user authentication, authorization, serverless workloads, secrets, and the data-layer decision.

The repository already has Next.js application routes and SQL migrations. Keep the current database during the initial deployment unless investigation shows a specific reason to replace it. Amplify Hosting and Amplify backend capabilities can be introduced independently of a database migration.

## Target architecture

- **Amplify Hosting** builds and hosts the Next.js application. Connect the Git repository so pushes deploy automatically, and use separate branches for production and non-production environments. Use pull request or branch previews to review changes before release.
- **Amazon Cognito through Amplify Auth** provides sign-up, sign-in, sign-out, and account recovery for features such as personal watchlists, ratings, and preferences.
- **Next.js server routes and server components** handle request-time application behavior. They verify the signed-in identity and permissions before reading or changing private data.
- **The existing SQL database** remains the initial system of record. Apply authorization in the server and, where supported, in database policies. Do not move credentials or privileged database access into browser code.
- **AWS Lambda through Amplify Functions** handles work that should run independently of a user request, such as scheduled metadata refreshes or longer-running ingestion tasks.
- **Secrets and environment configuration** are kept out of source control and browser bundles. Configure separate values for each deployment environment.
- **Amplify Data** is an option for new AWS-managed data/API needs. Evaluate it separately against the current relational schema and migrations before adopting it.

## Phase 0: Inventory and design decisions

- [x] Identify the database targeted by the existing SQL migrations and document how the application connects to it.
- [x] List current API routes, scheduled scripts, external APIs, and any existing authentication provider.
- [x] Decide which features should require an account, such as personal watchlists, ratings, or saved preferences.
- [x] Define the first authorization rules: public data, user-owned data, and administrator-only operations.
- [x] Choose production and non-production Git branches and decide which branch will be the production deployment.
- [x] Record external API credentials and other configuration needed at runtime; do not commit secret values.
- [x] Decide whether the existing database remains in place for the first release. Treat any database migration as a separate project with data migration and rollback planning.

Phase 0 inventory and recommended decisions: [docs/aws-amplify-phase-0-inventory.md](aws-amplify-phase-0-inventory.md).

### Phase 0 configuration decision

- Store server-side secrets in environment-scoped SSM Parameter Store SecureString parameters and grant the Amplify SSR compute role least-privilege access to the relevant environment path. Do not keep long-lived AWS credentials in application environment variables. Parameter Store does not rotate secrets automatically; evaluate Secrets Manager if automatic rotation is required.
- Use AWS AppConfig for non-secret runtime settings that benefit from changes without redeployment, such as feature flags, operational toggles, and provider limits. Implement server-side retrieval and caching; AppConfig values are not automatically process environment variables.
- Keep build-time and intentionally public settings in Amplify branch-specific environment variables. Anything bundled into browser code is public and must not contain secrets.
- Isolate production and non-production parameters, AppConfig environments, and IAM access.

## Phase 1: Deploy the existing Next.js app with Amplify Hosting

- [ ] Create or select the AWS account, region, and IAM access needed to administer the application.
- [ ] Connect the application’s Git repository to Amplify Hosting.
- [x] Configure the build settings for the repository’s Next.js version and package manager.
- [ ] Set the required non-secret environment configuration for the first deployment.
- [ ] Deploy a non-production branch and resolve build or runtime issues.
- [ ] Configure a custom domain and HTTPS when the deployment is ready for a stable URL.
- [ ] Deploy the production branch after reviewing the non-production deployment.
- [ ] Confirm that the application’s existing pages and API routes work in the hosted environment.
- [x] Document how to inspect deployment logs and redeploy a previous working revision.

Phase 1 runbook (console steps, variables, smoke test, logs, and rollback): [docs/aws-amplify-phase-1-runbook.md](aws-amplify-phase-1-runbook.md).

## Phase 2: Establish branch-based CI/CD

- [ ] Enable automatic deployments from the chosen production branch.
- [ ] Enable a non-production branch deployment for ongoing integration work.
- [ ] Enable pull request previews if they fit the repository’s review workflow.
- [ ] Configure environment-specific settings so previews and production use the correct services and credentials.
- [ ] Add or confirm build-time checks such as linting and production compilation in the deployment workflow.
- [ ] Verify that a pull request preview can be reviewed without changing production data.
- [ ] Document the release path from a pull request to the production branch and deployment.

## Phase 3: Add authentication with Cognito and Amplify Auth

- [ ] Configure an Amplify Auth backend using Amazon Cognito.
- [ ] Choose the sign-in method, such as email and password, and set account recovery behavior.
- [ ] Add sign-up, sign-in, sign-out, and password-recovery UI to the application.
- [ ] Add a clear signed-in and signed-out state to the navigation and account-specific pages.
- [ ] Protect account-specific pages from unauthenticated access.
- [ ] Configure allowed callback and sign-out URLs for local development, previews, and production.
- [ ] Test account creation, sign-in, sign-out, recovery, and expired-session behavior in non-production.
- [ ] Decide how existing anonymous or locally stored user preferences should behave after sign-in.

## Phase 4: Enforce authorization for user data

- [ ] Map each private record to its owning user or other authorization boundary.
- [ ] Require a valid authenticated identity in every server route that reads or changes private data.
- [ ] Derive the user identity from the verified session or token on the server; never accept an owner ID from the browser as proof of ownership.
- [ ] Add database constraints or row-level policies where the selected database supports them.
- [ ] Add role-based access only for concrete needs, such as protected administration of shared movie metadata.
- [ ] Keep privileged database credentials and administrative operations on the server.
- [ ] Return appropriate unauthenticated and unauthorized responses without exposing private records.
- [ ] Check public, signed-in, cross-user, and administrator cases for each protected feature.

## Phase 5: Add serverless functions and secrets where useful

- [ ] Identify tasks that should run outside a page request, such as scheduled provider metadata refreshes or bulk ingestion.
- [ ] Implement each selected task as an Amplify Function (AWS Lambda) with the smallest required permissions.
- [ ] Add a schedule or event trigger only when the task needs one; keep request-driven operations in the app when that is simpler.
- [ ] Store external API keys and database credentials as managed secrets or secure environment configuration.
- [ ] Ensure secrets are not committed, logged, returned in API responses, or bundled into client-side JavaScript.
- [ ] Configure separate secrets and resource access for non-production and production.
- [ ] Add useful logs and failure handling for each function.
- [ ] Run a function against non-production data and verify that retries or repeated runs do not create duplicate or inconsistent records.

## Phase 6: Evaluate Amplify Data and other AWS services

- [ ] Compare the current relational schema and SQL queries with the access patterns required by Amplify Data.
- [ ] Identify a bounded feature that could benefit from an Amplify-managed API or data model, if one exists.
- [ ] Estimate the work to migrate data, update application queries, preserve authorization, and roll back.
- [ ] Adopt Amplify Data only if the benefits justify changing the data access layer; otherwise continue using the existing database.
- [ ] Consider Amazon S3 through Amplify Storage only if the app needs user-uploaded files or other object storage.
- [ ] Consider queues or workflow services only if ingestion volume or processing needs outgrow a direct Lambda approach.
- [ ] Document the selected AWS services and the reason for each choice.

## Phase 7: Production readiness

- [ ] Review IAM permissions for least privilege across hosting, functions, data access, and deployment roles.
- [ ] Confirm that development and preview environments cannot accidentally modify production data.
- [ ] Verify authorization behavior for all user-owned records and privileged actions.
- [ ] Check logs for accidental exposure of tokens, personal data, and API credentials.
- [ ] Set appropriate monitoring and alerts for failed builds, function errors, and application availability.
- [ ] Document backup, recovery, and database migration procedures for the selected data store.
- [ ] Perform a production release and confirm the deployed app, sign-in flow, and protected features.

## Official Amplify guides

- [Amplify Next.js hosting and full-stack branch deployments](https://docs.amplify.aws/nextjs/deploy-and-host/fullstack-branching/)
- [Amplify authentication](https://docs.amplify.aws/nextjs/build-a-backend/auth/set-up-auth/)
- [Amplify functions](https://docs.amplify.aws/nextjs/build-a-backend/functions/set-up-function/)
- [Amplify data](https://docs.amplify.aws/nextjs/build-a-backend/data/set-up-data/)
