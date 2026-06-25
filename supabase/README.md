# Postgres Migrations

This legacy-named directory stores SQL migrations for the Postgres cutover. The current target database is Neon Postgres.

Apply migrations by running the SQL against the target project database with the direct Neon connection string. The current migration is intentionally idempotent and matches Phase 2 of `SUPABASE_POSTGRES_MIGRATION_PLAN.md`.

After applying a migration, refresh the inventory report:

```sh
npm run inventory:phase1:strict
```
