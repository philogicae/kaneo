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

- **Telegram notifications** — unified bots / chats / rules configuration, per-task reminders, task recurrence, and notification templates
- **MCP improvements** — extra tools (bulk task updates, Telegram management), API-key and OAuth hardening for the HTTP endpoint, in-app MCP setup docs
- **Dashboard work** — unified all-projects view, weekly project charts, backlog tabs, collapsible sidebar with UI scale control
- **Cross-workspace search** and small UX refinements across the board
- **Self-hosted deployment** — a single `compose.yml` that builds locally via `Dockerfile.kaneo` (Dokploy-friendly), instead of the upstream image publishing pipeline
- **Repo cleanup** — removed the upstream release/GHCR/Helm machinery, marketing site, and other pieces a self-hosted fork doesn't need

Upstream roadmap item under study: a SQLite single-container mode (`plans/008-sqlite-single-container.md`).

> This is a personal fork, not an official Kaneo release. For the upstream project, docs, cloud offering, and community, go to [usekaneo/kaneo](https://github.com/usekaneo/kaneo).

## Deploy (self-hosted)

Requires Docker with Compose. The compose file builds the bundled image from source (API + web + PostgreSQL in one Kaneo container):

```bash
git clone https://github.com/philogicae/kaneo.git
cd kaneo
cp .env.sample .env
# set KANEO_CLIENT_URL, POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -hex 32)
# adjust the postgres volume bind mount in compose.yml to your host path
docker compose up -d --build
```

Open [http://localhost:5173](http://localhost:5173).

Environment variables: see [.env.sample](.env.sample) and [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md). Upstream's prebuilt `ghcr.io/usekaneo/kaneo` image also works with this compose file if you do not want to build locally.

## Development

Requires Node.js ≥ 24 and pnpm 12 (see `packageManager`).

```bash
pnpm install
pnpm dev          # start dev servers
pnpm build        # build all workspaces
pnpm test         # unit tests
pnpm typecheck    # typecheck all workspaces
pnpm lint         # biome (writes fixes)
pnpm i18n:check   # locale files vs en-US source of truth
pnpm openapi:check # API reference vs routes
```

Read [AGENTS.md](AGENTS.md) for architecture, conventions, and boundaries before changing anything. Database schema lives in `apps/api/src/database/schema.ts`; generate migrations with `pnpm --filter @kaneo/api db:generate`.

Tests: `pnpm test` (unit) and `pnpm test:integration` (needs PostgreSQL; see CI config for the expected environment).

## Acknowledgments

All credit for Kaneo goes to the upstream team and contributors:

- Upstream repository: [usekaneo/kaneo](https://github.com/usekaneo/kaneo)
- Documentation: [kaneo.app/docs](https://kaneo.app/docs/core)
- Upstream repository: [usekaneo/kaneo](https://github.com/usekaneo/kaneo)
- Documentation: [kaneo.app/docs](https://kaneo.app/docs/core)
- MCP: this instance exposes the built-in HTTP endpoint at `/api/mcp` (see docs); upstream's stdio package [@kaneo/mcp](https://www.npmjs.com/package/@kaneo/mcp) is not used here

This fork tracks upstream and stays close to it; divergences are the ones listed above.

## License

MIT — see [LICENSE](LICENSE). Upstream © the Kaneo team and contributors; fork changes © 2026 philogicae.