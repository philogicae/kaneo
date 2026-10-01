<p align="center">
  <a href="https://kaneo.app">
    <img src="https://assets.kaneo.app/logo-text.png" alt="Kaneo's logo" width="420" />
  </a>
</p>

<div align="center">

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/philogicae/kaneo/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/philogicae/kaneo/actions/workflows/ci.yml)

</div>

A customized fork of [Kaneo](https://github.com/usekaneo/kaneo) — the simple, fast, self-hosted project management platform — tailored for and deployed as a personal self-hosted instance.

**This fork adds on top of upstream:**

- **SQLite/libSQL storage** — PostgreSQL replaced by a single local [libSQL](https://github.com/tursodatabase/libsql) (Turso) file, and uploaded assets stored on local disk: one container, no database sidecar, no external service
- **Unified notifications** — one Notifications page for general, Telegram, Discord and Slack rules (per-project management for Discord/Slack), unified bots / chats / rules configuration, per-task reminders, task recurrence, and notification templates
- **Appointments** — calendar and Gantt scheduling with reminders, unified Appointments / Calendar / Gantt dashboard tabs, and dedicated MCP tools
- **Access teams & workspace sharing** — per-project access teams, public workspace sharing, and workspace invite links
- **MCP improvements** — extra tools (bulk task updates, appointments, Telegram management, task qualification), API-key and OAuth hardening for the HTTP endpoint at `/api/mcp`, in-app MCP setup docs
- **Jev (TypeSafe System One)** — optional semantic reranking of global search results and auto-qualification of new tasks (priority + semantic labels); disabled by default, enabled via `TYPESAFE_API_KEY` (see `.env.sample`)
- **Agent skills over HTTP** — the bundled `skills/kaneo` agent skill is served at `/api/skills` alongside the MCP endpoint
- **Interactive API reference** — a [Scalar](https://scalar.com) UI served at `/api/docs` on top of the OpenAPI 3.1 document at `/api/openapi`
- **Dashboard work** — unified all-projects view, weekly project charts, backlog tabs, collapsible sidebar with UI scale control
- **Cross-workspace search** and small UX refinements across the board
- **Self-hosted deployment** — a single `compose.yml` that builds locally via `Dockerfile.kaneo`, plus a GHCR image published by `.github/workflows/publish.yml`

> This is a personal fork, not an official Kaneo release. For the upstream project, docs, cloud offering, and community, go to [usekaneo/kaneo](https://github.com/usekaneo/kaneo).

## Deploy (self-hosted)

Requires Docker with Compose. One container runs the API and the web app; the database is a local libSQL file bind-mounted from the host.

```bash
git clone https://github.com/philogicae/kaneo.git
cd kaneo
cp .env.sample .env
# set KANEO_CLIENT_URL and AUTH_SECRET (openssl rand -hex 32)
docker compose up -d --build
```

Open [http://localhost:5173](http://localhost:5173). The interactive API reference is at [/api/docs](http://localhost:5173/api/docs) and the OpenAPI 3.1 document at `/api/openapi` — both are public. The MCP endpoint is `/api/mcp` and the bundled agent skills are served at `/api/skills`.

The database lives at `./data/kaneo.db` (resolved from the repository root; the container bind-mounts the host directory at `/app/data`) — override the host directory with `KANEO_DATA_PATH` in `.env`. The directory must be writable by the container user (uid 1001) so libSQL can create the database and its WAL/SHM sidecars:

```bash
mkdir -p ./data && chown -R 1001:1001 ./data
```

Or run the prebuilt GHCR image instead of building locally:

```bash
docker compose -f compose.remote.yml up -d
```

Environment variables: see [.env.sample](.env.sample) and [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md).

## Development

Requires Node.js 26 and pnpm 12 (see `packageManager`).

```bash
pnpm install
pnpm dev               # start dev servers
pnpm build             # build all workspaces
pnpm test              # unit tests
pnpm test:integration  # API integration tests (local libSQL test file)
pnpm typecheck         # typecheck all workspaces
pnpm lint              # biome (writes fixes)
pnpm i18n:check        # locale files vs en-US source of truth
pnpm openapi:check     # API reference vs routes
```

Read [AGENTS.md](AGENTS.md) for architecture, conventions, and boundaries before changing anything. The database schema lives in `apps/api/src/database/schema.ts`; generate migrations with `pnpm --filter @kaneo/api db:generate`.

The documentation site source lives in [`apps/docs`](apps/docs) (Mintlify — `mint dev` for a local preview); `apps/docs/openapi.json` is a committed artifact kept in sync by `pnpm openapi:check`.

## Acknowledgments

All credit for Kaneo goes to the upstream team and contributors: [usekaneo/kaneo](https://github.com/usekaneo/kaneo) · [kaneo.app/docs](https://kaneo.app/docs/core).

This fork tracks upstream and stays close to it; divergences are the ones listed above. MCP is exposed through the built-in HTTP endpoint at `/api/mcp`; upstream's stdio package [@kaneo/mcp](https://www.npmjs.com/package/@kaneo/mcp) is not used here.

## License

MIT — see [LICENSE](LICENSE). Upstream © the Kaneo team and contributors; fork changes © 2026 philogicae.
