# AGENTS.md

> **Project management.** For the full project-delivery workflow, use the `project-management` skill.
>
> **Audience.** AI agents working inside the Kaneo fork (self-hosted instance customization: Hono API + React web).
>
> **Notes:**
>
> - This is a **fork** of [usekaneo/kaneo](https://github.com/usekaneo/kaneo) that tracks upstream. `upstream/main` is a local ref — never fetch; deleting upstream-owned paths is accepted and will surface as conflicts on upstream syncs. Fork context: self-hosted single instance, compose-based deploy, no release/GHCR/Helm machinery (removed 2026-09-11), MCP used **HTTP-only** (`/api/mcp`; `packages/mcp` stdio package deleted).
> - Route middleware declared via `createRoute({ middleware })` runs **before** request validators — middleware must read the raw request, not `c.req.valid()` (validators haven't run yet).
> - `dotenv-mono` is declared in the **root** `package.json` and consumed via pnpm hoisting by `apps/api`, `packages/email`, and `tests/` (which has no `package.json`). Do not "re-home" it to per-package deps without handling `tests/api-integration` resolution.
> - Root `.env` carries server env vars; Vite-only overrides go in `apps/web/.env.local`. Never print secret values.
> - `lint` scripts run Biome with `--write` and can rewrite unrelated files — prefer `pnpm exec biome check <paths>` while iterating.
> - `apps/docs/openapi.json` is a committed artifact checked by CI (`pnpm openapi:check`); regenerate with `pnpm openapi:check:fix` after any route/schema change.
> - `i18n/en-US.json` is the source of truth; `pnpm i18n:schema` regenerates `i18n/schema.json` after key changes. `scripts/i18n/check.mjs --fix` only adds missing keys — it never prunes extras, so removing a key means removing it from **every** locale file.
> - `pnpm-workspace.yaml` pins security-relevant overrides (`better-auth`, `hono`, `esbuild`…). Don't bypass them in package manifests.
> - User-visible web copy must use static i18n keys — no hardcoded UI copy.

## Project overview

- **Stack**: TypeScript monorepo (pnpm 12 workspaces + turbo) — Hono API (`@hono/zod-openapi`, Better Auth, Drizzle/PostgreSQL, optional Redis fan-out), React/Vite web (TanStack Router/Query, Tailwind 4, Biome), React Email templates.
- **Workspaces**: `apps/api` (API authority: controllers, events, integrations, HTTP MCP, WebSockets) · `apps/web` (UI, fetchers, hooks, realtime cache updates) · `apps/docs` (docs content + committed `openapi.json`) · `packages/libs` (typed Hono client) · `packages/permissions` (permission vocabulary, built-in roles) · `packages/email` · `packages/planka-import` (published CLI).
- **Deploy**: `compose.yml` builds locally via `Dockerfile.kaneo` (bundled API + web + PostgreSQL, one Kaneo container) — Dokploy-friendly. No GHCR publishing, no Helm, no release automation.
- **Tests**: `tests/api` (unit) and `tests/api-integration` (PostgreSQL-backed; run under `apps/api`'s vitest config).

## Setup commands

- Node ≥ 24, pnpm 12 (`packageManager: pnpm@12.3.4`).
- `pnpm dev` (turbo dev) · `pnpm build` · `pnpm typecheck` · `pnpm test` (unit) · `pnpm test:integration` (needs PostgreSQL)
- `pnpm lint` = Biome **--write** (rewrites files); CI gate is `pnpm exec biome ci .` — run that for a read-only check.
- `pnpm i18n:check` / `i18n:schema` · `pnpm openapi:check` / `openapi:check:fix`
- DB: schema in `apps/api/src/database/schema.ts`, relations in `database/relations.ts`; generate migrations with `pnpm --filter @kaneo/api db:generate`, inspect the SQL, existing installations must keep working.
- Server env comes from root `.env`; Vite-only overrides in `apps/web/.env.local` (see `ENVIRONMENT_SETUP.md`).
- Never use production databases, storage, or credentials for development or tests.

## Conventions

- The API owns authentication and authorization; hiding UI actions is not an authorization check. Workspace-scoped operations use `requireWorkspacePermission` and the `@kaneo/permissions` vocabulary — never duplicate role checks.
- Validate API inputs with Zod through `@hono/zod-openapi`: routes via `createRoute` on the `apiRouter()` factory in `apps/api/src/openapi.ts`; request schemas in `schema.ts`, responses in `response.ts` (`.openapi("Name")` components). Expected failures throw `HTTPException`. Valibot only for internal non-HTTP config under `plugins/` and `ws/`.
- Keep API handlers thin; domain behavior lives in controllers/focused utilities. Keep web requests in `apps/web/src/fetchers/` and server state in TanStack Query hooks, using the `@kaneo/libs` client — no parallel untyped request layer.
- Mutations that affect realtime state must consider `publishEvent()`, WebSocket delivery, and client cache invalidation. Do not expose secrets or private workspace data through responses, logs, events, WebSockets, or MCP tools.
- User-facing copy uses static i18n keys (`i18n/en-US.json` source of truth).
- Prefer inferred TypeScript types and `type` over `interface` unless extension/declaration merging is required. Comments explain constraints, not code.
- Conventional Commits are enforced by commitlint (`feat:`/`fix:`/… ); no release automation consumes them today.

## Tracking

All tasks and backlog live on the **Kaneo board** (project `kaneo` / KAN, workspace "Private Projects: Dev"). Nothing is tracked in this file.

- **Columns**: _To Do_ = ready (scoped, acceptance criteria set) · _In Progress_ = active work · _In Review_ = local gates passed, awaiting validation · _Done_ = accepted with recorded evidence.
- **One canonical task per issue** — search before filing, dedup, link don't duplicate. Attach the exact `branch:<name>` label (e.g. `branch:main`) plus area/type labels; priority is the task's own field.
- **Evidence lives in task comments** (findings, decisions, test results, blockers); descriptions stay stable scope. Don't delete tasks or history without explicit user authorization.
- New defects, follow-ups, and ideas discovered while working are filed on Kaneo before being pursued; out-of-scope discoveries stay queued until the user approves expansion.

## Glossary

- **instance**: one deployed Kaneo installation. **workspace**: top-level authorization boundary. **project**: task container inside a workspace. **role**: workspace-scoped permission set. **activity**: durable user-visible history. **event**: internal notification driving activity, integrations, notifications, or realtime.