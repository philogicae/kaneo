# API integration tests

These tests boot the Hono app against a local libSQL/SQLite test file (see `setup.ts` for env defaults).

- Run: `pnpm test:integration` from the repo root (uses a disposable `_test` database file).
- CI: `.github/workflows/ci.yml` runs the same command.

Coverage is intentionally incremental: add new files under this directory for additional routes or behaviors, following existing helpers (`helpers/fixtures.ts`, `helpers/database.ts`, `helpers/auth.ts`).
