# Study: replacing PostgreSQL with SQLite (single-container architecture)

Task: KAN-46. Motivation: one Docker container with the SQLite database file on a mounted volume, eliminating the Postgres sidecar.

## TL;DR

Feasible for the intended deployment (single API instance, modest teams), but it is not a driver swap:

- ~45 tables use `drizzle-orm/pg-core` exclusively; every table needs a mechanical `pgTable → sqliteTable` rewrite (~1,300 lines in `apps/api/src/database/schema.ts` + 436 in `relations.ts`, of which relations are dialect-neutral).
- Five Postgres-specific behaviors must be redesigned: advisory locks (3 sites), the `job_lease` UPSERT/RETURNING lease, the `bytea` avatar column, `jsonb` columns, and `information_schema`-based bootstrap migrations.
- Better Auth works with the `sqlite` drizzle adapter using the same mapped tables; no schema/SDK problem.
- Write concurrency under WAL is adequate for the target use case (single small team server), but it is the hard ceiling: every transaction that batches multiple writes over an `await` stretches the single-writer lock — audit them before trusting it.

Recommendation: **build it as a supported second/startup dialect, not a Postgres replacement**, gated on a prototype spike that validates the transaction/lock redesign. Multi-instance with a shared SQLite file is the red line that stays out of scope.

## Current database footprint

Everything lives under `apps/api/src/database`:

| File | Role | Portability |
|---|---|---|
| `database/index.ts` | `drizzle(node-postgres)` + `pg.Pool` (10 conns), lazy Proxy over the schema | must switch to `drizzle(better-sqlite3)`/`libsql` |
| `database/schema.ts` | all 45 tables, indexes, FKs, `jsonb`, `bytea`, `timestamps` | rewrite to `sqlite-core` |
| `database/relations.ts` | `relations()` definitions, no SQL | portable as-is |
| `database/resolve-database-url.ts` | `pg://` URL parsing | rewrite for a file path + optional `:memory:` |
| `database/wait-for-database.ts` + `prepare-database-startup.ts` | pg readiness loop | mostly deleted (opening the file IS the check) |
| `drizzle/0000..NNNN_*.sql` Postgres migrations, replayed on startup via `drizzle-orm/node-postgres/migrator` (`src/index.ts:806`) | regenerate from the SQLite schema; only the migrator import swaps | | One-off bootstrap guards, etc. |

Notable non-issues:

- IDs are `cuid2` strings generated app-side (`@paralleldrive/cuid2` with `$defaultFn`). No `uuid` DB functions, no sequences, no identity columns → nothing to regenerate on SQLite.
- Search is not FTS: `search/controllers/global-search.ts` uses Drizzle `ilike` + `escapeLikePattern()`. SQLite's `LIKE` is case-insensitive on ASCII, which matches the user-visible search semantics closely; the escape helper carries over 1:1. No `tsvector`, no extensions anywhere.
- No SQL views, stored procedures, triggers, extensions, or partitioning anywhere in the API.

## Postgres-specific features actually used

1. **`jsonb` (5 columns)** — `task.reminderOffsets`, `task.recurrence`, billing `eventData`, Telegram rule `events`, notification-preferences `payload`. SQLite `jsonb` is not supported by Drizzle's sqlite-core; declare as `text().$type<...>()` with a JSON serialization mapper (JSON.stringify/parse) — small custom wrapper type.
2. **`bytea` custom type (1 column)** — `user_avatar.data` image blobs. SQLite `BLOB` with a `customType` is a direct equivalent (same driver `Buffer`).
3. **`pg_advisory_xact_lock` (3 call sites)** — around `project.lastTaskNumber` counter increments (`create-project.ts:24`, `reorder-projects.ts:24`) and a Better Auth customization in `auth.ts:646`. Inside a SQLite `BEGIN IMMEDIATE` transaction, writers are serialized on the whole file, so advisory locks collapse into "run these mutations in one transaction under `busy_timeout`" and the counter-increment logic needs no explicit per-workspace keying.
4. **`job_lease` scheduler leader lease** (`scheduler/leader-lock.ts`: `INSERT ... ON CONFLICT DO UPDATE ... WHERE expires_at < now() RETURNING`). SQLite supports `INSERT ... ON CONFLICT DO UPDATE ... WHERE` since 3.24.0 and `RETURNING` since 3.35.0; the `now()` vs `strftime('%s',...)`/unixepoch comparison needs a small restructuring. The lease pattern itself is portable (and becomes pointless in the default single-instance deployment, but must stay correct for multi-instance delivery).
5. **`information_schema` bootstrap migrations** (`utils/migrate-apikey-reference-id.ts` and several other one-off helpers) — rewrite against `PRAGMA table_info(...)`. Note: SQLite dropped columns require ≥3.35 (bundled with any recent build); `ALTER TABLE` limits are otherwise narrow. Touches about five hand-rolled migration helpers.
6. **onConflict/RETURNING everywhere else** — all `onConflictDoNothing`/`onConflictDoUpdate` usage is Drizzle DSL with direct `sqlite-core` equivalents.
7. **Transactions** — ~10 controllers use `db.transaction(...)`. Drizzle's `better-sqlite3` driver supports transactions (wrapping the sync driver's `BEGIN/COMMIT`). Because better-sqlite3 is synchronous under the hood, any awaited work inside a transaction holds the write lock for its full duration — see Concurrency.

## ORM and Drizzle assessment

- Current stack: `drizzle-orm@0.45` node-postgres + `pg`; migrations generated with `drizzle-kit generate` (`drizzle.config.ts`) are applied at startup via `migrate(migrationsFolder)` and a handful of hand-written migration helpers in `src/index.ts`.
- Recommended SQLite flavor: `drizzle-orm/better-sqlite3` + `better-sqlite3` (maturest Drizzle integration, synchronous, transactional integrity). The `libsql` variant buys HTTP/local-replica/sidecar flexibility but adds a native file-lock edge and is unnecessary when the API and the DB file live in the same container.
- The singleton Proxy in `database/index.ts` isolates controllers from the driver, so most of the switch is mechanical: swap the pool for the better-sqlite3 `Database`, keep the exported shape. But raw SQL strings referencing Postgres semantics must be rewritten by hand.
- Drizzle 0.45's sqlite adapter is as mature as node-postgres for the query language used here (selects, joins, subqueries, upserts). Verify during the prototype that the gen-classes of every query in the ~150 controllers compile against the sqlite adapter.

## Better Auth compatibility

Current config: `drizzleAdapter(db, { provider: "pg", schema: {...12 tables}})` at `apps/api/src/auth.ts:201`.

- Better Auth's drizzle adapter also accepts `provider: "sqlite"`; the mapped table set is unchanged since our `schema.ts` passes the mapping explicitly.
- Nothing about session lifetime, OAuth flow, or API keys changes; sessions are keyed by unique `session.token` strings — fully portable.
- Two caveats: `auth.ts:646` uses `pg_advisory_xact_lock(2026)` inside a `db.transaction` for session-column hydration and must be refactored to plain serial SQL; and the auth OpenAPI export (`auth-openapi.ts`) still holds generic metadata that needs no rewrite.
- `@better-auth/drizzle-adapter` and `@better-auth/api-key` versions are dialect-agnostic; they rely only on Drizzle's portable API surface.

## Concurrency and performance

- SQLite's single-writer model: in practice the API is a single Node process; webhooks, scheduler cron jobs (`scheduler/seat-reconciliation`, reminders), Better Auth session churn, and user edits reach the DB concurrently. Under WAL (`journal_mode=WAL`, `busy_timeout` ~5s, `synchronous=NORMAL`), writes queue and readers proceed; a project-management tool's write rates sit comfortably under WAL capacity.
- Risks concentrate where transactions batch writes behind `await` chains (e.g. `import-tasks.ts` / `import-gitea-issues.ts` imports each task inside its own transaction loop). Each transaction holds the write lock; a 300-task import becomes one long write. Mitigate with per-task transactions reusing one connection, or multi-value `INSERT`s.
- Reads get FASTER with SQLite than with the pg pool: no per-request pool checkout or network round-trip.
- Maintenance: `PRAGMA optimize` + `wal_checkpoint(TRUNCATE)` scheduled at low-traffic hours keeps the file compact; `notification` and `activity` churn this the most.
- The only structural regression risk is accidental write serialization slop: a controller that opens implicit short transactions with the DB on separate queries no longer behaves concurrently. The prototype's benchmark (`tests/api-integration`-wave) must cover a board reordering + notification flow so that this cannot regress silently.

Also note: CI currently spins a PostgreSQL service for `tests/api-integration`; a SQLite variant would change CI cost in a good way (no service container at all). A dual-dialect test matrix is the honest upgrade if Postgres remains supported.

## Deployment and operations impact

- `compose.yml` drops the postgres service: one volume, one healthcheck on the API; `DATABASE_PATH=/data/kaneo.db` replaces `DATABASE_URL`.
- `Dockerfile.kaneo` must ship a compiled `better-sqlite3` — Node 20 prebuilds exist for linux x64/arm64; the question is Alpine musl: better-sqlite3 ships prebuilds for both glibc and musl in recent versions, but this must be validated in the CI image build, otherwise pivot to `@libsql/client` (which also has a prebuilt node binding and a WASM fallback).
- Redis stays optional; the scheduler leader-lease actually becomes unnecessary with a single-instance SQLite deployment, but the shared code must keep behaving with Redis-enabled deployments — one option is to scope SQLite mode to exactly one API instance and refuse to start when `REDIS_URL` is set alongside it, keeping that constraint documented in the compose/Helm docs.
- Helm chart (`charts/kaneo`) must gain a sqlite storageClass-style value: the PVC becomes the primary durable state on NodePath, no postgres state subchart.
- Backup story: a nightly filesystem copy of the SQLite file (or `sqlite3 .backup` dump) is dramatically simpler than `pg_dump` for typical self-hosters; a `--backup` CLI flag in the image is enough.

## Data migration (Postgres → SQLite)

A one-off export/import script is enough; both endpoints stay available during the migration window:

1. Backup Postgres; pin the current version; stop accepting writes (brief maintenance quiesce).
2. Regenerate and apply the Drizzle SQLite schema into an empty SQLite file first.
3. For each of the 45 tables, stream rows in batches and transform:
   - `jsonb` → JSON-stringified `TEXT`
   - `bytea` → `BLOB` (identical Buffer bytes)
   - `timestamp` → one uniform SQLite storage format (ISO-8601 strings or integer epoch), driven by the same Drizzle `timestamp({mode:'date'})` mappers.
4. Insert with prepared statements inside one transaction (`PRAGMA foreign_keys=OFF` during load, then re-enable and run `PRAGMA foreign_key_check`).
5. Validate: table row counts, checksum on canonical queries (sessions, tasks, activity).
6. Rollback plan: keep the Postgres volume and `compose.yml` for one release cycle; SQLite mode is opt-in via env (`DATABASE_MODE=sqlite`, `DATABASE_PATH`), defaulting to postgres if unset — the switch is reversible by data, not by code.

Volume: a small instance's DB is a few to tens of MB; the migration takes seconds to minutes.

## Rewrite scope estimate

| Work item | Size |
|---|---|
| `schema.ts` (1,289 lines) + `relations.ts` (436) to `sqlite-core`, migrations regen | ~1.5 days |
| Database bootstrap: path resolver, readiness removal, migrator swap | ~0.5 day |
| JSONB → TEXT mapper type, avatar BLOB custom type, PRAGMA setup (WAL, busy_timeout, FK, synchronous) | ~0.5 day |
| Advisory-lock → transaction refactor (`auth.ts`, `create-project`, `reorder-projects`) + `job_lease` SQL port | ~1 day |
| Hand-rolled `information_schema` migration helpers → `PRAGMA` variants | ~1 day |
| Full typecheck of ~150 controllers against the sqlite builder, fixing query-language drift | ~2 days |
| SQLite variant of `tests/api-integration` + CI changes | ~1 day + CI |
| Dockerfile/compose/Helm split (single-container variant) + docs | ~1 day |
| pg→SQLite importer script + dry-run verification | ~1 day |
| **Total** | **~2–3 weeks with an on-par test suite** |

## Open questions for the prototype

1. better-sqlite3 native build on the Alpine-based container (musl) — if it fails, pivot to `@libsql/client`.
2. Do the five `jsonb → text` column mappers hold with Drizzle's `text({mode:'json'})` or a custom type across all read/write sites?
3. Profile a large import (500 tasks) under WAL to size write-transaction risk on the import paths.
4. Confirm better-auth 1.6.x `drizzleAdapter({provider:"sqlite"})` emits no Postgres-specific SQL against our mapped schema (session, apiKey, and cleanup flows included).
5. Decide whether Postgres remains a parallel option — maintaining two dialects means double migration generation and CI matrices per schema change.

## Recommendation

Proceed, scoped as:

1. **Spike (~1 day):** `schema.ts` + a representative set of controllers compiling against `better-sqlite3` on a scratch branch, WAL verified in-container. Kill switch if the musl build fails and libsql is also unacceptable.
2. **Main implementation** per the table above, SQLite staged behind `DATABASE_MODE` env, keeping Postgres for one release.
3. **Migration script + docs** shipped with the release; don't silently drop Postgres support in the same version.
4. Explicitly document and enforce: **no multi-instance SQLite support** (single API container only).
