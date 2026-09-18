## [1.1.0] - 2026-09-18

### 🚀 Features

- Feat: add Jev (TypeSafe) search reranking and task auto-qualification, Scalar API reference, local-disk asset storage docs; rework fork docs

- apps/api/src/jev/ (new): optional TypeSafe System One integration — client with retry/backoff, token-budget batching (budget.ts), search
  reranking (rerank.ts) and task qualification (priority + semantic labels, branch:_/machine:_ excluded); fail-open without TYPESAFE_API_KEY
- apps/api/src/search/jev-search.ts (new), global-search.ts: over-fetch candidates (CANDIDATE_CAP) and rerank/filter by relevance when Jev
  is enabled; totalCount reflects kept results; short-id matches pinned
- apps/api/src/task/controllers/qualify-task.ts (new), create-task.ts, index.ts, schema.ts, response.ts: POST /task/qualify/{projectId}
  suggestion endpoint; create-task runs qualification (qualify=true), attaches suggested labels as task-scoped copies, returns CreatedTask
  with final priority + labels
- apps/api/src/mcp/tools.ts: new qualify_task MCP tool; create_task description documents authoritative priority/labels in response
- apps/api/src/index.ts, package.json: serve Scalar interactive API reference at /api/docs reading /api/openapi (@scalar/hono-api-reference
  0.12.1)
- apps/docs/: fork docs rework — remove drim/migration/storage-backends guides, rewrite compose/env-variables/object-storage (S3*\* →
  local-disk STORAGE*\*), new pages (appointments-calendar-gantt, custom-fields, dashboard-and-analytics, recurrence-and-reminders,
  search-and-command-palette, teams-and-scoped-access, agent-skill), docs.json nav updates
- apps/docs/openapi.json: regenerate (CreatedTask, TaskQualification, SuggestedTaskLabel, qualifyTask route)
- .env.sample, ENVIRONMENT*SETUP.md, README.md, CONTRIBUTING.md, AGENTS.md: document TYPESAFE_API_KEY + KANEO_JEV*\_ tuning, STORAGE\_\_
  variables, GHCR publish workflow, updated structure/deploy notes
- schema.ts, skills/kaneo (1.1.0), turbo.json: reminder comment fix (due→start date), qualify*task in catalog + usage guidance, turbo
  globalEnv cleanup (drop AWS*/REDIS*/S3* leftovers, add STORAGE\_\*)
- pnpm-lock.yaml: @scalar/hono-api-reference dependency
- tests/api/ (new: jev/client, jev/qualify, jev/rerank, search/jev-search, task/qualify-task; mcp-tools): cover client retries, budget
  batching, rerank fallback, qualification thresholds, MCP passthrough

### ⚙️ Miscellaneous Tasks

- Chore: update changelog

## [1.0.6] - 2026-09-17

### 🚀 Features

- Feat: expand MCP tooling, project analytics and workspace UX

MCP (HTTP):

- validateApiKey accepts session tokens or API keys (Bearer or x-api-key), mirroring
  authenticateApiRequest; new create_column, update_column, reorder_columns, delete_column
  and bulk_update_tasks tools with tests
- telegram: replace deprecated disable_web_page_preview with link_preview_options; relax bot
  token regex (short bot ids and longer suffixes were silently rejected), accept null optional
  fields from older stored configs

Web:

- cross-workspace "All projects" dashboard (/dashboards) with weekly created/completed charts
  (new GET /project/{id}/charts endpoint, dependency-free SVG ProgressChart) and workspace
  tiles replacing table rows
- sidebar: sort modes for projects (custom/name/date/completion) and workspaces with drag &
  drop in custom mode, persisted in user-preferences; collapsible="icon" mode with
  slug/initials rail fallbacks, SidebarHeaderControls, UiScaleControl (80-125% via root
  font-size, persisted and validated on rehydrate), search field collapsing to an icon
- search: workspaceId query param optional — search spans every workspace the user belongs to
  (workspace-access middleware gains an `optional` mode, explicit workspaceId intersected with
  memberships); shared taskMatchesTextQuery + TaskSearchInput wired into board toolbar and
  backlog
- theming: new volt theme (index.css palette, provider/toggle/command palette/preferences,
  treated as dark by shiki); label palette grows to 16 centralized colors; priority-colored
  card borders with the priority icon merged into the assignee cluster

Deps & housekeeping:

- pin better-auth ~1.6.30 with @better-auth/core override; lockfile refresh
- i18n keys across all locales with schema.json regenerated; openapi.json regenerated for the
  charts route, plannedTasks and the optional search workspaceId
- tests: MCP column/bulk tools, project charts, search scoping, telegram dispatch,
  UiScaleControl and user-preferences effects
- Feat: unified telegram bots, per-task reminders and task recurrence

Telegram system:

- new telegram_bot / telegram_chat / telegram_rule tables (migrations 0045-0049) plus
  task.reminderOffsets and task.recurrence columns
- plugins/telegram: unified dispatch — account-owned bots with per-bot event filters and
  workspace/project-scoped routing rules (optional forum thread) superseding the legacy
  per-project integration; structured dispatch logging (matched rule / skip / sent / failed)
- telegram-config: CRUD/verify/discover routes for bots, chats and rules (gated by
  workspace:manage_settings via workspaceAccess.fromTelegramRule); web settings card with
  fetchers + TanStack Query hooks
- scheduler/telegram-task-reminders: 5-minute cron sending per-task reminders at
  reminderOffsets before the start date, deduped via taskReminderSentTable

Task recurrence:

- task/recurrence.ts: daily/weekly/monthly shift with month-end clamping — completing a
  recurring task in a final column spawns the next occurrence; reminderOffsets/recurrence
  accepted on create/update/due-date routes; dateless recurring tasks skip the spawn
- recurrence/reminderOffsets null clears pass through to controllers (`?? undefined` silently
  dropped them) with regression test
- web: reminder and start/due-date popovers gain offset + recurrence editing, calendar bars
  show recurrence/reminder hints; startOfDay helper with forced setup defaults (today 00:00,
  no recurrence) and midnight normalization on day-picks; compact reminders popover size

Housekeeping:

- nginx: Cache-Control no-cache on index.html, immutable 1y on /assets/ (redeploys previously
  kept serving the stale JS bundle); number inputs hide native spin buttons
- MCP URL settings page resolving the instance MCP URL for copied configs
- i18n keys across 20 locales; .env.sample documents DISABLE_GUEST_ACCESS /
  DISABLE_REGISTRATION; tests for telegram dispatch and recurrence
- Feat: shareable workspace invite links with default-link backfill

Invite links:

- new workspace-sharing module: create/list/revoke links gated by workspace:manage_settings;
  public GET /public/:token lookup and POST /public/:token/accept with atomic used_count
  increment and rollback on failed join
- workspace_invite_link table (migration 0051): unique token, role member, expires_at,
  max_uses, used_count; max_uses enforced
- registration accepts inviteLinkToken (sign-up/sign-in/user-create hooks) so shared links
  unlock signup even with DISABLE_REGISTRATION=true
- anonymous lookup: GET /api/workspace-sharing/public/\* exempted from the global auth
  middleware (route-level security: [] never bypassed it — signed-out visitors got 401 on the
  lookup powering the invite landing page); accept stays authenticated and is idempotent for
  existing members (addMember failure falls back to a membership lookup returning the actual
  role instead of a 500; use-slot reservation rollback unchanged)
- better-auth addMember response accepted with or without the {member} wrapper
- default no-expiry unlimited invite link created with every workspace
  (afterCreateOrganization) and idempotently backfilled on startup for pre-existing
  workspaces (owner-attributed member links, memberless workspaces skipped), via a shared
  createDefaultWorkspaceInviteLink helper
- web: /invitation/link/$token accept page (signed-in join, sign-up/sign-in path for
  signed-out visitors, sign-up forwards inviteLinkToken and redirects to accept);
  members-page shareable-links card (expiry/max-uses/copy/revoke); invite copy strings
  rendered with <Trans> (inline tags printed raw with t()), unlimited-uses display fixed

MCP:

- 15 telegram\_\* CRUD tools (bots/config/chats/rules, telegram_create_rule with nullable
  threadId, topic_not_allowed_on_dm guard, duplicate-safe created:false responses) replacing
  the deprecated configure_telegram_notifications alias, which becomes a first-class tool
  sharing the create-rule flow with canonical args
- new get_public_url and get_workspace_invite_link tools; telegram_create_rule scopes send
  projectIds as an array (a string broke every project-scoped rule creation with a 400);
  create_project forwards description (the zod schema stripped it — projects were created
  with description null)

Housekeeping:

- i18n: 36+ new keys across 22 locales, schema.json regenerated; openapi.json regenerated for
  the new routes
- tests: invite-link details/accept/backfill/idempotency, MCP regressions (projectIds array,
  description passthrough, renamed alias, default-link selection), integration proof that the
  public lookup serves 200 without auth while accept stays 401
- Feat: reminder rescheduling discipline, MCP datetime args and bounded pagination

Reminders:

- task_reminder_sent purged whenever dates or offsets change, even when reminderOffsets are
  omitted (MCP date moves); due-date changes reset only due-date reminder rows, telegram rows
  only on an offset change; task.due_date_changed published only on a real change (single and
  bulk update paths)
- web reminder popover: input/unit/add reorder, Enter to add, per-reminder fire time shown in
  the browser timezone, bell opens without a start date

MCP:

- reminderOffsets + recurrence inputs and an IANA timezone arg on all date/hour tools; new
  delete_time_entry tool; mcp/datetime.ts (new) converts local wall-clock to UTC via Intl with
  a DST-safe two-pass and explicit-offset passthrough; run() catches synchronous throws;
  label copy-path docs

Pagination:

- shared utils/paging.ts limit/offset query parser (task/schema.ts reuses it); optional
  limit/offset on activity, comment and time-entry lists with controller slicing; get_project
  tasksLimit/tasksOffset (-1 keeps web behavior); MCP pagination defaults (list_tasks
  page=1/limit=50 max 100, get_project tasksLimit=50, activity/comments/time-entries limit=50)

- openapi.json regenerated; tests: mcp-tools + clears-config updates, new list-pagination and
  task-reminder-rescheduling integration suites, time-entry deletion
- Feat: telegram verification with membership checks, board label grouping and consolidated dashboard lists; fix: actionable telegram verify
  errors; chore: pin unit-test database to data/kaneo_test.db

- apps/api/src/telegram-config/verify.ts: new describeTelegramFailure/evaluateChatMembership mapping Telegram errors (401/404/409, chat not
  found, membership state) to actionable user messages
- apps/api/src/plugins/telegram/client.ts: surface error_code, can_join_groups, can_read_all_group_messages; add getTelegramChatMember;
  parse reply_to_message forum titles in updates
- apps/api/src/telegram-config/controllers/telegram-config-controller.ts: getMe first (validates stored tokens too), then getChat +
  getChatMember post-rights check; topic discovery names topics via created/edited/replied events with id fallback
- apps/api/src/telegram-config/response.ts + apps/web/src/types/telegram-config.ts: verify result gains canJoinGroups, botMemberStatus,
  botCanPost
- apps/web/src/components/settings/telegram-config/telegram-config-card.tsx: show post-rights and canJoinGroups warnings; add rule edit
  dialog
- apps/web/src/lib/group-tasks.ts + hooks/use-board-grouping.ts: display-only label grouping keyed by name+color, persisted per project with
  StrictMode-safe hydration
- apps/web/src/components/common/group-control.tsx, kanban-board/group-column.tsx: group toolbar control and grouped columns; drag & drop
  disabled while grouping
- apps/web/src/components/dashboard/consolidated-task-list.tsx: read-only cross-project Backlog/Tasks dashboard tabs sharing per-project
  task cache
- apps/api/vitest.config.ts + tests/api/database/unit-db-isolation.test.ts: pin DATABASE_PATH to data/kaneo_test.db with isolation guard
  test
- tests/api/telegram-config/_: verify-message and controller tests; i18n/_ new keys; apps/docs/openapi.json regenerated
- Feat: appointments with calendar view, recurrence and reminders; bundled kaneo skill serving; project dashboard charts; chore: pnpm
  12.4.1→12.4.2 and agent-config cleanup

- apps/api/src/appointment, database, scheduler: new appointment domain — CRUD controllers/routes/schema, appointmentTable + relations with
  migrations 0001/0002, cron reminders with reminderOffsets and recurrence spawning (concurrency-claimed)
- apps/api/src/plugins, notification-preferences, ws: appointment.created/updated events → unified Telegram dispatch
  (created/rescheduled/reassigned), email/notification delivery contexts, websocket broadcasts
- apps/api/src/mcp/tools.ts, search: list/get/create/update/move appointment MCP tools; appointments in global search types
- apps/web: appointments view (week-calendar, appointment-dialog, week-model), routes, fetchers/queries, realtime cache invalidation,
  gantt/calendar integration
- dashboard charts: project-charts endpoint (project/index.ts) + unified-charts (velocity, workload, status distribution, progress rework)
- skills: skills serving endpoints (marked for markdown, path-traversal-safe), skills/kaneo bundle + setup/lifecycle/mcp references,
  settings page, Dockerfile copies skills/, mcp-tools contract test (tests/api/mcp-tools.test.ts)
- chore: pnpm 12.4.1→12.4.2 (packageManager, CI, Dockerfile), marked 17.0.6 dep, pnpm-lock; drop CLAUDE.md, .cursor/rules, .agents/.claude
  skills, skills-lock.json; AGENTS.md now points at skills/kaneo
- i18n: appointment/chart/skill keys added across all locales + schema.json
- tests: api-integration suites for appointments, reminders/recurrence, mcp-appointments, charts, search, skills, ws appointment-events
- Feat: unified Notifications page (General/Telegram/Discord/Slack tabs, per-project Discord/Slack management, legacy Telegram route dropped); personal mention events for Telegram/Discord/Slack (separate from comments, both on by default, mentions target the mentioned member's Telegram rules); unified Appointments/Calendar/Gantt dashboard tabs + MCP and Skill links; charts ranges 1w/1m/3m/6m/12m/all; copyable skill URL block and served-page frontmatter (name/description/version); fix: week calendar header/column alignment, appointment reminder chips 15m/1h/2h/1d/1w with theme-aware selected state; chore: translate 28 new keys across 19 locales + alphabetize all i18n files, mcp-install skill reference, docs/openapi refresh

- apps/api/src/plugins/{types,registry,discord,slack,telegram}: new `task.mentioned` event (emitted on comment/description mentions), handlers for the three channels, `taskMentionCreated` filter defaulting to on, unified Telegram dispatch scoped to the mentioned member's bot owner with no legacy fallback for mentions
- apps/api/src/{integrations,telegram-config,mcp/tools}: mention-aware request/response event schemas + bot events schema; openapi.json regenerated
- apps/api/src/project: charts endpoint takes an enum `range` (1w/1m/3m/6m/12m/all, default 6m; `all` starts at the project's earliest task)
- apps/api/src/skills: HTML view renders the YAML frontmatter as a meta block (name/description/version) instead of hiding it
- apps/web/src/components/dashboard: new unified-appointments/calendar/gantt components; unified-charts range filter persisted as `chartsRange`
- apps/web/src/routes: dashboard tabs (Overview/Charts/Backlog/Tasks/Appointments/Calendar/Gantt) + MCP/Skills links; Notifications page tabs (General first); Skills page skill-URL block first in section; `settings/account/telegram.tsx` removed; routeTree.gen regenerated
- apps/web/src/components/{appointments,calendar}: sticky week header inside the scroll container (header/column alignment), reminder presets 15m/1h/2h/1d/1w with primary selected state + aria-pressed
- apps/web/src/components/{project,settings}, fetchers, types: mention toggles in Discord/Slack forms and Telegram bot events; per-project integration status list in the Discord/Slack tabs
- i18n/\*.json + schema.json: 28 new keys translated across the 19 locales, all keys alphabetized
- tests: Telegram mention integration coverage (legacy silence, personal delivery, bot mute), mention defaults, charts ranges, skills frontmatter, Telegram action text
- apps/docs: notifications/discord/slack/telegram docs updated, openapi refresh; skills/kaneo: new `references/mcp-install.md` linked from SKILL.md
- Feat: board charts period/unit dropdowns with independent window and unit (3 months/day defaults, hourly→monthly buckets, dynamic averages); global access teams and scoped invitations (workspace×project scope bundles, manual grants or teams, materialised at acceptance, dynamic on team edits) enforced across project routes, project lists, global search and private assets; Teams settings page and invitation scope tree; additive migration 0003; openapi + i18n refreshed

- apps/api/src/database/schema.ts, relations.ts, database/index.ts, apps/api/drizzle/0003_careless_scream.sql: add access_team/\_member/\_workspace/\_project, user_workspace_access, user_project_access, invitation_team/\_workspace_grant/\_project_grant and workspace_member.access_scope (default "full", additive, existing rows unchanged)
- apps/api/src/utils/access-scope.ts: new scope resolver (none/scoped/full workspace levels, explicit project grants, scoped project ids, full-access workspace ids)
- apps/api/src/utils/access-grants.ts: new materialisation helpers (scoped memberships, team members, invitation grants) with orphan cleanup and admin-scope checks
- apps/api/src/utils/workspace-access-middleware.ts, validate-workspace-access.ts: resolve the project for every addressed resource and 403 scoped members without a grant; workspace access now also accepts team/direct grants
- apps/api/src/utils/authorize-asset-access.ts, apps/api/src/index.ts: private assets require project access (public assets unchanged)
- apps/api/src/project/controllers/get-projects.ts: project list filtered by scope (null = no restriction)
- apps/api/src/search/controllers/global-search.ts: results filtered to full-access workspaces plus explicitly granted projects
- apps/api/src/access-team/\*: new /api/access-team CRUD (scope, members, /manageable-workspaces) with instance-admin and workspace-admin governance
- apps/api/src/invitation/\*: POST /api/invitation scoped wrapper around better-auth createInvitation plus invitation scope child rows
- apps/api/src/auth.ts: afterAcceptInvitation materialises teams/manual grants and narrows the primary membership to "scoped"
- apps/api/src/project/schema.ts, controllers/get-project-charts.ts, response.ts, index.ts: range and unit decoupled (hour/day/week/month buckets, bucketStart ISO), unit defaults to day (week for "all"), 1000-bucket guard and explicit 400s
- apps/web/src/components/dashboard/charts/\*, progress-chart.tsx, store/user-preferences.ts, fetchers/project/get-project-charts.ts: period/unit Selects (invalid units disabled, automatic fallback), per-unit axis/tooltips and averages, chartsRange/chartsUnit defaults 3m/day, chart-utils.test.ts added
- apps/web/src/components/team/\*, routes/.../settings/workspace/teams.tsx, settings/workspace.tsx, fetchers + hooks: Teams settings page (scope editor, members, delete) and scoped invite modal (team picker + workspace/project tree), Teams nav gated on invitation permission
- apps/web/src/hooks/mutations/workspace-user/use-invite-workspace-user.ts: deleted (dead better-auth invite hook replaced by POST /api/invitation)
- i18n/\*.json, i18n/schema.json: charts unit keys, teams/invite scope keys and common save across 20 locales, files re-sorted
- apps/docs/openapi.json: regenerated for the new Access teams and scoped Invitation routes and the charts range/unit parameters
- tests/api-integration/access-teams.test.ts, project-charts.test.ts, tests/api/utils/authorize-asset-access.test.ts: scoped team access, invitation materialisation and search filtering, chart defaults/units, asset project access
- apps/web/src/routeTree.gen.ts: regenerated for the teams settings route
- Feat: scope assignee lists, notifications and project WebSockets to project access (GET /api/project/{id}/members; assignability moved from workspace membership to canAccessProject across task/appointment create/update/assignee/bulk/import; notifications dropped at creation when the recipient cannot open the project, all emitters pass projectId; /ws/:projectId upgrade enforces project access); editable direct project grants for existing members (GET/PUT /api/workspace/{workspaceId}/members/{userId}/access — all-projects lifts the scope to full, clearing removes the orphaned scoped membership, invitation:create guard — plus Manage access dialog on the Members page); a scoped member keeps the project they create via a direct grant; fix: dashboard charts default to the last month by day with a one-time persisted-preference migration 6m/3m→1m; openapi + i18n (9 keys × 20 locales) + integration tests refreshed

- apps/api/src/project: controllers/get-project-members.ts + index.ts/response.ts (GET /{id}/members: full access, direct/team scoped grants, instance admins); controllers/create-project.ts grants the creator of a project made by a scoped member
- apps/api/src/utils/assert-assignable-user.ts: filterAssignableUsers/assertAssignableUser take a projectId and use canAccessProject (403 "does not have access to this project"); task create/update/assignee, bulk assignee per project, import, appointment create/update pass it
- apps/api/src/notification: controllers/create-notification.ts takes projectId and returns null when the recipient lacks access; index.ts + activity/controllers/create-comment.ts pass it for task created/status/assignee, time entry, appointments, mentions and comments
- apps/api/src/index.ts: project WebSocket upgrade also checks canAccessProject
- apps/api/src/workspace: controllers/get|update-member-access.ts + index/schema/response.ts and utils/access-grants.ts (getDirectWorkspaceGrants/replaceDirectWorkspaceGrants), replacing direct grants only
- apps/web: components/team/member-access-dialog.tsx + members-table.tsx menu entry ("Member actions" aria label); fetchers/workspace-user/get|update-member-access.ts + matching hooks; use-get-active-workspace-users.ts switches to the project member list when the route has a projectId (explicit projectId in appointment-dialog.tsx); shared payload types in types/workspace-user
- apps/web/src/store/user-preferences.ts: chartsRange 3m→1m, version 1 migrate (6m/3m→1m), rehydrate fallback 1m; user-preferences.test.ts
- apps/api/src/project/controllers/get-project-charts.ts + schema.ts + apps/docs/openapi.json: DEFAULT_RANGE 3m→1m and "default 1m" descriptions
- i18n: team:memberAccess.\* (8 keys) + membersTable.ariaMemberActions across 20 locales + schema.json
- tests/api-integration: access-teams (scoped assignee/member list/mention, direct grant/revoke, all-projects lift, creator grant), project-charts defaults, task assignee message

### 🐛 Bug Fixes

- Fix: harden MCP auth and label flows, rework self-hosted compose

MCP:

- OAuth token endpoint client compatibility: client_id via Basic auth (RFC 6749 §2.3.1),
  query-string params, form bodies without content-type; typed invalid_request/invalid_grant
  errors naming the failing parameter; Bearer casing
- new bulk_update_tasks and configure_telegram_notifications tools with label color slugs;
  delete_label accepts workspace-level labels (the API deletes them and cascades task copies);
  attach_label_to_task refuses moving a label already attached to another task;
  list_workspace_labels documents the mixed workspace/task-level response

API:

- app.onError logs non-HTTPException errors so 500s are not silent without Sentry
- workspace-access: label->task workspace fallback for legacy labels with null workspaceId
  (new test); openapi check script execs the native pnpm binary vs Node JS entrypoint
  depending on npm_execpath

Self-hosting & tooling:

- compose.yml reworked for self-hosted builds (named containers, dedicated kaneo-network,
  postgres bind mount, kaneo built locally from Dockerfile.kaneo); deploy.sh, compose
  variants and the deploy-site workflow deleted (superseded by docker compose up -d --build)
- biome 2.5.12->2.5.13, workflow pnpm pins dropped (rely on packageManager), lockfile refresh
- plans/008 SQLite single-container feasibility study (KAN-46)
- Fix(web): keep drag & drop active while a board or backlog sort is applied

- new shared sort-aware drop planner (lib/apply-task-drop.ts) for the kanban board and list
  view, plus getNextManualPosition; sorted cross-column drops append to the manual order
  (position = max + 1) instead of rewriting positions, sorted same-column drops are no-ops
- kanban board: disableDragDrop replaced by sortActive, drops delegated to the planner,
  dnd-kit sensors restored, cards stay sortable with the move cursor (column/column-dropzone/
  task-card plumbing removed); list view uses the shared planner with sortActive; backlog
  planned <-> archived drops follow the same rules with manual renumbering preserved;
  board.tsx/backlog.tsx pass sortActive={sort.field !== "position"}
- 7 unit tests: manual reorder, sorted cross-column append, sorted same-column no-op, drop on
  an empty column
- chore: pnpm 12.3.4 -> 12.4.1 (packageManager, ci.yml pins, Dockerfile stages, AGENTS.md)
  with lockfile refresh
- Fix: telegram verify loop, board sort/filter hydration, per-workspace label identity

- apps/web telegram config: key the topic-discovery verify effect on the stable
  mutateAsync instead of the useMutation object — opening the add/edit rule
  dialogs looped /api/telegram-config/verify (~300 req/s); regression test added
- apps/web board hooks: gate sort/filter localStorage writes on hydration so the
  StrictMode double mount no longer resets them on dev reload; StrictMode tests
- apps/web grouping: key label groups by name so task-level copies always merge
- apps/api labels: task copies mirror the workspace definition color; workspace
  renames colliding on a name return 400; startup migration re-syncs drifted copies
- apps/api mcp: create_label description documents the color mirroring
- Fix: default the Compose host data mount to the ./data directory instead of ./data/kaneo.db so the WAL/SHM sidecars are persisted; chore: dependency lockfile refresh, biome 2.5.13→2.5.14 and docs alignment
  - .env.sample, compose.yml, compose.remote.yml: KANEO_DATA_PATH default ./data/kaneo.db→./data — the host directory is bound to /app/data so kaneo.db-wal and kaneo.db-shm live next to the database
  - ENVIRONMENT_SETUP.md: KANEO_DATA_PATH default ./data/kaneo.db→./data (DATABASE_PATH unchanged)
  - pnpm-lock.yaml: in-range bumps — @types/node 26.5.1→26.6.1, @types/nodemailer 8.0.1→8.0.2, kysely 0.29.5→0.29.6 (drizzle-orm/better-auth peer hashes), @tanstack/react-query 5.102.8→5.103.1 (+query-core), framer-motion 13.3.0→13.4.0, rolldown 1.2.8→1.2.9 (+bindings), unplugin 3.3.0→3.4.0, prettier 3.9.6→3.9.7, @oxc-project/types 0.149.0→0.150.0, electron-to-chromium 1.5.428→1.5.430, baseline-browser-mapping 2.11.23→2.11.24
  - package.json, biome.json: @biomejs/biome 2.5.13→2.5.14, $schema aligned; biome ci passes (1266 files)

### 🚜 Refactor

- Refactor: migrate PostgreSQL to local libSQL (Turso) storage

- apps/api: replace pg@8 + @types/pg with @libsql/client@0.18.0; schema rewritten to
  sqlite-core (jsonb->text json, bytea->blob, boolean->integer, timestamps->integer ms);
  libSQL client with WAL/busy_timeout/foreign_keys pragmas; resolve-database-config.ts (new,
  local DATABASE_PATH) replaces resolve-database-url.ts, wait-for-database.ts and
  prepare-database-startup.ts
- drizzle/: 51 PostgreSQL migrations + snapshots dropped, single SQLite 0000_soft_owl.sql and
  meta journal added
- query rewrites: advisory locks -> BEGIN IMMEDIATE transactions, leader-lock rewrite,
  ilike->LIKE+ESCAPE, reminders ms/json_each, project charts JS bucketing,
  IS DISTINCT FROM->IS NOT, .for("update") removed, selectDistinctOn->JS dedup; legacy
  information_schema boot helpers (apikey/session/user-email/notification-prefs) and
  github_integration CASCADE dropped, role/invite-link seeds simplified
- compose/Docker: single container with ${KANEO*DATA_PATH:-/mnt/user/appdata/kaneo/turso}:/data,
  kaneo-entrypoint.sh /data mount, libSQL musl prebuild kept (--no-optional dropped),
  POSTGRES*\* DATABASE_URL derivation removed; compose.remote.yml pulls
  ghcr.io/philogicae/kaneo:latest
- CI: house ci.yml boilerplate (checkout@v7, pnpm/action-setup@v6 12.3.4, setup-node@v6
  Node 26, --prefer-offline, concurrency); publish.yml (GHCR) triggers on x.x.x tags and
  manual dispatch only
- docs/env: DATABASE_PATH/KANEO_DATA_PATH documented in .env\*, turbo.json, AGENTS.md,
  README.md (rewritten) and ENVIRONMENT_SETUP.md; plans/008 and .devcontainer/ deleted;
  tests run on a local libSQL \_test file with a new resolve-database-config unit test,
  vitest configs use import.meta.dirname without esbuild target
- Refactor: drop SaaS dependencies for local-disk asset storage

Removed: @sentry/node + profiling-node + react + vite-plugin, @aws-sdk/client-s3 +
s3-request-presigner, creem (billing), ioredis; drizzle-kit moved to devDependencies

- storage: AWS SDK presign/upload rewritten as a local-disk fs backend (assets next to the
  DB file, STORAGE_PATH override, key traversal guard); new PUT /task/image-upload/{id}/blob
  route (workspace access, key-context check, content-type/size validation, requireEntitlement
  stripped from all routes); web upload-task-image PUTs bytes with credentials: "include";
  openapi.json regenerated for the route
- Sentry removal: api/web instrument.ts deleted, capture*/checkIn/withIsolationScope/
  breadcrumbs -> console.error (index.ts, scheduler, query-client, error-boundary,
  auth-provider, plugin clients), main.tsx init + vite plugin + hidden sourcemaps + SENTRY\_*
  env vars dropped
- Redis removal: apps/api/src/redis and ws/redis-broadcast-adapter.ts deleted; WebSocket
  broadcast always uses InMemoryBroadcastAdapter
- Billing removal: apps/api/src/billing/\*\*, scheduler leader-lock.ts, seat-reconciliation.ts
  and trial-reminders.ts deleted; entitlement guards stripped across
  task/project/activity/comment/auth/delete-account, billingEnabled removed from
  config/response + get-settings; web billing page, fetchers/hooks, trial-card,
  checkout-intent, use-pending-checkout removed and routeTree regenerated
- database: relative DATABASE_PATH resolved from the repo root via pnpm-workspace.yaml
  walk-up, default ./data/kaneo.db; compose.yml/compose.remote.yml/Dockerfile/entrypoint drop
  the DATABASE_PATH env/export and mount ${KANEO_DATA_PATH:-./data/kaneo.db} at /app/data
  (/data -> /app/data), ioredis removed from the runtime module check
- docs/env: .env.sample, ENVIRONMENT_SETUP.md, README.md, AGENTS.md, turbo.json synced;
  LICENSE gains Copyright (c) 2026 Philogicae; STORAGE_PATH/STORAGE_KEY_PREFIX/
  STORAGE_MAX_IMAGE_UPLOAD_BYTES documented for integrations
- ci.yml: typecheck runner ubuntu-slim -> ubuntu-latest (fix exit 137 OOM); lockfile refresh
  - @pnpm/exe 12.3.4 packageManagerDependency pin; billing (unit + integration), redis,
    leader-lock and trial-reminders test suites deleted, task-image-upload suite updated

### ⚙️ Miscellaneous Tasks

- Chore(infra): modernize runtime and deploy stack

- Dockerfile.kaneo: node:24-alpine -> platformatic/node-caged:26-alpine in all four stages;
  corepack -> npm i -g pnpm@12.3.4; runtime nginx pulled from nginx.org mainline repo
  (v3.21) instead of alpine 1.30.4
- package.json: pnpm 10.32.1->12.3.4; biome 2.5.7->2.5.12 (schema too); semantic-release majors
  (git ^10->^11, changelog ^6->^7, sr ^24->^25, conventionalcommits ^9->^10); turbo
  2.10.8->2.10.12; commitlint 21.2.1->21.2.2; loose >= pins -> ^
- pnpm-workspace.yaml: onlyBuiltDependencies -> allowBuilds map; adds @prisma/engines,
  @sentry/cli, @sentry/node-cpu-profiler, msw, prisma; drops biome/bcrypt/better-sqlite3
- pnpm-lock.yaml: full rewrite for the new pnpm/version set
- compose-custom.yml + compose-remote.yml: self-hosted stacks (postgres:16-alpine + kaneo,
  shared kaneo-network, healthchecks, .env); custom builds Dockerfile.kaneo, remote pulls
  ghcr.io/usekaneo/kaneo:latest
- deploy.sh: remote docker compose up via compose-custom.yml on tcp://192.168.1.133:2375
- Chore: fork cleanup — drop upstream release, site, helm and stdio-mcp machinery

- CONTRIBUTORS.svg (8.8MB) + update-contributors.yml, CHANGELOG.md, release.config.js,
  scripts/release/_, sentry/ + provision-sentry-_.sh: removed (upstream release/ops machinery,
  zero consumers)
- .github: 13 upstream workflows removed (build-images, docker, nightly, release, helm x2,
  publish-mcp, publish-planka-import, auto-assign/merge, issue/release-notify), ci.yml kept
  with its 8 jobs; templates/dependabot/FUNDING dropped
- charts/kaneo, apps/site, apps/docs unreferenced images, plans/001-007 + README (upstream
  DONE, plans/008 sqlite kept), .coderabbit.yaml, apps/api/Dockerfile + apps/web/Dockerfile +
  nginx.conf (build-images-only): deleted
- packages/mcp: deleted — instance uses HTTP MCP only (/api/mcp); apps/docs
  integrations/mcp.mdx rewritten HTTP-only with an upstream stdio note
- apps/web/package.json: -25 unused deps (17 @radix-ui/react-\*, lowlight/highlight.js trio,
  tiptap extension-{link,list,underline}, cmdk, react-markdown, react-use-websocket,
  turndown + gfm, @tanstack/react-query-devtools, globals, postcss)
- apps/api/package.json: -@oslojs/crypto, @oslojs/encoding, @better-auth/drizzle-adapter
  (also kills the 1.6.30/1.6.31 lockfile dup), @octokit/webhooks
- package.json (root): -linkifyjs, tar-fs, esbuild, semantic-release + changelog/exec/git
  plugins, conventional-changelog preset; typescript 7.0.2 kept
- apps/site/package.json: -zustand, tw-animate-css, shadcn (with site deletion); packages/libs:
  -react + types + @kaneo/typescript-config; permissions: -vite, -typescript-config;
  planka-import: -typescript-config; pnpm-lock: -388 packages
- apps/api dead code: auth-schema.ts (inert better-auth dump), utils/migrate-organizations.ts,
  github-integration get-github-integration-by-repository-id (never mounted), 9 dead exported
  functions (github/slack/discord/mattermost configs, registry.listPlugins, billing
  requireProjectEntitlement), auth-schema relations block in database/schema.ts (9 relations +
  12 aliases, duplicates of relations.ts, 0 refs), mcp oauth-consent publishEvent without
  subscriber
- apps/web: 22 orphan files removed (settings-layout, delete-team-member-modal,
  error-fallback, auth hooks x4, workspace-user/invitation hooks + fetcher, workflow-rule
  hook, dead time-entry UI chain x6, format-duration, to-kebab-case, api-response) + dead
  exports (ColumnIconName, LabelColorKey/labelColorValues, priorityColorsFilter,
  NotificationEventData, ActiveWorkspace)
- i18n: 47 orphan keys removed from all 20 locale files (~935 entries; exact +
  dynamic-template verified zero refs), schema.json regenerated
- AGENTS.md: rewritten to house structure (notes/overview/setup/conventions/tracking);
  README.md simplified as fork readme referencing usekaneo/kaneo; SECURITY.md scope,
  .env.sample (-SENTRY_API_TOKEN), docs.json (-coolify nav), turbo.json (-@kaneo/site#build),
  biome.json (-release overrides)
- vitest ^4.1.10->^5.0.0 + @vitest/coverage-v8 ^4->^5 across
  api/web/libs/permissions/email/planka-import, lockfile refresh
- Chore(ci): per-workspace coverage reporting and test-infra hardening

- coverage: root test:coverage -> turbo run test:coverage (dependsOn ^build, uncached,
  coverage/\*\* outputs); test:coverage scripts + v8 coverage config (all: true, json-summary
  reporter, maxWorkers: 3 + fsModuleCache under turbo parallelism) across
  api/web/email/libs/permissions/planka-import; .github/scripts/coverage-summary.mjs renders
  a per-workspace markdown table in the GitHub Actions job summary (if: always(), missing
  reports skipped)
- web vitest config: manual path aliases replaced by resolve.tsconfigPaths, inheriting
  tsconfig.json path mappings
- default vitest testTimeout raised to 10s to absorb loaded CI runners; mcp-internal-api-url
  load timeout 30s -> 60s for coverage-instrumented runs
- unit tests run on ubuntu-latest — slim's 2 vCPUs starve parallel coverage runs past
  testTimeout
- AGENTS.md documents pnpm test:coverage in setup commands
- Chore: add changelog

## [2.25.0] - 2026-09-17

### 🚀 Features

- Feat(ci): add maintainer-triggered Peekareq screenshots
- Feat: add focused Peekareq previews and accessibility findings

### 🐛 Bug Fixes

- Fix(ci): filter Peekareq commands with a Cloudflare webhook
- Fix(ci): use Cloudflare-compatible GitHub requests
- Fix: ground Peekareq custom-field screenshots in fixtures
- Fix: fall back when Peekareq's model provider is throttled
- Fix(billing): keep cancelled subscriptions entitled until the paid period ends

Creem reports a mid-period cancellation as `subscription.canceled` and never
sends `subscription.scheduled_cancel`, so the `scheduled_cancel` entry in
ACTIVE_STATUSES never matched. Because computeEntitlement gated purely on
status and never read currentPeriodEnd, cancelling a renewal revoked write
access immediately while the billing page kept showing the paid period
running to its real end date. Customers were told they had access and then
got a 402 on every write.

Treat `canceled` with a future currentPeriodEnd as entitled, reported as the
new `paid_period` reason. `expired` is deliberately excluded: that event
means the period itself is over, so a stale currentPeriodEnd must not
resurrect access.

Claude-Session: https://claude.ai/code/session_01JaQCtAXKPyXfxWBcoatTBm

### 💼 Changes

- Merge pull request #1741 from usekaneo/fix/billing-paid-period-entitlement

fix(billing): keep cancelled subscriptions entitled until the paid period ends

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🧪 Testing

- Test(ci): isolate screenshot publisher test identities
- Test(billing): separate act from assert in entitlement tests

Claude-Session: https://claude.ai/code/session_01JaQCtAXKPyXfxWBcoatTBm

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.25.0 [skip ci]

### Features

- add focused Peekareq previews and accessibility findings: [6e01c0f](https://github.com/usekaneo/kaneo/commit/6e01c0f0d579c1a5fc3b602206e95f2478232ca8)
- **ci:** add maintainer-triggered Peekareq screenshots: [2d8a4c6](https://github.com/usekaneo/kaneo/commit/2d8a4c6fe5727a96a550380995aa5bb57775b669)

### Bug Fixes

- **billing:** keep cancelled subscriptions entitled until the paid period ends: #1741
- fall back when Peekareq's model provider is throttled: [145c13a](https://github.com/usekaneo/kaneo/commit/145c13a11bd508659ee6396a95058cf468845ef5)
- ground Peekareq custom-field screenshots in fixtures: [4b684e7](https://github.com/usekaneo/kaneo/commit/4b684e79441055a12a79579443551ecf8a19fa84)
- **ci:** use Cloudflare-compatible GitHub requests: [9740bf8](https://github.com/usekaneo/kaneo/commit/9740bf8402d79b806e9115180aca7b5e3354f9a5)
- **ci:** filter Peekareq commands with a Cloudflare webhook: [34ee59e](https://github.com/usekaneo/kaneo/commit/34ee59e12343b80ab6beae94ba06c36e0f7cc813)

### Documentation

- update contributors and sponsors: [508bd4b](https://github.com/usekaneo/kaneo/commit/508bd4b89ade880527e01408aaec332102cafa4b)
- update contributors and sponsors: [a750d01](https://github.com/usekaneo/kaneo/commit/a750d01a2f420992d5321918c9f57750f3326e01)
- update contributors and sponsors: [16fcd5f](https://github.com/usekaneo/kaneo/commit/16fcd5fc5103ec3ce7187dcb780ef5ac360e1375)
- update contributors and sponsors: [93cb471](https://github.com/usekaneo/kaneo/commit/93cb4712367e5cbb7ac6f9c5ec20e6a037c227bc)

### Credits

Huge thanks to @andrejsshell for helping!

## [2.24.0] - 2026-09-11

### 🚀 Features

- Feat: add custom fields support
- Feat: add optimistic drag-and-drop reordering to CustomFieldEditor
- Feat: add an unset action for optional dropdown/boolean and date fields
- Feat(i18n): add Azerbaijani (az-AZ) translation
- Feat: redirect to default project

### 🐛 Bug Fixes

- Fix: resolve biome lint errors
- Fix: trim value to prevent whitespace issues
- Fix: dropdown options parsing error
- Fix: filters no longer return only cached field
- Fix: resolve missing lint errors
- Fix: unused customFields validator
- Fix: harden dropdown options parsing

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Fix: revert dropdown fix that make CI check fail
- Fix: inject default values for required fields on task creation
- Fix: misplaced translation for custom field editor
- Fix: add custom fields migration
- Fix: regenerate custom fields migration
- Fix: drizzle journal formating
- Fix: drizzle migration formatting
- Fix: reported issue
- Fix: filtering issue for new field
- Fix: prevent concurrent custom field reorders
- Fix: replace per-field queries with grouped query
- Fix: reject invalid calendar dates in task fields
- Fix: use canUpdateTasks for task editing instead of canManageTasks
- Fix: lint the conflicted create-task file
- Fix: create task not inserting custom field
- Fix: invalidate field value after task creation
- Fix: use the new api schema and response format
- Fix: customFields order on task card field icon
- Fix: incorrect/missing invalidateQueries
- Fix: add missing fieldPosition to custom field values response
- Fix(api): skip archived tasks in due date reminders
- Fix(api): skip archived tasks in due date reminders

Merge pull request #1702 from mmilanovic4/fix/archived-task-due-date-reminders

- Fix(npm): fixing CVE-2026-75604
- Fix(i18n): sync Mattermost keys across locales
- Fix: merge conflict
- Fix: unit test failing
- Fix: lint issue
- Fix: outdated openapi.json
- Fix/zh-cn-locale-sync

## Summary

The Simplified Chinese locale (`i18n/zh-CN.json`) had drifted from `en-US.json`. This PR brings it back in sync and completes the translation.

## Changes

1. **Add Mattermost integration strings** (`settings.mattermostIntegration.*`, `settings.projectIntegrations.mattermostSection*`) — 32 keys, translated to match the existing Slack/Discord integration wording. (Other locales are also missing these; zh-CN is one of the first to catch up.)
2. **Translate remaining English strings** (~47): full error page / crash page copy incl. CORS & network troubleshooting steps, calendar view, avatar settings, delete-account (danger zone) flow, Gitea verification toasts, Mermaid render errors, etc.
3. **Fix misplaced/outdated copy (4):**
   - `deleteAccount.confirmLabel` had lost the `{{email}}` placeholder and was mistranslated → now "请输入 {{email}} 以确认"
   - `deleteAccount.modalDescription` contained the confirmLabel text → now "你的账户将被永久删除，此操作无法撤销。"
   - `avatar.hint` was outdated (old copy about file formats) → synced to the current en-US wording
   - `slackIntegration.webhookLabel` casing synced with en-US
4. **Remove 7 unused `_one` plural keys** — Chinese only has the `other` plural category, so these keys are never rendered; consistent with ja-JP/ko-KR/id-ID/vi-VN which don't ship `_one` variants.

## Verification

- `pnpm i18n:check zh-CN` → `zh-CN: OK` / "All locale files are in sync with en-US."
- Key set matches en-US minus the 7 intentionally removed `_one` keys
- All `{{placeholder}}` interpolations match en-US
- No changes to already-translated strings beyond the items above

## Notes

Code-language names, brand terms (GitHub/Slack/Mattermost/Webhook URL/Issue/…) and example placeholders (`team-alerts`, `PRO`) are intentionally kept in English, matching other locales.

- Fix(i18n): restore Simplified Chinese translations for Mattermost integration
- Fix: duplicate projects fetch on load
- Fix: unhandled projects fetch errors
- Fix: use fresh project data
- Fix: remove unused catch binding

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Fix(web): defer Shiki highlighter loading on task page
- Fix(reviews): suggestion fixes from ai bots
- Fix(ci): pnpm i18n:check:fix

### 💼 Changes

- Merge branch 'feat/custom-fields-configuration' of https://github.com/MonsPropre/kaneo into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'feat/custom-fields-configuration' of https://github.com/MonsPropre/kaneo into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'feat/custom-fields-configuration' of https://github.com/MonsPropre/kaneo into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge branch 'main' into feat/custom-fields-configuration
- Merge pull request #1710 from usekaneo/fix/i18n-sync-mattermost-locales

fix(i18n): sync Mattermost keys across locales

- Merge branch 'main' into fix/CVE-2026-75604
- Merge pull request #1709 from usekaneo/fix/CVE-2026-75604

fix(npm): fixing CVE-2026-75604

- Merge branch 'main' into feat/az-locale
- Merge pull request #1704 from jamalkamaladdin/feat/az-locale

feat(i18n): add Azerbaijani (az-AZ) translation

- Merge branch 'main' into feat/custom-fields-configuration
- Update zh-CN.json
- Merge branch 'main' into main
- Merge branch 'main' into feat/home-redirect-to-default-project
- Merge branch 'main' into feat/home-redirect-to-default-project
- Merge branch 'main' into feat/home-redirect-to-default-project
- Merge branch 'main' into feat/home-redirect-to-default-project
- Merge pull request #1640 from MonsPropre/feat/home-redirect-to-default-project

feat: redirect to default project

- Merge branch 'main' into main
- Merge pull request #1701 from ApplesBear-X/main

fix/zh-cn-locale-sync

- Merge pull request #1713 from usekaneo/seer/fix/defer-shiki-loading

fix(web): defer Shiki highlighter loading on task page

- Merge branch 'main' into feat/custom-fields-configuration
- Merge pull request #1542 from MonsPropre/feat/custom-fields-configuration

feat: custom fields configuration

### 🚜 Refactor

- Refactor: use transaction for custom fields insert
- Refactor: fetch custom field values per project

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🧪 Testing

- Test(api): add custom field integration tests

### ⚙️ Miscellaneous Tasks

- Chore: add expect log to CI to identify error
- Chore(db): regenerate migration SQL after conflict resolution
- Chore(db): fix formatting on drizzle meta files
- Chore(db): resolve database migration conflict
- Chore(db): resolve database migration conflict
- Chore(release): v2.24.0 [skip ci]

### Features

- custom fields configuration: #1542
- redirect to default project: #1640
- **i18n:** add Azerbaijani (az-AZ) translation: #1704

### Bug Fixes

- **web:** defer Shiki highlighter loading on task page: #1713
- **i18n:** restore Simplified Chinese translations for Mattermost integration: #1701
- **i18n:** sync Mattermost keys across locales: #1710
- **npm:** fixing CVE-2026-75604: #1709
- **api:** skip archived tasks in due date reminders: #1702

### Documentation

- update contributors and sponsors: [d7f1c46](https://github.com/usekaneo/kaneo/commit/d7f1c4664d55bdea1f3b9e27d1f26607a053c00e)
- update contributors and sponsors: [243f9d8](https://github.com/usekaneo/kaneo/commit/243f9d8e16793d2bbc3d22d66ba53bc21eed0867)
- update contributors and sponsors: [41b72df](https://github.com/usekaneo/kaneo/commit/41b72df7cdfefd89f0adf643f249aa3ad6ea28d8)

### Credits

Huge thanks to @MonsPropre, @ApplesBear-X, @randoneering, @jamalkamaladdin, and @mmilanovic4 for helping!

## [2.23.2] - 2026-09-07

### 🐛 Bug Fixes

- Fix(mcp): accept refresh_token grant on register

Claude's connector registers with grant_types
["authorization_code", "refresh_token"]. The Zod tuple introduced
in the OpenAPI refactor (v2.23.0) rejects the second element,
where the previous Valibot tuple ignored it. Registration failed
with a plain-text 400, so Claude fell back to a stale cached
client_id and /api/mcp/authorize answered invalid_client.

- Accept any grant_types list that includes authorization_code;
  the response still advertises only authorization_code since no
  refresh tokens are issued
- Return RFC 6749 / RFC 7591 JSON errors from the OAuth routes:
  invalid_client_metadata, invalid_redirect_uri, invalid_request
- Regenerate the OpenAPI artifact and cover the Claude-shaped
  registration body in tests

Claude-Session: https://claude.ai/code/session_016bffT9dDBiksjy5uPbJnuB

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.23.2 [skip ci]

### Bug Fixes

- **mcp:** accept refresh_token grant on register: [59314c1](https://github.com/usekaneo/kaneo/commit/59314c15aded93fe65170eb7ca94d00bc1af5174)

### Documentation

- update contributors and sponsors: [e5a4675](https://github.com/usekaneo/kaneo/commit/e5a4675e7d49e634de4cef4171e3925666bb6c8c)

## [2.23.1] - 2026-09-06

### 🐛 Bug Fixes

- Fix(web): use location.href for the sign-in redirect param

The authenticated route guard built its `redirect` search param as
`location.pathname + location.search + location.hash`. In TanStack Router
`location.search` is the parsed search object, and router-core's `decode()`
builds it with `Object.create(null)`, so concatenating it throws
"TypeError: Cannot convert object to primitive value".

The throw happens inside `beforeLoad` on the unauthenticated branch, so any
signed-out visitor to /dashboard got a blank page instead of being redirected
to sign-in. `location.href` is already pathname + search + hash without the
origin.

Claude-Session: https://claude.ai/code/session_01LBpGzCzCwMqbnEjqrisNH4

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.23.1 [skip ci]

### Bug Fixes

- **web:** use location.href for the sign-in redirect param: [7483d37](https://github.com/usekaneo/kaneo/commit/7483d37ea059a76f298cbd66cb3eb9903e0ce44f)

## [2.23.0] - 2026-09-06

### 🚀 Features

- Feat(i18n): add Japanese (ja-JP) translation
- Feat(i18n): localize auth and notification emails for Japanese

Resolve ja-JP in the email locale resolver and templates so magic link,
OTP, password reset, notification, and workspace invitation emails use
Japanese copy. Auth email subjects for Japanese are added alongside the
existing German and Vietnamese ones.

- Feat(mattermost): add native Mattermost integration

Backend:

- apps/api/src/plugins/mattermost/ — config, client (attachment format),
  events, and index mirroring the Slack plugin
- apps/api/src/mattermost-integration/ — full CRUD API route at
  /mattermost-integration/project/:projectId
- apps/api/src/schemas.ts — mattermostIntegrationSchema
- apps/api/src/plugins/index.ts — register mattermostPlugin
- apps/api/src/index.ts — mount /mattermost-integration route
- apps/api/src/plugins/slack/{client,events}.ts — reverted to upstream
  Block Kit format (Mattermost gets its own plugin)

Frontend:

- apps/web/src/fetchers/mattermost-integration/ — create, get, update,
  delete fetchers
- apps/web/src/hooks/{mutations,queries}/mattermost-integration/
- apps/web/src/components/project/mattermost-integration-settings.tsx
- integrations.tsx — Mattermost section with Server icon

i18n: mattermostIntegration keys added to all 10 locale files

Docs: mattermost.mdx created; slack.mdx Slack-compatible section removed

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- Feat: added polish translations
- Feat: added task item counters
- Feat: added green highlight when all tasks are completed
- Feat: center Gantt chart on today and add jump-to-today button
- Feat(i18n): add jumpToToday translation key

### 🐛 Bug Fixes

- Fix(api): make notifications and seat reconciliation survive replicas

broadcastToUser wrote straight to the local userConnections map and never
touched the broadcast adapter, so NOTIFICATION_CREATED only ever reached
sockets on the instance that raised it. On any multi-replica deployment a user
connected to instance B saw nothing for a notification raised on instance A,
and the bell only updated on the next poll. User messages now go through the
adapter like project messages do, and local sockets are served from the
subscription.

The Redis user channel is kaneo:ws-user:, not kaneo:ws:user:, because a Redis
glob spans colons -- the latter would also match the existing
kaneo:ws:\*:broadcast pattern and every user message would be parsed as a
project broadcast and dropped. The project channel is unchanged so a rolling
upgrade keeps delivering across mixed versions.

initializeScheduler starts all four crons on every replica with no leader
election. The two reminder jobs survive that because they claim each send
against a unique constraint first, but reconcileWorkspaceSeats has no such
claim, so N replicas each called the billing provider for the same drifted
workspace. It now runs under a session-scoped advisory lock and a replica that
cannot take it skips the tick. The lock is session-scoped rather than the
pg_advisory_xact_lock used elsewhere because it has to span external HTTP
calls, which do not belong inside an open transaction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(api): correct five defects that fail silently

createTimeEntry wrote `duration: duration || 0` and the POST route never
supplied a duration, so an entry created with both timestamps persisted zero
tracked time until someone edited it -- only updateTimeEntry ever computed the
value. Duration is now derived from the timestamps on the same formula, and
stays null while an entry is open rather than claiming zero.

checkTrialReminders returned void while the other three cron jobs return
{ degraded }, and the scheduler reads result?.degraded to pick the Sentry
check-in status, so that monitor could only ever report ok. A failed reminder
query now degrades the run instead of disappearing.

The search route declared workspaceId optional and then applied
workspaceAccess.fromQuery(), which throws 400 when it cannot resolve one, so
the optional form was unreachable over HTTP. The validator now says what the
route actually requires, and the web hook holds the query behind skipToken
until a workspace is known instead of firing a request that can only 400.

The bearer-token shim on /auth/\* listed POST, GET, PUT and DELETE but not
PATCH, so a PATCH carrying a bearer token skipped the x-api-key rewrite.

relations.ts declared user.workspaces as many(workspaceTable), but workspace
has no user column and no inverse relation -- ownership is workspace_member
.role. Any query using `with: { workspaces: true }` would throw, so the
relation is removed. taskReminderSentTableRelations was exported but never
registered on the schema object; it is now.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(api): close five workspace-scoping gaps

GET /github-integration/repositories and POST /verify carried no workspace
access check, only the global authenticate middleware. listUserRepositories
paginates every repository of every installation of the shared GitHub App, so
any authenticated account -- including a guest when DISABLE_GUEST_ACCESS is
unset -- could enumerate repository names, owners and private flags across every
tenant of the instance, and probe arbitrary owner/repo pairs through verify.
Both now take a projectId and require workspace manage_settings, matching their
Gitea counterparts and every other route in the same file. app-info is left
alone; it returns only the configured app name.

getPublicProject called getTasks first and checked isPublic afterwards, so an
unauthenticated request materialised a private board -- every task, label and
external link -- before deciding it was not allowed to. The flag is now read on
its own before the board is loaded.

createTask and updateTaskAssignee never checked that the assignee belonged to
the task's workspace, so any member could assign work to arbitrary accounts on
the instance, who then received notifications for a workspace they cannot open.
Both go through assertAssignableUser, which mirrors validateWorkspaceAccess in
still allowing instance admins. That also drops the `where id = ''` query
createTask issued on every unassigned creation.

POST /activity/create read userId from the request body, letting any member with
task:update write history attributed to someone else. The actor is the session.

postToGenericWebhook did not set redirect: "manual", so a destination that
passed assertPublicDestination could 302 the payload and its signature to an
internal address. The Gitea client already does this and says why.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(api): replace the seat-reconciliation advisory lock with a job lease

pg_try_advisory_lock is session scoped. Behind a transaction-mode pooler such as
PgBouncer, consecutive statements from one client are not guaranteed the same
backend, so the lock could be taken on one session and the unlock issued on
another. The lock then stays held on a backend nothing will return to, every
later tick skips, and seat reconciliation silently stops running for good. The
unlock result was ignored, so nothing reported it.

A lease row carries no session state and cannot strand: the claim is a single
INSERT ... ON CONFLICT DO UPDATE guarded on the stored expiry, so exactly one
replica wins, and a replica that dies mid-run only holds the job until the lease
expires rather than forever.

The scheduler keeps skipping on a lost claim; what changes is that the skip is
now temporary by construction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(web): resolve the root error boundary's translation keys

The boundary called t("common.error.title") and its siblings with a dot where
the namespace separator belongs. defaultNS is "common", so i18next looked for a
"common" key inside the common namespace rather than error.title, and the
fallback screen rendered raw keys in every language including English.

Surfaced by pnpm i18n:report, which listed common:error.description as unused
because nothing referenced it under its real name.

- Fix(api): read the raw body in task permission middleware

createRoute({ middleware }) registers middleware before the request
validators, so c.req.valid() is not populated when it runs. The three task
permission guards still read it, which threw a TypeError and turned every
bulk task mutation and full task update into a 500.

Read the raw JSON body instead, the same way the workspace access middleware
already does, and reject an unknown bulk operation with a 400 rather than
letting it fall through to the task:update branch.

An earlier sweep for this pattern only covered src/\*/index.ts and so missed
these, which live in a controller file. The sweep now covers every file.

Also hide the billing routes from the OpenAPI document. Billing is a Kaneo
Cloud concern; on a self-hosted instance isBillingEnabled() is false and the
entitlement is always active, so advertising a paid tier in the API reference
that self-hosters read is noise. The routes stay served, they are just no
longer registered in the document.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(api): restore the entitlement check on project creation

POST /project lost requireEntitlement in the route migration, so a workspace
with an expired trial or a canceled subscription could still create projects.
Self-hosted instances were unaffected, since the middleware no-ops when billing
is disabled.

The middleware audit that was meant to catch this only matched authorization
helpers, not requireEntitlement. It now matches any require*/scopeTo*/access
helper, and reports nothing else lost across the 25 migrated modules.

Also move the request schemas that were left in index.ts into each feature's
schema.ts (discord, slack, generic-webhook, github, gitea) and the two inline
404 bodies into response.ts, matching the layout the other modules use, and
cut the narration comments back to the constraints worth stating.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(api): correct route contracts flagged in review

Regenerate auth-openapi.ts from Better Auth's live generateOpenAPISchema()
rather than the committed apps/docs/openapi.json, which had drifted. That
artifact reported teamId as required on invite-member; Better Auth does not.
The generator also had no anyOf case, so invite-member's role degraded to
z.unknown() and dropped out of required entirely; it is now the string or
string-array union Better Auth actually declares. All 35 operations keep their
paths and synthesized operationIds.

Statuses the controllers really return, which the document omitted or
mislabelled:

- task-relation create: a duplicate is 409, not 400, and a missing target task
  is a 404
- column create: reserved and duplicate slugs are 409

Task list pagination validated: page and limit were parsed with Number() and
never checked, so ?page=abc reached the Drizzle limit/offset clause as NaN.
They now reject anything that is not a positive integer.

The list route joins the user, so timeEntryListSchema carries userName. The
single-entry route does not join it and keeps the plain shape.

Drop the claim that integration credentials are verified with the provider
before storage. Every validate\*Config is local schema validation with no
network call, for Discord, Slack, Telegram, Gitea, GitHub and the generic
webhook alike.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(api): close the remaining gaps in the auth schema emitter

The generator behind auth-openapi.ts handled a narrow slice of JSON Schema and
quietly fell back to z.unknown() for the rest, so several Better Auth contracts
came out weaker than they are:

- a 3.1 nullable, written as type: ["string", "null"], lost its null branch, so
  logo, organizationId and teamId no longer accepted the null Better Auth uses
  to clear them
- allOf was unhandled, so delete-role and update-role accepted any JSON at all
  rather than an organizationId plus the roleName/roleId choice
- additionalProperties was ignored, so create-role's permission was a record of
  unknown instead of a record of string arrays

get-invitation's id is required again. Better Auth emits it optional and the
pipeline this file replaced patched it to required; regenerating had dropped
that, which the earlier commit missed.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(i18n): drop unused \_one plural keys from ja-JP

Japanese resolves every count to the "other" plural category, so the
\_one variants were dead keys. This matches zh-CN and ko-KR, which only
carry the \_other form.

- Fix: added `enableServiceLinks` field
- Fix: added `extraEnvFrom` field
- Fix: added `topologySpreadConstraints` field
- Fix: fixed typos in README
- Fix: default argument ordering in `enableServiceLinks`
- Fix(auth): prevent 401 retry storm and redirect to sign-in
- Fix(review): adding review suggestions
- Fix(auth): prevent 401 retry storm for pending invitations
- Fix(mattermost): harden webhook configuration
- Fix(mattermost): use ES2020-compatible text escaping
- Fix: typos and bad AI translations
- Fix: added polish plurals
- Fix: added more translations and fixed wording
- Fix: corrected translations
- Fix(i18n): add tasks.title to every locale and fix pl-PL formatting

Add the new tasks.title key to all 16 locales that were missing it,

and reformat pl-PL.json to use tabs to match the project Biome style.

- Fix(web): let task labels use card width
- Fix: hide mark as planned for planned tasks
- Fix: make task removal discoverable and calendar states distinct

Expose a permission-gated delete action in task details.
Synchronize task caches only after the server confirms deletion.
Preserve the backend permission boundary and cover every default status.

Constraint: Keep task deletion restricted to roles with task:delete.
Rejected: Grant deletion to all members | weakens the existing RBAC contract.
Confidence: high
Scope-risk: moderate
Directive: Keep custom statuses on the primary-color fallback pending a broader color system.
Tested: 162 web tests; 47 RBAC integration tests; web/API typechecks; Node 24 build.
Not-tested: Manual browser pass against a deployed server.

- Fix(web): protect unsaved task input
- Fix(web): address discard review feedback
- Fix: project nav width in different language
- Fix(web): preserve project menu minimum width
- Fix(i18n): sync Polish task discard translations with main
- Fix(web): preserve imported label colors
- Fix: make the OpenAPI artifact and its check environment independent

The exported document took its servers[0].url from KANEO_API_URL, which the
documented local setup sets to http://localhost:1337. A developer running the
check would see drift with unchanged routes, and running the fix it suggests
would write their own machine into the public API reference. The export now
pins the server block, since the committed artifact is the published reference
rather than a report of whoever generated it. The served /api/openapi still
reflects the instance it runs on.

Three defects in the checker itself:

- every outcome called process.exit() from inside the try, so the finally never
  ran and each invocation left a kaneo-openapi-\* directory holding a ~350KB
  document in the temp dir. It now returns a status and sets process.exitCode
  after cleanup.
- --fix read the committed file before reaching the fix branch, so a deleted
  artifact failed with ENOENT instead of being restored. A missing file is now
  treated as drift, which --fix repairs.
- pnpm is a .cmd shim on Windows, which execFile cannot launch without a shell.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix: pin the export environment instead of rewriting the servers block

Overwriting spec.servers made the artifact deterministic but discarded whatever
the route declares, so a new server entry or a changed description would never
reach the committed reference and the drift check would still pass. Pin
KANEO_API_URL for the export instead and let the route build the block.
dotenv-mono does not override an already-set variable, so a developer's .env
cannot reach the published document either way.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix: keep the OpenAPI check stable across CRLF checkouts

The exporter always writes LF while a Windows checkout could convert the
committed artifact to CRLF, so a clean tree reported drift and --fix could not
settle it. Pin the file to LF and compare with line endings normalized.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(ci): preserve OpenAPI checker argument boundaries
- Fix: `clsx` -> `cn`
- Fix: sorted imports
- Fix(lint): collapse get-task-item-stats test call to one line

Biome's formatter wraps the multi-line `getTaskItemStats(...)` call in
the blockquote-fenced-code-block test, so `biome ci` fails with a
formatting error. Flatten that one call so the argument string lives on
the same line as the call.

- Fix(web): ignore invalid checklist closing fences
- Fix(gantt): re-arm auto-center on project switch and inset scroll-padding for the task rail

Three fixes for the jump-to-today feature:

- Re-arm the one-time auto-center guard when the in-page project selector swaps `projectId` without unmounting the route, and list `projectId` as an effect dependency so the re-run actually fires even when `todayInRange` evaluates the same for both projects.
- Add `scroll-padding-left` on the scroll container so `scrollIntoView({ inline: "center" })` centers today's column against the space actually visible next to the sticky task rail, instead of against the whole viewport width.
- Disable the "Jump to today" button when a search filters the visible timeline down to zero tasks, even though today is still within the unfiltered project's date range.

Also fixes an indentation regression in the GanttTaskBar wrapper introduced in an earlier commit on this branch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01R3x2x4F1cXAzed9ySUSsiV

- Fix(web): center Gantt after filtered project becomes visible
- Fix(mattermost): resolve main conflicts and migrate OpenAPI routes

### 💼 Changes

- Merge pull request #1649 from usekaneo/fix/multi-instance-delivery

fix(api): make notifications and seat reconciliation survive replicas

- Merge pull request #1647 from usekaneo/fix/silent-data-bugs

fix(api): correct five defects that fail silently

- Merge pull request #1646 from usekaneo/fix/workspace-scope-integration-routes

fix(api): close five workspace-scoping gaps

- Merge pull request #1648 from usekaneo/fix/i18n-error-messages

chore(i18n): sync locale files and gate drift in CI

- Merge pull request #1655 from usekaneo/refactor/zod-openapi-migration

refactor(api): generate the OpenAPI spec from Zod instead of rewriting it

- Merge branch 'upstream/main' into feat/i18n-japanese
- Merge pull request #1662 from sinsky/feat/i18n-japanese

feat(i18n): add Japanese (ja-JP) translation

- Added image pull secrets
- Merge branch 'main' into fix/additional-chart-values
- Merge pull request #1636 from TymekV/fix/additional-chart-values

fix(chart): Added more values

- Merge pull request #1676 from usekaneo/seer/fix/auth-401-retry-storm

fix(auth): prevent 401 retry storm and redirect to sign-in

- Merge branch 'main' into seer/fix/pending-invitations-401-retry-storm
- Merge pull request #1677 from usekaneo/seer/fix/pending-invitations-401-retry-storm

fix(auth): prevent 401 retry storm for pending invitations

- Merge remote-tracking branch 'origin/main' into code/fix-pr-1325

# Conflicts:

# .husky/commit-msg

- Merge remote-tracking branch 'upstream/main' into feat/polish-translations
- Merge branch 'main' into feat/polish-translations
- Merge pull request #1635 from hydraxman/fix/board-label-truncation

fix(web): let task labels use card width

- Merge branch 'usekaneo:main' into main
- Merge pull request #1675 from mohiuddin000/fix/1645-hide-mark-as-planned-v2

fix: hide "Mark as planned" for backlog tasks

- Merge pull request #1685 from krudo-taco/fix/task-deletion-calendar-colors

fix: make task removal discoverable and calendar states distinct

- Merge pull request #1694 from usekaneo/code/fix-1693-unsaved-task

fix(web): protect unsaved task input

- Merge branch 'main' into fix/project-context-menu-width
- Merge branch 'main' into fix/project-context-menu-width
- Merge pull request #1641 from MonsPropre/fix/project-context-menu-width

fix: project nav width in different language

- Merge pull request #1695 from usekaneo/code/fix-1684-planka-label-colors

fix(web): preserve imported label colors

- Merge pull request #1657 from usekaneo/ci/openapi-drift-check

ci: fail when the API reference drifts from the routes

- Addressed review
- Merge remote-tracking branch 'upstream/main' into feat/checkboxes
- Merge branch 'main' into feat/checkboxes
- Merge pull request #1638 from TymekV/feat/checkboxes

feat: task item counters

- Merge pull request #1689 from usekaneo/dependabot/npm_and_yarn/tiptap/core-3.30.4

chore(deps): bump @tiptap/core from 3.29.2 to 3.30.4

- Merge pull request #1686 from reachsanjivbhagat-gif/feat/1671-center-gantt-on-today

feat: center Gantt view on today by default

- Merge pull request #1639 from TymekV/feat/polish-translations

feat(i18n): add polish locale

- Merge pull request #1325 from shockalotti/pr/mattermost

feat(mattermost): add native Mattermost integration

### 🚜 Refactor

- Refactor(api): generate the OpenAPI spec from Zod instead of rewriting it

The spec was assembled by running valibot through hono-openapi, merging in
Better Auth's generated document, and then rewriting the result with nine
transforms chained nine deep in createApp. Most of those transforms existed
only to paper over two things: valibot's JSON Schema output (v.date() came out
as {}, enums lost their type, $refs grew siblings) and a 3.1-to-3.0 downgrade
for the docs site.

Emit 3.1 natively from @hono/zod-openapi instead. Routes are declared with
createRoute on the apiRouter() factory in src/openapi.ts, request schemas live
in each feature's schema.ts and response schemas in its response.ts, named via
.openapi("Name") so they become reusable components.

utils/openapi-spec.ts drops from nine transforms to one URL helper. The only
post-processing left is a single loop injecting the shared 401 that every
authenticated route returns, rather than repeating it on 154 operations.

spec version 3.0.3 (downgraded) -> 3.1.0 native
component schemas 2 -> 83
missing summaries synthesized -> 0, all explicit
operationId clashes patched at runtime -> none, enforced by test

Better Auth's 35 organization operations are now declared as Zod in
auth-openapi.ts, generated from its own generateOpenAPISchema() output and
reviewed, replacing a runtime call plus ~200 lines of id/summary/tag
normalization and ref pruning.

Typing the responses surfaced documentation that did not match the code:

- listGitHubRepositories was documented as a bare array but has always
  returned {repositories, installations, total}; the web client already read
  .repositories, so the spec was the wrong half
- deleteGitHubIntegration returns {success, message}, not the integration
- POST /notification returns null when the user has muted that category
- the search response described a shape the controller never produced
- task startDate/dueDate were optional but the columns are nullable
- GET /api/config is mounted before the auth middleware, so it is public;
  it had been documented as requiring a bearer token

Behavior changes:

- createRoute({ middleware }) registers middleware before the request
  validators, so authorization now runs before validation. An unauthorized
  caller gets 403 rather than 400 and no longer learns whether their body was
  well formed. Inline middleware that read c.req.valid() was rewritten to read
  the raw request, since that is no longer populated when it runs.
- Declaring error responses puts them in each route's typed-response union, so
  untagged InferResponseType on the web side widens. The six call sites that
  needed it now pass the 200 status, matching what src/types/project already did.

Valibot remains only for internal, non-HTTP config validation under plugins/
and ws/. hono-openapi, @hono/standard-validator and @valibot/to-json-schema
are removed.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🎨 Styling

- Style: drop the explanatory comments added with the recent fixes

The reasoning belongs in the commit bodies and pull request descriptions, which
already carry it, rather than inline.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

### 🧪 Testing

- Test(web): cover task label overflow contract
- Test: cover task deletion state synchronization
- Test(web): cover browser-supported label colors
- Test: add regression coverage for Gantt jump-to-today
- Test(gantt): cover project-switch re-centering, scroll-padding, and empty-filter disable

Regression coverage for the three gantt.tsx fixes in the previous commit:

- Switching the in-page project selector to a different project re-arms the mount-time auto-center guard, verified by asserting scrollIntoView fires again for the newly selected project.
- The scroll container's scroll-padding-left matches the task rail's fixed 20rem width. Asserted against the raw inline style rather than toHaveStyle, since jsdom resolves getComputedStyle() rem units to pixels and would otherwise compare "20rem" against a computed "320px".
- The "Jump to today" button is disabled once a search filters the visible timeline down to zero tasks, even though today is still within the unfiltered project's date range.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01R3x2x4F1cXAzed9ySUSsiV

### ⚙️ Miscellaneous Tasks

- Ci: build release notes from pull requests and credit contributors

semantic-release walks every commit in a release range, and Kaneo merges most
pull requests with merge commits, so branch-internal work reached the notes:
v2.21.0 shipped 29 entries for 19 merges, three of them "apply CodeRabbit
auto-fixes".

Replace @semantic-release/release-notes-generator with a plugin that maps each
commit back to its pull request through the commit-association endpoint, which
resolves merge-commit branches as well as squashes, and collapses the range to
one entry per pull request. The same range now renders 17 entries referencing
#1629 rather than the three commits inside it.

Sections still come from the commit type, so the notes cannot disagree with the
bump the commit analyzer computed. The entry text is the pull request title only
when its type matches the commit's; when they disagree the title is describing
the whole branch rather than the part that landed, which would have filed #1558's
follow-up fixes under Features. Commits pushed straight to main resolve to no
pull request and keep today's commit link.

Pull request authors are credited by handle, excluding bots, which drops
dependabot and sentry.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- Chore(i18n): sync the locale files and teach the checker about plurals

pnpm i18n:check exited 1: all 16 non-English locales were missing the same 15
common.error.\* keys -- the network, CORS, auth, server and unknown messages
plus their troubleshooting steps, which is the entire error surface the web
error handler renders. i18next is configured with fallbackLng, so these showed
in English rather than as raw keys, but they were invisible to translators.

The check then still failed on ru-RU and uk-UA "extra" keys that are CLDR
plural categories those languages require and English does not have. Comparing
flat key sets treated every language-specific plural form as drift, so the
check could never pass and could not be wired into CI. Categories now come from
Intl.PluralRules per locale: a form the locale needs is required, a category it
does not have is reported, and i18next's exact-zero override is accepted.

pnpm i18n:report gains an untranslated section, because nothing previously
compared a locale's values against en-US, and it now recognises keys referenced
indirectly rather than deleting them as unused. pruneLocale keeps the plural
variants the check depends on. i18n/schema.json is regenerated and no longer
rejects the locales' own plural forms.

- Ci: gate locale drift on pnpm i18n:check

The check exists and is wired into package.json, but nothing ran it, which is
how 15 keys went missing from every translation.

- Ci: fail when the API reference drifts from the routes

apps/docs/openapi.json is a committed artifact that Mintlify serves as the API
reference, and nothing regenerated or checked it, so it was only ever as fresh
as the last person who remembered to run the export by hand. It had already
drifted: regenerating from unmodified code produced a 2000-line diff.

pnpm openapi:check regenerates the document to a temp file and compares it with
the committed one, so a route, request schema, or response schema change that
forgets the export fails CI with the command to fix it. pnpm openapi:check:fix
writes it. This mirrors the existing i18n:check pair.

The export needs no database and no secrets, so the job is a plain install and
run with no services attached.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Ci: build workspace packages before exporting the OpenAPI document

The exporter imports the API, which imports @kaneo/permissions from its built
dist output. Every other turbo task gets that build from dependsOn: ["^build"],
but the check invoked tsx directly and so ran against a workspace where nothing
had been built, failing with ERR_MODULE_NOT_FOUND on a clean checkout. It only
passed locally because dist happened to be left over from an earlier build.

Build the API's workspace dependencies through turbo first.

Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Chore: sync reviewed main into Polish locale branch
- Chore(i18n): add jumpToToday key to de-DE
- Chore(i18n): regenerate schema.json with jumpToToday key
- Chore(i18n): add jumpToToday key to el-GR
- Chore(i18n): add jumpToToday key to es-ES
- Chore(i18n): add jumpToToday key to fr-FR
- Chore(i18n): add jumpToToday key to hi-IN
- Chore(i18n): add jumpToToday key to id-ID
- Chore(i18n): add jumpToToday key to it-IT
- Chore(i18n): add jumpToToday key to ja-JP
- Chore(i18n): add jumpToToday key to ko-KR
- Chore(i18n): add jumpToToday key to mk-MK
- Chore(i18n): add jumpToToday key to nl-NL
- Chore(i18n): add jumpToToday key to pt-BR
- Chore(i18n): add jumpToToday key to ru-RU
- Chore(i18n): add jumpToToday key to tr-TR
- Chore(i18n): add jumpToToday key to uk-UA
- Chore(i18n): add jumpToToday key to vi-VN
- Chore(i18n): add jumpToToday key to zh-CN
- Chore: sync Gantt navigation and translate its Polish label
- Chore(release): v2.23.0 [skip ci]

### Features

- **mattermost:** add native Mattermost integration: #1325
- center Gantt view on today by default: #1686
- task item counters: #1638
- **i18n:** add polish locale: #1639
- **i18n:** add Japanese (ja-JP) translation: #1662

### Bug Fixes

- **ci:** preserve OpenAPI checker argument boundaries: #1657
- **web:** preserve imported label colors: #1695
- project nav width in different language: #1641
- make task removal discoverable and calendar states distinct: #1685
- **web:** protect unsaved task input: #1694
- **auth:** prevent 401 retry storm for pending invitations: #1677
- **auth:** prevent 401 retry storm and redirect to sign-in: #1676
- hide "Mark as planned" for backlog tasks: #1675
- **api:** close the remaining gaps in the auth schema emitter: #1655
- **web:** resolve the root error boundary's translation keys: #1648
- **api:** replace the seat-reconciliation advisory lock with a job lease: [cf701d0](https://github.com/usekaneo/kaneo/commit/cf701d02415412b91c28ea608c144f6673c6e4b8)
- **api:** close five workspace-scoping gaps: #1646
- **api:** correct five defects that fail silently: #1647
- **api:** make notifications and seat reconciliation survive replicas: #1649
- **chart:** Added more values: #1636
- **web:** let task labels use card width: #1635

### Documentation

- update contributors and sponsors: [8083ab2](https://github.com/usekaneo/kaneo/commit/8083ab2a65257da6552f07cf52149ad12434d0bf)
- update contributors and sponsors: [2ad7533](https://github.com/usekaneo/kaneo/commit/2ad753396331d964310d5ddd3ef112d9a0bede3e)
- update contributors and sponsors: [ee36e49](https://github.com/usekaneo/kaneo/commit/ee36e499a9d4e8520d8f8cdf5cd685e48fae48f9)
- update contributors and sponsors: [4653916](https://github.com/usekaneo/kaneo/commit/46539164c68669cec15b1528835c10ad0a66355e)
- update contributors and sponsors: [22e7da2](https://github.com/usekaneo/kaneo/commit/22e7da2db1c41b9449f4768000bf1504e0d343be)
- update contributors and sponsors: [48e87e4](https://github.com/usekaneo/kaneo/commit/48e87e4f8749474e940081708320dc75eb84afe8)
- update contributors and sponsors: [b760dce](https://github.com/usekaneo/kaneo/commit/b760dcec37edf22c390ec973d7fbed9a4c110578)
- update contributors and sponsors: [8100f3b](https://github.com/usekaneo/kaneo/commit/8100f3b1ab47a0b49c7ac6deabe64eb0d1d9970d)

### Credits

Huge thanks to @shockalotti, @reachsanjivbhagat-gif, @andrejsshell, @tinsever, @TymekV, @MonsPropre, @krudo-taco, @mohiuddin000, @sinsky, and @hydraxman for helping!

## [2.22.0] - 2026-08-21

### 🚀 Features

- Feat(site): add blog section with alternatives round-ups

Markdown-backed blog at /blog with category pages, an RSS feed, authors,
reading time, and a table of contents. Seeded with three long-form
alternatives round-ups built from the existing comparison data.

Frontmatter is parsed locally rather than with gray-matter, which calls the
yaml.safeLoad that the repo-wide js-yaml 4 override removes.

The guides and comparison indexes now share the blog's card component so the
three content hubs read as one system, and cross-link to each other.

Blog, guides, and comparisons sit behind a single navbar item, and posts are
wired into sitemap-pages.xml, llms.txt, and llms-full.txt.

### 🐛 Bug Fixes

- Fix(api): return 404 when a label does not exist

getLabel never awaited the query, so the not-found branch tested a Promise and
could not be reached. GET /api/label/:id answered 200 with an undefined body
for an id that does not exist.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Fix(ci): stop the release chart gate requesting packages write

GitHub validates the permissions of every job in a called workflow, including
ones whose `if` will skip them, so the release's validate-only call to
helm-chart.yml was rejected for the publish job's `packages: write` while the
caller granted `contents: read`.

Move the lint and template matrix into its own callable helm-validate.yml.
The release gate and the chart PR check both call that and need only
`contents: read`; publishing stays in helm-chart.yml where the write scope
belongs.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: describe the release flow in the agent guide

Record that releasing is a manual dispatch from main, what each commit type
produces, and that version-carrying files are declared in the apply-version
script rather than in a workflow step.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

### ⚙️ Miscellaneous Tasks

- Ci: gate the release on the image and chart builds

Replace the Bun changelog script with semantic-release, and invert the order
so images are built and pushed under the computed version before anything is
written. A failed image build now stops the release instead of leaving a tag,
a GitHub Release, a Discord announcement and a Helm chart pointing at an image
that was never published.

Releases stay manual: dispatch from main with release_type (auto/patch/minor/
major) and an optional dry_run that prints the version and notes and stops.
The GitHub Release body is now the same grouped notes as CHANGELOG.md, and
merged PRs and closed issues get a "released in vX.Y.Z" comment.

The images self-report their version, so scripts/release/apply-version.mjs
stamps it into an uncommitted tree for the build and semantic-release runs the
same script in prepare. Version-carrying files are declared in one place.

Collapse the three copies of the image matrix into a reusable build-images.yml.
That also fixes nightly.yml passing the Sentry token with `secrets:` where
docker.yml uses `secret-files:` -- by docker.yml's own comment the nightly web
build was receiving the file path instead of the token.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Chore: tighten monorepo hygiene

Mark the root and the unpublished workspaces private, so nothing here can be
published by accident. Give apps/site a typecheck script -- it passes, and it
was previously only ever checked by next build inside pnpm build.

Drop the full pnpm run build from the pre-commit hook; CI already builds, and
a multi-minute hook invites --no-verify, which would skip the Biome gate too.
Stop marking turbo's lint task persistent, and ignore \*.tsbuildinfo now that
the new typecheck writes one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Ci: let turbo pass DATABASE_URL through to the integration tests

Turbo's strict env mode strips undeclared variables, so pointing DATABASE_URL
at a Postgres other than localhost:5432 was silently ignored when running the
suite through pnpm test:integration -- the setup file fell back to its default.
CI is unaffected because its service container matches that default.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GW5WNH1SZkYaV5HzrdW7a3

- Chore(release): v2.22.0 [skip ci]

## [2.22.0](https://github.com/usekaneo/kaneo/compare/v2.21.0...v2.22.0) (2026-08-21)

### Features

- **site:** add blog section with alternatives round-ups ([ddc242f](https://github.com/usekaneo/kaneo/commit/ddc242f51eb549a75ab69c7dda4d4c594f3bacb1))

### Bug Fixes

- **api:** return 404 when a label does not exist ([442a382](https://github.com/usekaneo/kaneo/commit/442a38230291edb7784343dc8cf576705a32c737))
- **ci:** stop the release chart gate requesting packages write ([6ebb762](https://github.com/usekaneo/kaneo/commit/6ebb762cf346fb4a862819ca0dd180994e905664))

### Documentation

- describe the release flow in the agent guide ([56a9eab](https://github.com/usekaneo/kaneo/commit/56a9eabf7e78dfd51664285b801ae8c1fd22dcdc))
- update contributors and sponsors ([012778e](https://github.com/usekaneo/kaneo/commit/012778e4e64c1d18c84fde192e025ae798f3df33))

## [2.21.0] - 2026-08-20

### 🚀 Features

- Feat(site): add comparison and guide content engine

Turn the four hand-written alternative pages into a data-driven route and
expand the set to 24 competitors, then add a guides section that answers
the questions people ask before choosing a project manager.

Comparison entries now carry a short-answer verdict, a licence, hosting,
SSO, and pricing summary, an FAQ, related links, and a verifiedOn date
with sources. Every price, tier, licence, and seat cap was checked
against the vendor's own pricing page or LICENSE file.

Adds /alternatives and /guides hubs, FAQPage, Article, BreadcrumbList,
and ItemList JSON-LD, generated llms.txt and llms-full.txt, and a
sitemap generated from the same data.

- Feat(auth): let admins restrict workspace creation to instance admins

Add DISABLE_WORKSPACE_CREATION, which gates Better Auth's
allowUserToCreateOrganization to instance admins only (user.role ===
"admin"), following the same implicit-exemption shape as
DISABLE_REGISTRATION. Hide the "Add workspace" affordance in the
workspace switcher and command palette for non-admins when the flag is
set; the server-side check is the actual enforcement boundary.

- Feat(web): add a monthly calendar view to projects

Adds a per-project calendar view alongside board, backlog and gantt. It
reuses the existing useGetTasks query, so it shares the ["tasks", projectId]
cache with the gantt view and needs no API change.

Tasks are placed as bars spanning the days between their start and due
dates, using the same date normalization the gantt view applies: either
date alone is enough, and reversed ranges are swapped. A bar crossing a
week boundary is clipped per week row and drops its cap on that side so
the halves read as one span. Overlapping tasks are packed into lanes, and
anything past the lane cap stays reachable through a per-day overflow
popover listing that day's full task list.

Weekday and month labels go through Intl via lib/format, so they follow
the user's locale without new translation keys.

### 🐛 Bug Fixes

- Fix(web): prevent auth client timeout by optimizing i18n loading
- Fix: apply CodeRabbit auto-fixes

Fixed 1 file(s) based on 1 unresolved review comment.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>

- Fix(web,sentry): handle Safari "TypeError: Load failed" network errors
- Fix(web): classify Safari 'Load failed' as a network error

Safari throws 'TypeError: Load failed' when a fetch fails due to a
transient network drop — same family as Chrome's 'Failed to fetch', not
a CORS issue. The previous fix lumped it into the CORS branch, which
made ErrorDisplay show the deployment-guide action and irrelevant
server-side troubleshooting instead of connection/retry steps.

Move 'Load failed' to the network branch and add a regression test
asserting type, message key, and originalError preservation.

Signed-off-by: justin <justin@randoneering.tech>

- Fix(web,sentry): narrow Safari 'Load failed' suppression to auth-session path

The global ignoreErrors filter dropped every 'Load failed' by message
alone, which also silenced actionable TanStack Query fetch failures
(real API/CORS errors). The query client already rate-limits network
errors via its own 60s cooldown before reporting to Sentry, so the
broad filter bypassed that deliberate behavior.

Remove 'Load failed' from ignoreErrors and add a beforeSend that drops
only events tagged 'area: auth.session'. auth-provider captures
transient Safari session-fetch errors with that tag (useSession uses
nanostores, so the query-client cooldown never sees them); real auth
failures still flow to Sentry through Better Auth.

Signed-off-by: justin <justin@randoneering.tech>

- Fix(api): add timeout to Turnstile verification
- Fix(api): reject malformed Turnstile timeout env values

TURNSTILE_TIMEOUT_MS like "5000ms" or "1e3" previously collapsed
into a partial parse via parseInt, producing a short or incorrect
timeout that surfaced as a failed captcha verdict during sign-up.

Validate the trimmed env value as a positive safe integer and fall
back to DEFAULT_TIMEOUT_MS when the value has trailing characters
or is otherwise malformed.

- Fix(web,i18n): preload all namespaces after init and locale change

Components subscribe to the default namespace only via useTranslation(),
so calling t('auth:foo') on an unloaded namespace returns the raw key —
the lazy backend is never invoked because no consumer requested 'auth'.
Resolve all namespaces from the loaded locale JSON after init and on
every changeLanguage, and cache the JSON per locale so the lazy backend
shares a single dynamic import per language.

Adds a test that asserts a non-default namespace key resolves after the
asynchronous preload completes and that subsequent calls reuse the cache.

- Fix(web,sentry): ignore third-party adware/extension errors from cdn77.org
- Fix(web): prevent Tiptap TransformError from duplicate Link extension
- Fix(web): prevent Shiki highlighter crash on stale dynamic module load
- Fix: apply CodeRabbit auto-fixes

Fixed 1 file(s) based on 1 unresolved review comment.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>

- Fix(web): clear shiki stale-chunk reload flag after successful init
- Fix: apply CodeRabbit auto-fixes

Fixed 1 file(s) based on 1 unresolved review comment.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>

- Fix(web): track readOnly in ref so handleClick sees current mode

The handleClick handler closed over the initial readOnly prop, so when
CommentCard switched the same mounted editor between editable and read-only
modes, link clicks inside a newly read-only editor still allowed edits and
link clicks in a newly editable editor were blocked. Mirror the existing
onSubmitShortcutRef pattern with readOnlyRef and consult it from handleClick.

- Fix(api): gzip API responses to shrink large board payloads

Board/task list responses inline full labels and external links per
task with no pagination on the primary board fetch (see #1630), so
boards with a few thousand tasks return multi-MB JSON. Enable hono's
compress middleware to shrink this at the transport layer.

Measured against a seeded board of 2802 tasks / 2805 labels:
1,730,391 bytes -> 59,121 bytes (96.6% smaller)
Verified gzip and non-gzip clients receive byte-identical content.

- Fix(web): preserve MIME metadata for unknown files
- Fix: increase card title font size
- Fix: remove text-sm
- Fix(auth): address coderabbit/qodo review on workspace-creation gating

Re-read the user's role from the database in allowUserToCreateOrganization
instead of trusting the session, which can be cookie-cached and still hold
the pre-promotion role right after first-user signup, causing a spurious
403 for the bootstrap admin. Also stop the command palette and workspace
switcher from treating an unloaded/errored config as "creation allowed",
and guard the command palette's keyboard shortcut so it can't bypass the
now-hidden create-workspace item.

- Fix(web): address calendar view review feedback

- Calendar switcher labels now resolve through t("tasks:calendar.title")
  instead of a hardcoded string, in the desktop switcher and the mobile
  nav. The pre-existing Backlog/Tasks/Gantt labels are left untouched;
  they were already hardcoded and are outside this change.
- MonthGrid memoizes the per-week lane packing rather than recomputing
  every week's layout on every render.
- The calendar route no longer claims "no scheduled tasks" while the
  query is loading or has failed. Loading and error render their own
  states, reusing common:empty.loading and a new tasks:calendar.loadError.
- The four calendar components declare an explicit JSX.Element return type.

Two review points were deliberately not applied. The suggested
arrange-act-assert split is not the local convention: existing tests
assert inline, 63 inline call assertions against 46 hoisted results.
The missing ko-KR keys are intentional, as that locale is translated by
hand and seeded separately.

- Fix(web): announce the scheduled range in calendar task bars

The calendar bar's accessible name carried only the task title, so a
screen reader user got no sense of when the task is scheduled even
though the range is already in the tooltip. tasks:calendar.taskAriaLabel
now takes a range value alongside the title.

Adds a component test that resolves the key against the real en-US
bundle, so the assertion fails if the label stops receiving a value its
source string interpolates.

- Fix(docker): preserve web runtime placeholders
- Fix(coolify): pin the Kaneo image to a release tag

Address review feedback: replace the mutable :latest tag with a pinned
release (v2.18.0) so redeploys are deterministic and database migrations
cannot run unintentionally. KANEO_IMAGE_TAG allows intentional upgrades.

- Fix(coolify): track the latest release instead of a broken pinned tag

The default was ghcr.io/usekaneo/kaneo:v2.18.0, which does not exist. The
release workflow tags images from the raw version, so the registry holds
2.18.0 and 2.20.0 with no v prefix. A first deploy following the guide would
have failed to pull with manifest unknown.

Default to latest, which is published as a multi-arch manifest on every
release, so the file also stops going stale as releases land.

KANEO_IMAGE_TAG still overrides the tag for anyone who wants a fixed version.
The startup-migration warning moves to that note, since it is the reason to
pin rather than a property of the default.

- Fix(email): let the workspace invitation template render without copy

workspace-invitation is the only template whose copy comes from outside: the
other five carry built-in messages and resolve a locale themselves. It
destructured a required copy prop and read copy.preview immediately, so any
render without props threw and email export died partway, leaving .cjs
intermediates instead of HTML.

Give copy an English default matching i18n/en-US.json. The API always passes
locale-resolved copy, so the production path is untouched.

The default is inlined rather than imported from the i18n bundle. This package
builds with plain tsc, which leaves the import in dist as a relative require
reaching outside the package. apps/api gets away with the same import only
because esbuild inlines it at build time, and the api-runtime image copies
packages/email without i18n, so an import here would throw MODULE_NOT_FOUND
whenever an invitation was sent. A test pins the default to the en-US bundle
so the two cannot drift.

Also drop @react-email/preview-server, which react-email 6 no longer uses and
nothing in the repo imports.

### 💼 Changes

- Merge branch 'main' into seer/fix/api-turnstile-timeout
- Merge pull request #1623 from usekaneo/seer/fix/api-turnstile-timeout

fix(api): add timeout to Turnstile verification

- Merge branch 'main' into seer/fix/safari-load-failed-error
- Merge pull request #1624 from usekaneo/seer/fix/safari-load-failed-error

fix(web,sentry): handle Safari "TypeError: Load failed" network errors

- Merge branch 'main' into seer/fix/web-i18n-lazy-load
- Merge branch 'main' into seer/fix/sentry-ignore-cdn77-errors
- Merge branch 'main' into seer/fix/sentry-ignore-cdn77-errors
- Merge pull request #1625 from usekaneo/seer/fix/sentry-ignore-cdn77-errors

fix(web,sentry): ignore third-party adware/extension errors from cdn77.org

- Merge branch 'main' into seer/fix/web-i18n-lazy-load
- Merge pull request #1626 from usekaneo/seer/fix/web-i18n-lazy-load

fix(web): prevent auth client timeout by optimizing i18n loading

- Merge branch 'main' into seer/fix/shiki-dynamic-import-reload
- Merge branch 'main' into seer/fix/shiki-dynamic-import-reload
- Merge pull request #1627 from usekaneo/seer/fix/shiki-dynamic-import-reload

fix(web): prevent Shiki highlighter crash on stale dynamic module load

- Merge branch 'main' into seer/fix/tiptap-duplicate-link-extension
- Merge pull request #1629 from usekaneo/seer/fix/tiptap-duplicate-link-extension

fix(web): prevent Tiptap TransformError from duplicate Link extension

- Merge pull request #1613 from aoright/fix/optional-chaining-and-lint-cleanups

refactor: simplify conditional checks with optional chaining and clean up lint warnings

- Merge pull request #1631 from Kampe/fix/compress-api-responses

fix(api): gzip API responses to shrink large board payloads

- Merge pull request #1614 from hydraxman/fix/unknown-mime-upload

fix(web): use fallback MIME type for unknown files

- Merge pull request #1571 from smltr/change-font

fix: increase card title font size

- Merge branch 'main' into feat/admin-only-workspace-creation
- Merge pull request #1562 from pesnik/feat/admin-only-workspace-creation

feat(auth): let admins restrict workspace creation to instance admins

- Merge pull request #1570 from fvoci/feat/project-calendar-view

Adds a per-project monthly calendar view alongside board, backlog and gantt.

- Merge pull request #1561 from N1arko/agent/migrate-node-24

chore: migrate supported runtime to Node 24

- Merge pull request #1632 from usekaneo/chore/planka-drop-dead-author

refactor(planka-import): drop the dead author parameter from formatComment

- Merge branch 'main' into feat/coolify-deployment
- Merge pull request #1558 from pourmirzai/feat/coolify-deployment

feat: add Coolify deployment support (docker-compose.yml + guide)

- Merge pull request #1606 from usekaneo/dependabot/npm_and_yarn/react-email-6.9.2

chore(deps): bump react-email from 5.2.10 to 6.9.2

- Merge pull request #1633 from usekaneo/fix/email-export

fix(email): let the workspace invitation template render without copy

### 🚜 Refactor

- Refactor: simplify conditional checks with optional chaining and clean up lint warnings

Signed-off-by: aoright <102943475+aoright@users.noreply.github.com>

- Refactor(planka-import): drop the dead author parameter from formatComment

Comment attribution moved to the API in 15f68683, which passes
displayName(author) as createComment's externalUserName alongside
externalSource "planka". That commit removed the inline markdown byline from
the comment body, leaving the author parameter unused.

3534e4cb then renamed it to \_author to quiet the lint warning, which kept a
dead parameter in the signature. Remove it instead. The caller still needs
the local author binding for displayName, so attribution is unchanged.

### 📚 Documentation

- Docs: add Coolify deployment instructions and Docker Compose file
- Docs: update Coolify deployment instructions to clarify KANEO_API_URL usage

### ⚙️ Miscellaneous Tasks

- Chore(i18n): seed calendar view keys for non-English locales

Adds the eleven tasks:calendar and navigation:keyboardShortcuts keys the
calendar view introduced, filled with the en-US strings so nothing renders
a raw key while translations catch up.

ko-KR is deliberately left out; it is being translated by hand separately.

- Chore(i18n): regenerate the locale schema

The generated schema had drifted: 384eb005 ("feat(account): change avatar
and delete account") added settings keys to en-US.json without rerunning
the generator, and schema.json uses additionalProperties: false.

Regenerating therefore picks up more than the calendar view keys this
branch adds. It also brings in the settings avatar and deleteAccount
blocks that 384eb005 left out, which is why the diff is larger than the
calendar change alone would suggest.

- Chore(i18n): seed the calendar loadError key for non-English locales

Follows the calendar view seeding: the error state added in the review
fixes introduced tasks:calendar.loadError, so the fifteen locales carry
the en-US string until they are translated.

ko-KR is left out again; it is being translated by hand separately.

- Chore(i18n): regenerate the locale schema for loadError

Picks up tasks:calendar.loadError only. The earlier drift from 384eb005
was already absorbed by the previous schema regeneration on this branch.

- Chore(i18n): add Korean translations for the calendar view
- Chore(i18n): reseed the calendar taskAriaLabel for non-English locales

The en-US source string gained a range value, and i18n:check --fix only
adds absent keys, so the seeded copies had to be rewritten by hand to
keep the placeholder set in sync.

ko-KR is translated separately.

- Chore(i18n): add the range placeholder to the Korean calendar task label
- Chore: migrate supported runtime to Node 24
- Chore(mcp): drop the Node 24 engines constraint

The runtime migration only needs to bind the API image and the contributor
toolchain. @kaneo/mcp ships to npm and is spawned by MCP clients with
whatever Node the user already has, which is commonly 20 or 22 LTS.

The published package runs correctly on Node 20 and this branch does not
change its compile target, so the constraint gains nothing while producing
an EBADENGINE warning under npx and a hard install failure under pnpm or
engine-strict.

- Chore(coolify): name the compose file compose.coolify.yml

The repo already uses compose.yml for the default stack and compose.local.yml
for local development, so a Coolify-specific file reads better as
compose.coolify.yml than as a second root-level compose file whose name gives
no hint that it is Coolify-only.

Docker Compose prefers compose.yml over docker-compose.yml, so the old name
was never picked up by a bare "docker compose up" anyway. It only invited
confusion about which of the two root files was canonical.

References in the README, the Coolify guide, and the file header are updated
to match.

- Chore(release): v2.21.0

## [2.20.0] - 2026-08-19

### 🚀 Features

- Feat(web): emit source maps, switch to captureReactException, mount a safe root crash fallback
- Feat(api): drop workspace identifiers from Sentry integration breadcrumbs
- Feat: provision Sentry alert rules from sentry/alerts.json

Sentry MCP only exposes read tools for alert rules; the Sentry REST
API is the only path to create them. Putting the spec in the repo
makes the rules auditable and reproducible.

Six rules cover the original recommendations:

- Kaneo API / Kaneo Web: new issue (first_seen_event)
- Kaneo API: error spike (count > 50 in 5min)
- Cron: missed check-in (any of the 4 captureCheckIn monitors)
- Kaneo API: p95 latency > 1.5s over 10min (transaction.duration)
- Kaneo API: MCP error rate > 5% over 1h

scripts/provision-sentry-alerts.sh resolves monitor slugs to IDs,
POSTs detectors + workflows to the Sentry REST API, and is
idempotent (existing alerts are skipped). Actions are intentionally
empty so each rule can be wired to the right channel in the Sentry
UI (Slack / email / on-call) after provisioning.

sentry/README.md documents both the script and the manual fallback.
.env.sample documents SENTRY_API_TOKEN (org:write scope).

- Feat(scripts): update existing alerts instead of skipping

The script was create-only. Editing an alert in sentry/alerts.json
(e.g. changing a threshold, adding a condition) would not propagate
to Sentry because the name lookup said 'already exists' and the
script walked away.

This swaps the create-or-skip branches for create-or-update:

- find_existing_workflow now returns the full workflow object so we
  can grab detectorIds[0] for inline detectors.
- Two new helpers (create_or_update_workflow, create_or_update_detector)
  POST when id is empty, PUT otherwise. Same payload either way.
- The metric-detector branch plucks the existing detector id from
  the workflow's detectorIds when updating, so the same detector is
  edited in place rather than creating a duplicate.
- Cron monitor detectors are re-resolved by slug on every run, so
  adding a new captureCheckIn monitor is a no-op here \u2014 the IDs
  just get re-fetched.

Net effect: editing sentry/alerts.json and re-running the script
now converges the Sentry state to the spec. Replaced the 'skipped'
counter with a single 'applied' counter (created or updated).

README updated to match.

- Feat: provision Sentry dashboards from sentry/dashboards.json

Adds four Kaneo-specific dashboards and a provisioning script
mirroring the alerts script.

Dashboards:

- 'Kaneo: Backend Overview' \u2014 error rate, p95 latency, request
  volume, top errors by exception type
- 'Kaneo: Frontend Overview' \u2014 web error rate, page load p95,
  LCP p75, top error pages
- 'Kaneo: MCP' \u2014 MCP request volume, failure rate, top tools by
  usage, p95 latency
- 'Kaneo: Cron Monitors' \u2014 check-in status by monitor, history,
  and missed-check-in events

The 10 prebuilt Sentry dashboards are left untouched. Kaneo
dashboards are prefixed 'Kaneo:' so they're visiblly distinct.

scripts/provision-sentry-dashboards.sh reads the spec, finds
existing dashboards by title, and post-or-puts. On update, the
script reads the current dashboard and merges only the widgets
array \u2014 filter settings (projects, environment, period, etc.)
that the maintainer has set in the Sentry UI are preserved.

README updated. Cron monitor alert (item 1) is auto-resolved on
the next cron tick after the next deploy \u2014 documented in the
'What's NOT here yet' section.

Performance metrics use the new span dataset format
(event.type:transaction is_transaction:true); the cron check-in
events use event.type:transaction monitor.check_in_id:\* per the
Sentry API current state.

- Feat(design): replace Cal Sans and Paper Mono with Geist

Cal Sans is a display face and it was doing interface work at 13px.
Kaneo's palette is deliberately achromatic, so the typeface carries
essentially all of the product's personality, which raises the bar on
the body face and lowers the tolerance for quirk.

Geist and Geist Mono were drawn as one family, so task keys and titles
share proportions. One family now covers both roles: --font-heading
points at --font-sans instead of a separate display cut, so the
font-heading utility keeps working and headings render Geist semibold.

Web and site load the fonts through the Fontsource variable packages
rather than committed woff2 files. They still self-host with no CDN
request at runtime, but they ship per-subset files behind unicode-range.
That matters because Kaneo ships three Cyrillic locales (ru-RU, uk-UA,
mk-MK) and Cal Sans is Latin-only, so those interfaces have been falling
back to system fonts. Geist covers latin, latin-ext, cyrillic,
cyrillic-ext and vietnamese. Greek, CJK and Devanagari still fall back,
which is unchanged. A Latin user now downloads 52.5KB instead of the
130KB of Cal Sans UI, Cal Sans Heading and Paper Mono.

This also fixes a latent bug on the site: globals.css declared
@font-face for Cal Sans UI only, while --font-heading and --font-mono
referenced families that were never defined, so site headings and code
silently used system fonts despite the woff2 files sitting in public.

Mintlify's docs.json has no mono slot, so docs code blocks keep the
theme default and only the body family is set.

### 🐛 Bug Fixes

- Fix(review): qodo/coderabbit suggestions
- Fix(review): qodo/coderabbit suggestions
- Fix(review): qodo/coderabbit suggestions
- Fix(ci): failing test
- Fix(ci): failing test and code review recommendations
- Fix: apply CodeRabbit auto-fixes

Fixed 2 file(s) based on 1 unresolved review comment.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>

- Fix: apply CodeRabbit auto-fixes

Fixed 4 file(s) based on 1 unresolved review comment.

Co-authored-by: CodeRabbit <noreply@coderabbit.ai>

- Fix(scripts): surface Sentry API errors in provision-sentry-alerts

The first run reported "[ok] Created workflow" for every rule,
but every API call had silently returned HTTP 400. Three bugs:

- local + $(...) swallows curl failures (subshell + set -e don't mix)
- hidden error response body \u2014 couldn't tell where the API rejected
- false success on empty response (jq gets null, .id is empty)

Plus two payload-shape issues that the error body will likely call
out:

- workflows were missing config.frequency (default now 30 minutes)
- metric-alert workflows carried an empty triggers alongside
  detectorIds; the docs imply a workflow is one or the other

The retry path is idempotent: any alerts that did get created on
the first run are skipped by name lookup, so re-running just
fixes the failed ones.

- Fix(sentry/alerts): add missing API fields and URL-encode GET params

The third run from the real Sentry API surfaced the actual 400
response bodies. Three payload issues, one URL issue:

- issue-alert conditions need conditionResult: true
- metric detectors need eventTypes on each dataSource
- metric detectors need a top-level conditionGroup (separate from
  any triggers the workflow might have); priority fields are 75 (high),
  50 (low), 0 (resolved)
- removed the 'monitor_check_in_failure' trigger type from the
  cron workflow; that type doesn't exist in the API. Cron alerts
  work via detectorIds alone \u2014 the detector's failure is the trigger.

Plus, the GET queries with spaces in '?query=Kaneo API: New issue'
returned HTTP 000 (curl failure). The script now URL-encodes the
query value via jq's @uri filter before calling curl.

The metric alert workflows are now minimal (name + enabled).
The script adds organizationId, config.frequency, and detectorIds
automatically. The detector body is sent verbatim from the spec.

- Fix(sentry/alerts): add resolution condition + drop tokenized query params

Two more fixes from a fourth run:

- Metric detectors need a resolution condition alongside the
  trigger. The API rejects them with 'Resolution condition required
  for metric issue detector.' Each metric conditionGroup now has
  two conditions: the gt trigger (conditionResult 75 or 50) and an
  lte resolution (conditionResult 0 = resolved).

- The workflow GET with '?query=Kaneo API: New issue' returned
  'Invalid key for this search: API' \u2014 the Sentry query parameter
  is tokenized (is:unresolved, project:foo, etc.), not free text.
  Switched find_existing_workflow_id and the cron monitor lookup
  to fetch all and filter client-side. Org is small so this is fine.
- Fix(sentry/alerts): migrate to span dataset, add triggers to metric workflows

Two real issues from the api response bodies:

1. Sentry's transaction dataset is being deprecated. Detectors with
   dataSources[].dataset = 'transactions' now return:
   'Creation of transaction-based alerts is disabled, as we migrate
   to the span dataset. Create span-based alerts (dataset:
   events_analytics_platform) with the is_transaction:true filter
   instead.'
   The p95 latency and mcp error rate detectors now use
   dataset = events_analytics_platform plus is_transaction:true in
   the query. The error spike alert (events dataset, error events)
   is unaffected.

2. The new error spike workflow POST returned HTTP 500. The
   minimal payload had no 'triggers' field, and every Sentry
   workflow response includes one. Metal detectors drive
   notifications, but the triggers field needs to be present on
   the resource. Now set to { logicType: 'any-short', conditions: [] }.

Note: the previous run created detector 1658482 for the error spike
alert but the workflow POST failed, so 1658482 is orphaned. The
next run will create a new detector and reference it from the
workflow. The orphan can be deleted manually in Sentry UI.

- Fix(scripts): inject datasetSource + conditions fields Sentry requires

The dashboard POST returned HTTP 400 with:
'fields are required during creation', 'conditions are required
during creation' on every query.

But the payload already had fields. The docs example response does
show fields, but the Sentry v10 API also requires:

- datasetSource: 'user' on every user-defined widget (vs 'default'
  for prebuilt templates)
- conditions: '' on every query (a legacy filter field that the
  API still validates)

Added both via the script's jq template so the spec stays focused
on what the user actually wants to see (not Sentry API quirks).

- Fix(sentry/dashboards): add limit:10 to every query

The dashboard POST returned HTTP 400 with:
'limit is required. The maximum limit is 10.'

The Sentry API requires a 'limit' field on every query object, with
a max of 10. Most of the line charts in the spec didn't have one
(it makes no sense for a time-series plot), and the MCP tool usage
query had limit: 20 which exceeds the max.

Added limit: 10 to all 15 queries. The 'MCP tool usage (top 20)'
widget title is now 'top 10' to match.

The script doesn't try to inject this — it's a per-query setting
users typically want to control, and the API actually REJECTS values
above 10. README updated to document the constraint.

- Fix(sentry/dashboards): inject limit:10 on time-series widgets

The Sentry API rejects line/bar/area widgets without a widget-level
`limit` field with HTTP 400: 'limit is required. The maximum limit
is 10.' Tables don't require it.

Injecting it in the jq transformation keeps the spec clean — the
same pattern as datasetSource and conditions. The error path
`widgets[i].limit` makes it clear which field is missing.

Mirrors the existing 'inject datasetSource' pattern, so the only
spec writers need to know is that tables don't need it.

- Fix(sentry/alerts): drop /projects/ prefix from detector endpoint

Detectors are organization-scoped, not project-scoped. The project
lives in the request body as `projectId`, not the URL path.

The script's POST to `/organizations/{org}/projects/{project}/detectors/`
returned 200 with a detector ID, but the follow-up PUT to update that
detector at the same URL returned 404. The detector was created but
couldn't be updated, so every metric alert re-run after the first
provisioning flow would fail until the detector was manually deleted.

Aligns with the workflow endpoint pattern, which is also
`/organizations/{org}/workflows/{id}/` (no project in the URL).

- Fix(sentry): review-batch fixes across provision scripts and specs

- .env.sample: SENTRY_API_TOKEN is now consumed by both provision scripts
- provision-sentry-alerts.sh:
  - capture curl stderr so transport-level diagnostics appear in the
    failure branch (DNS, TLS, timeout)
  - find_existing_workflow now propagates list_workflows failures with a
    non-zero status; the main loop skips the alert and counts the error
    instead of silently creating a duplicate
  - detector provisioning: when the workflow has no detector ID, fall
    back to a name lookup on the org's detectors endpoint. Prevents
    orphan detectors from accumulating on failed re-runs.
  - drop the unused project parameter from create_or_update_detector
- provision-sentry-dashboards.sh:
  - find_dashboard_by_title preserves the list call's exit status (the
    pipeline was swallowing it); caller now skips on lookup failure
  - preserve the existing dashboard description on update and use the
    spec's description on create
- sentry/alerts.json: drop http.status_code:>=500 from the MCP error
  rate query. failure_rate() already computes the proportion of failed
  spans; the extra filter was collapsing the result to 100% of failures.
- sentry/dashboards.json: monitor.status:missed_or_failed is not a
  valid check-in status. Use the explicit (monitor.status:missed OR
  monitor.status:error) form.
- Fix(sentry): Qodo review-batch (issue projects, cron coverage, region)

Three findings from the Qodo review batch applied. #2 and #4 were already
fixed in the previous "review-batch fixes" commit; #5 was already
mitigated by find_detector_by_name and is not changed here.

- scripts/provision-sentry-alerts.sh:
  - Issue alerts now forward the top-level `projects` array to the
    workflow payload (Qodo #1). The previous jq started at `.workflow`
    and discarded everything else, so the api/web first-seen alerts
    were organization-wide instead of scoped to their named projects.
    The metric branch gains the same `projects: (.projects // [])`
    line so the two paths stay aligned.
  - Cron provisioning now fails when any configured slug is missing
    (Qodo #3). Previously it only failed when zero resolved, so a
    partial rollout could report success. The error message lists the
    missing slugs so a re-run cannot be mistaken for complete provisioning.

- scripts/provision-sentry-alerts.sh + scripts/provision-sentry-dashboards.sh:
  - ORG, REGION, and API_BASE are now read from the JSON spec instead
    of being hardcoded (Qodo #6). The README told maintainers to change
    the region field when migrating, but the script silently routed to
    the EU endpoint. SENTRY_API_BASE remains an explicit override.
- Fix(sentry/alerts): propagate detector lookup failures

`find_detector_by_name` was called with `|| true`, so a request
failure (network, auth, 5xx) was masked as an empty ID and the script
fell through to create_or_update_detector's POST path — recreating a
detector that may already exist, the same orphan pattern we just
added the lookup to prevent.

Distinguish the two empty-EXISTING_DET_ID cases now:

- request failure -> log, ERRORS++, continue (skip the alert)
- request succeeded, no match -> create new detector (unchanged)

This brings the detector lookup in line with
`find_existing_workflow`, which already propagates failures.

- Fix(sentry/alerts): declare cron SLUGS as an array

The cron coverage fix from the Qodo batch used ${#SLUGS[@]} in the
error message, but `SLUGS` was still a scalar from a command
substitution. With `set -u`, bash treats ${scalar[@]} as an unbound
array access and aborts the script before the missing-slug error
prints.

Switch to `mapfile -t` so `SLUGS` is a real array, and update the
iteration to `for slug in "${SLUGS[@]}"` so the loop still visits
every slug (the prior `for slug in $SLUGS` would only see the first
element once SLUGS was an array).

- Fix(sentry): ignore Safari extension runtime.sendMessage() errors
- Fix(web,sentry): remove unnecessary Sentry capture for auth fetch errors
- Fix(web,sentry): reduce noise from auth fetch errors and validate API URL
- Fix(web,sentry): ignore Facebook in-app browser postMessage errors
- Fix(seer): removed throw
- Fix(test): stop integration test hook and case timeouts

Vitest's defaults are 10s for hooks and 5s for cases. Several integration tests flake under that budget, including workspace-rbac.test.ts where beforeEach trips the hook timeout in CI.

Derive the TRUNCATE list in resetTestDatabase from schema.ts so new tables stop leaking between cases. The hardcoded list was missing workspace_role, trial_grant, user_avatar, and others added in recent migrations.

- Fix(web,sentry): handle authClient.getSession() network errors in workspace settings
- Fix(web): prevent Shiki highlighter crash on dynamic module load failure
- Fix(web): handle shiki initializer rejection in comment editor

The shared shiki initializer resets its cached promise on rejection so
later calls can retry. CommentEditor's useEffect only chained .then() on
the promise, so a persistent dynamic-module failure produced an
unhandled rejection during fallback rendering. Mirror TaskDescription's
pattern and add a .catch() that logs and renders without highlighting.

- Fix(web): track session-fetch failure and skip setActive fallback

Parent route now distinguishes a confirmed-empty session from a failed
fetch: a network error leaves session state unknown and surfaces a
sessionError flag in route context rather than redirecting to sign-in.

The workspace settings beforeLoad uses that flag to skip the
setActive fallback. Calling setActive during an outage would clobber
the user's current active organization without knowing what they had
selected; only mutate after a successful session response confirms
no active organization is set.

### 💼 Changes

- Merge branch 'main' into feat/sentry-secure-source-map-build
- Merge pull request #1603 from usekaneo/feat/sentry-secure-source-map-build

chore(ci): pass Sentry auth token via BuildKit secret, not image env

- Merge branch 'main' into feat/sentry-web-source-maps
- Merge branch 'main' into feat/sentry-runtime-instrumentation
- Merge branch 'main' into feat/sentry-runtime-instrumentation
- Merge pull request #1604 from usekaneo/feat/sentry-runtime-instrumentation

feat(api,web): runtime Sentry instrumentation

- Merge branch 'main' into feat/sentry-web-source-maps
- Merge pull request #1602 from usekaneo/feat/sentry-web-source-maps

feat(web): source maps + root error boundary for Sentry

- Merge pull request #1610 from usekaneo/feat/sentry-alerts

feat(sentry): provision alerts and dashboards as code

- Merge pull request #1615 from usekaneo/seer/fix/sentry-auth-fetch-noise

fix(web,sentry): remove unnecessary Sentry capture for auth fetch errors

- Merge branch 'main' into seer/fix/ignore-safari-runtime-errors
- Merge pull request #1616 from usekaneo/seer/fix/ignore-safari-runtime-errors

fix(sentry): ignore Safari extension runtime.sendMessage() errors

- Merge pull request #1617 from usekaneo/seer/fix/ignore-fb-iab-error

fix(web,sentry): ignore Facebook in-app browser postMessage errors

- Merge branch 'main' into seer/fix/web-auth-fetch-error
- Merge pull request #1618 from usekaneo/seer/fix/web-auth-fetch-error

fix(web,sentry): reduce noise from auth fetch errors and validate API URL

- Merge pull request #1619 from usekaneo/fix/integration-test-timeouts-and-truncate

fix(test): stop integration test hook and case timeouts

- Merge pull request #1622 from usekaneo/seer/fix/shiki-highlighter-dynamic-import

fix(web): prevent Shiki highlighter crash on dynamic module load failure

- Merge branch 'main' into seer/fix/workspace-auth-fetch-error
- Merge pull request #1621 from usekaneo/seer/fix/workspace-auth-fetch-error

fix(web,sentry): handle authClient.getSession() network errors in workspace settings

- Merge branch 'feat/geist-typography'

Replace Cal Sans and Paper Mono with Geist across web, site, docs and
email templates.

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🧪 Testing

- Test: derive reset helper from Postgres catalog, not schema registry

The previous reset list was built from apps/api/src/database's schema object, which is a curated subset of tables used by typed queries. Tables that exist in schema.ts but are not re-exported from index.ts (currently mcp_oauth_state and task_reminder_sent) were silently dropped from the TRUNCATE list.

Reset now reads information_schema.tables directly so it always matches whatever migrations created, regardless of the schema registry. Also add mcp_oauth_stateTable and taskReminderSentTable to the schema registry so typed access works from tests and app code.

A new integration test seeds rows in both tables, calls resetTestDatabase, and asserts the rows are gone. The test fails on the previous code and passes on the fix.

- Test: tighten reset helper regression coverage

Drop the precondition rowExists assertions in the existing reset tests. db.insert throws on failure, so the pre-check was redundant.

Add a third test that creates a raw SQL table that no module in apps/api/src/database knows about, seeds a row, calls resetTestDatabase, and asserts the row is gone. The table is dropped in a finally block. The new test fails on the previous schema-derived approach even if the mcp_oauth_state and task_reminder_sent tables are present in the registry, because the table is genuinely unknown to any module.

- Test: quote catalog table names through quoteIdentifier

resetTestDatabase was wrapping each catalog-provided table name with bare double quotes. Use the existing quoteIdentifier helper so embedded quotes in table names are escaped as PostgreSQL requires instead of producing invalid SQL.

- Test: drop redundant precondition in third reset test

Same reason as the previous commit: db.execute throws on a failed INSERT, so checking rowExists === true before resetTestDatabase was noise.

### ⚙️ Miscellaneous Tasks

- Ci: switch docker build-push secret input from secrets to secret-files
- Chore(release): v2.20.0

## [2.19.1] - 2026-08-15

### 🐛 Bug Fixes

- Fix(web): save a description to the task it was typed in (#1600)

* fix(web): save a description to the task it was typed in

The 700ms debounce read taskRef.current when the timer fired rather than
when the text was typed, and the task id decides which endpoint the save
goes to. Leaving a task inside that window wrote its markdown over
whichever task was open when the timer expired, damaging both: the one
navigated to lost its description, and the one edited never got the text.

The helper also holds a single timeout per component. Since the editor
started surviving task switches, typing in the task just opened cleared
the timer still owed to the previous one, dropping that edit silently.

Pending saves are now keyed by task id, and the task is captured when the
text is typed. When the timer fires on a task still open, its freshest
copy is used, so a status or due date changed inside the window is not
carried back stale.

Fixes #1599.

- test(web): wait on an animation frame instead of a delay

settle() slept 50ms for a flag that hydration clears inside
requestAnimationFrame, which made the two tests depend on timing rather
than ordering. Awaiting a frame is deterministic: hydration's callback is
already queued when settle runs, so one queued after it cannot run first.

Raised by qodo on #1600. Both tests still fail against v2.19.0.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.19.1

## [2.19.0] - 2026-08-15

### 🚀 Features

- Feat(api): enrich Sentry with profiling and user attribution

Wires up two Sentry features that were missing on the API:

- nodeProfilingIntegration + profilesSampleRate (opt-in via
  SENTRY_PROFILES_SAMPLE_RATE, default 0). Lets Sentry capture CPU
  profiles when traces are enabled.
- Sentry.setUser({ id }) in authenticateApiRequest's success paths
  so events are tagged with the authenticated user id. id only, no
  PII \u2014 sendDefaultPii stays false.

Bumps @sentry/node to ^10.70 to match @sentry/profiling-node's
@^10.70 peer (also pulled in by the dep).

.user scope is per-process in @sentry/node, so concurrent requests
from different users can race the per-context user id. Proper fix
is Sentry.runWithAsyncContext per request via AsyncLocalStorage \u2014
left for a follow-up.

- Feat(github): move the task back when an issue is reopened (#1518)

* feat(github): move the task back when an issue is reopened

The Gitea plugin handles `reopened` and moves the linked task out of the
done column. The GitHub plugin does not: it registers `issues.opened`,
`issues.closed`, `issues.edited`, `issues.labeled` and
`pull_request.reopened`, but never `issues.reopened`. Reopening a GitHub
issue left the task where closing it had put it.

The handler mirrors `issue-closed.ts` for lookup, the kaneo-origin guard
and the event it publishes, and mirrors the Gitea reopen handler for the
two things that differ: the `issue_reopened` workflow trigger and writing
`state: "open"` back to the link metadata. `resolveTargetStatus` takes the
trigger as a plain string and falls back to `to-do`, which is how the
Gitea side behaves today.

- fix(github): process every integration on reopen and guard the metadata parse

The Gitea reopen handler is the behavioural twin of this one, and it does both
already: it catches a metadata parse failure and carries on with an empty
object, and it walks every matching integration instead of stopping at the
first. `handleIssueOpened` on the GitHub side also walks all of them.

With the early return, a repository connected to two projects only moved one
task out of Done. With the bare `JSON.parse`, a legacy or truncated metadata
row threw and the whole webhook delivery failed, leaving the task unsynced.

### 🐛 Bug Fixes

- Fix(api): isolate Sentry user scope to per-request async context

authenticateApiRequest called Sentry.setUser without a per-request scope,
so errors captured later (including auth failures reaching app.onError) could
be attributed to whichever user authed last on the same process.

Fork the current scope in the api.use("\*", ...) middleware via
Sentry.withScope, clear any previous user at request start, and clear again
in finally so background/unrelated errors don't inherit the prior user.
attachUserToScope() is unchanged; it now only tags the in-flight request.

- Fix(api): validate Sentry sample rate env vars are in 0..1

tracesSampleRate and profilesSampleRate were parsed with
Number.parseFloat("") and only filtered for finite-ness, so values like
"-0.5" or "1.5" reached Sentry.init. Switch to Number() (rejects trailing
garbage) and clamp to the inclusive 0..1 range; out-of-range and malformed
values fall back to 0.

- Fix(api): scope Sentry user per-request via withIsolationScope

Sentry.setUser writes to the isolation scope, not the current scope, so
Sentry.withScope in the api.use("\*", ...) middleware did not actually
isolate setUser per request. Switch to Sentry.withIsolationScope, which
forks the isolation scope so each request's user tag stays scoped to the
in-flight request and cannot leak to siblings or background work.

- Fix(web): keep task description editor alive across task switches (#1581)

* fix(web): keep task description editor alive across task switches

* fix(web): guard task description uploads against stale task switches

* refactor(web): use optional chaining in code block copy guard

* test(web): pin task description editor dependency stability

* fix(web): reset editor undo history on task switch

* fix(web): keep hydration setContent out of the undo history

- Fix: GitHub-imported tasks without priority label get priority=null and can never be edited (#1583)

* test: add repro for GitHub-imported tasks with null priority

A GitHub issue without a priority: label is imported with priority=null
(overriding the schema default), and the update endpoint rejects any edit
of such a task with a 400 picklist validation error. This test drives the
issues.opened webhook handler and asserts the created task's priority is
a valid value ("low") instead of null.

- fix: default GitHub-imported task priority to low when label missing

extractIssuePriority() returns null when a GitHub issue has no
priority: label. The issues.opened webhook handler and the GitHub issue
import controller persisted that null, overriding the schema default
("low"). Because the task update endpoint validates priority against a
picklist (no-priority|low|medium|high|urgent), such tasks could never be
edited (HTTP 400). Default to "low" when no priority label is present.

Fixes #1582

- Fix(github): keep a webhook delivery alive when link metadata will not parse (#1526)

* fix(github): keep a webhook delivery alive when link metadata will not parse

An external link's metadata is a JSON string in the database, so a row written
by an older version, or a truncated one, is not something the delivery can do
anything about. On the GitHub side four handlers called `JSON.parse` on it bare,
so the throw escaped the handler and the whole delivery failed, leaving the task
unsynced with no record of why.

The Gitea handlers already warn and carry on with an empty object. This is the
same behaviour, in one helper, since the GitHub side needs it in four places.

`issue-closed` also stopped at the first matching integration, so a repository
connected to two projects only moved one task. Its Gitea twin and
`issue-opened` on this side both walk all of them. `pull-request-closed` returns
early on both sides, so that one is left as it is.

- fix(github): type the metadata the edit handler reads back

`JSON.parse` returned `any`, so reading `metadata.lastSync.title` off it went
unchecked. The helper hands back a typed value, which made `tsc` point at four
reads that were never verified.

`parseLinkMetadata` takes the shape from the caller now, defaulting to the
untyped record for the handlers that only spread it forward, and the edit
handler declares what it looks for. Every field is optional, since a row may
predate any of them.

A stamp with no timestamp used to become an Invalid Date, whose NaN failed the
recency comparison; the epoch fails it the same way, so the branch taken does
not change.

- fix(github): ignore link metadata that parses to something other than an object

`JSON.parse` answers `null` for the row `null`, and a string for `"kaneo"`. The
helper handed either one back as metadata, so a caller reading
`metadata.createdFrom` off it threw inside the webhook, which is the crash this
helper exists to prevent.

A parsed value that is not a plain object now takes the same exit as a row that
will not parse. Arrays go with them: nothing here writes one, and spreading it
forward would turn its indices into keys.

The warning no longer carries the row itself. A row can hold a task description
synced from Kaneo, and the link id is enough to find it by.

---

Co-authored-by: (justin)randoneering <justin@randoneering.tech>

- Fix: derive a project key from non-Latin names (#1517)

* fix: derive a project key from non-Latin names

`generateProjectSlug` stripped everything outside `A-Z0-9`, so a project
named in Cyrillic, Greek or Han produced an empty key and the create
button stayed disabled with nothing on screen to explain why. It also
split on whitespace without discarding the empty leading entry, so a name
starting with a space or a stripped punctuation mark spent one of the
three initials on nothing: " Kaneo" became "K" and " Alpha Beta Gamma"
became "AB".

Match the slug rules the API already applies in `toSlug`: NFKC first,
then Unicode property escapes for letters, marks and numbers. Words with
no letter or number are dropped, which covers both the empty leading
entry and a word left holding only combining marks.

- fix: keep non-Latin project keys usable end to end

Two follow-ups from review on the key generator.

The generator now accepts letters outside the basic multilingual plane, but
it still indexed by UTF-16 unit, so `word[0]` could return half a surrogate
pair and `slice(0, 3)` could cut one in half. Iterate by code point instead,
and skip a leading combining mark when picking an initial.

The API's global search only treated a query as a task short id when it
started with `A-Za-z`, so a key like "ПА-23" never reached the exact
slug-plus-number lookup. The pattern moves to `apps/api/src/search/
task-short-id.ts` with the same Unicode rules the generator and `toSlug`
use, and it still requires a leading letter and a trailing number.

- fix(search): compare a project key instead of matching it as a pattern

Three things the review turned up, all in the path a task short id takes from
the key that generates it to the lookup that reads it back.

A key may hold `_`, and `ilike` reads that as "any one character". Checked
against Postgres 16: `slug ILIKE 'A_B'` returns `A_B` and `ACB` both, so
`A_B-23` could open a task in `ACB` and the `limit(1)` decided which. The
value is escaped now, which keeps the case-insensitive comparison and drops
the wildcards.

The query is normalized to NFKC before matching, because `generateProjectSlug`
normalizes before it stores a key, so a decomposed `ПА-23` never reached the
composed form on disk.

And a single word name starting with a combining mark produced a key starting
with that mark, which the short id pattern cannot match, since it wants a
letter first. The multi-word path already skipped leading marks; the one-word
path now does too.

- refactor(web): let firstLetterOrNumber infer its return type

* Fix(auth): secure cookies on HTTPS deployments (#1560)

- fix(auth): secure cookies on HTTPS deployments

- fix(auth): parse cookie URL protocol

* Fix(web): respect granular task permissions (#1520)

- fix(web): respect granular task permissions

Fixes #1505

- fix(web): address task permission review feedback

- fix(web): recheck description edit permission

* Fix(task): repair the null priority that blocks every edit, and move tasks by column slug (#1594)

- fix(task): stop writing a priority no update can repair

An issue imported without a priority: label was stored with priority
NULL. Every task update validates priority against a picklist with no
null and no empty member, and the web client sends the whole task on any
edit, so those tasks rejected every change with a 400. Setting a start
date failed. Dragging the card between columns failed, silently, because
the optimistic update had already moved it.

#1583 fixed the two GitHub write sites. The two Gitea ones wrote the same
null, and no existing row was ever repaired.

The column now refuses NULL outright, so this cannot come back through a
future writer. Rows already broken are set to the column default the
insert should have used, which is also what a GitHub import produces
today, so an issue imported before and after the fix ends up the same.

The client no longer sends "" for a task with no priority. That value
could never validate, and after this migration it should be unreachable
anyway.

Fixes #1584. Fixes #1585. Completes #1582.

- fix(web): move tasks by column slug rather than column id

A task's status is a column slug. The board, the list view and the
backlog all assigned a column id instead, which works only because
GET /task/tasks/:projectId returns id: column.slug while the column
endpoint returns the real uuid. Read columns from the other endpoint and
every drag would 400 with a uuid the project has no status for, without
surfacing anything, since the card has already moved optimistically.

The backlog "Move All" matched a column id against the literal "to-do"
for the same reason, so its optimistic update was already dead code
wherever the two differ.

Column ids still identify droppables, which is what dnd-kit compares
against, so those comparisons stay as they are.

Fixes #1586.

### 💼 Changes

- Merge pull request #1589 from usekaneo/chore/biome-fixes

chore: fix biome lint config for 2.5.x

- Merge pull request #1595 from usekaneo/test/task-description-regression

test(web): cover the crash #1580 actually reported

- Merge branch 'main' into feat/sentry-api-instrument
- Merge pull request #1590 from usekaneo/feat/sentry-api-instrument

feat(api): enrich Sentry with profiling and user attribution

### 📚 Documentation

- Docs: add AI contribution guidelines (#1593)

### 🎨 Styling

- Style(contributing): drop the en dash from the AI guidance

Matches the rest of the repo, which had its em and en dashes removed.

### 🧪 Testing

- Test(web): drain input-otp timers before cleanup in verify-otp

input-otp's password manager detection effect sets timers (0ms,
2s, 5s, 6s) when the input focuses. The 0ms timer can fire after
vitest tears down the jsdom environment on the next macrotask,
surfaces as an unhandled "window is not defined" error and fails
the unit job in CI.

Wrap the wait in @testing-library/react's act() so any pending
React updates also flush while the timer drains. Longer timers
are cleared by React's effect cleanup when cleanup() unmounts the
component.

- Test(web): mock the capability the description editor actually calls

#1581 added this test while the editor still read canManageTasks, and
#1520 renamed that capability to canUpdateTasks. Each PR was green on its
own branch; merged together the mock returns an object without the
function the component destructures, so the render throws.

Nothing to fix in either change, only the mock they were both written
against.

- Test(web): cover the crash #1580 actually reported

The test that shipped with #1581 mocked useEditor to return null and
asserted its dependency array stayed referentially stable. It could not
fail if the crash came back, which @tinsever pointed out on the PR before
it merged.

These build a real editor instead, stub only the extensions that need a
browser, and drive the reported path: render a child task, hand the same
component the parent's id, and read the document. Checked against the
component as it was before #1581, where the first one fails with the
message from the issue, "Cannot read properties of null (reading
'commands')".

The second covers what keeping one editor alive introduced. Hydration
would otherwise land in the undo stack, so Ctrl+Z after a task switch
blanks the description. Without the guard it fails the same way.

The dependency-stability assertion is dropped rather than kept alongside:
it mocks the module these need real, so the two cannot share a file, and
it asserted the mechanism where these assert the behaviour.

### ⚙️ Miscellaneous Tasks

- Chore: fix biome lint config for 2.5.x

Replaces the deprecated `linter.rules.recommended: true` field
with the new `linter.rules.preset: "recommended"` form per the
Biome 2.x schema.

Also ignores `.pi/` and `.pi-subagents/` — these are pi agent
runtime state directories that were tripping the formatter check
in `biome ci`. Tracking them as source files made the pre-commit
hook fail on every commit.

- Chore(api): drop redundant return type on parseSampleRate

The function body returns either n (number) or 0 (number), so TypeScript
infers the return type as number. The annotation was documentary only.

- Chore(release): v2.19.0

## [2.18.0] - 2026-08-12

### 🚀 Features

- Feat(account): change avatar and delete account

Account settings could show a profile picture but never set one, and there
was no way to leave.

Avatars are stored in Postgres and served from /api/user/avatar/<id>.
Object storage stays optional, so uploading a picture works on every
install and a database dump restores it; the row id is regenerated per
upload, which makes the URL unguessable enough to serve unauthenticated
and self-busting for caches. The browser crops to a centred square and
downscales to 256x256 before upload, so a phone photo arrives as ~30KB
of WebP rather than 8MB, and the API re-checks the declared type against
the actual magic bytes.

Deleting an account takes the workspaces nobody else belongs to and
refuses while the account is the only owner of a shared one, naming it so
the owner can transfer or delete it first. Three foreign keys had to move
off ON DELETE CASCADE for that to be safe: task.assignee_id,
time_entry.user_id and activity.user_id now SET NULL, because an
assignment, a logged hour and a history entry belong to the workspace, not
to the person leaving it. Deleting any user previously deleted their
assigned tasks out of other people's projects.

Deletion is refused while a workspace still has a Creem subscription that
can charge, since neither path can cancel one and the customer would keep
paying for something they cannot see. Trials move into trial_grant, keyed
by a hash of the normalised email, because workspace_billing rows die with
their workspace and deleting either a workspace or an account handed the
same person a fresh 14 days.

GET /api/auth/get-session now delegates to Better Auth rather than reading
the session itself. Reading it dropped the refreshed cookie and ignored
disableCookieCache, so the web app kept showing the pre-update user for up
to five minutes after any profile change.

### 🐛 Bug Fixes

- Fix(web): restore the backdrop behind settings modals

Every dialog opened from Settings appeared with no dimming at all, while
the command palette dimmed normally.

Base UI renders Dialog.Backdrop only for dialogs that are not nested, and
the settings route wrapped its entire layout, Outlet included, in the
Sheet it uses for the mobile menu. That made every dialog on every settings
page a nested dialog and silently removed its backdrop, even though the
sheet itself was closed the whole time.

The settings route no longer wraps anything in a Sheet. Its hamburger sets
state that reaches SettingsSidebar through the existing provider, and
SettingsSidebar wraps only its own popup, which is the shape
components/ui/sidebar.tsx already used for the main sidebar and the reason
modals outside Settings were unaffected.

Backdrops are also forced for dialogs that really are nested, so a confirm
opened inside the task details sheet still separates from it, and the
shared treatment moves to bg-black/50 with a 6px blur since 32% black over
a dark page read as nothing.

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: document changing your avatar and deleting your account

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.18.0

## [2.17.6] - 2026-08-11

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.6

## [planka-import-v0.2.0] - 2026-08-11

### 🐛 Bug Fixes

- Fix(planka-import): explain unmatched assignees, keep dependencies, attribute comments

Three problems reported after a real migration of 13 boards.

Assignees never matched. PLANKA lists email in PRIVATE_FIELD_NAMES and
omits it for anyone who is not the caller or an admin, so a non-admin
import sees no addresses and silently assigns nobody. The import now
counts why each assignment was dropped and says whether to re-run as a
PLANKA admin or to invite the person to the workspace first.

Card dependencies became checkbox text. PLANKA checklist items carry a
linkedCardId, which is a real reference to another card, so those now
become Kaneo task relations and are no longer flattened into the
description. Relations are created after every task exists.

Comments all showed as the API key's owner. activity already stores an
external author for GitHub and Gitea imports, so POST /comment/:taskId
now accepts externalUserName with externalSource. Both are required
together and the source is a fixed picklist, since a name on its own
would render as an unattributed impersonation of a real account.

## [2.17.5] - 2026-08-11

### 🐛 Bug Fixes

- Fix(billing): send one trial reminder per owner, not per workspace

Reminders were keyed to the workspace while the trial is granted to the
owner, so someone owning twenty workspaces got twenty identical emails.
Making trials per-owner made this worse: every workspace an owner has
now shares one expiry, so the copies all land in the same hour instead
of being spread out.

It has already happened once (one owner received three copies), and one
account owning 35 workspaces that expire together would have received 35
in a burst, then 35 more. Beyond being unusable, that is the kind of
pattern that costs a sending domain its reputation.

The dedupe key moves to (user_id, reminder_type) so the database
enforces it. The migration backfills the owner for existing rows and
collapses the duplicates already recorded.

DISTINCT ON forces ORDER BY to lead with the owner, so urgency ordering
moves outside it; otherwise the per-run cap would drop the soonest
expiries rather than the furthest.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.5

## [2.17.4] - 2026-08-11

### 🐛 Bug Fixes

- Fix(billing): throttle trial reminders so they cannot exhaust the quota

The first run sent 152 emails back to back against a 100/day provider
quota. Roughly a third were dropped, and because the send is claimed
before dispatch they are recorded as sent and will never retry. Worse,
the quota is account-wide, so it also consumed the budget for magic
links and OTP codes and left sign-in broken for the rest of the day.

Caps each run (BILLING_REMINDER_MAX_PER_RUN, default 25), spaces sends
600ms apart, and orders by soonest expiry so the most urgent always go
first. Hourly runs give roughly 600/day of capacity against a peak need
near 250, without ever bursting.

Throttling alone is not sufficient on a plan whose daily ceiling is
below the daily need; the ceiling has to be large enough as well.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.4

## [2.17.3] - 2026-08-11

### 🚀 Features

- Feat(billing): email trial reminders before and after expiry

Nothing warned a workspace owner that their trial was ending. The only
signal was a dismissible in-app card, so anyone not signing in during
the window first learned of it from a 402 mid-action, which is the worst
possible moment to ask for a card.

Adds an hourly job sending two emails: three days before expiry and once
the trial has lapsed. Skips founding-free workspaces and anyone with a
subscription, and no-ops entirely when billing or SMTP is unconfigured,
so self-hosted installs are unaffected.

The send is claimed in billing_reminder_sent before the mail goes out,
so a duplicate needs both a crash and a lost unique constraint. Sending
one email twice is worse than missing one.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.3

## [planka-import-v0.1.2] - 2026-08-11

### 🐛 Bug Fixes

- Fix(planka-import): default to the real Kaneo Cloud host

The default target was https://app.kaneo.app, which does not resolve.
Kaneo Cloud is cloud.kaneo.app, so anyone importing without an explicit
--kaneo-url hit a connection failure, and the docs example showed the
wrong host too.

Every end-to-end run passed --kaneo-url explicitly, so the default was
never exercised.

Moves it into DEFAULT_KANEO_URL, used by both the client and the help
text, so the two cannot drift apart again.

### 📚 Documentation

- Docs(agents): revamp project guidance (#1564)

* docs: revamp agent guidance

* docs: clarify agent guide discovery and env setup

## [2.17.2] - 2026-08-11

### 🐛 Bug Fixes

- Fix(billing): grant the trial once per owner, not per workspace

Trials were keyed to the workspace, so a single account could mint an
unlimited number of them just by creating more workspaces. No evasion
was needed and nothing capped it.

A new workspace now inherits its owner's earliest trial window. Creating
more workspaces cannot extend trial time, and a workspace created after
that window has lapsed starts unentitled. Subscriptions stay per
workspace, which is unchanged.

Existing rows are left alone: this only affects billing rows created
from here on.

- Fix(auth): resolve the client IP behind multiple proxy hops

Session IP capture went blank on 5 August: every session since records
an empty address. Two changes a day apart combined to cause it. The
better-auth bump to 1.6.25 only trusts a forwarded header it can
attribute, and unset trustedProxies means it trusts single-value headers
only. The bundled-image migration then added a second hop, so
X-Forwarded-For became "client, caddy" and stopped being interpreted.

Sets ipAddressHeaders and trustedProxies, with TRUSTED_PROXIES to
override for deployments whose proxies sit outside private ranges.

This also restores per-IP rate limiting, which had silently degraded to
one shared bucket per path, and returns the signal needed to spot one
person opening many accounts.

### 📚 Documentation

- Docs: remove the v1 migration guide

v2 shipped months ago and the page had gone stale: it documented the old
two-image usekaneo/api plus usekaneo/web layout, which no longer exists.

Redirects the old URL to the environment variables page, which covers
what the guide was mostly about, so existing links do not 404.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.2

## [planka-import-v0.1.1] - 2026-08-11

### 🚀 Features

- Feat(planka-import): authenticate with a PLANKA API key

PLANKA accepts a user API key only in the x-api-key header; sent as a
bearer it is rejected with a 401, so --planka-token could not be used
for one. Adds --planka-api-key (and PLANKA_API_KEY).

This matters for the accounts most likely to be migrating: an SSO-only
user has no local password to log in with, and a copied session token
expires. An API key does neither.

Verified against PLANKA 2.1.1 and 2.2.1, including a full write import
authenticated by API key alone.

### 🎨 Styling

- Style(planka-import): drop em and en dashes from prose and output

House style avoids em dashes. Replaces them in the migration guide, the
README, the CLI help and its runtime messages.

Also swaps the en dash separator in generated project names, so a PLANKA
project with several boards now yields "Project - Board" rather than
"Project - Board" with a typographic dash.

### ⚙️ Miscellaneous Tasks

- Chore(planka-import): publish 0.1.1

Ships --planka-api-key. The published 0.1.0 predates it, and the docs
already describe the flag, so npx users following them would hit an
unknown option until this lands.

## [planka-import-v0.1.0] - 2026-08-11

### 🚀 Features

- Feat(planka-import): add PLANKA to Kaneo migration CLI

PLANKA has no export feature, so migrating means reading its REST API
directly. This adds @kaneo/planka-import, which pulls boards from PLANKA
and recreates them through Kaneo's public API: lists become columns
(a closed list becomes the final column), cards become tasks, and labels,
assignees, checklists and comments come across with them.

It runs on the user's machine rather than on the server, so PLANKA
credentials never transit Kaneo and no outbound-request surface is added
to the API. A dry run reads PLANKA only and needs no Kaneo key.

Two mapping details are load-bearing:

- Kaneo seeds new projects with four default columns. They are deleted
  before any task exists, so the imported board is a 1:1 mirror rather
  than PLANKA's lists plus four unused columns.
- Labels are attached with POST /label (idempotent in both scopes) and
  never PUT /label/:id/task, which moves an existing label row and would
  silently detach it from whichever task already had it.

Archive and trash lists are skipped: they are PLANKA's paginated
"endless" lists, and their cards do not arrive with the board payload.

- Feat(site): add PLANKA comparison page

PLANKA 2.2 moved SSO into its paid Pro tier, so /planka-alternative
leads on SSO being free and on the licence difference: Kaneo is MIT,
PLANKA is source-available under its own Fair Use License.

Adds an optional migration note to ComparisonPage, rendered as prose
with an inline link rather than a CTA button, so the page keeps the
density of the rest of the site.

### 🐛 Bug Fixes

- Fix: use internal URL for MCP tool requests (#1556)

* fix: use internal URL for MCP tool requests

* test: cover configured MCP internal URL

* fix: normalize MCP API URL slashes

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: add PLANKA migration guide

Covers the dry run first, what carries over and what does not, and the
two failure modes worth naming: PLANKA answering login with 403 and
step "accept-terms", and TOTP accounts needing --planka-token.

Says to invite the team to the Kaneo workspace before importing, since
assignees are matched by email and anyone not yet a member imports
unassigned.

### ⚙️ Miscellaneous Tasks

- Ci: publish @kaneo/planka-import on version bump

Mirrors publish-mcp.yml, minus the MCP Registry step. Bumping version in
packages/planka-import/package.json on main publishes to npm with
provenance and cuts a planka-import-v<version> release.

Three details are deliberate and should not be "tidied":

- No registry-url on setup-node. It writes an .npmrc referencing
  NODE_AUTH_TOKEN, and npm only attempts the tokenless OIDC exchange
  when no auth is configured for the registry; an empty reference fails
  ENEEDAUTH before OIDC is tried.
- Node 24, because OIDC publishing needs npm >= 11.5.1.
- permissions: id-token: write, required for the OIDC exchange.

## [mcp-v0.1.11] - 2026-08-10

### ⚙️ Miscellaneous Tasks

- Chore(mcp): publish 0.1.11

  0.1.10 shipped update_time_entry describing an omitted endTime as reopening
  the entry, which stopped being true when #1554 landed.

## [2.17.1] - 2026-08-10

### 🐛 Bug Fixes

- Fix(security): block the shared address space in webhook destinations (#1523)

isDisallowedIpv4 covers 0/8, 10/8, 127/8, 169.254/16, 172.16/12 and
192.168/16, but not 100.64.0.0/10. RFC 6598 set that range aside for
carrier-grade NAT, and several hosted Kubernetes offerings put pod and
service networks in it, so on those clusters a webhook aimed at
100.64.x.x reaches the same neighbours one aimed at 10.x.x.x would, and
that one is already refused.

It applies to the DNS answers too, since assertPublicDestination runs the
same check over every address lookup returns.

- Fix(github): match a branch whose title segment is empty (#1522)

* fix(github): match a branch whose title segment is empty

slugify keeps only ASCII alphanumerics, so a task titled in any other
script leaves nothing where {title} goes and generateBranchName emits the
separator with no name after it: "Проверка входа" in project KAN as task 42
becomes "kan-42-".

createBranchRegex asked for ([a-z0-9-]+) there, so the branch this module
had just generated did not match its own pattern and extractTaskNumber
returned null. The push and pull request webhooks then never linked the
branch back to the task.

Four of the eight patterns in the integration settings carry {title}, and
the copy button in the task sidebar hands the user the same string.

Same shape as the empty project slug in #1517: the ASCII-only filter is
invisible until the input is not Latin.

- test(github): let the config type come from the spread

* Fix: preserve time entry end time (#1554)

Signed-off-by: Emre K <110906681+kocaemre@users.noreply.github.com>

- Fix(time-entry): reject a start time later than the end time

Preserving a stored endTime (#1554) means moving startTime past it now
persists a negative duration, where the old behaviour nulled both columns
instead. Reject the range like the task routes do, and drop the comment
restating the branch below it.

Also corrects the update_time_entry MCP description on both surfaces: an
omitted endTime keeps the stored one now rather than reopening the entry.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.1

## [mcp-v0.1.10] - 2026-08-10

### ⚙️ Miscellaneous Tasks

- Chore(mcp): publish 0.1.10 with the new tools

The stdio package gained the members, search, columns, task lifecycle, time
entry and activity tools, but the publish workflow only fires on changes to
packages/mcp/package.json or server.json, so npm stayed on 0.1.9 without
them. Also realigns server.json, which had drifted to 0.1.8.

## [2.17.0] - 2026-08-10

### 🚀 Features

- Feat(mcp): support stateless 2026 protocol (#1540)

Co-authored-by: theZenNana <258786929+theZenNana@users.noreply.github.com>

- Feat(mcp): expose members, search, columns, time and activity tools

An agent could not resolve an assignee user id, search, or discover which
statuses a project accepts, so it guessed at all three. Adds
list_workspace_members, search and list_project_columns, fills the task
lifecycle with delete_task, update_task_assignee and update_task_due_date,
and exposes time entries, task activity and notifications.

Mirrored into the stdio package so the parity the docs promise still holds.
The API has no delete route for time entries, so there is no
delete_time_entry tool.

### 🐛 Bug Fixes

- Fix(web): omit unassigned userId when creating tasks (#1552)
- Fix(mcp): guard media type and share the tool registrar

The v2 SDK's own docs note that a composition routing with isLegacyRequest
must check Content-Type itself, since the legacy leg inherits the SDK
transport's check but a custom modern leg has none. Reject non-JSON POSTs
with 415 before either era is dispatched.

Also collapse the duplicated registerTool adapter into toMcpToolRegistrar,
and turn an argument-schema violation into the tool error shape instead of
letting a raw ZodError escape the callback on both eras.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.17.0

## [2.16.4] - 2026-08-10

### 🐛 Bug Fixes

- Fix(auth): let invited users sign up with OAuth in invite-only mode

The user-create hook only read the invitation id from the request body,
query or x-invitation-id header. None of those survive an OAuth redirect:
the frontend folds the id into callbackURL, which better-auth only uses
after the user row is created, so DISABLE_REGISTRATION=true rejected
every invited user signing up with Google, GitHub, Discord or OIDC.
With DISABLE_PASSWORD_REGISTRATION=true they had no way in at all.

On an OAuth callback the email comes from the provider rather than the
client, and findValidInvitation already pins the invitation to that
email, so a pending invitation for it is enough. The password path is
untouched: there the email is unverified at signup time and the link
stays the only proof of invitation.

Fixes #1551

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.16.4

## [2.16.3] - 2026-08-10

### 🐛 Bug Fixes

- Fix(task): treat blank assignee id as unassigned on task creation

The assignee validation added in #1543 rejected an empty userId with a
400, but the create-task modal sends userId: "" whenever no assignee is
picked, so creating an unassigned task failed in production. Blank and
whitespace-only ids now mean unassigned; a non-empty unknown id still
returns 404.

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.16.3

## [2.16.2] - 2026-08-10

### 🐛 Bug Fixes

- Fix(web): handle unhandled promise rejection from authClient.getSession()
- Fix(web): preserve full location in auth redirect
- Fix(task): validate assignee existence on task creation
- Fix(pr): responding to AI pr reviews
- Fix(web): avoid nested buttons in alert dialog footers

AlertDialogClose renders a <button> and so does the Button child it
wrapped, which produces invalid HTML and a React 19 dev-mode hydration
warning (caught in CI). Switch the wrapped pattern to the Base UI
render={<Button ... />} prop so the two <button> elements collapse into
one. Affected dialogs across team, task, kanban, backlog, list view,
notification, nav, and workspace/project settings.

- Fix(ci): failure in ci after fix
- Fix(web): prevent TypeError when relatedTarget is not an Element
- Fix(gitea-integration): handle invalid JSON from non-Gitea URLs
- Fix(gitea-integration): structured failure response and test coverage

- Add failureReason field to verify-gitea-access so the frontend can
  pick the right toast and panel treatment. Values: null,
  'not_a_gitea_instance', 'redirected', 'repository_not_found'.
- Add GiteaApiErrorKind discriminator to GiteaApiError; controller
  now branches on error.kind instead of message substring matching.
- Update frontend toast and verification panel to dispatch on
  failureReason.
- Add 'redirected' and 'notGiteaInstance' toast keys to all 17
  locales via pnpm i18n:check:fix.
- Add verify-gitea-access.test.ts (mocks giteaFetch) covering
  success, redirect, invalid-JSON, and a discriminator-regression
  test that fails when the controller regresses to substring matching.
- Add verify-gitea-access-fetch.test.ts (stubs global.fetch) covering
  the actual giteaFetch flow: SSRF bypass, invalid JSON, redirect,
  404 handling.
- Fix(gitea): classify /user 404 as not-a-gitea-instance

Treat a 404 from the /user token-validation request as a non-Gitea-instance

signal instead of a repository lookup failure, so the user-facing toast

matches the actual cause.

Translate the untranslated English fallback values for notGiteaInstance,

redirected, and mermaid.renderFailed across 8 locales (de-DE, el-GR,

es-ES, fr-FR, hi-IN, id-ID, it-IT, ko-KR).

### 💼 Changes

- Merge pull request #1546 from usekaneo/seer/fix/gitea-invalid-json-url

fix(gitea-integration): handle invalid JSON from non-Gitea URLs

- Merge branch 'main' into seer/fix/web-related-target-closest-typeerror
- Merge pull request #1548 from usekaneo/seer/fix/web-related-target-closest-typeerror

fix(web): prevent TypeError when relatedTarget is not an Element

- Merge branch 'main' into seer/fix/task-assignee-validation
- Merge pull request #1543 from usekaneo/seer/fix/task-assignee-validation

fix(task): validate assignee existence on task creation

- Merge branch 'main' into seer/fix/auth-session-rejection
- Merge pull request #1549 from usekaneo/seer/fix/auth-session-rejection

fix(web): handle unhandled promise rejection from authClient.getSession()

### 🚜 Refactor

- Refactor(web): drop redundant throw check and explicit return annotation

Tighten the isInCodeBlockLanguagePicker helper and its test per review:

- Single assertion in the Text-node test. A thrown TypeError already fails
  the assertion, so the separate `not.toThrow()` was redundant noise.
- Drop the `: boolean` return type; the `&&` expression's inferred type
  is already `boolean`.

### 🧪 Testing

- Test: add regression test for relatedTarget TypeError in editor mouseleave

Extract the shared `instanceof Element` guard from handleEditorMouseLeave
in CommentEditor and TaskDescription into isInCodeBlockLanguagePicker and
reuse it in both. The helper is unit-tested against null, a Text node,
the picker element, a picker descendant, and an unrelated Element.

event.relatedTarget is typed as EventTarget | null and at runtime can be
a non-Element node (Text node when the pointer moves between text runs)
or null. Calling .closest() on either throws TypeError. The previous fix
added the instance check inline in both editors but had no test, so the
crash could reappear unnoticed. Verified the test fails (TypeError on
the Text node case) when the helper's instance check is removed.

- Test(task): cover whitespace-padded and whitespace-only assignee userIds

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.16.2

## [2.16.1] - 2026-08-09

### 🐛 Bug Fixes

- Fix: strip quoted runtime placeholders
- Fix: address placeholder cleanup reviews

### 💼 Changes

- Merge pull request #1528 from usekaneo/dependabot/github_actions/actions/checkout-7.0.1

ci(deps): bump actions/checkout from 6.0.2 to 7.0.1

- Merge pull request #1545 from usekaneo/agent/fix-turnstile-placeholder-quotes

fix: strip quoted runtime placeholders

### ⚙️ Miscellaneous Tasks

- Ci(deps): bump actions/checkout from 6.0.2 to 7.0.1

Bumps [actions/checkout](https://github.com/actions/checkout) from 6.0.2 to 7.0.1.

- [Release notes](https://github.com/actions/checkout/releases)
- [Commits](https://github.com/actions/checkout/compare/v6.0.2...v7.0.1)

---

updated-dependencies:

- dependency-name: actions/checkout
  dependency-version: 7.0.1
  dependency-type: direct:production
  update-type: version-update:semver-major
  ...

Signed-off-by: dependabot[bot] <support@github.com>

- Chore(release): v2.16.1

## [2.16.0] - 2026-08-09

### 🚀 Features

- Feat(projects): add drag-and-drop project reordering

Add a position column to the project table with a backfill migration, a
PUT /project/reorder endpoint that validates workspace ownership of the
whole batch before writing, and drag-and-drop reordering in the sidebar
nav and the workspace overview. New projects are appended at the end and
project lists are ordered by position.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GpXHsRFbNby8ayRbwZt3pc

- Feat(web): add Mermaid diagram preview support

Add Mermaid as a supported code block language in task descriptions and comments.
Render Mermaid diagrams inline with theme-aware previews and localized language labels.
Update local compose environment overrides for API and database connectivity.

- Feat(web): improve Mermaid diagram rendering and error handling

Sanitize SVG output, add localized error messages, refactor debounce with cancellation.

- Feat(web): localize Mermaid rendering errors

Add Mermaid render error translations for all supported languages.
Use configurable i18n keys in Mermaid error handling.

- Feat: refactor settings layout to use Sheet component and improve mobile responsiveness

### 🐛 Bug Fixes

- Fix(projects): address reorder review findings

Derive project positions server-side instead of persisting client-supplied
values. The payload now only expresses a relative order; the controller
renumbers the workspace to 0..n-1, appending any projects the payload omitted.
Clients only ever see non-archived projects, so a partial payload is
legitimate and must not renumber archived ones out of the ordering.

This also closes the overflow path: a client could previously store a position
near the integer ceiling, after which createProject's max(position) + 1 would
overflow the column and break project creation for that workspace.

Serialize ordering writes per workspace with a shared advisory lock in both
createProject and reorderProjects, so concurrent creates cannot read the same
max(position) and a create cannot interleave with a renumber.

Add asc(id) as the final orderBy term, since rows sharing both a position and
a createdAt otherwise come back in an unspecified order.

Gate the reorder UI on a new updateProjects capability rather than
canManageProjects(): the API requires project:["update"] alone, so a role with
update-only permission was being denied a reorder it is authorized to perform.

Wire up keyboard reordering, which did not work in either drag surface. The
KeyboardSensor lacked sortableKeyboardCoordinates, so a keyboard drag nudged a
virtual pointer by fixed pixel steps instead of moving between list positions,
and the handles lacked setActivatorNodeRef, so focus was lost after a drop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- Fix(projects): show reorder handle on touch and cover archived ordering

The drag handle was `opacity-0` until hover, but `TouchSensor` is
registered and touch devices never hover, so the affordance was
unreachable there. Keep it visible below `md` on both reorder surfaces.

Also add integration coverage for the archived-project path: clients
only ever see non-archived projects, so an archived one has to keep its
slot in the workspace ordering without being sent in the payload.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- Fix(projects): keep omitted projects at their existing rank on reorder

The controller documented that projects absent from the payload hold
their place in the workspace ordering, but `[...requestedOrder,
...remaining]` appended them instead. An archived project sitting
between two visible ones sank to the bottom the first time anyone
dragged a visible project, and resurfaced there on unarchive.

Pin each omitted project to the rank it already holds and let the
payload fill the slots around it. The test that was meant to cover this
seeded the archived project last, where appending and pinning agree, so
move it into the middle where the two differ.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

- Fix(projects): rework project drag-and-drop interaction

The reorder shipped in #1524 had three problems in the sidebar and the
workspace overview.

The dragged row was transformed in place inside `SidebarContent`, which is
`overflow-auto`, so it was clipped at the container edges and slid under the
group label and "Add project". It now renders through a `DragOverlay`
portalled to the body, with the drag pinned to the vertical axis and to the
sidebar's scroll bounds. The overview table gains the same axis constraint
plus a parent bound, so a row dragged past the last one no longer keeps
translating and growing the page.

The grip handle is gone and the whole row is the drag source. `MouseSensor`
only claims the gesture after 8px of travel, so a click still navigates, and
the dropdown trigger stops the press from reaching the row. This drops
keyboard reordering, which the handle existed to provide; restoring it needs
an activator that is visible on focus rather than always.

The order also flashed back to its pre-drag arrangement on drop. dnd-kit
clears its transforms with a setState in the pointer-up handler, so that
commit lands immediately, while a query-cache write notifies subscribers a
task later through TanStack's scheduler. That left one frame with the
transforms gone and the rows not yet moved. The overview now holds the
dropped order in React state set in the same handler, and the mutation hook
writes the cache synchronously rather than from `onMutate`, carrying the
rollback snapshot in its variables instead.

Motion is reviewed against Emil Kowalski's animation rules: the sortable
transition uses the app's `--ease-out` rather than dnd-kit's default `ease`,
and is neutralized under `prefers-reduced-motion` where nothing previously
covered it. The cursor stays a pointer at rest and becomes `grabbing` only
once a drag is live.

Co-authored-by: rdlugs <rdlugs@users.noreply.github.com>

- Fix(web): stop the mermaid render cache evicting diagrams still on screen

The cache is capped at 20 entries and evicted oldest-first, while every
settled render dispatches a refresh that re-runs getDecorations and re-wants
anything missing. A document with more diagrams than the cap therefore
evicted entries the same pass still needed, and never settled: 21 diagrams
looped indefinitely at one full render each per 250ms debounce.

Eviction now skips keys the current pass is showing, so the cap acts as a
floor and the cache grows to fit the working set, then shrinks again once a
smaller document replaces it.

The cache is module global, so the cap was shared across the task description
and every comment editor mounted at once, which brought the threshold well
below 20 diagrams in one place.

- Fix(web): use column isFinal for due-date badges on public views

The completion helper takes columns and falls back to matching the done or
archived slug when it has none. The public project views and the marketing
site's views were calling it without any, so a project whose final column is
named something else kept warning about due dates on finished tasks, which is
the same bug the authenticated board already had fixed.

The card, row and site card now accept the flag from the view that holds the
column, and the detail modal takes the column list so it can resolve the task
by slug. Surfaces without column data keep the existing fallback.

- Fix: polish mobile settings layout

- prevent sidebar overflow
- guard workspace navigation
- close the sidebar when resizing
- clean up component types and naming
- Fix(web): make settings rows responsive and align their typography

Every label and control pair in settings was laid out with flex items-center
justify-between at all widths, against a fixed-width input or select. Below
the sm breakpoint that crushed the label column, to the point where the
transfer ownership hint wrapped one word per line and the public project URL
field was cut off mid-placeholder. The pairs now stack under sm and keep the
side-by-side layout above it, and their controls go full width. List rows,
card headers and switch rows are left horizontal, since a compact control
beside its label reads fine at any width.

The import and export buttons were reimplementing the outline variant by
hand, with bg-card rather than bg-popover, hover:bg-accent rather than
hover:bg-accent/50, and none of the shadow, inner highlight or dark mode
treatment the variant carries. Their icons hardcoded h-4 w-4, which fought
the responsive sizing the button base already applies. They now use the
variant.

Settings navigation used an off-scale text-[11px] that the design system has
no step for, so mobile put 11px items directly under the 14px back to
workspace button in the new sheet. Items are now text-sm, matching both that
button and the project list in the main sidebar, and the group labels and
workspace meta drop to text-xs, which is what SidebarGroupLabel defaults to.

### 💼 Changes

- Merge pull request #1524 from rdlugs/feat/reorder-projects

feat(projects): add drag-and-drop project reordering

- Merge branch 'main' into feat/mermaid-support
- Merge pull request #1453 from Sol1de/feat/mermaid-support

feat(web): add Mermaid diagram preview support

- Merge pull request #1492 from Navdeepannu/fix/1446-mobile-settings-layout

fix(web): make settings navigation responsive on mobile

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: add Emil Kowalski's design engineering skills

Nine skills covering animation construction, review, and Apple-style
interaction design, installed via `npx skills add emilkowalski/skill`.
Tracked the same way as the existing coss skill: sources under
.agents/skills with symlinks from .claude/skills and skills/.

skills-lock.json is reformatted to tabs; the installer writes it with
spaces, which biome rejects.

- Chore(release): v2.16.0

## [2.15.0] - 2026-08-08

### 🚀 Features

- Feat(billing): reconcile drifted seat counts hourly

syncWorkspaceSeats gives up silently when the provider call fails: the
local seat count is left untouched and the only caller is fire-and-forget,
so a workspace can stay billed for the wrong number of seats indefinitely,
undercharging when members join and overcharging when they leave.

An hourly job now reconciles from the source of truth instead of retrying
the failed call: it selects team workspaces on an active or trialing
subscription whose stored seat count disagrees with their membership and
re-syncs them, batched at 100 per run and isolated per workspace so one
provider failure does not abort the rest.

### 🐛 Bug Fixes

- Fix(billing): keep failed webhooks replayable and preserve subscription dates

The idempotency claim was committed before the event was applied, so a
failure mid-apply left the claim behind and the provider's retry was then
dismissed as a duplicate. A lost subscription.active locks out a customer
who has paid; a lost subscription.canceled keeps serving one who has not.
The claim and the work it guards now share a transaction.

currentPeriodEnd and canceledAt were also assigned unconditionally, so any
event that omitted them overwrote the stored values with null. They are now
written only when the payload carries them, with an explicit null still
clearing the field.

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.15.0

## [2.14.0] - 2026-08-07

### 🚀 Features

- Feat(i18n): add Brazilian Portuguese (pt-BR) locale

Add full pt-BR UI translations and register the locale so it appears
in Settings → Preferences language picker for Brazilian Portuguese users.

Co-authored-by: Cursor <cursoragent@cursor.com>

### 🐛 Bug Fixes

- Fix(helm): set postgresql Deployment update strategy to Recreate

The bundled postgresql Deployment used the default RollingUpdate
strategy with replicas: 1 and a single shared PVC. On image tag bumps
the new pod started before the old one terminated, briefly running two
postmasters against the same PGDATA — a known data-corruption path.

Force Recreate so the old pod is terminated before the new one starts.
Closes #1508.

- Fix(i18n): use pt-BR copy for workspace invitation emails

Wire Brazilian Portuguese into the invitation email copy resolver so
users with locale pt-BR receive Portuguese subjects and body strings
instead of falling back to English.

Co-authored-by: Cursor <cursoragent@cursor.com>

- Fix(i18n): complete translations for all locales

Fill every missing key across the 15 non-English locales (2,500+
strings), translate the untranslated English leftovers, and add the 32
keys that only existed as inline defaultValue in components (ownership
transfer, table editor commands, instance setup) to en-US and all
locales. ru-RU and uk-UA get proper \_few/\_many plural forms for the new
count keys. Also fix a broken {{identificador}} placeholder in es-ES
that never interpolated.

### 💼 Changes

- Merge pull request #1515 from randoneering/fix/chart_postgres_recreate

fix(helm): set postgresql Deployment update strategy to Recreate

- Merge branch 'main' into feat/i18n-add-brazilian-portuguese-locale
- Merge pull request #1506 from OFFsaber/feat/i18n-add-brazilian-portuguese-locale

feat(i18n): add Brazilian Portuguese (pt-BR) locale

### ⚙️ Miscellaneous Tasks

- Chore: Add Contributor Covenant Code of Conduct
- Chore(release): v2.14.0

## [2.13.2] - 2026-08-07

### 🚀 Features

- Feat(api): tag Sentry events with the app release

Read the monorepo root package.json version (with SENTRY_RELEASE as an
override) so API errors and traces are attributed to a release like the
web SDK already does.

### ⚙️ Miscellaneous Tasks

- Chore: trim comments in Sentry instrumentation
- Chore(release): v2.13.2

## [2.13.1] - 2026-08-07

### 🚀 Features

- Feat: add web Sentry SDK with session replay and opt-in API tracing

Web: @sentry/react initialized behind the KANEO_SENTRY_DSN runtime
placeholder (same env.sh mechanism as the Turnstile site key), with
browser tracing, session replay, and release tagging. Self-hosted
instances get no telemetry unless they set the DSN.

API: SENTRY_TRACES_SAMPLE_RATE enables performance tracing on the
existing Sentry init; defaults to 0 so behavior is unchanged.

### 🐛 Bug Fixes

- Fix(web): correct link to the API reference in the nav menu
- Fix(deps): patch 16 disclosed advisories through the overrides

Raises the pinned floors for seroval (critical: fromJSON type confusion),
brace-expansion, engine.io, postcss, sharp, socket.io-parser, undici and
valibot to their first patched releases. All are transitive, so the
overrides block is where they get fixed.

- Fix(web): stop warning about due dates on completed tasks

Overdue and due-soon badges kept their red and amber styling after a
task was finished, so a done task still read as late. Completion now
comes from the task's column isFinal flag, which is what the rest of the
app and the reminder scheduler use, rather than a hardcoded status
slug, so it holds for projects whose final column is not called done.

Applied across every surface that renders the badge: the board card,
list and backlog rows, the task sidebar, the public project views and
the marketing site's project views. Surfaces without column data fall
back to matching done or archived.

Closes #1465

- Fix(deps): drop the next override so the site really gets next 16

The override pinned next to an exact version, so bumping the site's
package.json to 16.2.12 resolved back to 15.5.21 and the build kept
running on 15. apps/site is the only consumer and pins next exactly,
so the override has nothing left to enforce.

next 16 sets jsx to react-jsx and reads .next/dev/types, both of which
it writes into the tsconfig on first build.

- Fix(web): use Shiki's JavaScript regex engine to avoid WebAssembly

Chrome enterprise policies that disable the JIT (e.g.
JavaScriptJitDisabled) also disable WebAssembly, so Shiki's default
oniguruma engine fails to initialize and the full-page task view,
which waits on the highlighter before rendering, shows loading
skeletons forever. The JavaScript regex engine already ships in the
shiki package and doesn't require WASM; forgiving: true degrades an
untranslatable grammar pattern instead of throwing.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

- Fix(deps): sync lockfile with the babel override

pnpm add wrote the raw ^7.29.7 specifier for apps/web's
@babel/core while the pnpm-workspace.yaml override maps it to

> =7.29.6 <8, so pnpm install --frozen-lockfile failed in CI
> with an outdated-lockfile error. Regenerated so the importer
> records the override-effective range.

- Fix(mcp): cap pending OAuth authorization requests

The in-memory store bounded pending consent requests at 10,000
but the move to Postgres dropped the cap, leaving the authorize
endpoint able to grow the state table without limit before any
session check. Restore the bound by evicting the oldest-expiring
rows at create time, as flagged by PR #1493.

Co-authored-by: Oxygen56 <100782273+Oxygen56@users.noreply.github.com>

### 💼 Changes

- Merge branch 'main' into fix/link-api-reference-nav
- Merge pull request #1510 from SegoCode/fix/link-api-reference-nav

fix(web): correct link to the API reference in the nav menu

- Merge pull request #1504 from jlui17/fix/shiki-js-regex-engine

fix(web): use Shiki's JavaScript regex engine to avoid WebAssembly

- Merge pull request #1513 from usekaneo/chore/typescript-7

chore: upgrade to typescript 7 and next 16

### 📚 Documentation

- Docs: unwrap hard-wrapped prose

The docs in this repo keep a paragraph on one line; these were wrapped
at 80 columns, which also made them awkward to copy out of.

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🧪 Testing

- Test(mcp): port cross-replica flow test from #1493

Port the integration test from PR #1493, which verifies the
exact multi-replica scenario of issue #1484 against a real
database: a client registered by one replica is visible to
another, consent requests are consumed exactly once across
replicas, and an auth code minted on one replica is exchanged
and burned on a third with a real S256 PKCE verifier.

Adapted to the merged single-table store, whose lookups resolve
null rather than undefined, and added mcp_oauth_state to the
integration TRUNCATE list so OAuth rows reset between tests.

### ⚙️ Miscellaneous Tasks

- Chore: upgrade to typescript 7 and next 16.3

Move every workspace to typescript 7.0.2 (native compiler) and
apps/site from next 16.2.12 to 16.3.0. Next runs build-time
typechecking through the TypeScript JS API that 7.x no longer
ships; 16.3.0 is the first release that both shells out to the
project-local tsc CLI by default and detects typescript@7
correctly (16.2.x misdetects it as missing).

Config migrations forced by TS7:

- replace removed moduleResolution node10: permissions and libs
  move to bundler, email to nodenext with an explicit rootDir
  (TS7 no longer infers it; emit would land in dist/src and
  break the package exports)
- drop the removed baseUrl option from web and site tsconfigs
- pin typescript in packages/email, which previously resolved
  the root hoisted copy transitively
- add site globals.d.ts so the globals.css side-effect import
  typechecks under TS7, and untrack the generated next-env.d.ts

Behavior fix: the @vitejs/plugin-react 6 bump dropped the babel
option, silently disabling the React Compiler for web. Restore
it via @rolldown/plugin-babel with reactCompilerPreset, and
verify compiled output via the memo_cache_sentinel marker in
the production bundle.

Type fixes and enforcement:

- narrow Redis | Cluster unions at event call sites; TS cannot
  dispatch calls on a union of overload sets, which broke the
  typecheck of api sources through packages/libs
- extend web typecheck to cover tsconfig.node.json and add a
  libs typecheck script so turbo typecheck (already in CI)
  guards both

Verified: turbo build 6/6 with cache bypassed, pnpm typecheck
green, 0 tsc errors in every workspace, 9/9 turbo test tasks
pass, biome ci clean. Known caveat: TS7 tsserver cannot load
the next language-service plugin until 7.1, so editor hints in
apps/site are degraded.

- Ci: allow manual dispatch of the ci workflow

Push-triggered runs are currently not being created for pushes
from this account (GitHub receives the events but Actions spawns
no check suite), so CI needs a manual trigger as a workaround
until that is resolved.

- Chore: cache the site build output in turbo

The build task only declares dist/\*\* as outputs while the site
emits .next/ and out/, so turbo warned on every build and never
cached the site. Declare them in a package-specific override,
excluding the .next/cache directory.

- Chore(release): v2.13.1

## [mcp-v0.1.9] - 2026-08-05

### 🐛 Bug Fixes

- Fix(mcp): correct the docs URL in package metadata

The homepage pointed at docs.kaneo.app, which does not resolve; the docs
are served at kaneo.app/docs. It shipped that way in 0.1.7 and 0.1.8, so
this bumps the version to correct the link on the npm package page.

### 📚 Documentation

- Docs: make the Kaneo docs the source of truth for drim

drim's README, MIGRATION.md and INSTALL_SCRIPT.md each documented part of
the CLI and drifted from each other. The drim page now covers every
command including the flags added since, and a new migration page covers
both moving an existing deployment onto drim and updating an older
two-image deployment to the single container, which drim upgrade does not
do on its own.

Also adds github-actions to dependabot with a ci(deps) prefix, matching
the npm entry.

## [2.13.0] - 2026-08-05

### 🚀 Features

- Feat(web): pick a project in the create-task modal when none is in scope

Quick-create (T then C or the command palette) is registered globally,
but the modal could only resolve a project from the route or the last
visited project, so it silently failed on views without project
context. When no explicit context exists the modal now shows a project
picker seeded with the last visited project, making quick-create work
from anywhere.

Fixes #1418

### 🐛 Bug Fixes

- Fix(web): show language names without region in the locale picker

Every supported locale is one per language, so the region suffix added
no information and rendered CLDR's country naming (e.g. the North
Macedonia form) that we do not want in the UI. Labels are now plain
endonyms: English, Deutsch, македонски.

- Fix(gitea): record the external link before publishing task.created

The webhook published task.created before creating the external link,
and the Gitea plugin's own task.created handler uses link existence as
its only self-origination guard, so it re-created its own webhook's
task as a duplicate Gitea issue. Linking first closes the loop.

Fixes #1393

- Fix(github): comment the task link on issues created from Kaneo

GitHub-originated issues get a task-link comment but Kaneo-originated
issues only carried the body footer, with no clickable way back. Both
directions now post the same link comment, gated by the existing
commentTaskLinkOnGitHubIssue setting.

Fixes #1406

- Fix(mcp): store OAuth state in Postgres so multiple replicas work

Registered clients, authorization requests, and auth codes lived in
per-process Maps, so any multi-replica deployment without session
affinity failed with invalid_client as soon as a request hit a
different replica. State now lives in a shared mcp_oauth_state table:
codes and requests are consumed with a single DELETE ... RETURNING so
they stay single-use across replicas, expired rows are ignored on read
and swept opportunistically, and dynamically registered clients get a
30-day TTL to bound growth from the unauthenticated registration
endpoint (they re-register transparently on invalid_client).

Fixes #1484

- Fix(api): stop returning integration secrets from the external-link route

GET /api/external-link/task/:taskId loaded links with the whole
integration row attached, and integration.config is plaintext JSON that
holds the Gitea accessToken and webhookSecret. The route is gated on
workspace membership alone, so any member down to viewer could read
them, defeating both the masking in the dedicated integration getter
and the HMAC on inbound Gitea webhooks. Only id and type are selected
now, which is all the UI reads.

Reported privately by Aeon Security.

- Fix(api): block SSRF through the Gitea integration endpoints

POST /gitea-integration/repositories and /verify took baseUrl straight
from the body and drove a bare fetch with no destination check and no
workspace authorization, so any authenticated account could aim the
server at internal addresses. /repositories reflects the upstream JSON
array back to the caller, and a trailing # let the caller control the
whole path, so this read internal endpoints rather than only probing
them.

Both routes now require manage_settings on the project's workspace, and
the destination guard that already protected generic webhooks moved to
a shared util and runs inside giteaFetch, which is the single choke
point for every Gitea call. Redirects are no longer followed, and
baseUrl must be a plain http(s) origin with no query, fragment, or
credentials.

The extracted guard also fixes two holes that affected the existing
webhook callers: bracketed IPv6 literals (http://[::1]) bypassed the
address check entirely because net.isIP rejects the brackets, and
IPv4-mapped IPv6 (::ffff:127.0.0.1) was never unwrapped.

Reported privately by Aeon Security.

- Fix(web): reject non-http URLs in attachment and issue-link nodes

Both nodes rendered node.attrs.url straight into href with no scheme
check, so a javascript: URL written as raw HTML into a description or
comment survived the markdown round-trip into the document. React 19
neutralises it at the DOM layer today, so this was not exploitable, but
the guard belongs in our code: EmbedBlock renders its anchor through
ProseMirror's serializer where React never sees it, and moving either
node to that path would have made it live.

The shared isValidUrl and escapeHtml helpers now live next to the
extensions, and the serializers escape interpolated attributes so a
quote in a filename can no longer break out of the attribute and inject
sibling nodes on round-trip.

Reported privately by Aeon Security.

- Fix(mcp): bind streamable sessions to the user that created them

The session map was keyed by a caller-supplied mcp-session-id with no
owner recorded, and the transport replays the creator's token, so any
authenticated caller holding a leaked session id acted fully as its
owner. Sessions now store the creator's userId and a mismatch answers
404 rather than 403, so the response cannot confirm that someone else's
session id exists.

Reported privately by Aeon Security.

- Fix(api): reject traversal in finalized task image keys

The finalize handler only checked that the object key started with the
caller's prefix, so a key carrying ../ segments passed while pointing
outside it. Real S3 treats keys as opaque strings, but gateways that
normalize paths would have resolved them, and the row is stamped with
the caller's own workspace. The suffix is now constrained to the
charset the key generator actually produces.

Reported privately by Aeon Security.

- Fix(api): stop reflecting arbitrary origins in production

With neither CORS_ORIGINS nor KANEO_CLIENT_URL set, the origin callback
reflected the caller's origin alongside credentials: true, which lets
any site read authenticated responses. Reflection is now a development
convenience only; production refuses cross-origin requests when nothing
is configured and logs what to set.

Same-origin deployments are unaffected, which covers the bundled image,
the Helm chart and drim, since all of them serve the web app and the
API from one origin. .env.sample now ships KANEO_CLIENT_URL uncommented
and documents CORS_ORIGINS so a copied sample is allowlisted rather
than reflecting.

Reported privately by Aeon Security.

### 📚 Documentation

- Docs: add a security policy

Vulnerabilities had no documented private channel, so the last reporter
had to find an email address and ask whether to refile elsewhere. This
points at GitHub's private vulnerability reporting, sets response
expectations, and states what is in scope.

### ⚡️ Performance

- Perf(web): render list and backlog rows from the task payload

The board stopped issuing per-card label and external-link requests in
#1475, but the list and backlog rows still fetched both per row, so a
100-task project kept paying ~200 requests on those views. Both rows
now read task.labels and task.externalLinks from the tasks endpoint,
which already returns them, and the now-unused TaskCardLabels wrapper
is gone.

Refs #1422

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.13.0

## [2.12.2] - 2026-08-04

### 🐛 Bug Fixes

- Fix(deps): align the better-auth override with 1.6.25

The npm-minor group bumps the @better-auth satellites to 1.6.25 while
the workspace override still pinned core to 1.6.23; the mixed versions
made every plugin fail typecheck. Aligning the override restores a
single 1.6.25 resolution across the workspace.

### 💼 Changes

- Merge pull request #1489 from usekaneo/dependabot/npm_and_yarn/npm-minor-d30931cbc9

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Ci: refresh sponsors daily and deploy the site after updates

Weekly Sunday runs left new sponsors invisible for up to a week, and
the bot's GITHUB_TOKEN push never triggered deploy-site.yml, so the
site stayed stale even after updates. The job now runs daily and
dispatches the site deploy explicitly when it pushes changes.

- Chore(release): v2.12.2

## [mcp-v0.1.8] - 2026-08-04

### 🚀 Features

- Feat(mcp): publish to the official MCP Registry

Adds server.json and the mcpName verification field, and extends the
publish workflow to push each release to registry.modelcontextprotocol.io
via GitHub Actions OIDC after the npm publish. Bumps to 0.1.8 so the
npm tarball carries mcpName for the registry's ownership check.

### 🐛 Bug Fixes

- Fix(ci): registry description limit and idempotent MCP Registry publish

The registry caps description at 100 chars, and the registry step now
checks the registry itself instead of piggybacking on the npm guard, so
a re-run can publish a version npm already has. server.json changes also
trigger the workflow.

## [mcp-v0.1.7] - 2026-08-04

### ⚙️ Miscellaneous Tasks

- Chore(mcp): publish 0.1.7 with official npm metadata

Marks @kaneo/mcp as the official Kaneo MCP server for discoverability:
richer description and keywords, author, docs homepage, an MCP section
in the repo README, and explicit npm links from the package README and
the docs MCP page (retitled Kaneo MCP Server).

## [mcp-v0.1.6] - 2026-08-04

### 🚀 Features

- Feat(web): add invitation link and clipboard helpers

buildInvitationLink derives the accept URL from window.location.origin
rather than a configured base, so the link always matches the URL the
admin is actually reaching the app through.

copyToClipboard falls back to an off-screen textarea plus
document.execCommand when navigator.clipboard is unavailable. That API
only exists in secure contexts, so a self-hosted instance served over
plain HTTP has no other way to copy.
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

- Feat(web): surface the workspace invitation link in the UI

Creating an invitation now keeps the modal open on the link instead of
closing, and each pending invitation row gains a menu to copy it later.
Without this, an instance with no SMTP configured creates invitations it
cannot deliver.
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

- Feat(i18n): add Vietnamese (vi-VN) locale

Adds a full Vietnamese translation of the web app (i18n/vi-VN.json,
registered in i18n/resources.ts) and extends the transactional email
templates (magic link, OTP, notification, password reset, workspace
invitation) with Vietnamese copy alongside the existing locales.

- Feat: add Hindi (hi-IN) locale translation

Add complete Hindi translation covering all major UI sections:

- Common UI elements (actions, modals, errors, pagination)
- Authentication (sign in, sign up, OTP, invitations, onboarding)
- Settings (account, preferences, notifications, developer, API keys)
- Navigation (command palette, sidebar, search, keyboard shortcuts)
- Notifications and activity feed
- Tasks (status, priority, CRUD, relations, subtasks, bulk actions)
- Workspace and team management
- Public project view

Also registers hi-IN in resources.ts (import, supportedLocales, resources map).

- Feat: add zh-CN locale
- Feat(i18n): add Italian (it-IT) translation

Add Italian language support to the i18n system.

- Added i18n/it-IT.json (1,598 translated strings)

- Registered it-IT in supportedLocales and resources map

- Added 'italian' label to en-US.json language names

### 🐛 Bug Fixes

- Fix: resolve workspace access from the id the handler acts on

`workspaceAccessMiddleware`'s `lookup` sources resolved the resource id as
`param || query || body`. Three routes declare the id in the JSON body and have
no matching path param — `POST /api/activity/comment`, `POST /api/activity/create`
and `POST /api/time-entry` — so a query-string value took priority over the body
value the handler then acted on.

That let a caller authorize against a task they can access while writing to a
different one:

    POST /api/activity/comment?taskId=<task I can access>
    {"taskId": "<task in a workspace I am not a member of>", "comment": "..."}

The middleware resolved the workspace from the query id and passed
`validateWorkspaceAccess` / `requireWorkspacePermission`, while `createComment`
inserted against the body id, published `comment.created` to the other
workspace's WebSocket subscribers and notified its assignee. None of the three
controllers re-checks the workspace.

Drop the query string as a lookup-id source so the id used to authorize is
always the id the handler reads. No `workspaceAccess.*` call site sources a
lookup id from the query string, so no working route changes; the `query`
fallback sources in `fromTask`/`fromTaskId`/`fromLabel` resolve a workspace id
rather than a resource id and are untouched.

Adds a unit test covering all three lookup source orderings.

- Fix: serve public-project assets to anonymous callers

`GET /api/asset/:id` called `resolveAssetBearerOrCookie` before consulting
`asset.isPublic`:

    const { userId, apiKeyId } = await resolveAssetBearerOrCookie(c);

    if (userId) {
      await validateWorkspaceAccess(userId, asset.workspaceId, apiKeyId);
    } else if (!asset.isPublic) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

That resolver is declared `Promise<{ userId: string; apiKeyId?: string }>` and
throws on every unauthenticated path (malformed bearer, bad api key, bad
bearer, no session). It never returns a falsy `userId`, so the `else if` branch
was unreachable and anonymous callers were rejected before `isPublic` was ever
read.

The route declares `security: []` and varies its cache header on `isPublic`, so
public assets are meant to be readable by anyone. In practice every image
embedded in a task description 404-rendered as a broken image on a public
project share page: anonymous viewers got 401, and signed-in non-members got
403 from `validateWorkspaceAccess`.

Skip the credential check entirely for assets of a public project, and keep the
exact authenticate-then-authorize pair for everything else.

The policy moves into `utils/authorize-asset-access.ts` so it can be unit
tested — the route itself lives inside `createApp()`, which only the
PostgreSQL-backed integration suite can exercise.

- Fix: enforce bulk task permissions
- Fix: fail closed for mixed-workspace bulk tasks
- Fix: preserve bulk task validation responses
- Fix: CVE-2026-69192 security vulnerability

Automated dependency upgrade by OrbisAI Security

Signed-off-by: anupamme <mediratta@gmail.com>

- Fix: move overrides to workspace config
- Fix(deps): bump next to 15.5.21 to patch 8 disclosed advisories

Advisory: https://github.com/advisories/GHSA-p9j2-gv94-2wf4
Severity: high
Fixed in: 15.5.21

- Fix(deps): raise next override floor to 15.5.21 so the bump actually resolves

The direct bump in apps/site/package.json (15.5.18 -> 15.5.21) was shadowed by
the root pnpm.overrides floor "next": ">=15.5.18 <16.0.0 || >=16.2.6", which
still permits 15.5.18. pnpm kept resolving the vulnerable 15.5.18 and
--frozen-lockfile stayed green because the recorded importer specifier (the
override) never changed - so merging the prior diff shipped nothing.

Pin the override to 15.5.21 (the disclosed patched version, GHSA-p9j2-gv94-2wf4)
and regenerate the lockfile. next now resolves to 15.5.21 across every importer.
Lockfile churn is limited to the next family: @next/env, the nine @next/swc-\*
binaries, next core, the better-auth peer-hash (next is in its peer set), and a
semver dedup inside next's own tree (7.8.0 -> already-present 7.8.5). No
unrelated transitive drift.

- Fix(email): stop forcing SMTP auth when no credentials are set

Closes #1419

- Fix: prevent task number gaps during partial import failures

Previously, importTasks() pre-claimed ALL task numbers upfront via
claimTaskNumbers(projectId, tasksToImport.length) before inserting
tasks one-by-one. If any individual task insert failed (caught in
the try/catch), the claimed task number for that slot was permanently
wasted — creating gaps in the task numbering sequence.

For example, importing 10 tasks where 3 fail meant task numbers
jumped from N to N+10, but only 7 tasks existed. Numbers at the
failed positions were gone forever.

Fix: Wrap each task insert in its own database transaction with
claimTaskNumber() called inside the transaction. If the insert
fails, the transaction rolls back and the number is never claimed.
This ensures task numbers remain contiguous.

- Fix: persist task title activity atomically
- Fix(api): stop embedding task rows in the project list response

GET /api/project used `with: { tasks: true }` to compute three summary
numbers per project (total tasks, completion percentage, earliest due date),
then spread the loaded rows into the response via `...project`. Every task in
the workspace was fetched into memory and serialised to the client on every
call, even though the endpoint only needs aggregates.

The surrounding code suggests this was unintended: the same object explicitly
returns `archivedTasks: []`, `plannedTasks: []` and `columns: []`, so nested
collections were already being deliberately omitted here. `tasks` slipped
through the spread.

Replace the join with a grouped aggregate (count, filtered count for
done/archived, min(dueDate)). Projects with no tasks fall back to zeroed
statistics. Semantics are unchanged, including ignoring null due dates when
finding the earliest, which is what SQL min() does natively.

Measured on 10 projects / 2000 tasks, median of 5 runs:
before 946.4 KB 31.3 ms
after 3.8 KB 5.0 ms

The response is now flat with respect to task count rather than linear.

Adds tests/api-integration/project-list.test.ts covering payload shape,
statistics accuracy, empty projects, and per-project isolation. These fail
against the previous implementation.

Related: #1037 applied the same principle to the task list endpoint.

- Fix(api): scope task aggregates by workspace join instead of project ID list

Review feedback: inArray(taskTable.projectId, projectIds) expands every
project ID in the workspace into one IN predicate, so statement size grew
with project count. Join taskTable to projectTable and filter on
workspaceId (mirroring the archived filter from the project list query)
so the statement stays constant-size. Empty-project fallback unchanged.

- Fix(project): allow one-character names and keys
- Fix(web): search tasks by issue identifier
- Fix(web): guard nullable task identifiers
- Fix: keep planned subtasks in backlog
- Fix: wait for subtask status columns
- Fix: add date validation for task create/update to prevent Invalid Date in DB

The create task (POST /:projectId) and update task (PUT /:id) routes
accepted startDate and dueDate as strings, converting them via
new Date(dateString) without any validation. If a client sent a
non-parseable string like 'not-a-date', JavaScript produced an
Invalid Date object that was silently persisted to the database.

The bulk update endpoint already validated dates correctly (using
Number.isNaN(parsedDate.getTime()) at bulk-update-tasks.ts:290),
making this an inconsistency across the codebase.

Additionally, no endpoint validated that startDate <= dueDate,
allowing logically impossible date ranges (e.g. start=Sept 2026,
due=Aug 2026) that break timeline and calendar views.

Fix:

- Add utils/validate-dates.ts with validateAndParseDate() and
  validateDateRange() helpers
- Apply validation in both create and update task route handlers
- Add comprehensive unit tests proving all edge cases
- Fix: address code review feedback for date validation

- Fix empty string bypass: use !== undefined instead of truthiness check
  so that empty strings flow through validation and get rejected
- Fix misleading error message: no longer claims ISO 8601 is required,
  provides examples of valid date formats instead
- Add explicit empty string check in validateAndParseDate()
- Add whitespace-only string test case
- Fix: include labels in task export to prevent data loss on round-trip

The exportTasks() function exported task fields (title, description,
status, priority, dates, userId) but completely omitted labels.
When users export tasks and re-import them, all label assignments
were permanently lost — a silent data integrity issue.

The get-tasks.ts controller already fetches labels correctly (via
inArray query on labelTable), but the export controller did not
follow the same pattern.

Fix: Query labels for all exported tasks using the same batch
pattern as get-tasks.ts, build a taskId -> labels map, and include
the labels array in each exported task object.

- Fix(auth): let invited users without an account register

With DISABLE_REGISTRATION=true an invitee who has no account could never
complete registration. The accept-invitation page only offered a sign-in
CTA, and the OTP sign-in it led to creates the account without carrying
the invitation, so the server rejected it with "Registration is currently
disabled".

Offer a create-account CTA on the accept page that routes to /auth/sign-up
with the invitation id and email (the sign-up form already forwards the
x-invitation-id header), and keep sign-in as the secondary path for people
who already have an account. Also forward the invitation on OTP
verification so that path completes for invited newcomers too.

Route tests are co-located, so the router plugin is told to ignore them.

Fixes #1474

- Fix(web): restore ResizeObserver stub and correct invite-flow comment

The verify-otp route test stubbed ResizeObserver at module scope without
restoring it, which could leak into other test files sharing the worker and
make behaviour order-dependent. Restore it in afterAll.

The comment on handleCreateAccount claimed sign-up was the only flow
forwarding the invitation id; handleSignIn forwards it too. State the real
reason instead: sign-in cannot create an account.

- Fix(email): fix Biome formatting in password-reset template

Line length exceeded the configured print width after adding the
Vietnamese copy, which is what CI's lint job caught.

- Fix: complete all 1598 translation keys for Hindi locale

Previous version had 906/1598 keys (693 missing), causing fallback to
English for many UI sections including:

- Settings (workspace roles, labels, integrations, workflow)
- Task editor (slash commands, code languages, embeds)
- Task popovers (assignee, status, priority, dates, labels)
- Backlog, Gantt, board filters
- Invitation emails
- Pull request labels

Now has exact 1:1 parity with en-US.json (1598/1598 keys).

- Fix: translate remaining externalLinks.issue and branch keys to Hindi

Deep audit found 2 UI labels still showing English text:

- settings.externalLinks.issue: 'Issue' → 'इश्यू'
- settings.externalLinks.branch: 'Branch' → 'ब्रांच'

Other identical-to-English values were confirmed as correct:

- URL/email placeholders (technical examples)
- Brand names (Gitea, ntfy, Gotify)
- PR abbreviation (universally understood)
- Fix(api): github install and label detachment bug
- Fix(api): resolve bugs in api tests
- Fix(api): coderabbit/qodo reviews
- Fix(api): coderabbit nitpick
- Fix(tests): update label test
- Fix: apply triage follow-ups for #1461, #1464 and #1470

- board search: match task identifiers by prefix instead of substring so
  short queries do not match every numbered task via the project slug
- subtasks: restore the to-do fallback when columns have not loaded yet
  so un-completing a subtask cannot send an empty status
- tasks: validate the date on PUT /due-date/:id like create/update, and
  fix the validate-dates test import path to match sibling tests
- Fix(i18n): translate invite-flow strings and language labels across locales

Post-merge cleanup for the invitation PRs and new locales: translate the
createAccount/createAccountOrSignIn and invitation-link strings that were
merged as English placeholders in the 11 existing locales, add them plus
the chinese/italian language labels to the four new locales (vi-VN,
zh-CN, hi-IN, it-IT), drop keys removed from en-US by the validation
cleanup, rewrite the es-ES voseo strings to tuteo, and regenerate the
stale i18n schema from en-US.

- Fix: resolve all TypeScript errors across api and web

pnpm typecheck now passes with zero errors in both apps. Aligns the api
tsconfig with how the code is actually built (ESM via esbuild) and the
web tsconfig lib with the ES2022 target. Most fixes are type-level;
four were real bugs the errors pointed at:

- buildContentDisposition stripped printable ASCII v-~ from fallback
  filenames due to a malformed \u7E escape in the character class
- GET /search rejected requests without ?limit because the valibot
  default was a number entering a string pipe
- the roles accordion silently ran single-open: Base UI renamed
  openMultiple to multiple
- four auth/invitation Buttons used an unsupported asChild prop,
  rendering links inside buttons; ported to Base UI render props

### 💼 Changes

- Merge pull request #1458 from thejesh23/fix/kaneo-001

fix: resolve workspace access from the id the handler acts on

- Merge pull request #1459 from thejesh23/fix/kaneo-004

fix: serve public-project assets to anonymous callers

- Merge pull request #1462 from ShiroKSH/fix/task-rbac-permissions

fix: enforce bulk task permissions

- Merge pull request #1483 from anupamme/fix-repo-kaneo-cve-2026-69192-ip-address

fix: upgrade ip-address to 10.3.1 (CVE-2026-69192)

- Merge pull request #1456 from N1arko/agent/fix-pnpm-overrides

# Conflicts:

# package.json

- Merge pull request #1457 from aeonframework/security/bump-next-15.5.21

# Conflicts:

# package.json

- Merge pull request #1434 from eeshsaxena/fix/smtp-optional-auth

fix(email): stop forcing SMTP auth when no credentials are set

- Merge pull request #1468 from Sunil56224972/fix/import-task-number-gaps

fix: prevent task number gaps during partial import failures

- Merge pull request #1439 from IEatCodeDaily/fix/atomic-task-title-activity

fix: persist task title activity atomically

- Merge pull request #1423 from alexmakarski/fix/project-list-payload

fix(api): stop embedding task rows in the project list response

- Merge branch 'usekaneo:main' into fix/1436-project-validation
- Merge pull request #1441 from Navdeepannu/fix/1436-project-validation

fix(project): allow one-character names and keys

- Merge pull request #1475 from xianjianlf2/perf/avoid-kanban-card-requests-1422

perf(web): avoid per-task kanban metadata requests

- Merge branch 'main' into fix/board-search-task-identifiers
- Merge pull request #1461 from Rutledge/fix/board-search-task-identifiers

fix(web): search tasks by issue identifier

- Merge pull request #1464 from hydraxman/fix/planned-subtask-status

fix(web): keep planned subtasks in backlog

- Merge pull request #1470 from Sunil56224972/fix/task-date-validation

fix: add date validation for task create/update to prevent Invalid Date in DB

- Merge pull request #1469 from Sunil56224972/fix/export-missing-labels

fix: include labels in task export

- Merge pull request #1477 from josephkehan-prog/contrib/kaneo-1474-invite-signup

fix(auth): let invited users without an account register

- Merge pull request #1478 from davidescobrodr-lang/pr/copy-invitation-link

feat(web): let admins copy a workspace invitation link

- Merge pull request #1481 from namtao/feat/vietnamese-locale

feat(i18n): add Vietnamese (vi-VN) locale

- Merge pull request #1471 from Sunil56224972/feat/hindi-translation

feat: add Hindi (hi-IN) locale translation

- Merge pull request #1482 from shutter-cp/main

# Conflicts:

# i18n/resources.ts

- Merge pull request #1455 from GaSeDevAI/feat/i18n-add-italian-locale

# Conflicts:

# i18n/en-US.json

- Merge branch 'usekaneo:main' into main
- Merge branch 'usekaneo:main' into main
- Merge branch 'usekaneo:main' into main
- Merge branch 'usekaneo:main' into main
- Merge pull request #1445 from randoneering/fix/github_install_fail

# Conflicts:

# apps/web/src/routeTree.gen.ts

- Merge pull request #1487 from usekaneo/dependabot/npm_and_yarn/hono-4.12.34

chore(deps): bump hono from 4.12.31 to 4.12.34

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### ⚡️ Performance

- Perf(web): avoid per-task kanban metadata requests

### 🎨 Styling

- Style: fix biome formatting for import-tasks
- Style: fix biome formatting for validate-dates files

### 🧪 Testing

- Test: read the bound id through drizzle's dialect, not queryChunks

The middleware assertion previously walked `condition.queryChunks` to find
which id had been authorized. That field is internal to drizzle's SQL class and
can move between releases, so the test could break on an unrelated upgrade.

Render the condition with `PgDialect.sqlToQuery()` instead - the same call
drizzle's own `.toSQL()` is built on - and read the documented `params` array.

Behaviour under test is unchanged: reverting the middleware to accept a
query-string id still fails the override case.

- Test(api-integration): add isSmtpConfigured to email mock

get-settings now imports isSmtpConfigured from @kaneo/email, but the
integration email mock did not export it, so /api/config threw and the
config integration test got 500 instead of 200. Mirror the real export.

### ⚙️ Miscellaneous Tasks

- Ci: enforce typecheck and fix cold-start dev

- CI gains a typecheck job running pnpm typecheck (turbo task; tsc
  --noEmit in api and web)
- turbo dev now depends on ^build so a fresh clone can run pnpm dev
  without @kaneo/permissions and friends missing their dist output
- pre-commit sets -e explicitly so manual sh runs fail like husky does
- i18n:schema pipes its generated output through biome format, and the
  current schema.json is reformatted accordingly
- Chore: remove em dashes repo-wide and shorten Macedonia in legal copy

Rewords every em dash in site and docs copy, root docs and plans,
code comments, CLI help text, and all 16 locale files that had them,
using commas, colons, or restructured sentences per house style.
Russian and Ukrainian strings were restructured so the removal stays
grammatical. Also refers to Macedonia without the North prefix on the
privacy and terms pages.

- Ci: upgrade npm before publishing @kaneo/mcp

The publish step needs npm 11.5+ for tokenless trusted publishing via
OIDC; the runner's Node 20 ships npm 10. Compatible with NPM_TOKEN auth
as well, so either auth path works.

- Ci: run mcp publish on Node 24 for OIDC-capable npm

npm@latest (12) no longer installs on Node 20, and Node 24 ships npm 11.6
which supports trusted publishing natively, so the manual npm upgrade
step goes away.

- Ci: drop token auth remnants so npm uses trusted publishing

npm only attempts the OIDC exchange when no registry auth is configured;
the empty NODE_AUTH_TOKEN reference written by setup-node's registry-url
made every publish fail ENEEDAUTH before reaching OIDC.

## [2.12.1] - 2026-07-30

### 🚀 Features

- Feat(site): add Jira, Trello, and Linear comparison pages for SEO
- Feat: switch Cloud pricing to USD and replace Product Hunt button with Pricing

### 💼 Changes

- Merge pull request #1451 from usekaneo/feat/comparison-pages

feat(site): comparison / alternative pages for SEO

### 📚 Documentation

- Docs(site): remove em dashes from comparison copy

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.12.1

## [2.12.0] - 2026-07-30

### 🚀 Features

- Feat: deep-link pricing CTAs through signup to checkout

Pricing page gains a monthly/annual toggle; the Cloud plan CTAs now carry
the chosen plan+interval as ?checkout=<plan>-<interval> to the app sign-up.
The app captures the intent at boot (before redirects strip it) and, once
the new user lands in a billable workspace, sends them straight into Creem
checkout instead of hunting for the billing page. No-ops for founding-free,
already-subscribed, non-admin, or self-hosted cases.

### 💼 Changes

- Merge pull request #1450 from usekaneo/feat/checkout-deeplink

feat: deep-link pricing CTAs through signup to checkout

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.12.0

## [2.11.0] - 2026-07-30

### 🚀 Features

- Feat(web): add dismissible trial nudge in sidebar

### 💼 Changes

- Merge pull request #1448 from usekaneo/feat/trial-nudge

feat(web): trial nudge in sidebar

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.11.0

## [2.10.0] - 2026-07-30

### 🚀 Features

- Feat: add Saturday week-start option
- Feat(billing): add Kaneo Cloud subscriptions via Creem

Workspace-level billing for the managed Cloud service, gated behind
KANEO_CLOUD + Creem credentials so self-hosted installs are unaffected.

- workspace_billing + billing_event tables (migration 0035)
- Creem checkout, customer portal, and signature-verified webhooks
- entitlement model: founding-free, trial, and subscription states
- read-only enforcement (HTTP 402) on task/project creation when lapsed
- Team seat auto-sync on member add/remove
- billing settings page, plan picker, and portal access in the web app
- Feat(billing): polish billing settings page UI
- Feat(billing): merge Kaneo Cloud subscriptions via Creem

### 🐛 Bug Fixes

- Fix: address week-start validation and i18n feedback
- Fix: add Saturday translations for all locales
- Fix(i18n): correct Greek Saturday translation

### 💼 Changes

- Merge branch 'usekaneo:main' into feat/1414-saturday-week-start
- Merge pull request #1416 from Navdeepannu/feat/1414-saturday-week-start

feat: add Saturday week-start option

### 🧪 Testing

- Test(api): keep project task counter in sync with seeded fixtures
- Test(billing): live-verify entitlement enforcement and seat sync

- integration tests exercise the real route + middleware + DB chain:
  expired trial returns 402; active trial, founding-free, and active
  subscription return 200
- seat-sync tests verify member-count recomputation, Creem update args,
  DB persistence, and that personal/inactive plans are skipped
- register workspace_billing + billing_event in the db schema registry
  so the relational query API sees them

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.10.0

## [2.9.10] - 2026-07-28

### 🚀 Features

- Feat(site): add pricing, privacy policy, and terms pages

### 🐛 Bug Fixes

- Fix(api): allocate task numbers atomically via per-project counter
- Fix(api): return 401 instead of 500 for invalid API keys

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.10

## [2.9.9] - 2026-07-27

### 🚀 Features

- Feat(site): add homepage sponsors section with public sponsor sync

Add a Sponsors section to the landing page with a founding/current
sponsor group and a past-sponsors wall, driven by
apps/site/constants/sponsors.json. A new sync script pulls public
sponsorships from the GitHub GraphQL API, excludes private sponsors,
pins founding sponsors permanently, and records tier amounts so
current sponsors get tier-based placement. Wire the script into the
update-contributors workflow, restore the README sponsors markers the
readme action needs, and add a Sponsor link to the site footer.

- Feat(site): make founding sponsorship a badge for all early backers

Group sponsors strictly by activity (current vs past) and turn founding
into a per-sponsor badge carried by all seven early backers instead of
a separate group for one person. Active founding sponsors show the
badge as their caption; past founding sponsors carry it in their
tooltip and stay pinned on the wall permanently.

- Feat(api): add optional Sentry error tracking via SENTRY_DSN

### 🐛 Bug Fixes

- Fix(mcp): emit type declarations for the package exports entry

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Ci(mcp): publish to npm automatically on version bump
- Chore(mcp): 0.1.6
- Chore(release): v2.9.9

## [2.9.8] - 2026-07-19

### 🚀 Features

- Feat: webhook events, unicode slugs, board sort (#1408)

* fix(api): allow non-latin column names

Column slug generation stripped every non-[a-z0-9] character, so
names written entirely in Cyrillic, Arabic, Chinese, or other
scripts produced an empty slug and were rejected with a 400.

- Normalize with NFKC and keep \p{L}\p{M}\p{N} runs, so slugs
  preserve any script while Latin names slugify byte-identically
- Keep combining marks attached to their base letters (Turkish
  dotted i, Indic matras) instead of splitting words on them
- Add unit tests covering Latin, Cyrillic, CJK, Arabic,
  Devanagari, full-width folding, and the empty-slug guard

Closes #1395

Claude-Session: https://claude.ai/code/session_01UkZ21HKnpGqwN7p2tkr6CV

- feat(web): persist kanban board sort per project

Sort applied on the board reset to position/asc on every reload
while filters already survived via localStorage. Store the sort
the same way, keyed per project, so the selection is restored.

- Add use-board-sort hook mirroring the board-filter persistence
  pattern (kaneo:board-sort:<projectId>, normalize on read)
- Validate persisted values against Record-derived field maps so
  a future SortField union change fails at compile time instead
  of silently resetting saved sorts
- Cover restore, invalid-data fallback, and write-through in
  tests

Closes #1357

Claude-Session: https://claude.ai/code/session_01UkZ21HKnpGqwN7p2tkr6CV

- feat: add missing task events to generic webhook

task.deleted, task.moved, task.due_date_changed,
task.assignee_changed, and task.unassigned existed internally
but never reached plugin integrations, so webhook consumers
could not track deletions, moves, or assignee and due-date
changes.

- Add payload types and optional plugin hooks, registry
  subscriptions, and broadcast fan-out for the five events
- Deliver task.deleted from event data with a project lookup
  (the row is already gone) via a shared delivery/health helper
- Gate each event behind new opt-in config keys, exposed as
  settings toggles with fetcher types, OpenAPI schema entries,
  and labels in all twelve locales
- Enrich bulk-update payloads (old assignee, old due date,
  title) so bulk operations emit the same webhook data as
  single edits, and publish bulk task.deleted only after the
  delete succeeds
- Forward assignee changes as oldAssigneeId/newAssigneeId plus
  newAssignee display name, null-normalized for JSON stability

Closes #1396

Claude-Session: https://claude.ai/code/session_01UkZ21HKnpGqwN7p2tkr6CV

- fix(api): reject mark-only column slugs

Keeping combining marks in slugs let a name made only of marks
produce a non-empty slug and slip past the alphanumeric guard.
Require at least one letter or number in the result.

Claude-Session: https://claude.ai/code/session_01UkZ21HKnpGqwN7p2tkr6CV

- fix(web): guard board sort persistence writes

localStorage.setItem throws in private mode or on quota, which
surfaced as an uncaught error inside the write effect. Treat
persistence as best-effort by swallowing write failures.

Claude-Session: https://claude.ai/code/session_01UkZ21HKnpGqwN7p2tkr6CV

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.8

## [2.9.7] - 2026-07-18

### 🚀 Features

- Feat(web): motion and fluidity polish pass (#1407)

* feat(web): motion and fluidity polish pass

Implements the seven motion plans in plans/ from an Emil
Kowalski-style animation audit:

- strong ease-out/ease-in-out motion tokens in the Tailwind theme;
  dialog-family entrances switch from ease-in-out to ease-out;
  sidebar collapse drops linear; hand-typed curves consolidated
- transition-all eliminated app-wide, scoped to the properties that
  change; keyboard j/k focus rings and palette toggles now snap
- Cmd+K command palette, search, and bulk-actions palette open with
  no animation via a new instant prop on CommandDialogPopup
- tactile press feedback: buttons and kanban cards compress to
  0.97/0.98 scale on press
- prefers-reduced-motion support: overlay movement neutralized via a
  global gate keeping opacity fades; framer flows honor
  useReducedMotion
- fluid micro-moments: bulk toolbar rises in, list sections soften
  in beside their chevron, checkbox checks scale in, notification
  badge pops in, task-sidebar tooltips share providers, subtask rows
  use springs
- kanban cards and list rows animate enter/exit through
  AnimatePresence popLayout, initial={false}, no layout prop so
  dnd-kit drag transforms stay untouched
- removed three unused animation plugin dependencies

* fix(web): make cmd+k toggle the command palette

The shortcut handler bailed for any event fired from an input, and
the palette focuses its search input on open, so cmd+k could open
the palette but never close it. Let cmd/ctrl chords through the
editable-target guard (plain keys and shift/alt combos stay
suppressed so typing is unaffected) and flip the palette binding to
a toggle. The slash shortcut stays open-only on purpose: slash must
remain typeable inside the search field.

- feat(web): redesign notification popover

Rebuild the dropdown as a quiet menu instead of stacked cards:
borderless hover rows in a padded list, title and relative time on
one line with a single trailing unread dot, one-line clamped body,
read items dimmed. Mark all read moves to the header as a quiet text
action, the footer keeps a single clear-all action that only turns
destructive on hover, and the empty state shrinks to a small icon
with muted copy. Also normalizes the task_created title to sentence
case.

- fix(web): address motion PR review findings

* restrict the editable-target chord passthrough to cmd+k so editor
  chords like cmd+b reach TipTap again instead of toggling the
  sidebar
* reduced-motion gate now only restricts transition-property, so
  nested-dialog steady-state offsets survive and movement snaps
  instead of being zeroed
* notification dropdown header and footer actions become menu items,
  reachable by keyboard; drop the vestigial negative margin
* sidebar rail keeps its movement transition, scoped to the
  properties that change
* workspace switcher chevron transitions the rotate property that
  Tailwind v4 rotate utilities actually use
* toast titles drop to normal weight

- fix(web): notification popover hierarchy, pointer menus, header rhythm

* notification popover: action items forced below title size (the
  menu item base sm:text-sm was overriding text-xs through the sm
  variant), unread dot uses the info token instead of near-black
  primary, read-state changes ease over 150ms
* context menus anchor their top-left corner at the pointer instead
  of centering beside it
* header row aligns to one 32px rhythm: the bell uses the icon size
  variant (size sm carried sm:h-7 past the override), the avatar
  moves to 32px, the chevron stays at the end of the switcher, and
  the unread badge shrinks with a ring cutout

- fix(web): toast titles use the body sans

Base UI renders Toast.Title as a heading element, so the global
heading rule dressed it in Cal Sans Heading, which reads bold at any
weight. Pin the title to font-sans with normal tracking.

- fix(web): editable chord exception matches plain cmd+k only

Reject alt and shift so chords like cmd+shift+k stay with the editor
instead of collapsing into the palette shortcut.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.7

## [2.9.6] - 2026-07-18

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.6

## [2.9.5] - 2026-07-18

### 🚀 Features

- Feat: complete task reminders and notifications (#1399)

* feat: complete task reminders and notifications

* fix: remove local dev env

* fix: address task notification review feedback

* fix: include routing data in comment notifications

* fix(db): make renumbered migration idempotent

Dev databases that ran this branch before the renumber already have
the columns from the original 0032_public_patriot, so 0033 must
tolerate them.

- fix(scheduler): serialize reminder window bounds as UTC ISO strings

node-postgres serializes JS Date params as local time with a UTC
offset, and Postgres drops the offset when coercing the parameter to
the timestamp type used by due_date. On any server whose timezone is
not UTC the reminder window was shifted by the UTC offset, so
due-date reminders never fired. CI runners are UTC, which is why the
integration tests could not catch it.

- fix(notifications): address review findings

* skip the task-created notification when the assignee is the actor,
  matching the comment and status-change handlers
* log unexpected failures when recording a sent reminder instead of
  swallowing them
* replace the hours-only reminder lead input with a stepper number
  field plus an hours/days unit select, with an inline message when
  the value is out of range

---

Co-authored-by: Andrej <aacevski@gmail.com>

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.5

## [2.9.4] - 2026-07-17

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.4

## [2.9.3] - 2026-07-17

### 🚀 Features

- Feat(i18n): complete French translations (#1359)

Co-authored-by: Andrej <aacevski@gmail.com>

- Feat(i18n): turkish language support (#1366)

* feat(i18n): add Turkish language support

* fix(i18n): update Turkish translations for accuracy

* Update i18n/tr-TR.json

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

---

Co-authored-by: Tin Sever <mail@tin-sever.de>
Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>
Co-authored-by: Andrej <aacevski@gmail.com>

### 🐛 Bug Fixes

- Fix(auth): fall back for custom OAuth profile names (#1360)

Co-authored-by: bramvera <10722486+bramvera@users.noreply.github.com>

- Fix(email): translate French workspace invitations (#1390)

* fix(email): translate French workspace invitations

* fix(email): localize French invitation subject

* refactor(i18n): centralize invitation email copy

* test(email): clarify invitation subject cases

* fix(docker): copy i18n into combined image api build

The API now imports locale JSON from the repo-root i18n directory,
which apps/api/Dockerfile already copies. Dockerfile.kaneo builds the
API too but only copied i18n into its web-builder stage, so the
api-builder stage failed to resolve the imports.

---

Co-authored-by: Andrej <aacevski@gmail.com>

- Fix(docker): allow nginx revision rebuilds in apk pin (#1405)

Alpine removed nginx 1.28.3-r4 from its repository when it published
the r5 rebuild, which broke every docker-build. Pin with =~1.28.3 so
the upstream version stays fixed while Alpine revision bumps keep
resolving.

- Fix(web): load status options from columns query (#1404)

* fix(web): load status options from columns query

TaskStatusPopover read columns from the project store, which is only
populated by the board, backlog, and list routes. On a direct load or
refresh of the full-screen task view the store is empty, so the status
dropdown rendered zero options. Fetch columns with useGetColumns
instead, matching SubtaskStatusPopover.

Fixes #1402

- fix(web): memoize status options for stable references

* Fix: load task statuses on direct page visits (#1403)

- fix: load task statuses on direct page visits

- fix: handle task status query states

---

Co-authored-by: Andrej <aacevski@gmail.com>

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.3

## [2.9.2] - 2026-07-16

### 🚀 Features

- Feat: standardize avatar fallback initials (#1401)

* feat: standardize avatar fallback initials

* fix(web): address review findings on avatar initials

- uppercase before selecting characters so expanding characters
  (e.g. ß -> SS) cannot yield more than two initials
- normalize the fallback to two uppercase characters
- fall back to task.assigneeName in the task properties sidebar so
  avatar initials match the displayed assignee label

---

Co-authored-by: Andrej <aacevski@gmail.com>

### 🐛 Bug Fixes

- Fix(api): enforce scoped API key permissions (#1374)

* fix(api): enforce scoped API key permissions

* fix(api): preserve and validate API key scopes

- Fix(auth): enforce disabled local login (#1375)

* fix(auth): enforce disabled local login

* test(auth): cover disabled local sign-in paths

- Fix(editor): reject active embed URL schemes (#1376)

* fix(editor): reject active embed URL schemes

* fix(editor): preserve unsafe embeds as inert text

- Fix(gitea): restrict webhook secret access (#1377)

* fix(gitea): restrict webhook secret access

* fix(gitea): redact webhook secrets for members

- Fix(gitea): bind webhooks to signed integration (#1378)

* fix(gitea): bind webhooks to signed integration

* fix(gitea): scope webhook integration lookup

- Fix(mcp): require explicit OAuth consent (#1372)

* fix(mcp): require explicit OAuth consent

* fix(mcp): address OAuth review feedback

- Fix(assets): prevent active content execution (#1373)

* fix(assets): prevent active content execution

* fix(assets): align safe inline image types

- Fix(labels): enforce task workspace boundary (#1380)
- Fix(mcp): validate registered redirect URIs (#1381)

* fix(mcp): validate registered redirect URIs

* fix(mcp): harden authorization callback state

* fix(mcp): address authorization review findings

* test(mcp): cover redirect URI rejection

---

Co-authored-by: Andrej <aacevski@gmail.com>

- Fix(api): prioritize project workspace lookup (#1383)

* fix(api): prioritize project workspace lookup

* test(api): enforce strict project workspace lookup

- Fix(tasks): prevent cross-workspace moves (#1384)

* fix(tasks): prevent cross-workspace moves

* fix(tasks): require move endpoint for project changes

- Fix(tasks): prevent cross-workspace relations (#1385)

* fix(tasks): prevent cross-workspace relations

* fix(tasks): bind relations to authorized workspace

- Fix(auth): protect invitation acceptance from unverified accounts (#1386)

* fix(auth): protect invitation acceptance from unverified accounts

* fix(auth): pass invitation id to database hook

* fix(auth): pass validated invitation id on signup

- Fix(auth): require verified email for account linking (#1387)

* fix(auth): require verified email for account linking

* fix(auth): clarify verified account linking

* fix(i18n): sync account linking error

- Fix(comments): unify API and activity storage (#1389)

* fix(comments): unify API and activity storage

* fix(comments): address review feedback

- Fix(auth): restore guest sign-in access (#1391)

* fix(auth): restore guest sign-in access

* fix(auth): secure guest sign-in flow

---

Co-authored-by: Andrej <aacevski@gmail.com>

### 📚 Documentation

- Docs(security): remove public default MinIO credentials (#1382)

* docs(security): remove public default MinIO credentials

* docs(security): remove remaining default credentials

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.2

## [2.9.1] - 2026-07-15

### 🚀 Features

- Feat(i18n): add Indonesian locale
- Feat: add DISABLE_EMAIL_OTP_SIGN_IN for password sign-in with SMTP

Allow self-hosted instances to keep SMTP for invitations while using
email/password sign-in instead of verification codes when configured.

- Feat: add DISABLE_EMAIL_OTP_SIGN_IN for password sign-in with SMTP (#1319)

feat: add DISABLE_EMAIL_OTP_SIGN_IN for password sign-in with SMTP

- Feat(settings): add workspace labels management page with CRUD

Add a Labels section to the workspace settings tab allowing users to
create, edit, and delete workspace-level labels.

- Fix API delete-label controller to allow deleting workspace-level labels
- Fix useUpdateLabel hook to invalidate cache on success
- Add labels settings page with create/edit/delete dialogs
- Add Labels nav item to workspace settings sidebar
- Add i18n translation keys for workspace labels
- Add tests for useUpdateLabel cache invalidation
- Feat: Workspace Label Settings (#1344)

feat: Workspace Label Settings

### 🐛 Bug Fixes

- Fix(charts/ci): Adding dynamic versioning in helm ci
- Fix(ci): resolving concern from qodo/coderabbit
- Fix(i18n): make workspace roles settings translatable
- Fix(docker): stop nightly arm64 build hanging on native bcrypt

The api and kaneo images ran `pnpm install --prod` in their runtime
stage, which is the target platform. For linux/arm64 that runs under
QEMU emulation and compiles bcrypt (a native addon) from source, which
hangs the multi-arch build for hours. The web image is unaffected
because its runtime stage only copies static files.

Replace bcrypt with bcryptjs (pure JS, hash-compatible: existing $2b$
password hashes still verify), then move production dependency install
to a build-platform stage and copy the resulting arch-independent
node_modules into the runtime image. A build-time resolution check
fails the build early if the dependency layout is ever broken.

This removes QEMU emulation from the dependency step entirely, fixing
the nightly hang and speeding up release arm64 builds.

- Fix(board): reflect disabled card dragging
- Fix(docker): update pinned nginx package
- Fix(docs): validate local OpenAPI reference
- Fix: address OpenAPI review feedback
- Fix: propagate label color changes to existing task assignments

- Cascade label name/color updates to all task-level copies in the DB
- Invalidate per-task label caches so the board shows updated colors
- Use refetchType: 'all' to eagerly refetch even when board is unmounted
- Fix(label): cascade delete task-level label copies when workspace label is deleted

When deleting a workspace-level label, also delete all task-level copies
matching the same workspaceId and name. Previously, only the workspace
label row was deleted, leaving orphaned labels on tasks.

Also update the frontend to:

- Show a clearer delete confirmation message
- Invalidate the tasks cache after deletion so the kanban board reflects removal
- Fix: destructure columns from createProjectFixture in label tests
- Fix: replace onClose with onOpenChange in labels settings dialogs

The Create, Edit, and Delete dialogs in the workspace Labels settings page
passed onClose directly to <Dialog>/<AlertDialog>, which Base UI silently
ignores. ESC key and backdrop clicks had no effect, leaving modals stuck
open. Changed all three to onOpenChange, matching the convention used
across the rest of the codebase.

- Fix: publish label deletion events and sync to GitHub/Gitea when labels are cascaded from workspace
- Fix: reset shared invalidate spy between useUpdateLabel tests
- Fix: invalidate labels query cache on workspace-level label deletion
- Fix: guard Enter key handlers in labels dialogs with isPending state
- Fix: replace invalid vi.Mock type references with imported Mock type
- Fix: add debug logging for device authorize CI failure

Logs the response body when POST /api/auth/device/approve returns
non-200, so the exact Better Auth error code can be identified in CI.

- Fix(labels): address workspace label review
- Fix(chart): generate per-release auth secret
- Fix(chart): require explicit auth secret
- Fix(chart): provide auth secret in validation matrix
- Fix(chart): require explicit auth secret (#1379)

fix(chart): require explicit auth secret

- Fix(site): use official Product Hunt logo
- Fix(charts/ci): fixing the publishing steps for helm chart
- Fix(qodo): applying fixes recommended by qodo review
- Fix(review): further updates from code review
- Fix(helm): app version fix, guard, and trigger added
- Fix(ci): grant actions: write to trigger-helm-publish
- Fix(ci): pass inputs.version via env to github-script
- Fix(ci): use in release main-branch guard
- Fix: prevent oversized workflow column drag preview (#1394)
- Fix: clean up drag preview on component unmount
- Fix: make drag preview non-interactive
- Fix: prevent oversized workflow column drag preview (#1394)

Merge pull request #1397 from Navdeepannu/fix/1394-column-drag-preview

### 💼 Changes

- Merge branch 'usekaneo:main' into main
- Merge branch 'usekaneo:main' into main
- Merge pull request #1363 from randoneering/fix/helm_ci

fix(charts/ci): remove hardcoded chart versions and add dynamic versioning

- Merge pull request #1362 from bramvera/feat/id-ID-locale

feat(i18n): add Indonesian locale

- Merge pull request #1388 from usekaneo/fix/sorted-card-cursor

fix(board): reflect disabled card dragging

- Merge remote-tracking branch 'origin/main' into feat/disable-email-verification

# Conflicts:

# apps/docs/core/installation/environment-variables.mdx

# apps/web/src/routes/auth/sign-in.tsx

# tests/api-integration/config.test.ts

# tests/api-integration/setup.ts

- Merge branch 'usekaneo:main' into main
- Merge branch 'main' into fix/workflow_dispatch_helm
- Merge pull request #1368 from randoneering/fix/workflow_dispatch_helm

fix(ci/charts): resolve helm cart publishing in ci

- Merge pull request #1398 from randoneering/fix/chart_app_ver_bug

fix(helm): app version fix, guard, and trigger added

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs(workspace): add workspace label management docs
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🧪 Testing

- Test(label): add integration tests for label deletion cascade

Test that deleting a workspace-level label cascades to all task-level
copies, and does not affect unrelated labels.

### ⚙️ Miscellaneous Tasks

- Ci(nightly): use GH_PACKAGE_TOKEN to push GHCR images

The default GITHUB_TOKEN lacks write access to the kaneo and api GHCR
packages, causing nightly image pushes to fail with permission_denied.
Switch to GH_PACKAGE_TOKEN, matching the release workflow (docker.yml).

- Chore: rerun documentation deployment
- Chore: remove .plans directory from tracking
- Ci: adds docs container to local compose for development viewing
- Chore(release): v2.9.1

## [2.9.0] - 2026-06-30

### 🚀 Features

- Feat(comments): @mention workspace members in task comments (#1353)

Add an @-triggered autocomplete of workspace members to the comment
editor. Selecting a member inserts an inline mention node that
round-trips through Markdown as <kaneo-mention id label>, mirroring the
existing KaneoIssueLink pattern.

On comment creation the API parses mentioned user ids out of the body
and fires a task_mention notification to each mentioned member (the
author is skipped). Navigation resolves via the existing resourceId
join in get-notifications, so eventData only carries the display copy.

- web: KaneoMention node + @tiptap/suggestion-based MentionSuggestion
  extension and MentionList popup, wired into comment-editor
- api: parseMentionIds util + create-comment notification wiring
- i18n: task_mention notification strings
- Feat(tasks): notify members @mentioned in a task description (#1353)

When a task description is saved, parse mentioned user ids from the new
body and fire a task_mention notification to each. Only members newly
introduced by the edit are notified — ids already present in the prior
description are skipped, so re-saving an unchanged mention does not
re-notify, and the editing user never notifies themselves.

The @mention editor UI already works in descriptions via the shared
CommentEditor; this wires the matching backend notification.

### 🐛 Bug Fixes

- Fix(auth): link OIDC sign-in to existing same-email accounts (#987)

Custom OIDC (and the github/google/discord providers) failed with error=account_not_linked when a user signed in with an email matching an existing email/password account. Enable better-auth account linking: trust github/google/discord/custom (they verify emails) and set requireLocalEmailVerified:false, since Kaneo does not verify emails on password signup so the linkable local account is usually unverified.

Documents the tradeoff in custom-oauth.mdx: instances that allow password registration alongside OIDC should set DISABLE_PASSWORD_REGISTRATION or require email verification, so nobody can pre-register another person's email and have an OIDC login linked into it.

Fixes #987.

- Fix(auth): allow unverified users to accept workspace invitations

Better Auth's organization plugin defaults requireEmailVerificationOnInvitation
to true, which rejects accept/reject from any user whose email is not
verified with EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION.

Kaneo does not verify emails on signup, and guest/anonymous users are
unverified by design, so the default broke invitation acceptance for
every invitee (surfaced after the recent better-auth bump). Set the
option to false explicitly — the invitation link id is the secret that
gates acceptance, not email verification.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.9.0

## [2.8.0] - 2026-06-30

### 🚀 Features

- Feat(mcp): support KANEO_API_KEY for non-interactive auth

The stdio MCP server only supported the interactive device flow, which times out in headless/Docker environments. When KANEO_API_KEY is set, the server authenticates with it as a Bearer token and skips the device flow (and skips the 401 retry loop, surfacing auth errors instead of re-prompting). The REST API already accepts API keys, so no server-side change is needed. Fixes #1215.

- Feat(notifications): opt-in flag to allow private webhook destinations

Add KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS (default off) with an early return in assertPublicWebhookDestination, so self-hosters with private-network ntfy/Gotify/webhook receivers can opt out of the SSRF guard; the http/https requirement still applies. Also documents the flag and adds a DATABASE_URL format and example to the env docs. Fixes #1338. Fixes #765.

### 🐛 Bug Fixes

- Fix(api): drop malformed Better Auth schema fields from OpenAPI output

Better Auth's generateOpenAPISchema emits an invalid properties entry for the organization create-role endpoint: additionalFields comes through as { type: object, properties: { type: object } }, where the property value is the string "object" instead of a schema object. Mintlify's OpenAPI validator rejected this, failing the docs deploy with 'create-role/post/requestBody: must have required property $ref'.

Add normalizeMalformedPropertySchemas to the /openapi assembly chain, which drops any properties entry whose schema is not an object. Verified the create-role error is gone via 'mint validate'.

- Fix(auth): claim device code before approve/deny (better-auth 1.6.11)

The better-auth 1.6.11 bump (8d97cffc) split the device-authorization flow: /device/approve and /device/deny now require the signed-in user to first claim the code via GET /device, returning 400 device_code_not_claimed otherwise. This broke the device-authorization integration test (red CI on main) and the web approve/deny flow when a user signs in after landing on the verification page.

- web: claim the code (authClient.device verify) before approving or denying in device/approve.tsx
- test: add the GET /device claim step before approve

Verified: API integration suite 60/60, full monorepo build green.

- Fix(subtasks): make the leading checkbox toggle completion (#1352)

The leading checkbox on a subtask row toggled bulk-selection (local state that resets when the parent task is reopened), but in a subtask checklist it reads as a completion checkbox. Users clicked it to complete a subtask, it appeared done, then reverted on reopen — the reported bug. Real completion (the status-circle popover) persisted fine all along.

Rewire the leading checkbox to toggle the subtask done/undone and persist it, mapped to the project's final/first column slugs so the API status validation accepts it. Move bulk-selection to a hover-revealed checkbox (keyboard space-select still works) so the two controls are no longer confused.

Verified end-to-end: marking persists across close/reopen (line-through + n/n counter), unchecking reverts, and the selection checkbox no longer affects completion.

### 🚜 Refactor

- Refactor(subtasks): one checkbox per row, drop the selection checkbox

The #1352 fix left a hover-revealed bulk-selection checkbox next to the new completion checkbox, putting two checkboxes side by side, which looked cluttered. Remove the per-row selection checkbox; the leading checkbox is now solely completion. Bulk-selection stays available via the keyboard (focus the list, arrows to move, space to select) and the selected-row highlight is unchanged.

### ⚙️ Miscellaneous Tasks

- Chore(ci): bump GitHub Actions off the deprecated Node 20/16 runtimes

GitHub runners are dropping Node 20, which forces affected actions onto Node 24 with a deprecation warning. Update each to a Node 24 release:

- actions/checkout v4->v6, actions/setup-node v4->v6, pnpm/action-setup v4->v6
- Pages: configure-pages v5->v6, upload-pages-artifact v3->v5 (its internal upload-artifact moves v4->v7), deploy-pages v4->v5
- dependabot/fetch-metadata v2->v3, softprops/action-gh-release v2.6.1->v3.0.1
- azure/setup-helm pinned SHA -> v5, pozil/auto-assign-issue pinned SHA -> v4.0.1 (was Node 16)

docker/\*, oven-sh/setup-bun, actions/github-script, jaywcjlove, JamesIves already run on Node 24.

- Chore(security): bump vulnerable deps to patched versions

Clears the 21 open Dependabot alerts by forcing patched versions via pnpm overrides:

- better-auth 1.6.9 -> 1.6.11 (high)
- hono override floor >=4.12.19 -> >=4.12.25 (high/medium), resolves to 4.12.26
- undici -> >=7.28.0 <8 (high/medium/low), resolves to 7.28.0
- esbuild override 0.27.3 -> 0.28.1 (low) — the override was pinning the vulnerable version, re-introducing it after #1349
- js-yaml -> >=4.2.0 <5 (medium, dev), resolves to 4.3.0
- @babel/core -> >=7.29.6 <8 (low), resolves to 7.29.7

Each range is capped to its current major to avoid undici 8 / js-yaml 5 / babel 8 jumps. Verified: full monorepo build green, API unit tests 158/158.

- Chore(release): v2.8.0

## [2.7.8] - 2026-06-29

### 🚀 Features

- Feat: custom OAuth auto login, allow disabling the Login Form
- Feat(helm): prep for helm chart publishing
- Feat(ci): add helm chart publishing
- Feat(mcp): add task-relation and label-delete tools

The REST API already supports task relations and label deletion, but the MCP servers did not expose them. Add four tools to both MCP tool registries (apps/api/src/mcp and packages/mcp):

- create_task_relation (subtask / blocks / related)
- get_task_relations
- delete_task_relation
- delete_label

subtask direction: sourceTaskId is the parent, targetTaskId the child. Thin wrappers over the existing /api/task-relation and /api/label endpoints; no schema changes.

- Feat: support AWS IAM roles for S3 storage (#1342)
- Feat(comments): allow users to delete their own comments (#1322)

* feat(comments): add delete button for own comments

Adds a trash icon next to the existing edit pencil that appears on hover,
only visible to the comment author. Uses the existing useDeleteComment hook.
Button turns red on hover to indicate a destructive action.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- fix: pass activityId as object to deleteComment mutation

mutate(commentId) was passing a bare string but the fetcher destructures
{ activityId } from its argument, causing activityId to be undefined and
the JSON validator to return 400.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

- Feat(notifications): notification inbox with real-time WebSocket updates (#1324)

* feat: notification inbox in sidebar with unread count badge

Wire NotificationDropdown into the workspace-switcher navbar next to
the user avatar. Bell icon now shows a red numbered badge for unread
count (capped at 99+). Mark-all-read and clear-all buttons sit in the
dropdown footer. Adds task_mention to the dropdown's title/content
switch cases.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- feat: clicking a notification navigates to the task and marks it read

- fix: white text in notification dropdown for better contrast

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- fix: revert dropdown text to theme colours, white only on badge number

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- fix: notification click and navigation

Use DropdownMenuItem/onSelect so Radix UI doesn't swallow click events.
Resolve projectId + workspaceId via JOIN in getNotifications so all
notifications (including old ones without those fields in eventData) can
navigate to the correct task. Text colours stay as theme-aware variables.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- fix: use onClick not onSelect for Base UI MenuItem

onSelect is Radix UI's API — Base UI uses onClick. Clicks were silently
dropped, making notifications appear non-interactive.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- feat(notifications): real-time badge updates via user-scoped WebSocket

Replace polling with a persistent WebSocket connection per user.

- API: add user-keyed connections to ws/index.ts with addUserConnection,
  removeUserConnection, broadcastToUser helpers
- API: subscribe to notification.created event and push NOTIFICATION_CREATED
  to the recipient's open WS connections
- API: add /ws/user endpoint (authenticated, user-scoped) alongside existing
  /ws/:projectId project endpoint
- Web: add useUserWebSocket hook (mirrors useProjectWebSocket) that connects
  to /ws/user and invalidates ["notifications"] query on NOTIFICATION_CREATED
- Web: mount useUserWebSocket in WorkspaceSwitcher (always rendered when
  logged in) so the badge updates in real-time across all projects

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

- fix(ws): register /ws/user before /ws/:projectId to prevent route shadowing

Hono matches param routes greedily — /ws/:projectId was capturing the
literal path "user" before /ws/user could be reached. Move the static
route first so user-scoped WebSocket connections are handled correctly.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>
Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

### 🐛 Bug Fixes

- Fix(comment): improve comment formatting in task event publication.
- Fix: auto-login failure can leave the sign-in page permanently stuck on skeleton
- Fix: errorCallbackURL redirect loop, empty <p>, integration test
- Fix(helm): resolve agent reviews and suggestions
- Fix(helm): define KANEO_POSTGRES_PASSWORD before DATABASE_URL (#1309)

Kubernetes only substitutes $(VAR) references to env vars defined
earlier in the same container's env list. KANEO_POSTGRES_PASSWORD was
declared after DATABASE_URL, so with bundled PostgreSQL plus
postgresql.auth.existingSecret the $(KANEO_POSTGRES_PASSWORD) reference
was left as a literal and the connection string was invalid. Move the
secret-backed env var above DATABASE_URL so it resolves.

- Fix(deps): allow @hono/node-server v2 so the #1292 upgrade takes effect (#1313)

The root override pinned @hono/node-server to '>=1.19.13 <2.0.0', which
silently forced apps/api back to 1.19.x even after #1292 bumped the
manifest to ^2.0.3 — the lockfile resolved 1.19.13, so v2 was never
actually used (and #1292's CI ran against 1.x, not 2.x).

Drop the '<2.0.0' cap, keeping the '>=1.19.13' security floor. apps/api
now resolves @hono/node-server@2.0.4. @hono/node-ws@1.3.1 is peer-
compatible with v2; API build and all 151 unit tests pass locally.

- Fix(docs): updating README.md for helm chart. Replaced steps and added clear direction
- Fix(docs): resolving qodo suggestions
- Fix: add enabled guard to useGetTask
- Fix(mcp): guard delete_label against workspace labels

DELETE /api/label/:id only deletes task-associated labels; the controller
rejects labels with taskId null (workspace-level labels) with HTTP 400.
delete_label now preflights with GET /api/label/:id and returns a clear
error for workspace labels instead of a raw 400, and its description no
longer claims to remove a label across tasks. Applied to both MCP
registries, with tests.

- Fix(bug): added normalizedApiServerUrl to resolve asset url
- Fix(tests): added integration tests for fix validation
- Fix(bug): derive fallback asset URL from request origin instead of hardcoded localhost:1337
- Fix(docs): resolves bug 1346 (#1350)

* docs: update contributors and sponsors

* fix(docs): add missing vars in quick start example

* fix(docs): instructions for .env.example

---

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Fix: use custom column names in webhook status reports (#1343)

* fix: use custom column names in webhook status reports

Both the Discord and generic webhook plugins read taskTable.status
directly, which holds the default slug (e.g. 'to-do', 'in-progress').
When a project uses custom column names, this reports the wrong status.

Join with columnTable to resolve the actual column name and fall back
to the default slug when no custom column is assigned.

- fix: sanitize user-controlled content in Discord webhook messages

Column names, task titles, and other user input are now sanitized
before being sent to Discord. The sanitizer inserts zero-width
characters into mention patterns (@everyone, @here, <@user>,
<@&role>, <#channel>, custom emojis) so they render as plain text
instead of triggering Discord mentions.

- fix: scope column lookup by project in webhook queries

Add projectId constraint to the columnTable left join so a column
from a different project cannot be matched. Both Discord and generic
webhook event handlers are updated.

- fix: preserve raw status slug in webhook payloads

Discord: return both statusSlug and columnName from the query, use
columnName when available and fall back to toSentenceCase(slug).

Generic webhook: keep task.status as the raw slug for backward
compatibility and add task.statusName for the display value.

- Fix: add WebSocket keepalive pings and DB connection timeouts (#1323)

Cloudflare closes idle WebSocket connections after 100 seconds of no
traffic. This caused intermittent complete non-responsiveness: the WS
dropped silently, the app lost real-time updates, and reconnect attempts
would fail if the DB was briefly slow at that moment.

Changes:

- Client sends a JSON ping every 30s to keep Cloudflare from closing
  idle WS connections; server handler ignores the ping gracefully
- DB connection pool now has connectionTimeoutMillis (5s) and
  idleTimeoutMillis (30s) so Railway internal-network hiccups fail fast
  rather than hanging all in-flight API requests indefinitely
- useGetTask now guards with enabled: Boolean(taskId) to prevent 404
  spam when taskId is transiently empty during reconnect re-renders

Co-authored-by: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

- Fix: use LF line endings in husky commit-msg hook
- Fix(notifications): full-bleed inbox dropdown and drop duplicate query key

The inbox dropdown rendered with a left/right inset because the DropdownMenu
popup wraps children in a hardcoded p-1 gutter. Wrap the content in a -m-1
container (clipped to the popup radius) so the header, rows, dividers, and
footer render edge-to-edge.

Also remove a duplicate enabled: Boolean(taskId) key in useGetTask that the
#1324 merge introduced (the same line landed via #1323), failing Biome lint.

- Fix(docker): bump pinned nginx to 1.28.3-r4

Alpine no longer ships nginx 1.28.3-r2 (now r4), so the hard pin failed the
docker-build smoke test with 'unable to select packages'. Pin to the currently
available revision.

- Fix(github-integration): surface server error text on verify failure

The verify fetcher parsed error responses as JSON while the API sends plain text, so a failed verify showed "Unexpected token 'F'..." instead of the real message. Use response.text() to match the sibling fetchers. Fixes #1204.

- Fix(command-palette): default to planned status when creating a task from backlog

Tickets created via the keyboard shortcut on the backlog view landed in to-do because the command palette rendered the create modal without a status. Detect the /backlog route and pass status="planned". Fixes #1230.

- Fix(permissions): let members with create-only permission create tasks

The create-task UI was gated on manageTasks (create+update+delete), so a role granting only create (the default member role lacks delete) could not see it, even though the API only requires task:create. Add a create-only createTasks capability and gate the create modal and board add-task button on it. Fixes #1345.

- Fix(task-relations): distinguish "blocked by" from "blocks"

A blocks relation is directional but both tasks showed "blocks". Group the relation under a blocked_by key when the current task is the target, with a humanized fallback for untranslated locales. Fixes #1351.

- Fix(editor): add table row/column controls to the bubble menu

Inserted tables had no way to add or remove rows and columns. Add a table-scoped bubble menu (shown when the cursor is in a table) wired to Tiptap's table commands, in both the task description and comment editors. Fixes #1333.

### 💼 Changes

- Merge branch 'main' into feat/github-comment-improvement
- Merge branch 'main' into oidc
- Merge branch 'main' into oidc
- Merge pull request #1306 from randoneering/feature/helm_chart

feat(helm): publishing helm chart to GHCR

- Merge branch 'main' into oidc
- Merge branch 'main' into oidc
- Merge branch 'main' into oidc
- Merge pull request #1279 from tiran133/oidc

feat: custom OAuth auto login, allow disabling the Login Form

- Merge branch 'main' into feat/github-comment-improvement
- Merge pull request #1303 from Asynchronite/feat/github-comment-improvement

fix(comment): Improve Github comment formatting

- Merge pull request #1314 from randoneering/fix/kaneo_chart_docs

docs(charts): improve README with missing configuration and troubleshooting guidance

- Merge pull request #1320 from Petr0611/fix-useGetTask-enabled-guard

fix: add enabled guard to useGetTask

- Merge pull request #1341 from dmtrTm/feat/mcp-task-relations

feat(mcp): add task-relation and label-delete tools

- Merge branch 'usekaneo:main' into main
- Merge pull request #1332 from randoneering/fix/bug-1270

fix(bug): fix for s3 files using old api URL

- Merge pull request #1335 from usekaneo/dependabot/npm_and_yarn/nodemailer-9.0.1

chore(deps): bump nodemailer from 8.0.7 to 9.0.1

- Merge pull request #1337 from usekaneo/dependabot/npm_and_yarn/vite-7.3.5

chore(deps-dev): bump vite from 7.3.2 to 7.3.5

- Merge branch 'main' into ci/nightly-builds
- Merge pull request #1347 from usekaneo/ci/nightly-builds

ci: add nightly builds

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### 🧪 Testing

- Test(mcp): cover task-relation and label-delete tools

Add unit tests in packages/mcp for the new create/get/delete task-relation
and delete_label tools, and document them in packages/mcp/README.md and the
docs MCP integration page.

### ⚙️ Miscellaneous Tasks

- Chore(helm): bump chart to 0.4.2 (#1310)

Publishes the KANEO_POSTGRES_PASSWORD env-ordering fix (#1309). The
0.4.1 artifact in GHCR was packaged before that fix merged, so a version
bump is needed for the publish workflow to push an updated chart.

- Chore(dependabot): group non-major npm updates per package (#1311)

* chore(dependabot): group non-major npm updates per package

Batch minor and patch updates per directory into a single grouped PR
instead of one PR per dependency. This avoids the lockfile churn where
~14 separate weekly PRs each rewrite the root pnpm-lock.yaml and conflict
with each other. Major bumps still open individually for review.

- chore(dependabot): target workspace root so the lockfile is maintained

This is a pnpm workspace with a single root pnpm-lock.yaml. The previous
config pointed dependabot at each package subdirectory, which bumps the
subdir package.json but never regenerates the root lockfile, so every
dependabot PR fails 'pnpm install --frozen-lockfile' in CI (and required
manual 'regenerate pnpm-lock.yaml' PRs to clean up).

Run dependabot from '/' instead: it discovers all workspace packages and
updates the shared lockfile in the same PR. Also group non-major updates
to cut the per-dependency PR churn.

- Chore(security): override transitive deps to patched versions (#1312)

Resolves 5 open medium-severity Dependabot alerts, all transitive:

- qs >=6.15.2 (DoS in qs.stringify)
- ws >=8.20.1 (uninitialized memory disclosure)
- brace-expansion >=5.0.6 (bump from >=5.0.5, which still resolved to the
  vulnerable 5.0.5; max DoS-protection bypass)
- ip-address >=10.1.1 (XSS in Address6 HTML methods)
- postcss >=8.5.10 (XSS via unescaped </style>)

Lockfile resolves qs@6.15.2, ws@8.21.0, brace-expansion@5.0.6,
ip-address@10.2.0, postcss@8.5.11.

- Ci: add nightly builds
- Ci: harden nightly workflow
- Ci: disable checkout credential persistence
- Chore: enforce LF line endings for husky hooks via .gitattributes
- Chore(release): v2.7.8

## [2.7.7] - 2026-05-29

### 🐛 Bug Fixes

- Fix(web): empty unset KANEO\_\* placeholders so self-hosted signup works

env.sh only ran substitution when the env var was set, so leaving an
optional KANEO\_\* env var unset (per the .env.sample contract) kept the
literal placeholder string in the bundle. The frontend then read it as
truthy and gated UI behind a captcha that couldn't load.

Triggered by leaving KANEO_TURNSTILE_SITE_KEY unset on a fresh self-host
deploy: Create Account / Continue with OIDC permanently disabled on
/auth/sign-up, no console errors. Backend POST /sign-up/email worked
fine, only the UI was broken.

Fix is a single post-loop sweep that empties any remaining "KANEO\_\*"
placeholder, so the same trap doesn't catch the next runtime-substituted
flag added.

Closes #1304

- Fix(ci): build internal deps before running tests

The test task only depended on `^test`, so turbo never built dependent
packages' dist/ before running consumer tests. @kaneo/permissions only
exports ./dist/index.js, so apps/web tests that transitively import it
(via lib/permissions -> @kaneo/permissions) failed in CI with:

Failed to resolve entry for package "@kaneo/permissions"

Locally this only worked because a prior `pnpm build` had left dist/
around. Changing the dependency to `^build` makes turbo produce the
required dist/ first.

This was introduced in 75273c9a (permissions package switched to
dist-only resolution); first surfaced on the abuse-hardening CI run
when use-project-websocket.test was re-evaluated against the new
resolution path.

- Fix(ci): route test:integration through turbo so deps are built first

Same root cause as 1c69023f. Integration tests were invoked via
`pnpm --filter @kaneo/api test:integration`, bypassing turbo entirely,
so @kaneo/permissions/dist/ was never produced before the API package
tried to import it. CI failed with the same "Failed to resolve entry"
on every integration test file.

Add a `test:integration` turbo task with `^build` dependency and route
the root script through it. Only @kaneo/api defines the task, so turbo
runs it once after building dependents.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.7.7

## [2.7.6] - 2026-05-29

### 🚀 Features

- Feat(auth): cloud abuse-mitigation gates for sign-up and invites

Hardens cloud.kaneo.app against the 2026-05-28 phishing botnet that
abused free workspace invites to send ~14k scam emails through the
verified Resend domain. Cloud-only (KANEO_CLOUD=true); self-hosted
skips every gate except the workspace-name input check.

- Turnstile captcha lifted to the sign-up page so it gates SSO,
  guest, and Create Account together until verified
- Disposable-email block on /sign-up/email and on /organization/
  invite-member (incl. wildcard subdomains used by the attackers)
- Guest accounts may not send workspace invites
- Rate limits: /sign-up/email 3/min, /organization/invite-member
  5/min (Better Auth customRules)
- Workspace-name check rejects URLs, HTML, names > 100 chars
- AuthProvider keeps the tree mounted during background session
  refetches; otherwise the Turnstile iframe was torn down on
  every alt-tab and forced a re-challenge
- Auth layout scrolls when content overflows

Removes the "Continue as guest" entry-point from sign-in (sign-up
still has it). Adds VITE_TURNSTILE_SITE_KEY for dev, the
KANEO_TURNSTILE_SITE_KEY runtime placeholder for the prod web image,
and TURNSTILE_SECRET_KEY for the API.

### 🐛 Bug Fixes

- Fix(permissions): compile package to dist for prod node runtime

@kaneo/permissions exported its .ts sources directly, which works under
tsx/vite in dev but crashes the prod container with ERR_UNKNOWN_FILE_EXTENSION
because Node 20 cannot load .ts. Add a tsc build, point the package exports
at dist, exclude tests from emission, and run the build in both Docker
images before bundling the API.

- Fix(docker): build @kaneo/permissions in web stages too

The package now points exports at dist, so vite's resolution fails until
tsc has emitted. The api builds already invoke it; mirror in the web
builder of Dockerfile.kaneo and the standalone apps/web Dockerfile.

- Fix(rbac): chunk default-role seed insert to stay under bind-param cap

A self-hosted instance with 5000+ workspaces produces 15000+ rows to
seed (3 default roles per workspace), which is 90000+ bind parameters
in one INSERT. Postgres caps bind parameters at 65535 (uint16 in the
wire protocol), so the seed crashes the API on startup. Insert in
batches of 1000 rows instead.

- Fix(github): skip issues opened by the configured app bot

The issues.opened webhook treated Kaneo-created issues as manual ones
and created duplicate tasks when the webhook arrived before the
task-to-issue external link was persisted. Skip when the issue author
matches `${GITHUB_APP_NAME}[bot]`; the existing external-link lookup
remains the fallback when GITHUB_APP_NAME is unset.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

### 💼 Changes

- Merge pull request #1281 from Franz1241/t3code/2b016d39

fix(github): skip issues opened by the configured app bot

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.7.6

## [2.7.5] - 2026-05-27

### 🚀 Features

- Feat: workspace RBAC with custom roles and instance admin

Wire Better Auth's organization access control end-to-end so workspace
roles are enforced server-side, support per-workspace custom roles via
dynamicAccessControl, and seed an instance admin from the first signup.

- Extract permissions to @kaneo/permissions to share ac/roles between
  API and web (avoids the libs <-> api cycle)
- Pass ac/roles + dynamicAccessControl into the org plugin on both the
  server and the auth-client
- Add requireWorkspacePermission middleware and apply it across all
  mutating endpoints (project, task, column, label, comment, time-entry,
  workflow-rule, task-relation, integrations, activity)
- Admin plugin + databaseHooks promote the first user to instance admin
  and bypass DISABLE_REGISTRATION while no users exist
- Public /api/instance/status endpoint drives the sign-up onboarding
  copy and redirects sign-in -> sign-up when the instance is empty
- Workspace settings: new Members and Roles pages (accordion-based
  permission editor, Empty primitive for empty states)
- Shared SSOProviders component reused on sign-in and sign-up
- Feat(rbac): gate workspace UI on server-checked permissions

Convert built-in workspace roles to DB-seeded defaults so admins can fully
override them. Only `owner` stays as a static role. New workspaces seed
viewer/member/admin rows via the org-creation hook; existing workspaces are
backfilled at API startup. Middleware prefers DB-stored permissions, falling
back to the compiled defaults when a row is missing.

Rewrite useWorkspacePermission to call hasPermission server-side and cache
the capability map per (workspaceId, role) so custom roles are respected.
Replace the broken team:invite / team:remove / team:manage_roles checks
with invitation:create and member:update/delete. Add canManageLabels and
canDeleteProjects helpers. Capability cache is invalidated when an admin
edits a role or changes a member's role.

Roles UI: drop AC meta-resource, hide the owner row, reserve
viewer/member/admin/owner names, badge defaults as "Default" with delete
suppressed, sticky action bar in the editor (PermissionList gets its own
scroll container since AccordionPanel's overflow-hidden breaks sticky).

Gate previously ungated CRUD UI across the app: project + workspace
settings (rename/delete/visibility), column editor (add/rename/delete/done
toggle), kanban column header (add task + archive all), bulk toolbars,
task popovers (status/priority/assignee/start/due/labels), inline
title/description editor (Tiptap setEditable), subtasks + relations
panels, task context menus, create-task modal (subtask + label inline
creation), invite + delete-member modals as defense-in-depth. Empty-state
copy on the projects page picks a read-only variant when the user can't
create projects.

- Feat(web): move members page back to workspace sidebar with new table design

The PR had relocated members under Settings > Workspace > Members. Restore
it as a top-level workspace page (matches main's structure) and rebuild
the table:

- New route at /dashboard/workspace/$workspaceId/members; Members link
  back in the workspace sidebar
- Settings sidebar loses Members; Roles stays
- Restyled members-table using the devl.dev "members" registry as
  reference: per-row avatar tone (stable hash), Owner badge with shield
  icon, role Select (h-8 w-32), kebab menu for actions, pending invites
  folded into the same table
- Table layout matches the Projects page (header in WorkspaceLayout.headerActions,
  table flush with edges, no inner card) so the two pages look like siblings
- Owner deliberately NOT offered in the role Select — better-auth needs an
  explicit transfer flow; that lives in workspace general settings
- Custom-role list filtered to truly-custom names (viewer/member/admin are
  seeded default rows and were appearing twice)
- Sort: owner first, then other members, then pending invites at the bottom
- Show actual member.createdAt instead of nonexistent member.joinedAt
- Added missing i18n keys: team.roles.viewer + team.membersTable.roleUpdate{Success,Error}
- Feat(web): ownership transfer in workspace general settings

better-auth 1.6.9 has no dedicated transfer-ownership endpoint, so the
new useTransferWorkspaceOwnership hook does it in two sequential
updateMemberRole calls — promote new owner first, then demote the
previous owner to admin. Order matters: better-auth refuses to demote
the only owner, so the promote has to land first.

UI sits in workspace general settings, above the danger zone, owner-only:

- Select of eligible members (everyone except the current owner)
- SelectValue renders the chosen member's name/email, not the raw id
- Confirm dialog names both the recipient and the workspace
- Disabled when there's no other member to transfer to
- Invalidates ["workspace","full",id], ["workspace-user","active"],
  ["workspace-capabilities",id], and ["active-organization"] so the
  sidebar role badge and the members table both reflect the change
- Feat: workspace RBAC with custom roles and instance admin (#1253)

* feat: workspace RBAC with custom roles and instance admin

Wire Better Auth's organization access control end-to-end so workspace
roles are enforced server-side, support per-workspace custom roles via
dynamicAccessControl, and seed an instance admin from the first signup.

- Extract permissions to @kaneo/permissions to share ac/roles between
  API and web (avoids the libs <-> api cycle)
- Pass ac/roles + dynamicAccessControl into the org plugin on both the
  server and the auth-client
- Add requireWorkspacePermission middleware and apply it across all
  mutating endpoints (project, task, column, label, comment, time-entry,
  workflow-rule, task-relation, integrations, activity)
- Admin plugin + databaseHooks promote the first user to instance admin
  and bypass DISABLE_REGISTRATION while no users exist
- Public /api/instance/status endpoint drives the sign-up onboarding
  copy and redirects sign-in -> sign-up when the instance is empty
- Workspace settings: new Members and Roles pages (accordion-based
  permission editor, Empty primitive for empty states)
- Shared SSOProviders component reused on sign-in and sign-up

* chore(db): renumber RBAC migrations to 0030/0031 for main's 0029 fk_indexes

* fix(rbac): address PR review feedback (build, tests, label permissions)

- Dockerfile.kaneo, apps/api/Dockerfile, apps/web/Dockerfile: copy the
  new packages/permissions workspace into the build context (both the
  package.json copy for `pnpm install` and the full-package copy for
  the build itself). Without this, `vite` failed to resolve
  `@kaneo/permissions` from `apps/web/src/lib/permissions.ts`.
- require-workspace-permission.ts: stop calling `auth.api.hasPermission`
  via request headers (which doesn't see the mocked session used by
  integration tests). Instead look up the member's role from
  `workspaceUserTable` using `c.get("userId")` + `c.get("workspaceId")`
  and evaluate the requested permissions against the role's `statements`
  (built-in roles from @kaneo/permissions, or the JSON-encoded
  `permission` column on `workspaceRoleTable` for custom roles).
- @kaneo/permissions: add a `label` resource to the statement and grant
  the built-in roles appropriate label actions (members can CRUD their
  workspace labels; viewers can read).
- label/index.ts: switch label routes from the `project`/`task` update
  permission to the new dedicated `label` resource so workspace members
  can manage labels without `project.update` rights.

* fix(rbac): address review bot comments

Security:

- auth.ts: replace the racy "first user becomes admin" check in the
  `before` hook (concurrent first-signups could both see count=0 and
  both become admins) with an `after` hook that runs the check + role
  promotion inside a transaction guarded by a Postgres advisory lock.
  Only the first transaction past the lock sees adminCount=0 and
  promotes; any concurrent transaction sees >=1 and skips.
- comment/index.ts: enforce `requireWorkspacePermission({ task: ["update"] })`
  on comment update + delete (only create was gated before, so any
  authenticated workspace member could mutate comments without passing
  RBAC).

Schema (qodo #2 / CodeRabbit):

- workspace_role: make `updated_at` `defaultNow().notNull()` per repo
  conventions, and add `onUpdate: "cascade"` to the workspace FK to
  match other tables. Updated the migration SQL + 0030/0031 snapshots.
  Skipped the camelCase→snake_case rename in the JS property names
  because every other table in this repo uses camelCase JS / snake_case
  DB (e.g. `projectId: text("project_id")`).

Frontend (CodeRabbit):

- use-workspace-roles: guard `JSON.parse(r.permission)` so a malformed
  payload returns `{}` instead of crashing the whole query.
- use-workspace-permission: stop treating custom roles as non-members
  in `checkPermission("member")` — any non-empty role now passes the
  baseline check.
- members-table: drive invite / change-role / remove affordances off
  permission helpers (`canManageTeam`, `canRemoveMembers`,
  `canInviteUsers`) instead of hard-coded `isAdmin || isOwner`, so
  custom roles with the matching grants get the controls.
- invite-team-member-modal: guard against `workspaceId === undefined`
  (disable submit + abort mutation + skip cache invalidation).
- settings/workspace/members: render explicit loading / error states
  before falling back to the empty list.
- settings/workspace/roles: derive the resource list from
  `statement` and the built-in role permissions from the imported
  `viewer`/`member`/`admin`/`owner` role objects in `@kaneo/permissions`
  (so adding a resource in one place picks up everywhere); add
  loader+description entries for the new `label` resource; render an
  explicit error branch before the empty-state placeholder; and stop
  closing the delete confirmation on click — the dialog now stays open
  until the mutation succeeds, so failed deletes don't silently dismiss.
- auth/sign-up: hide self-service alternatives (guest + SSO) when
  registration is disabled and the user isn't accepting an invitation
  or doing first-user setup.
- auth/sign-in: also wait on `isInstanceStatusLoading` so the form
  doesn't flash before redirecting to sign-up when `hasUsers === false`.

Skipped: qodo's `sso-providers.tsx` PascalCase complaint — the actual
codebase convention is kebab-case (117 kebab-case component files,
0 PascalCase).

- fix(deps): regenerate pnpm-lock.yaml (stale next@16 reference)

- fix(rbac): address CodeRabbit follow-up on admin promotion and sign-in flash

* auth.ts: skip the admin-promotion `after` hook for anonymous users so
  a guest signup on a fresh instance doesn't get promoted to instance
  admin (CodeRabbit critical).
* sign-in.tsx: treat `instanceStatus.hasUsers === false` as still
  loading in the render guard. The existing useEffect redirects to
  /auth/sign-up, but it runs after paint, so the form briefly flashed
  before the redirect. Keeping the skeleton up bridges that gap.

- refactor(auth): type the admin-promotion hook's user via UserWithAnonymous

Replace the inline `(user as { isAnonymous?: boolean })` cast with a
narrow through better-auth's exported `UserWithAnonymous` type, which
the anonymous plugin contributes via additionalFields. Confirms the
`isAnonymous` field exists on the user when that plugin is enabled.

- fix(auth): widen ac to AccessControl for organization() typing

@kaneo/permissions exports `ac` with a narrow inferred statement
type (project/task/label/workspace + default org statements). That
makes its `newRole` generic incompatible with better-auth's looser
`AccessControl` interface, producing a TS2769 error at the
`organization({ ac, ... })` call.

Widen with an explicit `as unknown as AccessControl` cast at the
single consumer instead of rewriting the package's exports. Build
output is unchanged (esbuild already strips types).

- fix(rbac): address Qodo re-review (admin promotion, registration, instance status)

Bugs:

- auth.ts: instance-admin promotion was conditional on adminCount===0,
  but on an upgrade from a DB without `user.role` every existing user
  ends up with role=NULL after migration 0031. That meant the next
  signup on an already-populated instance would be promoted to admin
  (qodo #4). Now count total users; promote only when the just-inserted
  row is the only one in the table.
- auth.ts: `databaseHooks.user.create.before` ran `checkRegistrationAllowed`
  on every signup, so a fresh instance with DISABLE_REGISTRATION=true
  could never bootstrap its first admin (qodo #3). Skip the check when
  the user table is empty.

Architecture:

- Move the `/instance/status` route's inline db queries into a new
  controller `instance/controllers/get-instance-status.ts` per the
  thin-route-handler convention (qodo #1).

Reliability:

- `getInstanceStatus` fetcher now includes the HTTP status and response
  body in its error message instead of a generic "Failed to fetch".
- `sign-in.tsx` and `sign-up.tsx` toast the instance-status query error
  via a `useEffect` so a failed status fetch doesn't silently break
  onboarding (qodo #2).

* fix(rbac): validate custom-role permission JSON before authorizing

`customRoleStatements` previously cast the result of `JSON.parse`
straight to `Record<string, string[]>` and handed it to
`satisfies()`, which then called `.includes()` on each value. A
malformed `workspace_role.permission` row (non-object, or a value
that wasn't a string array) would either return wrong authorization
results or crash at request time (qodo bot).

Add `parsePermissionStatements` that:

- rejects non-object / array roots,
- drops entries whose value isn't a string[]
- coerces any non-string actions out of the array

So a bad row safely degrades to "no permissions" instead of a 500.

- feat(rbac): gate workspace UI on server-checked permissions

Convert built-in workspace roles to DB-seeded defaults so admins can fully
override them. Only `owner` stays as a static role. New workspaces seed
viewer/member/admin rows via the org-creation hook; existing workspaces are
backfilled at API startup. Middleware prefers DB-stored permissions, falling
back to the compiled defaults when a row is missing.

Rewrite useWorkspacePermission to call hasPermission server-side and cache
the capability map per (workspaceId, role) so custom roles are respected.
Replace the broken team:invite / team:remove / team:manage_roles checks
with invitation:create and member:update/delete. Add canManageLabels and
canDeleteProjects helpers. Capability cache is invalidated when an admin
edits a role or changes a member's role.

Roles UI: drop AC meta-resource, hide the owner row, reserve
viewer/member/admin/owner names, badge defaults as "Default" with delete
suppressed, sticky action bar in the editor (PermissionList gets its own
scroll container since AccordionPanel's overflow-hidden breaks sticky).

Gate previously ungated CRUD UI across the app: project + workspace
settings (rename/delete/visibility), column editor (add/rename/delete/done
toggle), kanban column header (add task + archive all), bulk toolbars,
task popovers (status/priority/assignee/start/due/labels), inline
title/description editor (Tiptap setEditable), subtasks + relations
panels, task context menus, create-task modal (subtask + label inline
creation), invite + delete-member modals as defense-in-depth. Empty-state
copy on the projects page picks a read-only variant when the user can't
create projects.

- test(rbac): cover all built-in + custom roles in workspace permissions

API integration (tests/api-integration/workspace-rbac.test.ts):

- viewer / member / admin / owner enforcement on POST /api/task and
  DELETE /api/task to prove the gates that ship in this PR
- custom role with task:create succeeds; with task:read only → 403
- workspace_role row for a built-in name (viewer) overrides the
  compiled-in statements
- malformed permission JSON → 403, not a crash
- entries that aren't string arrays are dropped instead of throwing
- instance admin (user.role = "admin") bypasses workspace checks;
  users without role do not

Unit tests for @kaneo/permissions (package's first test config):

- statement surface keeps better-auth defaults alongside Kaneo's
- viewer/member/admin/owner have the expected per-resource actions
- DEFAULT_ROLE_NAMES excludes owner; defaultRolePayloads mirror the
  compiled role statements and round-trip through JSON

* fix(web): ensure active workspace is set when deep-linking to settings

Settings pages live outside /dashboard/workspace/$workspaceId, so they
have no route param to identify "which workspace". They rely on the
session's active organization. A user who deep-links to
/dashboard/settings/workspace/\* (or refreshes there) before ever
visiting a workspace dashboard would see an empty sidebar
("WS / Roles.Undefined") and a stuck "Loading…" — `useActiveWorkspace`
falls back to better-auth's `activeOrganization` which is null until
something calls `setActive`.

Add a beforeLoad on the workspace-settings route that picks the first
workspace as active when none is set (or redirects to /onboarding if
the user has no workspaces yet), matching what /dashboard/ already does.

- test(rbac): expand coverage to every gated resource

Extend the workspace RBAC integration suite from 14 to 31 tests so
every resource and action enforced by requireWorkspacePermission is
exercised through a real HTTP request:

- task:update — PUT /api/task/:id (member 200, viewer 403)
- task:assign — PUT /api/task/assignee/:id (admin 200, member 403)
- project:create — POST /api/project (member 200, viewer 403)
- project:update — PUT /api/project/:id (admin 200, member 403)
- project:delete — DELETE /api/project/:id (admin 200, member 403)
- label:create — POST /api/label (member 200, viewer 403)
- label:delete — DELETE /api/label/:id (member 200, viewer 403,
  label attached to a task per the controller's contract)
- workspace:manage_settings — POST/DELETE /api/slack-integration
  (member 403, viewer 403) — proves the middleware blocks before
  the handler tries to call out to Slack

* feat(web): move members page back to workspace sidebar with new table design

The PR had relocated members under Settings > Workspace > Members. Restore
it as a top-level workspace page (matches main's structure) and rebuild
the table:

- New route at /dashboard/workspace/$workspaceId/members; Members link
  back in the workspace sidebar
- Settings sidebar loses Members; Roles stays
- Restyled members-table using the devl.dev "members" registry as
  reference: per-row avatar tone (stable hash), Owner badge with shield
  icon, role Select (h-8 w-32), kebab menu for actions, pending invites
  folded into the same table
- Table layout matches the Projects page (header in WorkspaceLayout.headerActions,
  table flush with edges, no inner card) so the two pages look like siblings
- Owner deliberately NOT offered in the role Select — better-auth needs an
  explicit transfer flow; that lives in workspace general settings
- Custom-role list filtered to truly-custom names (viewer/member/admin are
  seeded default rows and were appearing twice)
- Sort: owner first, then other members, then pending invites at the bottom
- Show actual member.createdAt instead of nonexistent member.joinedAt
- Added missing i18n keys: team.roles.viewer + team.membersTable.roleUpdate{Success,Error}

* fix(web): invalidate the right caches on workspace user role update

The mutation was invalidating ["workspace", id], ["full-workspace"],
and ["active-workspace-user"] — none of which actually matched any
live query keys. So changing a member's role in the UI looked like a
no-op until a manual refresh.

Replace with the keys real queries use:

- ["workspace", "full", id] — drives the members table
- ["workspace-users", id]
- ["workspace-user", "active"] — drives the sidebar role badge
- ["workspace-capabilities", id] — capability cache, keyed by (id, role)

* feat(web): ownership transfer in workspace general settings

better-auth 1.6.9 has no dedicated transfer-ownership endpoint, so the
new useTransferWorkspaceOwnership hook does it in two sequential
updateMemberRole calls — promote new owner first, then demote the
previous owner to admin. Order matters: better-auth refuses to demote
the only owner, so the promote has to land first.

UI sits in workspace general settings, above the danger zone, owner-only:

- Select of eligible members (everyone except the current owner)
- SelectValue renders the chosen member's name/email, not the raw id
- Confirm dialog names both the recipient and the workspace
- Disabled when there's no other member to transfer to
- Invalidates ["workspace","full",id], ["workspace-user","active"],
  ["workspace-capabilities",id], and ["active-organization"] so the
  sidebar role badge and the members table both reflect the change
- Feat(site): add product hunt landing badge

### 🐛 Bug Fixes

- Fix(rbac): address PR review feedback (build, tests, label permissions)

- Dockerfile.kaneo, apps/api/Dockerfile, apps/web/Dockerfile: copy the
  new packages/permissions workspace into the build context (both the
  package.json copy for `pnpm install` and the full-package copy for
  the build itself). Without this, `vite` failed to resolve
  `@kaneo/permissions` from `apps/web/src/lib/permissions.ts`.
- require-workspace-permission.ts: stop calling `auth.api.hasPermission`
  via request headers (which doesn't see the mocked session used by
  integration tests). Instead look up the member's role from
  `workspaceUserTable` using `c.get("userId")` + `c.get("workspaceId")`
  and evaluate the requested permissions against the role's `statements`
  (built-in roles from @kaneo/permissions, or the JSON-encoded
  `permission` column on `workspaceRoleTable` for custom roles).
- @kaneo/permissions: add a `label` resource to the statement and grant
  the built-in roles appropriate label actions (members can CRUD their
  workspace labels; viewers can read).
- label/index.ts: switch label routes from the `project`/`task` update
  permission to the new dedicated `label` resource so workspace members
  can manage labels without `project.update` rights.
- Fix(rbac): address review bot comments

Security:

- auth.ts: replace the racy "first user becomes admin" check in the
  `before` hook (concurrent first-signups could both see count=0 and
  both become admins) with an `after` hook that runs the check + role
  promotion inside a transaction guarded by a Postgres advisory lock.
  Only the first transaction past the lock sees adminCount=0 and
  promotes; any concurrent transaction sees >=1 and skips.
- comment/index.ts: enforce `requireWorkspacePermission({ task: ["update"] })`
  on comment update + delete (only create was gated before, so any
  authenticated workspace member could mutate comments without passing
  RBAC).

Schema (qodo #2 / CodeRabbit):

- workspace_role: make `updated_at` `defaultNow().notNull()` per repo
  conventions, and add `onUpdate: "cascade"` to the workspace FK to
  match other tables. Updated the migration SQL + 0030/0031 snapshots.
  Skipped the camelCase→snake_case rename in the JS property names
  because every other table in this repo uses camelCase JS / snake_case
  DB (e.g. `projectId: text("project_id")`).

Frontend (CodeRabbit):

- use-workspace-roles: guard `JSON.parse(r.permission)` so a malformed
  payload returns `{}` instead of crashing the whole query.
- use-workspace-permission: stop treating custom roles as non-members
  in `checkPermission("member")` — any non-empty role now passes the
  baseline check.
- members-table: drive invite / change-role / remove affordances off
  permission helpers (`canManageTeam`, `canRemoveMembers`,
  `canInviteUsers`) instead of hard-coded `isAdmin || isOwner`, so
  custom roles with the matching grants get the controls.
- invite-team-member-modal: guard against `workspaceId === undefined`
  (disable submit + abort mutation + skip cache invalidation).
- settings/workspace/members: render explicit loading / error states
  before falling back to the empty list.
- settings/workspace/roles: derive the resource list from
  `statement` and the built-in role permissions from the imported
  `viewer`/`member`/`admin`/`owner` role objects in `@kaneo/permissions`
  (so adding a resource in one place picks up everywhere); add
  loader+description entries for the new `label` resource; render an
  explicit error branch before the empty-state placeholder; and stop
  closing the delete confirmation on click — the dialog now stays open
  until the mutation succeeds, so failed deletes don't silently dismiss.
- auth/sign-up: hide self-service alternatives (guest + SSO) when
  registration is disabled and the user isn't accepting an invitation
  or doing first-user setup.
- auth/sign-in: also wait on `isInstanceStatusLoading` so the form
  doesn't flash before redirecting to sign-up when `hasUsers === false`.

Skipped: qodo's `sso-providers.tsx` PascalCase complaint — the actual
codebase convention is kebab-case (117 kebab-case component files,
0 PascalCase).

- Fix(deps): regenerate pnpm-lock.yaml (stale next@16 reference)
- Fix(rbac): address CodeRabbit follow-up on admin promotion and sign-in flash

- auth.ts: skip the admin-promotion `after` hook for anonymous users so
  a guest signup on a fresh instance doesn't get promoted to instance
  admin (CodeRabbit critical).
- sign-in.tsx: treat `instanceStatus.hasUsers === false` as still
  loading in the render guard. The existing useEffect redirects to
  /auth/sign-up, but it runs after paint, so the form briefly flashed
  before the redirect. Keeping the skeleton up bridges that gap.
- Fix(auth): widen ac to AccessControl for organization() typing

@kaneo/permissions exports `ac` with a narrow inferred statement
type (project/task/label/workspace + default org statements). That
makes its `newRole` generic incompatible with better-auth's looser
`AccessControl` interface, producing a TS2769 error at the
`organization({ ac, ... })` call.

Widen with an explicit `as unknown as AccessControl` cast at the
single consumer instead of rewriting the package's exports. Build
output is unchanged (esbuild already strips types).

- Fix(rbac): address Qodo re-review (admin promotion, registration, instance status)

Bugs:

- auth.ts: instance-admin promotion was conditional on adminCount===0,
  but on an upgrade from a DB without `user.role` every existing user
  ends up with role=NULL after migration 0031. That meant the next
  signup on an already-populated instance would be promoted to admin
  (qodo #4). Now count total users; promote only when the just-inserted
  row is the only one in the table.
- auth.ts: `databaseHooks.user.create.before` ran `checkRegistrationAllowed`
  on every signup, so a fresh instance with DISABLE_REGISTRATION=true
  could never bootstrap its first admin (qodo #3). Skip the check when
  the user table is empty.

Architecture:

- Move the `/instance/status` route's inline db queries into a new
  controller `instance/controllers/get-instance-status.ts` per the
  thin-route-handler convention (qodo #1).

Reliability:

- `getInstanceStatus` fetcher now includes the HTTP status and response
  body in its error message instead of a generic "Failed to fetch".
- `sign-in.tsx` and `sign-up.tsx` toast the instance-status query error
  via a `useEffect` so a failed status fetch doesn't silently break
  onboarding (qodo #2).
- Fix(rbac): validate custom-role permission JSON before authorizing

`customRoleStatements` previously cast the result of `JSON.parse`
straight to `Record<string, string[]>` and handed it to
`satisfies()`, which then called `.includes()` on each value. A
malformed `workspace_role.permission` row (non-object, or a value
that wasn't a string array) would either return wrong authorization
results or crash at request time (qodo bot).

Add `parsePermissionStatements` that:

- rejects non-object / array roots,
- drops entries whose value isn't a string[]
- coerces any non-string actions out of the array

So a bad row safely degrades to "no permissions" instead of a 500.

- Fix(web): align invite member modal styling
- Fix(web): ensure active workspace is set when deep-linking to settings

Settings pages live outside /dashboard/workspace/$workspaceId, so they
have no route param to identify "which workspace". They rely on the
session's active organization. A user who deep-links to
/dashboard/settings/workspace/\* (or refreshes there) before ever
visiting a workspace dashboard would see an empty sidebar
("WS / Roles.Undefined") and a stuck "Loading…" — `useActiveWorkspace`
falls back to better-auth's `activeOrganization` which is null until
something calls `setActive`.

Add a beforeLoad on the workspace-settings route that picks the first
workspace as active when none is set (or redirects to /onboarding if
the user has no workspaces yet), matching what /dashboard/ already does.

- Fix(web): invalidate the right caches on workspace user role update

The mutation was invalidating ["workspace", id], ["full-workspace"],
and ["active-workspace-user"] — none of which actually matched any
live query keys. So changing a member's role in the UI looked like a
no-op until a manual refresh.

Replace with the keys real queries use:

- ["workspace", "full", id] — drives the members table
- ["workspace-users", id]
- ["workspace-user", "active"] — drives the sidebar role badge
- ["workspace-capabilities", id] — capability cache, keyed by (id, role)
- Fix(github): accept \n-escaped and base64-encoded GITHUB_PRIVATE_KEY

Orchestrators with form-based env editors (Portainer's "Simple" stack
editor is the common culprit) silently strip real newlines from env
values, so users either end up with an empty key or a single line of
literal `\n` sequences. octokit's App requires a real multi-line PEM.

Add `resolveGithubPrivateKey()` that supports three input shapes:

1. GITHUB_PRIVATE_KEY = real multi-line PEM (unchanged, canonical)
2. GITHUB_PRIVATE_KEY = single line with literal `\n` separators
   (unescaped only when no real newline is present, so legitimate
   multi-line values containing a literal `\n` are not mangled)
3. GITHUB_PRIVATE_KEY_BASE64 = base64-encoded PEM, takes precedence

No behavior change for users whose env already carries a real PEM.

Closes #1299

- Fix(columns): allow workflow icon updates
- Fix(docker): bump pinned nginx to 1.28.3-r2 in Dockerfile.kaneo

Alpine 3.22 dropped the -r1 revision so the apk install fails the GHCR
image build. The base image still resolves to that branch, so update the
pin to the current available revision.

- Fix(ci): use RELEASE_TOKEN PAT so release events fire downstream

The default GITHUB_TOKEN does not emit workflow trigger events, so
release-notify never received release: published. Switch the release
action to a PAT so the Discord webhook job actually runs.

- Fix(package): revert version to 2.7.4 in package.json

### 💼 Changes

- Merge: bring in main (resolve journal conflict + renumber RBAC migrations)
- Merge remote-tracking branch 'origin/main' into feat/workspace-rbac

# Conflicts:

# Dockerfile.kaneo

- Merge pull request #1280 from azula9713/fix/invite-member-modal

fix: align invite member modal styling

- Merge pull request #1301 from usekaneo/fix/1298-change-icons-after-created

fix(columns): allow workflow icon updates

### 🚜 Refactor

- Refactor(auth): type the admin-promotion hook's user via UserWithAnonymous

Replace the inline `(user as { isAnonymous?: boolean })` cast with a
narrow through better-auth's exported `UserWithAnonymous` type, which
the anonymous plugin contributes via additionalFields. Confirms the
`isAnonymous` field exists on the user when that plugin is enabled.

### 📚 Documentation

- Docs: update contributors and sponsors

### 🧪 Testing

- Test(rbac): cover all built-in + custom roles in workspace permissions

API integration (tests/api-integration/workspace-rbac.test.ts):

- viewer / member / admin / owner enforcement on POST /api/task and
  DELETE /api/task to prove the gates that ship in this PR
- custom role with task:create succeeds; with task:read only → 403
- workspace_role row for a built-in name (viewer) overrides the
  compiled-in statements
- malformed permission JSON → 403, not a crash
- entries that aren't string arrays are dropped instead of throwing
- instance admin (user.role = "admin") bypasses workspace checks;
  users without role do not

Unit tests for @kaneo/permissions (package's first test config):

- statement surface keeps better-auth defaults alongside Kaneo's
- viewer/member/admin/owner have the expected per-resource actions
- DEFAULT_ROLE_NAMES excludes owner; defaultRolePayloads mirror the
  compiled role statements and round-trip through JSON
- Test(rbac): expand coverage to every gated resource

Extend the workspace RBAC integration suite from 14 to 31 tests so
every resource and action enforced by requireWorkspacePermission is
exercised through a real HTTP request:

- task:update — PUT /api/task/:id (member 200, viewer 403)
- task:assign — PUT /api/task/assignee/:id (admin 200, member 403)
- project:create — POST /api/project (member 200, viewer 403)
- project:update — PUT /api/project/:id (admin 200, member 403)
- project:delete — DELETE /api/project/:id (admin 200, member 403)
- label:create — POST /api/label (member 200, viewer 403)
- label:delete — DELETE /api/label/:id (member 200, viewer 403,
  label attached to a task per the controller's contract)
- workspace:manage_settings — POST/DELETE /api/slack-integration
  (member 403, viewer 403) — proves the middleware blocks before
  the handler tries to call out to Slack

### ⚙️ Miscellaneous Tasks

- Chore(db): renumber RBAC migrations to 0030/0031 for main's 0029 fk_indexes
- Chore(ci): notify Discord on new issues only

Adds a workflow that posts to Discord when an issue is opened, so
closed/edited/labeled events stop spamming the channel. Uses jq to
build the JSON payload safely against titles with quotes or backslashes.

- Chore(ci): notify Discord on new releases with full notes

Adds a release-published workflow that posts a Discord embed with the
release title, notes body, author, and a link to the GitHub release —
richer than the native GitHub/Discord integration's title-only format.

- Chore: merge main into feat/workspace-rbac

Resolves conflicts in:

- apps/web/src/components/team/invite-team-member-modal.tsx:
  keep main's new Dialog primitives (Header/Panel/Footer + variant=outline
  cancel) and PR's RBAC gating (useActiveWorkspace, canInvite check, and
  disabled state on submit). Drop main's Route.useParams import — the
  workspace members route was removed in this PR.
- pnpm-lock.yaml: regenerated via pnpm install.
- Chore(release): v2.7.5
- Chore(release): v2.7.5

## [2.7.4] - 2026-05-18

### 🚀 Features

- Feat(api): add S3 key prefix support and auto-delete orphaned assets (#1258)

* feat(api): add S3 key prefix support and auto-delete orphaned assets

- Add S3_KEY_PREFIX env var to prefix all S3 object keys, allowing
  multiple environments to share a single bucket
- Add DeleteObjectCommand support and cleanup-assets module that
  automatically deletes S3 objects when attachments are removed from
  task descriptions, comments, or when tasks/comments are deleted
- Integrate orphaned asset cleanup into update-task, update-task-description,
  update-comment, and delete-comment controllers (both comment and activity)
- Delete all task assets from S3 before cascade-deleting task DB rows
- Add unit tests for applyKeyPrefix, key matching with prefix, and
  extractAssetIds
- Document S3_KEY_PREFIX in environment-variables.mdx

* fix(s3): unscoped asset deletion and Blocking S3 deletes on task

* fix: don't drop asset rows when S3 deletion fails and additional logging when s3 delete fails

### 🐛 Bug Fixes

- Fix(api): restore atomic ownership check on activity comment writes

Re-add the userId predicate to the UPDATE/DELETE WHERE clauses in the
activity comment controllers so the write itself enforces ownership,
matching the comment controllers. The preceding SELECT was already
checking ownership, but the write was open on id alone — a TOCTOU gap.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.7.4

## [2.7.3] - 2026-05-18

### 🚀 Features

- Feat(site): add Product Hunt launch badge to hero

Adds the PH featured-badge above the hero H1 in its own FadeIn for the
launch.

Reverts the postcss/defu/fast-xml-parser override bumps from d7022590
(re-opens Dependabot #141, #124, #140) — the bumps shifted transitive
deps in a way that broke the static export build for the marketing
site. Will revisit those security fixes separately.

- Feat(i18n): add Korean (ko-KR) translation (#1229)

* feat(i18n): add Korean (ko-KR) translation

Signed-off-by: FVOCI <150913557+fvoci@users.noreply.github.com>

- feat(i18n): register korean in language labels and schema

---

Signed-off-by: FVOCI <150913557+fvoci@users.noreply.github.com>

### 🐛 Bug Fixes

- Fix: replace em dash with hyphen in titles and metadata
- Fix(web): Fix websocket path (#1228)
- Fix: properly construct WS URL
- Fix: inconsistent import extension
- Fix(db): add missing foreign key indexes (#1226)

* fix(db): add missing foreign key indexes

* fix(db): formatting issue-biome

* fix(db):`time_entry` now has standard `createdAt` / `updatedAt` timestamps in schema

* fix(db): `notification` now has standard `createdAt` / `updatedAt` timestamps in schema

* fix(db): blocking index builds at startup resolved

* fix(db): shorten fk index name

* fix(db): avoid api take down w/fk failure

* fix(pr): two required fixes and nitpick 4

- Fix: remove duplicate import tasks modal close button (#1264)
- Fix: emit task.status_changed for git webhook status updates (#1263)

Publish task.status_changed after integration-driven status changes
from Gitea/GitHub push and PR webhooks so Telegram and other plugins
match manual UI updates. GitHub issue webhooks aligned the same way.

- Fix(api): resolve issue #1231 (#1257)

* fix(api): resolve issue #1231

* fix(api): qodo fixes

* fix(api): wait for database maxattemps"

* fix(ci): main merge conflicts in dockfile

* fix(db): merge conflict from previous pr

### 💼 Changes

- Merge pull request #1254 from tiran133/fix-ws-url

fix: properly construct WS URL

- Fix priority items and assignee styles
- Merge pull request #1260 from nimone/fix/backlog-filter-styles

fix(web): project backlog filter priority items and assignee styles

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(security): align pnpm overrides with bumped deps and resolve next alerts (#1271)

* chore(security): align pnpm overrides with bumped deps and pin next safely

- Drop stale `hono: 4.12.14` pin; replace with `>=4.12.19` floor so
  the security fixes from #1259 (cache middleware, JSX SSR, JWT
  validation) actually apply at install time.
- Loosen `@hono/node-server` override to `>=1.19.13 <2.0.0`. Latest
  @hono/node-ws@1.3.1 still peers on `@hono/node-server@^1.19.11`, so
  2.x breaks the WebSocket layer; revert apps/api's spec to 1.x to
  match what's actually installed.
- Add `next: ">=15.5.18 <16.0.0 || >=16.2.6"` to fix the 12 open
  Dependabot alerts on `next@16.1.7` (a transitive optional peer from
  better-auth; never imported by us). Apps/site stays on 15.5.18.

* fix(deps): restore bumps that earlier rebases silently reverted

While fixing lockfile conflicts on dependabot PRs, the rebase script
was checking out each PR's full `package.json` over fresh main, which
clobbered unrelated bumps that had merged in between. These 7
intended bumps regressed in `main`'s package.json files (the
dependabot squash commits are in history, but the version strings
ended up reset):

- apps/api/package.json
  - @hono/node-ws: 1.3.0 → 1.3.1 (PR #1242)
  - @better-auth/api-key: 1.6.9 → 1.6.11 (PR #1251)
- apps/web/package.json
  - jsdom: 29.0.1 → 29.1.1 (PR #1236)
  - @tiptap/extension-placeholder: 3.22.5 → 3.23.1 (PR #1240)
  - @tiptap/extension-underline: 3.22.5 → 3.23.1 (PR #1246)
- packages/libs/package.json
  - react: 19.2.5 → 19.2.6 (PR #1238)
  - vitest: 4.1.5 → 4.1.6 (PR #1269)
- Chore(release): v2.7.3

## [2.7.2] - 2026-05-05

### 🚀 Features

- Feat(chart): add kaneo.extraEnv for arbitrary env vars

Adds a standard extraEnv escape hatch to the kaneo container so users
can inject CUSTOM*OAUTH*\_, SMTP\_\_, DEVICE_AUTH_CLIENT_IDS, etc. without
forking the chart. Each entry is a regular Kubernetes EnvVar and supports
both `value` and `valueFrom` (e.g. SecretKeyRef). Entries are appended
after chart-defined vars; duplicate names override.

Chart bumped 0.3.0 → 0.4.0.

Originally proposed in #1203 against the previous two-container layout;
ported here to the unified kaneo container.

### ⚙️ Miscellaneous Tasks

- Chore(docs): updating repo with 127.0.0.1 for health checks (#1225)
- Chore(release): v2.7.2

## [2.7.1] - 2026-05-04

### 🚀 Features

- Feat: import/export task re-enabled
- Feat(web): 404 not found page for task page
- Feat(ui): move create task to top and display permanently
- Feat: custom logout url for automatic logout from idp
- Feat: add websockets for realtime collaboration
- Feat: add Redis-backed broadcast adapter for WebSocket scaling

- Introduce BroadcastAdapter interface with InMemory and Redis implementations
- Use Redis pattern subscriptions (psubscribe) for per-project channels
- Lazy Redis client creation to avoid connections when REDIS_URL is not set
- Add graceful shutdown for WebSocket adapter and Redis connections
- Update compose files with optional Redis service
- Document REDIS_URL environment variable
- Feat: add redis sentinal and cluster support

### 🐛 Bug Fixes

- Fix: update healthcheck URL to use 127.0.0.1
- Fix: feature_request.yml

I wrote the correct id 'simplicity' instead of 'sinplicity'

- Fix: copy task link
- Fix: move task
- Fix: use correct column slug property
- Fix: missing properties of Task type
- Fix: unused project route
- Fix: some CodeRabbit suggetions
- Fix: codeRabbit suggetions
- Fix: codeRabbit suggetions applied
- Fix: bulkUpdateTasks never fires WebSocket events
- Fix(type): broadcastAdapter is defined as an interface
- Fix: missing projectId in WS broadcast
- Fix: project membership authorization check to the WebSocket /ws/:projectId endpoint
- Fix: get /api/oauth/id-token is implemented inline
- Fix: webSocket retry counter not reset on project change
- Fix: hardcoded "done" check for strike-through styling
- Fix: broadcast task-relation.refresh on status update. For task details view updates
- Fix: move WebSocket endpoint under API path. For new single docker image

### 💼 Changes

- Merge pull request #1221 from Asynchronite/fix/docker-healthcheck

fix: Update healthcheck URL

- Merge branch 'main' into main
- Merge pull request #1220 from capti/main

refactor: made feature_request easier to fill out

- Update i18n/el-GR.json

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Merge branch 'feat-websockets-bugfixes' of github.com:tiran133/kaneo into feat-websockets-bugfixes
- Merge branch 'main' into feat-websockets-bugfixes
- Merge branch 'main' into feat-websockets-bugfixes
- Merge branch 'main' into feat-websockets-bugfixes
- Merge branch 'main' into feat-websockets-bugfixes
- Merge branch 'main' of https://github.com/usekaneo/kaneo into feat-websockets-bugfixes

# Conflicts:

# .gitignore

# apps/api/src/index.ts

# compose.yml

- Merge pull request #1161 from tiran133/feat-websockets-bugfixes

feat: add websockets for realtime collaboration and more

- Revert "chore(release): v2.7.1"

This reverts commit dec26d04706ac0d70c221fca3985753951d42b32.

### 🚜 Refactor

- Refactor: made feature_request easier to fill out

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: sync CLAUDE.md pnpm pin to 10.32.1

### 🧪 Testing

- Test: add unit tests for websocket broadcast and event system

### ⚙️ Miscellaneous Tasks

- Chore: update •gitignore add IDE specific folder
- Chore(type): typesafety
- Chore: add SEO setup, asset refresh, and UI polish

- Add sitemap index, robots, web manifest, and JSON-LD structured data for the site
- Wire Apple touch icon, theme color, and Organization logo metadata
- Update Cal Sans UI font to current upstream version
- Refresh favicons across site, docs, and web app
- Reinstall coss Button primitive (with built-in loading state) and Spinner
- Migrate workspace projects empty state to use the Empty component
- Move kanban add-task action into the column header

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

- Chore: refresh brand assets across site and web

- Drop the site web manifest so the marketing page no longer prompts a PWA install
- Regenerate the OG hero image at exact 1200x630 from the updated vector source
- Refresh the web app's apple-touch-icon and PWA manifest icons to match the new branding
- Update the web app manifest theme and background color to the brand dark

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

- Chore: Change logo width from 300 to 450

Updated logo size in README

- Chore(release): v2.7.1
- Chore(release): v2.7.1

## [2.7.0] - 2026-05-01

### 🚀 Features

- Feat(deploy): add single kaneo container combining API and web

Collapses the two-container deploy (separate api + web images) into one
ghcr.io/usekaneo/kaneo image. Users now run one container + postgres
instead of three services.

- Dockerfile.kaneo: multi-stage build producing a single image with the
  Node API (port 1337 internal) and nginx (port 5173 external)
- nginx.kaneo.conf: proxies /api/ to 127.0.0.1:1337, serves static web
- kaneo-entrypoint.sh: starts both processes, traps signals, exits with
  correct code if either process dies
- compose.yml: replace api + web services with single kaneo service
- Remove postgres host port — DB is internal to the compose network
- CI workflows: add kaneo image to build matrix; old api/web images
  retained for advanced deployments

KANEO_API_URL must now point to http://<host>:5173/api instead of
http://<host>:1337.

- Feat(deploy): reduce required env vars for combined image

KANEO_API_URL and DATABASE_URL are now derived automatically if unset.
AUTH_SECRET auto-generates a random value at startup with a warning to
set it explicitly for persistent sessions.

Minimum .env for the kaneo image is now:
KANEO_CLIENT_URL, POSTGRES_PASSWORD, AUTH_SECRET

- Feat(deploy): refactor Helm chart and drim docs to single kaneo image

Helm chart (0.2.0 -> 0.3.0, BREAKING):

- Collapse api._ and web._ values into a single kaneo.\* block
- Single container deployment using ghcr.io/usekaneo/kaneo on port 5173
- Replace separate api + web services with single kaneo service
- Simplify ingress/gateway defaults — nginx inside the container handles
  /api/ routing internally, no more split path rules needed
- Fix liveness/readiness probes — were commented out for web container;
  both probes now target /api/health on the kaneo container
- Bump appVersion to 2.6.0

Migration: rename api._ and web._ values to kaneo.\* in your values.yaml.

drim docs:

- Update "What Gets Installed" to reflect combined kaneo container

### 🐛 Bug Fixes

- Fix: run apikey migration after drizzle and drop user_id not null

- Move migrateApiKeyReferenceId after migrate() so apikey exists on fresh DB
- Add migration 0028 to align apikey.user_id with Better Auth plugin inserts
- Fix(deploy): fix entrypoint exit codes, scan triggers, and docs drift

- entrypoint: replace `if ! wait` pattern — captured $? was from the
  negated condition, not the child process; use `wait || status=$?`
  so actual subprocess exit codes propagate correctly
- vuln scan: add deploy/kaneo-entrypoint.sh, nginx.kaneo.conf, env.sh
  to path triggers so image-baked file changes trigger scans
- docs: remove postgres host port 5432 from compose example to match
  compose.yml — was exposing DB to host unnecessarily
- Fix(deploy): pin nginx to 1.28.3-r0 for reproducible builds
- Fix(deploy): restore postgres host port 5432 in compose and docs
- Fix(deploy): resolve CR PR notes
- Fix(deploy): missing mcp well-known routes
- Fix(deploy): env.sh fails editing nginx-qodo
- Fix(deploy): whitespace in env.example
- Fix(deploy): Helm update to avoid losing CORS allowlist
- Fix(deploy): double-slash bug in url
- Fix(deploy): nit pick
- Fix(deploy): preserve status of process that failed
- Fix(deploy): aligning .env.sample
- Fix(deploy): removing hardcord postgres ports-but really should be 5432 be default
- Fix(deploy): fix Biome error in runner

### 💼 Changes

- Update apps/docs/core/installation/migration.mdx

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Merge branch 'main' into fix/deploy-single-image
- Merge pull request #1210 from randoneering/fix/deploy-single-image

feat(deploy): consolidate Kaneo deployment to a single image

- Merge branch 'main' into fix/api-create-500
- Merge pull request #1217 from usekaneo/fix/api-create-500

fix: run apikey migration after drizzle and drop user_id not null

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs(deploy): update env examples to reflect reduced required vars

### 🎨 Styling

- Style: format drizzle 0028 snapshot for Biome CI

### ⚙️ Miscellaneous Tasks

- Chore(deploy): harden entrypoint defaults, CI smoke test, and
  workflow cleanup
  - Default POSTGRES_DB/POSTGRES_USER to kaneo in entrypoint so only
    POSTGRES_PASSWORD is required when DATABASE_URL is unset
  - Add healthcheck to kaneo service in compose.yml
  - Align pnpm version in Dockerfile.kaneo to 10.32.1 (matches packageManager)
  - Add docker-build smoke test job to CI so broken Dockerfiles fail fast
  - Remove docker-manual.yml (duplicate of docker.yml)
  - Add migration guide for v2.6.0 breaking changes

- Chore(release): v2.7.0

## [2.6.9] - 2026-04-21

### 🚀 Features

- Feat: add configurable first day of week

### 🐛 Bug Fixes

- Fix: restore board label filters after reload
- Fix(web): sync task label mutations into tasks cache
- Fix(ui): align task label text vertically
- Fix: align task list checkboxes to top
- Fix: .github/ISSUE_TEMPLATE/bug_report.yml

commit suggestion from ai

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

### 💼 Changes

- Merge pull request #1206 from tinsever/feat/1201-allow-selecting-first-day-of-week

feat: add configurable first day of week

- Merge branch 'main' into fix/ui-fixes
- Merge pull request #1202 from tinsever/fix/ui-fixes

fix(web): ui fixes

- Merge pull request #1209 from capti/main

refactor: made bug_report easier and faster to fill out

- Merge pull request #1205 from tinsever/fix/1200-label-shows-as-active

fix(web): 1200 label shows as active

### 🚜 Refactor

- Refactor: made bug_report easier and faster to fill out

### ⚙️ Miscellaneous Tasks

- Chore: merge origin/main into fix/1200-label-shows-as-active
- Chore(release): v2.6.9

## [2.6.8] - 2026-04-13

### 🚀 Features

- Feat(nginx): update well-known endpoints to serve MCP OAuth discovery JSON

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.8

## [2.6.7] - 2026-04-13

### 🐛 Bug Fixes

- Fix(docker): update nginx configuration for environment variable handling

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.7

## [2.6.6] - 2026-04-13

### 🚀 Features

- Feat(api): add mcp redirects

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.6

## [2.6.5] - 2026-04-13

### 🐛 Bug Fixes

- Fix(api): remove trailing '/api' from KANEO_API_URL in routing

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.5

## [2.6.4] - 2026-04-13

### 🚀 Features

- Feat(mcp): add OAuth 2.0 well-known endpoints for authorization server

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.4

## [2.6.3] - 2026-04-13

### 🚀 Features

- Feat(mcp): implement device authorization flow with polling mechanism

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.3

## [2.6.2] - 2026-04-13

### 🚀 Features

- Feat(mcp): implement Model Context Protocol server with HTTP and stdio support

### 🐛 Bug Fixes

- Fix(api): simplify visit function in normalizeEmptyAndEnumSchemas

### ⚙️ Miscellaneous Tasks

- Chore: rerun build
- Chore(release): v2.6.2

## [2.6.1] - 2026-04-12

### 🚀 Features

- Feat(api): add normalizeEmptyAndEnumSchemas function for OpenAPI spec processing

### 🐛 Bug Fixes

- Fix(api): avoid checksum query params in presigned S3 uploads
- Fix(docs): update OpenAPI URL to use the production endpoint
- Fix(web): show all workspace members in assignee popovers
- Fix(task): use renamed project column names in status popovers
- Fix(task): load sidebar status metadata from columns and restore default status i18n

### 💼 Changes

- Merge pull request #1196 from tinsever/fix/1173-s3-attachement-incorrect-crc

fix(api): avoid checksum query params in presigned S3 uploads

- Merge pull request #1195 from tinsever/fix/1175-renaming-column-ignored

fix(web): renaming column ignored

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚡️ Performance

- Perf(web): incrementally render assignee popover members

### 🎨 Styling

- Style(web): apply biome formatting for status label updates

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.6.1

## [2.6.0] - 2026-04-07

### 🚀 Features

- Feat: add kaneo mcp app
- Feat: new docs for mcp; allow mcp by default
- Feat(mcp): add interactive installer
- Feat(mcp): support multi-target installer
- Feat(mcp): harden install/auth tools and align device auth docs

- Optional DEVICE_AUTH_CLIENT_IDS docs; prepublishOnly via pnpm
- Install: flag parsing, merge-all-then-write, resilient JSON parse
- Auth: fail-open comment; device poll timeout after fetch
- Tools: partial update_project; stable MCP text results; tests AAA
- Web: add nanostores for better-auth org client resolution in Vite
- Feat: separate github sso and integration
- Feat(web): show exact comment timestamp on relative time hover
- Feat(i18n): add Russian and Ukrainian locales

Add ru-RU and uk-UA translations with proper Slavic plural forms
(\_one/\_few/\_many/\_other) for all existing i18n keys.

- Feat(docs): add mcp docs

### 🐛 Bug Fixes

- Fix: fix dist url
- Fix(mcp): harden auth and tool validation
- Fix(mcp): harden install merge, prompts, and device code validation

- Pass config path into overwrite prompt; only swallow ENOENT on read
- Fail merge on invalid JSON; use null-prototype mcpServers map and reject reserved server names
- Validate device code response fields and normalize numeric interval/expires_in
- Fix(mcp): tighten install validation, merge errors, and config parsing

- Log mergeMcpServerEntry failures with message and stack; exit 1
- Validate custom --output with shared rules (absolute .json path)
- Parse empty existing MCP JSON as invalid via null-only guard
- Derive valid --target IDs from INSTALL_TARGETS registry
- Add test for empty-string existing config
- Fix(mcp): validate custom path in resolveTargetConfigPath

- Use validateCustomConfigPathInput in custom branch; throw on failure
- Type INSTALL_TARGETS with as const satisfies readonly InstallTarget[]
- Fix: use refs for comment submit/cancel shortcuts in TipTap handler

Stale closures in handleKeyDown kept initial empty content when using Cmd+Enter.

- Fix(web): repair comment timestamp tooltip
- Fix: persist project icon from general settings

Remove stale isDirty guard in form watch so icon setValue schedules saves.
Flush pending edits on unmount when navigating before debounce completes.

- Fix(mcp): harden auth, timeouts, and project update payloads
- Fix(mcp): guard device-flow polling and project fallback types
- Fix(mcp): harden project update/auth timeout/install chmod
- Fix: downgrade dependabot/fetch-metadata to version 2
- Fix: apps/api/Dockerfile to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:

- https://snyk.io/vuln/SNYK-UPSTREAM-NODE-14975915
- https://snyk.io/vuln/SNYK-UPSTREAM-NODE-14928492
- https://snyk.io/vuln/SNYK-ALPINE319-MUSL-8720640
- https://snyk.io/vuln/SNYK-ALPINE319-MUSL-8720640
- https://snyk.io/vuln/SNYK-ALPINE319-OPENSSL-7895536
- Fix: address CodeRabbit review comments
- Fix(web): use column.id in task move popover

The /tasks API returns project columns as { id: slug, name, isFinal, tasks }
with no `slug` property. TaskMovePopover referenced `column.slug` which was
always undefined, causing every status match to fail silently and ultimately
crashing when the Select rendered items: `getStatusLabel(undefined)` reaches
toDisplayCase, which calls `.replace` on undefined.

Fixes "Cannot read properties of undefined (reading 'replace')" on opening
the task move popover and picking a destination project.

- Fix(web): prefer column.name over slug-derived label in move popover

`getStatusLabel` falls back to `toDisplayCase(status)`, which always
returns a non-empty string for any non-empty input. The previous
`getStatusLabel(column.id) || column.name` therefore made `column.name`
unreachable, so users saw a slug-derived label like "Qa Review" instead
of the configured column name like "QA / Review".

Swap the precedence in both the dropdown items and the
`selectedStatusLabel` lookup to show the actual column name first and
only fall back to the i18n status label when the name is empty.

### 💼 Changes

- Merge pull request #1163 from tinsever/fix/separate-github-oidc-and-integration

feat: separate github sso and integration

- Merge pull request #1159 from tinsever/fix/shortcut-to-post-comment

fix: use refs for comment submit/cancel shortcuts in TipTap handler

- Update apps/web/src/components/activity/comment-card.tsx

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Merge pull request #1158 from tinsever/feat/timestamp-on-hover-comment

feat(web): show exact comment timestamp on relative time hover

- Merge pull request #1157 from tinsever/fix/change-project-icon

fix: persist project icon from general settings

- Merge pull request #1139 from ONREZA/feat/ru-uk-locales

feat(i18n): add Russian and Ukrainian locales

- Merge branch 'main' into feat/add-mcp
- Merge branch 'main' of github.com:usekaneo/kaneo
- Merge branch 'main' into feat/add-mcp
- Merge pull request #1160 from tinsever/feat/add-mcp

feat: add mcp

- Merge pull request #1167 from randoneering/pr/api-docker-vuln-fix

fix: apps/api/Dockerfile to reduce vulnerabilities

- Merge pull request #1165 from ONREZA/fix/task-move-popover-column-slug

fix(web): use column.id in task move popover (crash on project select)

### 📚 Documentation

- Docs: update contributors and sponsors

### 🧪 Testing

- Test(mcp): account for abort signal in device flow fetch assertion

### ⚙️ Miscellaneous Tasks

- Chore(mcp): add package repository metadata
- Chore(mcp): update open and zod
- Chore(mcp): bump version to 0.1.3
- Chore(mcp): bump version to 0.1.4
- Chore: move MCP package and harden publish workflow
- Chore(mcp): 0.1.5
- Chore(release): v2.6.0

## [2.5.3] - 2026-04-03

### 🚀 Features

- Feat: add account notification delivery settings
- Feat: add user-based Gotify notifications
- Feat: harden notification prefs schema, delivery, OpenAPI, and i18n

Add composite FKs and workspace_id on workspace-project rows, CUID id PK on
user notification preferences, updated_at on workspace projects, and a single
cascade update for workspace rules. Add fetch timeouts and context logging in
delivery; remove dead exports; document Gotify and fix account nav docs.

Consolidate notification settings UI state and ChannelCard; toast from mutation
hooks. Extend i18n schema and locales (including el-GR sync).

- Feat: add project settings to sidebar project menu
- Feat: Init es-ES translations
- Feat: Add Spanish support
- Feat: More translations
- Feat: Webhook translations
- Feat: Finished translations
- Feat: Include Spanish in language selector
- Feat(auth): add device authorization flow for CLI and external apps
- Feat(docs): add otp rfc 8628 to docs
- Feat: add coss primitives documentation and rules
- Feat: add due date reminders scheduler

### 🐛 Bug Fixes

- Fix: notification preferences secrets and locale strings
- Fix: harden secret encryption guard and normalize error handling

- Validate enc:v1: prefixed values by attempting decryption before
  skipping encryption, preventing users from injecting fake ciphertext
- Replace raw Error throws with HTTPException (500) so crypto failures
  return proper API responses instead of leaking internal errors
- Wrap decipher block in try-catch to normalize unexpected crypto errors
- Add Gotify to troubleshooting docs alongside ntfy and webhook

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

- Fix(api): reorder notification project migration constraint
- Fix: show all board columns on public project link
- Fix: Applied suggestions
- Fix: Sort imports
- Fix: fix device auth route validation and bearer handling
- Fix(api): harden auth error handling and device query parsing
- Fix(api): tighten bearer parsing and initialize api auth email
- Fix(api): reject unauthenticated cookie fallback in asset auth
- Fix(api,test): preserve bearer sessions on auth routes
- Fix: notification preference schema bootstrap
- Fix: enable all configured notification channels
- Fix: stop column migration from restoring deleted default columns
- Fix: read workspace description from organization field
- Fix: update lodash to version 4.18.0

### 💼 Changes

- Update apps/api/src/schemas.ts

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Update apps/api/src/schemas.ts

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Merge pull request #1134 from tinsever/fix/invisible-column-when-sharing

fix: show all board columns on public project link

- Merge pull request #1135 from tinsever/feat/add-project-settings-button

feat: add project settings to sidebar project menu

- Merge origin/main into feat/add-user-notifications-integrations
- Merge branch 'main' into feat/spanish-translations
- Merge pull request #1118 from guillemc23/feat/spanish-translations

feat: Init es-ES translations

- Merge pull request #1138 from tinsever/feat/rfc-8628

feat(auth): add device authorization flow for CLI and external apps

- Merge remote-tracking branch 'upstream/main' into feat/add-user-notifications-integrations

# Conflicts:

# apps/api/drizzle/meta/0023_snapshot.json

# apps/api/drizzle/meta/\_journal.json

# apps/api/src/index.ts

- Merge pull request #1125 from tinsever/feat/add-user-notifications-integrations

feat: add user notifications integrations

- Merge branch 'main' into fix/in-review-reappearing
- Merge pull request #1133 from tinsever/fix/workspace-description

fix: read workspace description from organization field

- Merge branch 'main' into fix/in-review-reappearing
- Merge pull request #1132 from tinsever/fix/in-review-reappearing

fix: stop column migration from restoring deleted default columns

### 📚 Documentation

- Docs: add account notifications guide

### ⚙️ Miscellaneous Tasks

- Chore: format notification preference database files
- Chore: merge upstream/main and resolve conflicts

- Linearize Drizzle history: apply main migrations 0020-0022, then generated
  0023_early_owl (notification tables) and 0024_encrypt_notification_preference_secrets
- Take upstream snapshot meta for 0021-0022; add 0023 snapshot from generate
- Rebuild fr-FR, mk-MK, el-GR settings from en-US structure with upstream + feature strings
- Chore: format drizzle metadata
- Chore(release): v2.5.3

## [2.5.2] - 2026-04-02

### 🚀 Features

- Feat(web): move-task popover on task toolbar with readable select labels
- Feat(ci): add lint and unit workflow
- Feat(ci): extract api app startup
- Feat(ci): add api vitest suite
- Feat(ci): add api integration scaffolding
- Feat(ci): add api project integration harness
- Feat(ci): add api task integration tests
- Feat(ci): disable default api unit coverage and add test:coverage script
- Feat(test): extract resolveApiBaseUrl and add libs unit tests
- Feat(test): add vitest config and initial web unit tests
- Feat(test): add otp email template render smoke test
- Feat(test): add label api integration tests and readme
- Feat(api): set userEmail for API key auth and document public routes

- Load user email from the database when authenticating with an API key so
  routes using c.get("userEmail") match the declared context type.
- Add describeRoute, validator, and OpenAPI responses for public project and
  invitation endpoints.
- Export DEFAULT_PROJECT_COLUMNS from create-project for reuse in tests.

### 🐛 Bug Fixes

- Fix: accept dbOrTx, add subscribeToEvent, fix status lookup,error handling, error toast, french
- Fix(ci): mock email package in integration tests
- Fix(ci): use postgres admin db for tests
- Fix(ci): exclude coverage output from biome checks
- Fix(libs): strip trailing slash before appending /api in resolveApiBaseUrl

- Avoid double slashes when VITE_API_URL ends with /.
- Add regression tests for trailing-slash inputs.
- Fix(api): document health route and harden asset auth handling
- Fix(api): create projects transactionally
- Fix(github): preserve zero-valued task numbers
- Fix(github): only ignore missing label removals
- Fix(ci,github): tighten workflow token scope and preserve zero task numbers

### 💼 Changes

- Update apps/web/src/components/task/task-move-popover.tsx

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Update apps/web/src/components/task/task-move-popover.tsx

Co-authored-by: coderabbitai[bot] <136622811+coderabbitai[bot]@users.noreply.github.com>

- Some stuff
- Merge pull request #1126 from tinsever/feat/move-tasks-between-projects

feat(web): move-task popover on task toolbar with readable select labels

- Merge branch 'usekaneo:main' into feat/add-testing
- Merge branch 'main' into feat/add-testing
- Merge pull request #6 from tinsever/cursor/upstream-synchronization-dea9

Merge upstream main into cursor/upstream-synchronization-dea9

- Build: require Node 20.19 in repo and CI
- Merge pull request #1097 from tinsever/feat/add-testing

feat(ci): add tests

### 🚜 Refactor

- Refactor(api): realign index.ts with upstream shape

### 📚 Documentation

- Docs: document testing commands and workflows

### 🎨 Styling

- Style: apply biome formatting to test tooling files

### 🧪 Testing

- Test(integration): harden DATABASE_URL handling and fixtures

- Always derive and assert a \_test database URL; strip quotes from .env values.
- Clear cached migration promise after failure so a later attempt can retry.
- Default workspace membership role to member; seed four default columns via
  DEFAULT_PROJECT_COLUMNS to match production project creation.
- Test(api): tighten GitHub label helper assertions

- Assert createLabel call count in ensureLabelsExist.
- Assert getLabel runs and createLabel is skipped when labels already exist in
  addLabelsToIssue.
- Test(web): align Vitest aliases with Vite
- Test(integration): refuse non-test databases
- Test(integration): match mocked email contracts
- Test(integration): clear custom oauth env vars
- Test(api): stabilize max upload size assertion
- Test(integration): map seeded columns by slug
- Test(api): fix upload limit assertion input
- Test: formatting s3 test
- Test: add integration coverage for labels, tasks, and openapi
- Test: add integration coverage for labels, tasks, and openapi

### ⚙️ Miscellaneous Tasks

- Chore: merge upstream main into cursor/upstream-synchronization-dea9
- Chore(api): dedupe unit test script
- Ci: add monorepo build job

Run turbo build on every push/PR to catch compile failures that unit tests can miss.

- Chore: merge upstream/main into feat/add-testing
- Chore(release): v2.5.2

## [2.5.1] - 2026-04-01

### 🐛 Bug Fixes

- Fix(api): dedupe task numbers before unique constraint in migration 0021

Renumber duplicate (project_id, number) rows so ADD CONSTRAINT succeeds on
upgrades from databases that accumulated collisions before enforcement.

### 💼 Changes

- Merge pull request #1127 from tinsever/fix/dedupe-task-numbers-before-unique-constraint

fix(api): dedupe task numbers before unique constraint in migration 0021

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.5.1

## [2.5.0] - 2026-04-01

### 🚀 Features

- Feat(web): render supportedLocales from resources.ts
- Feat(api): add Gitea integration schema for OpenAPI
- Feat(api): create workflow rules for Gitea column migration
- Feat(api): add Gitea plugin with webhooks and sync helpers
- Feat(api): add Gitea integration REST API
- Feat(api): register Gitea routes and webhook endpoint
- Feat(api): sync task labels to Gitea
- Feat(web): add Gitea integration fetchers and query hooks
- Feat(web): extend external links for Gitea sources and icons
- Feat(web): add Gitea integration settings and workflow UI
- Feat(i18n): add Gitea integration strings
- Feat(api): add activity/label updatedAt, indexes, and task number uniqueness

- Add updatedAt to activity and label; index activity.task_id and label FKs.
- Enforce unique (project_id, number) on tasks with project_id index.
- Migration 0021 is additive; dedup constraints remain from 0020.
- Feat(web): localize Gitea webhook controls and copy feedback

- Add i18n for webhook show/hide/copy and clipboard toasts (en-US, de-DE).
- Document verify gating for import; default comment-on-issue Switch via nullish coalescing.
- Feat(api): add task.updated_at column and migration

Add updated_at to task table with default and on-update behavior to match
other tables. Includes Drizzle migration 0022.

- Feat(integrations): add project telegram integration
- Feat(api): publish integration events for Telegram CRUD

Emit integration.created, integration.updated, and integration.deleted via
publishEvent after successful DB writes, with projectId, actor userId, optional
apiKeyId, and integrationId. Publishing failures are logged and do not affect
responses.

Extract PATCH body handling into buildNextTelegramConfigFromPatch and shared
Valibot schema for the Telegram integration PATCH route.

### 🐛 Bug Fixes

- Fix(web): use shared default locale in preferences labels
- Fix: make macedonian first language
- Fix(web): isolate active workspace per tab via URL
- Fix(api): align integration response contracts
- Fix(gitea-api): harden webhook and sync handling
- Fix(gitea-web): tighten verification and repository browser behavior
- Fix(i18n): translate gitea integration labels
- Fix(api): harden gitea integration imports
- Fix(api): harden gitea webhook sync
- Fix(web): protect gitea webhook secrets
- Fix(api): handle duplicate activity and label rows on integration inserts

- Use ON CONFLICT DO NOTHING for GitHub/Gitea comment activity and label inserts
  keyed to existing unique constraints.
- Resolve workspace labels after conflict in create-label; sync remotes only on insert.
- Fix(api): harden Gitea import, API client, and webhooks

- Skip invalid integration configs during repo conflict check instead of aborting.
- Parse integration config safely; allocate task numbers inside a transaction with
  project row lock; label inserts use ON CONFLICT.
- Add fetch timeout (AbortError) to giteaFetch; chunk addLabelsToIssue requests.
- Cache Gitea repo labels in ensureLabelsExistGitea; isolate issue_reopened errors per integration.
- Use integration.project.workspaceId in label-created; partial unique ON CONFLICT.
- Align description sync dedup with title (source === gitea).
- Fix(gitea): map upstream errors, tighten sync, and fix bulk labels

- Map GiteaApiError from verifyGiteaToken/getRepo to HTTPException
- Skip inactive integrations in repository conflict check
- Only treat AbortError as timeout when our timer fired
- Instantiate Gitea client in addLabelsToIssueGitea
- Sync label colors on Gitea label_updated webhooks (batch by color)
- Skip issue reopen sync when webhook timestamp matches recent outbound state sync
- Set lastOutboundStateSyncAt on outbound issue create and status-driven updates
- Match bulk addLabel existence check to (taskId, name) unique constraint
- Fix(gitea): align fetch timeout, label api bodies, and webhook events

- Read response body before clearing the gitea fetch timer so slow streams
  stay abortable; map timeout aborts to 408 after body handling
- Send { labels } JSON for issue label POST/PUT per Gitea API
- Return applied/before/after from updateTaskStatus for event publishing
- Publish task.status_changed after Gitea label/reopen/close status sync
- Per-integration try/catch in issue_labeled; richer reopen error context
- Share outbound echo helpers; replace issue_closed createdFrom skip with
  lastOutboundStateSyncAt window
- Fix: resolve label alignment issues
- Fix: remove inner css styling for tailwind class
- Fix: remove unnecessary testing changes
- Fix(api): harden workspace access JSON body parsing

Treat null/array JSON as empty objects and only accept string IDs from body
for workspace lookup and body-based workspace resolution.

- Fix(telegram): harden integration validation and error handling
- Fix(api): harden telegram integration config handling
- Fix(telegram): redact sensitive config, avoid re-enabling, and skip no-op updates
- Fix(web): treat missing Telegram integration as empty state
- Fix(backlog): simplify label rendering in dropdown menu

### 💼 Changes

- Merge branch 'main' into feat/auto-create-language-selection
- Merge pull request #1116 from tinsever/feat/auto-create-language-selection

feat(web): render supportedLocales from resources.ts

- Merge branch 'main' into fix/issue-849-bug-parallel-browser-tabs-overwrite-each
- Merge pull request #1076 from tinsever/fix/issue-849-bug-parallel-browser-tabs-overwrite-each

fix(web): isolate active workspace per tab via URL

- Merge pull request #8 from tinsever/cursor/gitea-integration-and-database-cab2

fix: Gitea integration hardening, task updated_at, bulk label lookup

- Merge pull request #9 from tinsever/cursor/gitea-integration-and-database-cab2

fix(gitea): coderabbit follow-up — fetch body, label API, webhook events

- Merge pull request #1123 from xFGhoul/fix/label-alignment

fix: resolve label alignment issues

- Merge pull request #1122 from tinsever/fix/s3-uploaded-object-not-found

fix: s3 uploaded object not found

- Merge pull request #1124 from tinsever/feat/add-telegram-integration

feat: add telegram integration

- Add Dutch nl-NL Locale

Add Dutch nl-NL Locale

- Add Dutch nl-NL Locale

Add Dutch nl-NL Locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale
- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Add Dutch nl-NL locale

Add Dutch nl-NL locale

- Fix to Dutch translation
- Fix to Dutch translation
- Fix to Dutch translation
- Merge pull request #1121 from fsmeets84/main

Add Dutch nl-NL locale

- Merge branch 'main' into feat/gitea-support
- Merge pull request #1119 from tinsever/feat/gitea-support

feat: gitea support

### 🚜 Refactor

- Refactor(api): share telegram event schema and sanitize logs

### 📚 Documentation

- Docs: add Gitea integration setup guide
- Docs(integrations): add telegram setup guide

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.5.0

## [2.4.4] - 2026-03-30

### 🚀 Features

- Feat: add French locale (fr-FR) translations
- Feat(integrations): add Slack integration
- Feat(integrations): add Discord integration
- Feat(integrations): add generic outgoing webhooks
- Feat(webhooks): persist generic webhook delivery health
- Feat(docs): add outgoing webhooks
- Feat: add Macedonian language option to preferences

### 🐛 Bug Fixes

- Fix(ci): use GITHUB_TOKEN for dependabot fetch-metadata

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Fix(integrations): address review findings
- Fix(discord): hide webhook secrets and upsert integration
- Fix(discord): redact webhook failures in logs
- Fix(discord): preserve dirty integration form state
- Fix(web): normalize API base URLs
- Fix(slack): keep webhook URLs write-only
- Fix(api): tighten webhook URL validation and dedupe Discord event handling
- Fix: guard generic webhook secret normalization
- Fix(docs): refine docs for outgoing webhooks
- Fix: integration security and quality issues, add Discord/Slack docs

- Enforce SSRF check at config validation time for generic webhooks
- Consolidate SSRF logic into config.ts, remove duplication from client.ts
- Mask webhook URL in generic webhook API response (consistent with Discord/Slack)
- Fix double body read in github import-issues middleware
- Fix Slack frontend useEffect deps to match Discord's stable reset pattern
- Add Slack-specific URL pattern validation on frontend
- Add $onUpdate to githubIntegrationTable.updatedAt
- Add dedicated Discord and Slack integration doc pages

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Fix(ci): update Biome version to 2.4.8 and fix schema.json formatting

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 💼 Changes

- Update de-DE.json
- Update fr-FR.json
- Merge pull request #1114 from tinsever/feat/add-integrations

feat: add integrations

- Merge pull request #1117 from usekaneo/fix/integration-review-issues

fix: integration security and quality issues, add Discord/Slack docs

- Merge branch 'main' into feat/add-french-locale-translations
- Merge pull request #1115 from MonsPropre/feat/add-french-locale-translations

feat: add French locale (fr-FR) translations

### ⚙️ Miscellaneous Tasks

- Chore(ci): fix deprecated Node.js 20 actions in release workflow

- Replace ad-m/github-push-action@v1.0.0 with native git push
- Pin softprops/action-gh-release to v2.6.1

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Chore(ci): bump Docker actions to Node.js 24 compatible versions

- docker/setup-qemu-action: v3 → v4
- docker/setup-buildx-action: v3 → v4
- docker/login-action: v3 → v4
- docker/metadata-action: v5 → v6
- docker/build-push-action: v5 → v7

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Chore(ci): bump dependabot/fetch-metadata to v3

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Chore(webhooks): simplify generic webhook validation
- Chore(slack): simplify config validation
- Chore(release): v2.4.4

## [2.4.3] - 2026-03-29

### 🚀 Features

- Feat: add Greek locale file

Adds the Greek translation file for the application UI, preserving the existing JSON structure and interpolation placeholders.

- Feat: add el-GR translations

Adds the Greek language translation

- Feat: add Greek locale
- Feat: add el-GR translation
- Feat: add greek language to schema
- Feat: added support for el-GR language
- Feat: Added support for el-GR
- Feat(i18n): add Macedonian (mk-MK) translation

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 💼 Changes

- Merge pull request #1113 from achouvardas/main

feat: add Greek locale (el-GR) translations

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.4.3

## [2.4.2] - 2026-03-29

### 🚀 Features

- Feat(api): add user locale and event_data columns for i18n
- Feat(api): wire user locale into auth and API validation
- Feat(api): persist structured activity and notification events for i18n
- Feat(i18n): add English and German translation catalogs and schema
- Feat(i18n): add check, report, and schema maintenance scripts
- Feat(web): add i18next, locale hook, and Vite i18n integration
- Feat(web): sync locale with auth session and account preferences
- Feat(email): localize workspace invitation template
- Feat(web): internationalize routes and notification types
- Feat(web): internationalize components and task filter hooks
- Feat: add initial configuration for Coderabbit integration (#1099)

### 🐛 Bug Fixes

- Fix(api): restore activity search for event data
- Fix(email): localize auth sign-in emails
- Fix(auth): localize invitation email subject
- Fix(web): correct backlog priority filter chip label
- Fix(web): preserve exact locale matching in resolver
- Fix(web): invalidate session after locale updates
- Fix(web): refresh bulk priority labels on locale change
- Fix(web): make backlog due-date labels explicit
- Fix(ui): touchAction on the sortable row style object is now conditional on isDragging (#1098)

Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

- Fix: resolve i18n review issues and improve UI components

- Fix SQL injection risk in global search by using inArray() instead of raw sql IN
- Fix shortIdMatch early return that exited entire search function
- Fix missing SortableContext import in list view
- Fix missing useMemo import in bulk toolbars
- Fix hardcoded "Board"/"List" strings in board toolbar
- Fix Base UI select display showing raw values instead of labels
- Fix email locale resolution with shared resolveEmailLocale helper
- Fix task.created activity using hardcoded English content
- Add board loading skeleton replacing spinner
- Remove compact mode toggle from preferences
- Add i18next namespace list to init config
- Type setLocale as AppLocale for compile-time safety

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Fix(deps): patch security vulnerabilities in transitive dependencies

- path-to-regexp: 8.3.0 → 8.4.0 (ReDoS via sequential optional groups/wildcards)
- brace-expansion: 5.0.4 → 5.0.5 (process hang via zero-step sequences)
- picomatch: 4.0.3 → 4.0.4 (ReDoS and method injection in POSIX classes)
- yaml: 2.8.2 → 2.8.3 (stack overflow via deeply nested collections)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Fix(docker): copy i18n directory into web container build context

The i18n/ directory at the monorepo root contains translation catalogs
imported via the @i18n Vite alias. Without it, the web build fails with
ENOENT when resolving @i18n/resources.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 💼 Changes

- Merge branch 'main' into feat/i18n
- Merge pull request #1100 from tinsever/feat/i18n

feat: add internationalization

### 📚 Documentation

- Docs: document i18n contribution workflow
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: fix biome ci (formatting, dead code, ignore coverage)
- Chore(web): remove non-English list view comment
- Chore(release): v2.4.2
- Chore: revert version to 2.4.1

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Chore(release): v2.4.2

## [2.4.1] - 2026-03-27

### 🚀 Features

- Feat(ui): gantt chart resize dates (#1095)

* feat: resizable / moveable tasks on gantt

* fix(gantt): pad timeline past last task so bars can extend off-chart

* fix(gantt): avoid bar flicker after dragging dates

* feat(gantt): improve mobile touch targets, scroll, and drag thresholds

---

Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

- Feat(ui): refine ArchiveTasksModal layout and alignment (#1091)

Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

### 🐛 Bug Fixes

- Fix(web): resolve Biome noArrayIndexKey lint in shortcuts, repo modal, and error display (#1096)
- Fix: validate task status and priority inputs across all API endpoints (#1093)

Tasks become invisible when their status field is set to a value that
doesn't match any column slug or the virtual statuses "planned"/
"archived". The API accepted arbitrary strings for status and priority
on all write endpoints, allowing external consumers (CLI tools, LLM
agents) to create tasks with invalid statuses that silently vanish.

Add server-side validation for task status and priority:

- Create shared validate-task-fields module with constants and
  validation/coercion functions
- Use v.picklist for priority validation at Valibot validator level
  (static values: no-priority, low, medium, high, urgent)
- Add assertValidTaskStatus to all task write controllers (create,
  update, update-status, bulk-update) — validates against project
  column slugs + virtual statuses
- Import endpoint uses lenient coercion (maps unknown values to
  defaults with warnings) instead of rejecting
- Prevent column slug collisions with virtual statuses (planned/
  archived) and empty slugs
- Fix create-task writing empty string for status/priority when falsy
  instead of using the validated fallback value
- Fix bulk updateDueDate accepting invalid date strings silently
- Add default case to bulk operations switch
- Re-throw HTTPException in import catch block to avoid swallowing
  infrastructure errors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.4.1

## [2.4.0] - 2026-03-26

### 🚀 Features

- Feat(api) 1079 allow disabling GitHub task link comment (#1085)

* feat(integration): allow disabling GitHub issue task link comment

Add optional setting commentTaskLinkOnGitHubIssue (default on). PATCH updates
integration config; webhook skips createComment when disabled.

Fixes #1079

- chore(ui): shorten GitHub task link toggle description

---

Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

- Feat: gantt view and task start date (#1083)

- API/schema/migration for task start date
- Gantt route, backlog/board nav, import/export, task UI

Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

### 🐛 Bug Fixes

- Fix: mark optional Organization fields as nullable in OpenAPI spec (#1090)

Better Auth's OpenAPI generator does not emit nullable: true for fields
with required: false. This causes the Organization (Workspace) schema
to declare logo, metadata, and description as non-nullable strings,
while the API actually returns null for these fields.

Add a markOptionalSchemaFieldsNullable post-processor that walks
component schemas and adds nullable: true to properties not listed in
the required array.

Closes #1087

- Fix: enforce user ownership in notification endpoints (#1089)

markNotificationAsRead queried by notification ID only, without
verifying the notification belongs to the authenticated user. Any
authenticated user could mark another user's notifications as read by
enumerating IDs.

The POST notification endpoint accepted an arbitrary userId from the
request body, allowing any authenticated user to create notifications
targeting other users.

Fix markNotificationAsRead to filter by both id and userId using and().
Fix POST endpoint to use c.get("userId") from auth context instead of
accepting userId from the request body.

Closes #974

Co-authored-by: Andrej <44305048+andrejsshell@users.noreply.github.com>

- Fix: fix public project access after getTasks response shape change (#1088)

getPublicProject accessed result.isPublic directly, but getTasks now
returns { data: {..., isPublic}, pagination: {...} }, so result.isPublic
was always undefined — causing all public projects to return 403.

Access result.data.isPublic and return result.data instead of the full
response wrapper.

- Fix: prevent start date after due date and improve activity messages

Disable invalid dates in calendar pickers so start date cannot exceed
due date. Replace "none" in activity logs with "set due date to X"
when no previous date existed. Polish clear date button styling.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Fix: improve task sidebar icon button styling

Use connected outline buttons with brighter foreground color for
copy link and branch actions. Match style across desktop, mobile,
and compact views. Brighten sheet header icons.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Fix: resolve picomatch security vulnerabilities

Override picomatch to >=2.3.2 to fix ReDoS vulnerability via extglob
quantifiers (high) and method injection in POSIX character classes (medium).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 💼 Changes

- Fix/scrollbar redesign (#1086)

* fix: scrollbar design

Change scrollbar design to match the theme and look better

- Update index.css

- fix: remove the duplicate css

merge dark and light scrollbar css into one using the --border color var

### ⚙️ Miscellaneous Tasks

- Chore: fix vurnrebilities
- Chore(release): v2.4.0

## [2.3.16] - 2026-03-24

### 🐛 Bug Fixes

- Fix: Subtasks default priority (#1080)

Change the subtasks default priority to no priority to match normal task creation

- Fix(ui): make subtasks appear after creation without refresh (#1084)

### 💼 Changes

- Fix for Archive Modal not showing (#1082)

* Fix for Archive Modal not showing

Fix for Archive Modal not showing

- Fix for Archive Modal not showing

Fix for Archive Modal not showing

### ⚙️ Miscellaneous Tasks

- Chore: update pnpm-lock.yaml
- Chore(release): v2.3.16

## [2.3.15] - 2026-03-23

### 🚀 Features

- Feat: add bulk assign labels, priority & deadlines

Add bulk operations for setting priority, adding labels, and updating
due dates on multiple selected tasks. Extends both board and backlog
bulk toolbars with new action groups and a date picker popover.

Also fixes task card label colors by correcting the validColor lookup
order and removing a stray color prop on Badge.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Feat: add bulk assign labels, priority & deadlines

Add bulk operations for setting priority, adding labels, and updating
due dates on multiple selected tasks. Extends both board and backlog
bulk toolbars with new action groups and a date picker popover.

Also fixes task card label colors by correcting the validColor lookup
order and removing a stray color prop on Badge.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.15

## [2.3.14] - 2026-03-23

### 🚀 Features

- Feat: replace browser confirm with Archive modal
- Feat(web): refine breadcrumb and workspace switcher styling

- Align workspace switcher colors to use text-foreground for consistency
- Increase gap between project breadcrumb chevron and text
- Remove project icons from project breadcrumb dropdown
- Rename "Board" to "Tasks" in view switcher
- Use subtler breadcrumb separator color

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Feat(api,web): add subtasks and task relations

- New task_relation table (subtask, blocks, related types)
- API endpoints: GET/POST/DELETE for task relations
- Subtasks section on task detail page with progress bar
- Relations section with link dialog for connecting tasks
- Batch query for related tasks (no N+1)
- Feat(web): redesign subtasks UI with bulk actions

- Replace checkbox/progress bar with inline status and assignee popovers
- Add subtask selection with checkboxes and bulk status/assignee changes
- Add right-click context menu on subtask rows
- Add circular progress indicator with animated fill
- Add parent task breadcrumb when viewing a subtask's details
- Add archived/planned icons to column icon helper
- Fix task-relations cache invalidation on status/assignee mutations
- Fix context menu columns fallback via useGetColumns
- Add closeOnClick to context menu checkbox items
- Extract CircularProgress, SubtaskRow, and popover components

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Feat(web): add relations to task detail, animated subtasks, and keyboard nav

- Redesign relations with command palette for linking tasks
- Add relation rows matching subtask style (status/assignee popovers, context menu)
- Add animated list transitions for subtasks with framer-motion
- Add keyboard navigation (arrow keys, Space to select, Enter to open, Escape)
- Add focused row indicator with ring style
- Make Properties and Labels headings more readable in sidebar

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

- Feat(auth): allow OIDC-only user registration

### 🐛 Bug Fixes

- Fix(api): only apply task pagination when explicitly requested

The pagination PR (#1065) always applied a default limit of 50 tasks,
breaking boards with more than 50 tasks. Now pagination is only applied
when page or limit query params are explicitly provided.

Also fixes a pre-existing import ordering lint error in use-create-label.ts.

Co-Authored-By: Frank Smeets <99346831+fsmeets84@users.noreply.github.com>
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 💼 Changes

- Merge pull request #1064 from ONREZA/feat/subtasks-relations

feat(api,web): add subtasks and task relations

- Merge branch 'main' into main
- Merge pull request #1078 from fsmeets84/main

Replace browser confirm with Archive modal

- Merge pull request #1077 from tinsever/fix/issue-1042-feat-oidc-only-user-registration

feat(auth): allow OIDC-only user registration

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.13
- Chore: update biome dependency to version 2.4.8 in configuration files
- Chore: formatting
- Chore(release): v2.3.14

## [2.3.13] - 2026-03-22

### 🚀 Features

- Feat(web): refine breadcrumb and workspace switcher styling

- Align workspace switcher colors to use text-foreground for consistency
- Increase gap between project breadcrumb chevron and text
- Remove project icons from project breadcrumb dropdown
- Rename "Board" to "Tasks" in view switcher
- Use subtler breadcrumb separator color

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 🐛 Bug Fixes

- Fix(api): only apply task pagination when explicitly requested

The pagination PR (#1065) always applied a default limit of 50 tasks,
breaking boards with more than 50 tasks. Now pagination is only applied
when page or limit query params are explicitly provided.

Also fixes a pre-existing import ordering lint error in use-create-label.ts.

Co-Authored-By: fsmeets84 <49577632+fsmeets84@users.noreply.github.com>
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

### 💼 Changes

- Refresh label caches after creating a label

- Seed workspace and task label queries with the new label
- Invalidate both caches to keep label lists in sync
- Merge pull request #1075 from tinsever/fix/issue-1066-bug-labels-needs-a-hard-refresh-to-be-vi

Refresh label caches after creating a label

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.13

## [2.3.12] - 2026-03-21

### 🚀 Features

- Feat: better label color support

Implements #1058

- Feat(api): add pagination, bulk ops, comments, members, and project archival

API improvements:

- Pagination metadata (total, page, pageSize, totalPages) on task list
- Sorting (sortBy, sortOrder) and due date range filtering (dueBefore, dueAfter)
- Bulk operations endpoint (PATCH /task/bulk) for status, priority, assignee, delete, labels
- Comments as first-class resource (GET/POST/PUT/DELETE /comment)
- Workspace members endpoint (GET /workspace/:id/members)
- Project archival with soft-delete (archive/unarchive endpoints, includeArchived filter)
- Feat(web): add sorting controls to board, backlog, and list views

- Add reusable SortControl dropdown component
- Support sorting by: createdAt, priority, dueDate, title, task number
- Both ascending and descending directions
- Drag-and-drop is disabled when sorting is active
- Sorting resets to manual (position) on page reload
- Feat(api,web): add global search with short-id support

- Enhance global search controller with short-ID pattern detection (DEP-23)
- Short-ID lookup by project slug + task number with highest relevance
- Full search page implementation with debounced input and result navigation
- Lower minimum query threshold to 1 character for short-ID queries

### 🐛 Bug Fixes

- Fix(api,web): fix kanban position persistence and task numbering

- Use MAX(position)+1 when creating tasks (instead of default 0)
- Use MAX(number) instead of COUNT for task numbering to avoid duplicates
- Fix drag-and-drop position recalculation to be 0-based sequential
- Properly reindex source column when moving tasks between columns
- Increase refetch interval from 5s to 30s to prevent optimistic update conflicts
- Fix(api): consolidate migrations into single 0015 without duplicate asset table
- Fix: project key input limit

Add a maxLength property to the slug input field to prevent the slug preview from overflowing the modal window.

### 💼 Changes

- Merge pull request #1065 from ONREZA/feat/api-improvements

feat(api): API improvements — pagination, bulk ops, comments, members, archival

- Merge pull request #1062 from ONREZA/feat/sorting-views

feat(web): add sorting controls to board, backlog, and list views

- Merge pull request #1063 from ONREZA/feat/global-search

feat(api,web): add global search with short-id support (DEP-23)

- Merge branch 'main' into label-colors
- Merge pull request #1059 from Lukas-Simonson/label-colors

feat: better label color support

- Merge branch 'main' into fix/kanban-position
- Merge pull request #1061 from ONREZA/fix/kanban-position

fix(api,web): fix kanban position persistence and task numbering

- Merge branch 'main' into fix/project-key-limit
- Merge branch 'main' into fix/project-key-limit
- Merge pull request #1040 from MonsPropre/fix/project-key-limit

fix: project key input limit

- Helm chart add support for Gateway API
- Merge pull request #1032 from thomaslochet/chart-gateway-api

helm chart add support for Gateway API

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.12

## [2.3.11] - 2026-03-14

### 🚀 Features

- Feat(api,web): fix task access and editor link handling

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.11

## [2.3.10] - 2026-03-14

### 🐛 Bug Fixes

- Fix: due date calendar width
- Fix: mistake with regex
- Fix(web): preserve text color on autofilled inputs in dark theme

### 💼 Changes

- Merge pull request #1039 from MonsPropre/fix/due-date-calendar-width

fix: due date calendar width

- Merge pull request #1038 from tinsever/fix/better-file-name-normalization

fix(api): mistake with regex

- Merge branch 'main' into fix/autofill-dark-theme
- Merge pull request #1033 from GrassyAirplane/fix/autofill-dark-theme

fix: preserve text color on autofilled inputs in dark theme

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.10

## [2.3.9] - 2026-03-13

### 🚀 Features

- Feat: enhance file upload functionality for attachments

### 🐛 Bug Fixes

- Fix: file upload with umlauts

### 💼 Changes

- Merge pull request #1036 from tinsever/fix/normalize-file-names

fix: file upload with umlauts

### 📚 Documentation

- Docs: add storage backends guide and update references for image uploads
- Docs: update object storage documentation to clarify upload options and sizes

### ⚙️ Miscellaneous Tasks

- Chore: update deps
- Chore(release): v2.3.9

## [2.3.8] - 2026-03-11

### 🚀 Features

- Feat: add image upload functionality to task descriptions and comments

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.8

## [2.3.7] - 2026-03-11

### 🐛 Bug Fixes

- Fix: update actions/checkout version to v6 in workflow files

### 🚜 Refactor

- Refactor: update email templates

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.7

## [2.3.6] - 2026-03-11

### 🚀 Features

- Feat: redesign task details page

### 🐛 Bug Fixes

- Fix default values.yaml
- Fix web probes
- Fix: update auto-merge conditions and change merge strategy to squash
- Fix: update better-auth and tiptap dependencies to latest versions
- Fix: update packageManager version to pnpm@10.32.1

### 💼 Changes

- Merge pull request #1007 from usekaneo/dependabot/npm_and_yarn/npm_and_yarn-0697c9967b

chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates

- Updated helm chart to work with v2.3.5+
- Disabled web probes
- Disabled web probes
- Disabled web probes
- Remove unnecessary api suffix
- Added \_URL env vars
- Merge pull request #1030 from dscham/main

fixed the helm chart to work with v2.3.5

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: fix security issues
- Chore(release): v2.3.6

## [2.3.4] - 2026-03-05

### 🚀 Features

- Feat: openapi spec + migrations
- Feat: add operation summary generation for OpenAPI specs

### 🐛 Bug Fixes

- Fix: update API server URL to use HTTPS
- Fix: update organization paths to include auth prefix
- Fix: update task assignee retrieval to use user table

### 📚 Documentation

- Docs: update openapi spec
- Docs: update openapi
- Docs: fix openapi

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.4

## [2.3.3] - 2026-03-04

### 🐛 Bug Fixes

- Fix: api keys couldn't be created

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.3.3

## [2.3.2] - 2026-03-03

### 🐛 Bug Fixes

- Fix: update auth logic and add apiKey dependency
- Fix: consolidate imports from better-auth/api

### 💼 Changes

- Merge branch 'main' into dependabot/npm_and_yarn/packages/libs/hono-4.12.3
- Merge pull request #990 from usekaneo/dependabot/npm_and_yarn/packages/libs/hono-4.12.3

chore(deps-dev): bump hono from 4.12.2 to 4.12.3 in /packages/libs

- Merge pull request #918 from usekaneo/dependabot/npm_and_yarn/packages/email/nodemailer-8.0.1

chore(deps): bump nodemailer from 7.0.13 to 8.0.1 in /packages/email

- Merge pull request #985 from usekaneo/dependabot/npm_and_yarn/npm_and_yarn-efec19dca3

chore(deps): bump the npm_and_yarn group across 2 directories with 1 update

### ⚙️ Miscellaneous Tasks

- Chore: update deps
- Chore(release): v2.3.2

## [2.3.1] - 2026-03-02

### 🚀 Features

- Feat: implement FadeIn component for smooth animations in landing pages
- Feat: add Plausible analytics scripts for tracking
- Feat(settings): refresh settings sidebars and project/workspace UX
- Feat(tasks): improve bulk selection, column actions, and task detail popovers

### 🐛 Bug Fixes

- Fix: favicon
- Fix(types): align client models and add reliable web typecheck command

### 💼 Changes

- Add Plausible analytics configuration

### 🚜 Refactor

- Refactor(ui): remove Radix Slot and use Base UI render composition

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: update deps
- Chore: update deps
- Chore(release): v2.3.1

## [2.3.0] - 2026-02-25

### 🚀 Features

- Feat(web): persist board filters and polish linear-style filter chips
- Feat(web): revamp dashboard shell navigation and header controls
- Feat(web): polish kanban and backlog interactions
- Feat: improve styles for filters
- Feat(web): implement board search functionality and integrate with task filters
- Feat: add app preview in landing page

### 💼 Changes

- Update documentation theme to Aspen and add SEO indexing
- Update docs theme to almond
- Update theme and logo paths in docs.json
- Merge branch 'main' into coss
- Merge pull request #949 from usekaneo/coss

Feat: Complete redesign

### 🚜 Refactor

- Refactor(web): update coss ui wrappers for menu and popover primitives
- Refactor: simplify CommandDialog usage in SearchCommandMenu and TaskCard components

### 📚 Documentation

- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: switch to mintlify
- Docs: add new landing page
- Docs: add new landing page
- Docs: add new landing page
- Docs: update contributors and sponsors

### 🎨 Styling

- Style: adds coss ui & base ui

### ⚙️ Miscellaneous Tasks

- Chore: fix linting issues
- Chore: update deps
- Chore: fix conflicts
- Ci: fix linting
- Chore(release): v2.3.0

## [2.2.1] - 2026-02-16

### 🐛 Bug Fixes

- Fix: apps/web/Dockerfile to reduce vulnerabilities

The following vulnerabilities are fixed with an upgrade:

- https://snyk.io/vuln/SNYK-ALPINE319-EXPAT-7908400
- https://snyk.io/vuln/SNYK-ALPINE319-EXPAT-7908409
- https://snyk.io/vuln/SNYK-ALPINE319-LIBXML2-9360940
- https://snyk.io/vuln/SNYK-ALPINE319-EXPAT-9459844
- https://snyk.io/vuln/SNYK-ALPINE319-LIBXML2-10078852

### 💼 Changes

- Merge pull request #1 from randoneering/snyk-fix-9eefe18d9b3f10991bc23be0a8350f8c

[Snyk] Security upgrade nginx from 1.25-alpine to 1.29.5-alpine

- Merge pull request #930 from randoneering/main

fix: upgrade nginx 1.25 to 1.29.5 to reduce vulnerabilities

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.2.1

## [2.2.0] - 2026-02-09

### 🚀 Features

- Feat(columns): add column management
- Feat: update getColumnIcon to accept isFinal parameter and apply changes across components
- Feat: enhance task status management with new utility functions and improved status update logic

### 💼 Changes

- Merge branch 'main' into rename-columns
- Merge pull request #927 from usekaneo/rename-columns

feat: Rename columns

### 🚜 Refactor

- Refactor: rename upsertMigrationWorkflowRule to ensureMigrationWorkflowRule and update migration logic for workflow rules

### 📚 Documentation

- Docs: update CLAUDE.md to clarify validation tools, code style guidelines, and pre-commit hook checks
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: update dependencies
- Chore(release): v2.2.0

## [2.1.24] - 2026-02-05

### 🐛 Bug Fixes

- Fix(tasks): fix task deletion

Co-authored-by: fsmeets84 <99346831+fsmeets84@users.noreply.github.com>

### 💼 Changes

- Merge pull request #895 from usekaneo/dependabot/npm_and_yarn/apps/web/better-auth-1.4.18

chore(deps): bump better-auth from 1.4.10 to 1.4.18 in /apps/web

- Merge pull request #887 from usekaneo/dependabot/npm_and_yarn/apps/api/croner-10.0.1

chore(deps): bump croner from 9.1.0 to 10.0.1 in /apps/api

### 🚜 Refactor

- Refactor(auth): remove unused onSuccess prop from OtpSignInForm component

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.24

## [2.1.23] - 2026-01-17

### 💼 Changes

- Enhance environment variable replacement script

- Replace inefficient find+sed loop with grep -l filtering
- Use # delimiter instead of | for safer URL handling
- Add xargs -r to prevent errors on empty results
- Add dedicated block for KANEO_CLIENT_URL like KANEO_API_URL
- Reduces startup time from minutes to seconds
- Merge pull request #1 from usekaneo/main

Pulls new changes from usekaneo

- Merge pull request #2 from usekaneo/main

Update to 2.1.20

- Merge pull request #800 from usekaneo/dependabot/npm_and_yarn/apps/api/types/node-25.0.6

chore(deps-dev): bump @types/node from 25.0.3 to 25.0.6 in /apps/api

- Merge pull request #793 from usekaneo/dependabot/npm_and_yarn/packages/libs/types/react-19.2.8

chore(deps-dev): bump @types/react from 19.2.7 to 19.2.8 in /packages/libs

- Merge branch 'main' into main
- Merge pull request #792 from fsmeets84/main

Enhance environment variable replacement script

- Merge pull request #816 from usekaneo/dependabot/npm_and_yarn/npm_and_yarn-eb4f97c0ca

chore(deps): bump hono from 4.11.3 to 4.11.4 in the npm_and_yarn group across 1 directory

### ⚙️ Miscellaneous Tasks

- Chore: update pnpm
- Chore(release): v2.1.23

## [2.1.21] - 2026-01-12

### 🚀 Features

- Feat: integrate input-otp component for OTP verification

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.21

## [2.1.20] - 2026-01-11

### 🐛 Bug Fixes

- Fix: correct wording in OTP email template for improved clarity

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.20

## [2.1.19] - 2026-01-11

### 🐛 Bug Fixes

- Fix: update OTP email text for clarity

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.19

## [2.1.18] - 2026-01-11

### 🚀 Features

- Feat: enhance task due date management with clearing functionality and UI improvements

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.18

## [2.1.17] - 2026-01-11

### 🚜 Refactor

- Refactor: remove admin authentication and update user retrieval in activity comments

### ⚙️ Miscellaneous Tasks

- Chore: add esbuild override to package.json for version control
- Chore(release): v2.1.17

## [2.1.16] - 2026-01-11

### 🚀 Features

- Feat: add admin authentication and enhance task comment event with user details

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.16

## [2.1.15] - 2026-01-11

### 🚀 Features

- Feat: integrate Bun for documentation generation and add OpenAPI fetching scripts
- Feat: implement task comment creation event handling and integrate with GitHub plugin

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: add drim CLI tool for one-click deployment and enhance installation instructions
- Docs: update documentation structure
- Docs: add SMTP configuration details to environment setup and documentation
- Docs: update redirect URIs for Discord, GitHub, and Google social providers

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.15

## [2.1.14] - 2026-01-10

### 🚀 Features

- Feat: enhance GitHub integration documentation
- Feat: improve invites for smtp off users

### 💼 Changes

- Merge pull request #788 from usekaneo/roa-153

refactor: simplify task details sheet structure and add keyboard escape functionality for closing

- Merge pull request #789 from usekaneo/roa-152

refactor: remove optional workspaceId query validator from project endpoint

### 🚜 Refactor

- Refactor: simplify task details sheet structure and add keyboard escape functionality for closing
- Refactor: remove optional workspaceId query validator from project endpoint

### 📚 Documentation

- Docs: update readme

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.14

## [2.1.13] - 2026-01-09

### 🚀 Features

- Feat: enhance touch interactions and improve drag-and-drop responsiveness in Kanban board

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.13

## [2.1.12] - 2026-01-09

### 🚀 Features

- Feat: add keyboard shortcuts help dialog and enhance task selection with focus management

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.12

## [2.1.11] - 2026-01-08

### 🚀 Features

- Feat: enhance GitHub issue and pull request handling matching
- Feat: add bulk select toolbar on backlog and list view
- Feat: improve github integration, fix invitation bugs, move to otp, email templates improvements

### 💼 Changes

- Merge pull request #766 from usekaneo/dependabot/npm_and_yarn/apps/web/globals-17.0.0

chore(deps-dev): bump globals from 16.5.0 to 17.0.0 in /apps/web

### ⚙️ Miscellaneous Tasks

- Chore: update globals package version to 17.0.0
- Chore(release): v2.1.11

## [2.1.10] - 2026-01-05

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.10

## [2.1.9] - 2026-01-04

### 🚜 Refactor

- Refactor: streamline external link handling by importing ExternalLink type and updating fetch logic

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.9

## [2.1.8] - 2026-01-04

### 🚀 Features

- Feat: enhance auto-merge workflow for Dependabot PRs
- Feat: enhance email invitation handling with SMTP configuration check
- Feat: implement bulk selection and actions for tasks with a new toolbar and menu
- Feat: update issue import functionality to include closed issues and handle pull request links

### 💼 Changes

- Merge pull request #725 from usekaneo/dependabot/npm_and_yarn/apps/api/types/node-25.0.3

chore(deps-dev): bump @types/node from 24.10.1 to 25.0.3 in /apps/api

- Merge pull request #727 from usekaneo/dependabot/npm_and_yarn/apps/web/types/node-25.0.3

chore(deps-dev): bump @types/node from 24.10.1 to 25.0.3 in /apps/web

- Merge pull request #731 from usekaneo/dependabot/npm_and_yarn/apps/web/immer-11.1.0

chore(deps): bump immer from 10.2.0 to 11.1.0 in /apps/web

- Merge pull request #734 from usekaneo/dependabot/npm_and_yarn/apps/api/zod-4.2.1

chore(deps): bump zod from 4.2.0 to 4.2.1 in /apps/api

- Merge pull request #739 from usekaneo/dependabot/npm_and_yarn/packages/email/types/node-25.0.3

chore(deps): bump @types/node from 24.10.1 to 25.0.3 in /packages/email

- Merge pull request #745 from usekaneo/dependabot/npm_and_yarn/apps/docs/types/node-25.0.3

chore(deps-dev): bump @types/node from 24.10.1 to 25.0.3 in /apps/docs

- Bug: fix workspace switching
- Bug: fix workspace switching

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.8

## [2.1.7] - 2026-01-04

### 🚀 Features

- Feat: add external link and integration tables with relations

- Created `external_link` and `integration` tables in the database schema.
- Established foreign key constraints for task and integration references.
- Implemented API endpoints for managing external links.
- Added functionality to handle GitHub integration events.
- Managed external links associated with GitHub events.
- Updated the application to initialize new plugins.
- Added support for handling GitHub webhooks.
- Introduced utility functions for managing external links
  and task integrations.

This commit enhances GitHub integration capabilities.
It enables better task management and external link tracking.

- Feat: enhance activity schema and GitHub integration
- Feat: add task title and description change events to GitHub integration
- Feat: enhance GitHub issue import functionality
- Feat: improve repository listing for GitHub installations
- Feat: integrate pull request display in task row with hover card support

### 🐛 Bug Fixes

- Fix: adjust docs link

### 💼 Changes

- Merge pull request #764 from noobinthisgame/patch-1

fix: adjust docs link

- Merge branch 'main' into feat/improve-github-integration
- Merge pull request #750 from usekaneo/feat/improve-github-integration

feat: add external link and integration tables with relations

### 🚜 Refactor

- Refactor: remove unused Button import from page-actions component

### 📚 Documentation

- Docs: add railway docs
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: update deps
- Chore(release): v2.1.7

## [2.1.6] - 2025-12-20

### 🚀 Features

- Feat: add access control to API endpoints
- Feat: add GitHub webhook handling and workspace access validation

### 💼 Changes

- Merge pull request #720 from Rodaviva29/main
- Merge pull request #723 from AlessandroZanatta/main

feat: add access control to API endpoints

### 📚 Documentation

- Docs: update environment variable documentation and redirect URIs for social providers
- Docs: update AUTH_SECRET generation command to use base64

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.6

## [2.1.5] - 2025-12-16

### 💼 Changes

- Update links to docs in README.md
- Merge pull request #719 from FrostyLabs/patch-1

chore: Update links to docs in README.md

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.1.5

## [2.1.4] - 2025-12-15

### 🚀 Features

- Feat(api): enhance workspace access validation with API key support

- Added API key validation to the workspace access check.
- Updated the workspace access middleware to retrieve and pass the API key ID.
- Modified the validateWorkspaceAccess function to include API key verification logic.
- Feat(docs): create initial DocsPage component with redirect to core documentation

### 🐛 Bug Fixes

- Fix(auth): improve OAuth scopes handling and update redirect URI in documentation

### 💼 Changes

- Merge pull request #689 from usekaneo/dependabot/npm_and_yarn/apps/web/radix-ui/react-dialog-1.1.15

chore(deps): bump @radix-ui/react-dialog from 1.1.14 to 1.1.15 in /apps/web

- Merge pull request #712 from usekaneo/dependabot/npm_and_yarn/apps/docs/tw-animate-css-1.4.0

chore(deps-dev): bump tw-animate-css from 1.3.8 to 1.4.0 in /apps/docs

- Merge pull request #709 from usekaneo/dependabot/npm_and_yarn/apps/docs/tailwindcss/postcss-4.1.18

chore(deps-dev): bump @tailwindcss/postcss from 4.1.11 to 4.1.18 in /apps/docs

- Merge pull request #705 from usekaneo/dependabot/npm_and_yarn/packages/email/types/node-25.0.2

chore(deps): bump @types/node from 24.10.1 to 25.0.2 in /packages/email

- Merge pull request #703 from usekaneo/dependabot/npm_and_yarn/apps/api/types/node-25.0.2

chore(deps-dev): bump @types/node from 24.10.1 to 25.0.2 in /apps/api

- Merge pull request #699 from usekaneo/dependabot/npm_and_yarn/apps/api/tsx-4.21.0

chore(deps-dev): bump tsx from 4.20.6 to 4.21.0 in /apps/api

- Merge pull request #698 from usekaneo/dependabot/npm_and_yarn/apps/web/framer-motion-12.23.26

chore(deps): bump framer-motion from 12.23.24 to 12.23.26 in /apps/web

- Merge pull request #695 from usekaneo/dependabot/npm_and_yarn/packages/libs/multi-e1aa4930cf

chore(deps-dev): bump react and @types/react in /packages/libs

- Merge pull request #694 from usekaneo/dependabot/npm_and_yarn/apps/web/blocknote/shadcn-0.44.2

chore(deps): bump @blocknote/shadcn from 0.37.0 to 0.44.2 in /apps/web

### 🚜 Refactor

- Refactor(api): reorganize workspace access validation logic
- Refactor: change interface declarations to type aliases for consistency
- Refactor(api): update schemas to use picklists for status, priority, and type fields

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: add sponsorship information to README and issue template, and include sponsor link in layout
- Docs: update backend API guidelines

- Enhanced backend API documentation with detailed guidelines for Hono, Drizzle
  ORM, and Better Auth.
- Added best practices for database schema definitions and migrations.
- Introduced new cursor rules for development and deployment processes.
- Improved frontend web development guidelines for React and TanStack integration.
- Docs: update AUTH_SECRET documentation and enhance API key management UI

### ⚙️ Miscellaneous Tasks

- Chore: Update GitHub funding user from 'usekaneo' to 'andrejsshell'
- Chore: Add sponsors badge to README
- Chore: update deps
- Chore(release): v2.1.4

## [2.1.1] - 2025-12-13

### 🚀 Features

- Feat(auth): add custom OAuth provider support

- Add custom OAuth configuration support
- Update auth client with custom provider handling
- Add documentation for custom OAuth setup
- Update environment variables documentation
- Feat(db): add api key table schema
- Feat(db): add api key relations
- Feat(db): add api key migration
- Feat(db): export api key table from database
- Feat(api): add workspace access validation utility
- Feat(auth): add api key authentication middleware
- Feat(api): add OpenAPI endpoint and documentation handler
- Feat(web): add api key types
- Feat(web): add api key query hook
- Feat(web): add create api key mutation hook
- Feat(web): add delete api key mutation hook
- Feat(web): add api key table component
- Feat(web): add create api key dialog component
- Feat(web): add api key created modal component
- Feat(web): add developer settings page
- Feat(web): add developer tab to account settings
- Feat(docs): add OpenAPI specification file
- Feat(docs): add OpenAPI parsing utilities
- Feat(docs): add OpenAPI API route
- Feat(docs): add API page client component
- Feat(docs): add API page server component
- Feat(docs): add documentation generation script
- Feat(docs): update source configuration for new structure
- Feat(docs): update docs page for API routes
- Feat(docs): update docs layout navigation
- Feat(api): add shared response schemas for OpenAPI documentation
- Feat(api): replace v.any() with proper type schemas in all routes

- Update label routes to use labelSchema
- Update activity routes to use activitySchema
- Update search route with proper search result schemas
- Update GitHub integration routes with domain-specific schemas
- Update notification routes to use notificationSchema
- Update project routes to use projectSchema
- Update time-entry routes to use timeEntrySchema
- Update task routes to use taskSchema and add missing describeRoute calls
- Feat(docs): add API overview page with endpoint cards
- Feat(docs): add redirects from old documentation paths

- Redirect /docs to /docs/core
- Auto-redirect old /docs/_ paths to /docs/core/_ if they exist
- Handle redirects in both page rendering and metadata generation
- Feat(docs): update internal links to new documentation structure

- Update Get Started links to point to /docs/core
- Update all internal documentation links to use /docs/core prefix
- Update GitHub integration and social provider documentation links
- Feat(docs): configure docs generator to group endpoints by domain

- Add groupBy function to organize API docs by path prefix
- Map API paths to appropriate folders (tasks, projects, labels, etc)
- Disable includeDescription to prevent hydration errors
- Feat: add DISABLE_GUEST_ACCESS environment variable

- Add hasGuestAccess to backend settings
- Conditionally enable anonymous auth plugin based on env var
- Hide guest access button in sign-in and sign-up when disabled
- Defaults to enabled for backward compatibility
- Feat(database): update workspace slug handling
- Feat(auth): add support for custom OAuth/OIDC provider integration

- Implemented in the authentication middleware to support custom OAuth providers.
- Updated settings to include flag for environment variable checks.
- Enhanced documentation to include configuration details for custom OAuth/OIDC.
- Added UI elements for custom OAuth sign-in in the authentication flow.
- Updated relevant components and routes to handle custom OAuth sign-in logic.
- Feat(auth): add support for custom OAuth/OIDC provider integration

- Implemented in the authentication middleware to support custom OAuth providers.
- Updated settings to include flag for environment variable checks.
- Enhanced documentation to include configuration details for custom OAuth/OIDC.
- Added UI elements for custom OAuth sign-in in the authentication flow.
- Updated relevant components and routes to handle custom OAuth sign-in logic.
- Feat(database): update workspace slug handling
- Feat(api): implement workspace access middleware for project routes
- Feat(api): add Discord and guest access sign-in options to config schema
- Feat(api): add updatedAt field to githubIntegrationSchema
- Feat(api): implement updateTimeEntry functionality in time-entry API

- Added updateTimeEntry controller to handle updates for time entries.
- Enhanced the time entry schema to include an optional description field.
- Updated the API endpoint to process startTime, endTime, and description for time entry updates.
- Feat(api): enhance deleteComment function to return deleted comment

- Updated deleteComment controller to return the deleted comment after successful deletion.
- Modified database query to include returning clause for improved functionality.
- Feat(api): add event subscriptions for task activity tracking
- Feat(api): enhance event subscriptions for task and workspace notifications
- Feat(api): improve API key verification and error handling
- Feat(api): remove optional description field from label schema
- Feat(api): update OpenAPI schema and dependencies

- Updated API server URL to use HTTPS.
- Added updatedAt field to various schemas for tracking modifications.
- Introduced new fields for sign-in options and workspace ID in the API.
- Updated package dependencies to include shiki version 3.20.0.
- Removed unused client configuration file for API page.
- Feat(docs): add authentication guide and update API documentation

- Introduced a new guide for API authentication detailing how to create and use API keys.
- Updated the main API documentation to link to the new authentication guide.
- Added the authentication page to the API meta information.
- Feat(api): validate task creation data and update notification content

### 🐛 Bug Fixes

- Fix: resolve linter issues

- Replace any types with Record<string, unknown> in api-key types
- Remove unused updateTimeEntry import from time-entry route
- Apply biome auto-fixes
- Fix: prevent create task modal from closing on outside click

- Add onInteractOutside handler to prevent accidental closes
- Protect users from losing task creation progress
- Modal can only be closed via Cancel button or Escape key
- Fix(api): improve query validation and update API URL structure

- Refactor API URL to use KANEO_API_URL directly
- Enhance query validation to provide clearer error messages for minimum length
- Update limit validation to specify minimum value error message

### 💼 Changes

- Merge remote-tracking branch 'origin/main' into feat/api-keys-and-openapi
- Merge pull request #682 from usekaneo/feat/api-keys-and-openapi

Feat: Add API key support

### 🚜 Refactor

- Refactor(api): add OpenAPI schema to config endpoint
- Refactor(api): add OpenAPI schemas to activity endpoints
- Refactor(api): add OpenAPI schemas to label endpoints
- Refactor(api): add OpenAPI schemas to project endpoints
- Refactor(api): add OpenAPI schemas to task endpoints
- Refactor(api): add OpenAPI schemas to notification endpoints
- Refactor(api): add OpenAPI schemas to time entry endpoints
- Refactor(api): add OpenAPI schemas to search endpoints
- Refactor(api): add OpenAPI schemas to github integration endpoints

### 📚 Documentation

- Docs: reorganize documentation into core folder
- Docs: add API documentation meta file
- Docs: add activity endpoint documentation
- Docs: add comments endpoint documentation
- Docs: add label endpoint documentation
- Docs: add project endpoint documentation
- Docs: add task endpoint documentation
- Docs: add notification endpoint documentation
- Docs: add time entry endpoint documentation
- Docs: add github integration endpoint documentation
- Docs: add config and search endpoint documentation
- Docs: remove old documentation files
- Docs: document DISABLE_GUEST_ACCESS environment variable

- Add Access Control section to environment variables docs
- Document the new DISABLE_GUEST_ACCESS option with default value
- Docs: add Discord SSO documentation

- Create Discord SSO setup guide
- Document Discord environment variables
- Add Discord to social providers navigation
- Include redirect URI configuration instructions
- Docs: document DISABLE_GUEST_ACCESS environment variable

- Add Access Control section to environment variables docs
- Document the new DISABLE_GUEST_ACCESS option with default value

### 🎨 Styling

- Style(docs): update global styles
- Style: adjust spacing for guest access separator in sign-up component

- Updated the layout of the guest access separator to improve visual consistency.
- Added line breaks for better readability of the or text.
- Style: adjust spacing for guest access separator in sign-up component

- Updated the layout of the guest access separator to improve visual consistency.
- Added line breaks for better readability of the or text.
- Style: adjust spacing for guest access separator in sign-up component

- Updated the layout of the guest access separator to improve visual consistency.
- Added line breaks for better readability of the or text.
- Style: adjust spacing for guest access separator in sign-up component

- Updated the layout of the guest access separator to improve visual consistency.
- Added line breaks for better readability of the or text.

### ⚙️ Miscellaneous Tasks

- Chore(db): update migration journal
- Chore(api): add hono-openapi dependency
- Chore(web): regenerate route tree
- Chore(web): update auth client configuration
- Chore(docs): update dependencies
- Chore: update lockfile
- Chore(docs): regenerate API documentation with updated schemas
- Chore(api): remove unused imports from config route
- Chore(release): v2.0.9
- Chore(docs): update contributing and environment setup documentation
- Chore(release): v2.1.1

## [2.0.9] - 2025-12-10

### 🚀 Features

- Feat(database): update session and workspace schemas

- Renamed to in the table.
- Dropped the unique constraint on for and .
- Modified default values for in and tables.
- Set default to false in the table.
- Enforced NOT NULL constraint on in the table.
- Added column to the table with a default value.
- Created indexes for various tables to improve query performance.
- Feat: add DISABLE_GUEST_ACCESS environment variable

- Add hasGuestAccess to backend settings
- Conditionally enable anonymous auth plugin based on env var
- Hide guest access button in sign-in and sign-up when disabled
- Defaults to enabled for backward compatibility

### 🐛 Bug Fixes

- Fix: prevent create task modal from closing on outside click

- Add onInteractOutside handler to prevent accidental closes
- Protect users from losing task creation progress
- Modal can only be closed via Cancel button or Escape key

### 💼 Changes

- Bug: Check list won't save #640 (#656)

* fix: #640 changed the comments and descriptions to be stored as json instead of markdown text

* Revert "fix: #640 changed the comments and descriptions to be stored as json instead of markdown text"

This reverts commit 2ecfd2d01a9748596948627bf19853e092b2c29a.

- fix: #640 replacing multiple new lines with a single '\n' for the task description and the comments

- Revert "fix: #640 replacing multiple new lines with a single '\n' for the task description and the comments"

This reverts commit b0f0fd9501836c85cc242514d9d27aba0d044a71.

- fix: #640

replacing multiple new lines with a single '\n' for the task description and the comments

### 📚 Documentation

- Docs: document DISABLE_GUEST_ACCESS environment variable

- Add Access Control section to environment variables docs
- Document the new DISABLE_GUEST_ACCESS option with default value
- Docs: add Discord SSO documentation

- Create Discord SSO setup guide
- Document Discord environment variables
- Add Discord to social providers navigation
- Include redirect URI configuration instructions

### 🎨 Styling

- Style: adjust spacing for guest access separator in sign-up component

- Updated the layout of the guest access separator to improve visual consistency.
- Added line breaks for better readability of the or text.
- Style: adjust spacing for guest access separator in sign-up component

- Updated the layout of the guest access separator to improve visual consistency.
- Added line breaks for better readability of the or text.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.0.9

## [2.0.8] - 2025-12-09

### 🚀 Features

- Feat(auth): add support for custom OAuth/OIDC provider integration

- Implemented in the authentication middleware to support custom OAuth providers.
- Updated settings to include flag for environment variable checks.
- Enhanced documentation to include configuration details for custom OAuth/OIDC.
- Added UI elements for custom OAuth sign-in in the authentication flow.
- Updated relevant components and routes to handle custom OAuth sign-in logic.

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.0.8

## [2.0.7] - 2025-12-08

### 🚀 Features

- Feat(migration): update invitation table to add created_at column with default value handling

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.0.7

## [2.0.6] - 2025-12-08

### 🚀 Features

- Feat(auth): enhance base URL handling and trusted origins

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.0.6

## [2.0.5] - 2025-12-07

### 🚀 Features

- Feat(migration): rename active_workspace_id to active_organization_id

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.0.5

## [2.0.4] - 2025-12-05

### 🚀 Features

- Feat(email): Add option to enable RequireTLS (#630)

* feat: add requireTLS with environment variable to nodemailer

* docs: update environment variables page

- Feat: add ThemeToggleDropdown component and integrate into AppSidebar (#652)

### 🐛 Bug Fixes

- Fix: standardize title separator from ⎯ to — across metadata and layout files
- Fix: Fix Status not updating when moved in the grid (#638)

### 📚 Documentation

- Docs: update contributors and sponsors

### 🎨 Styling

- Style: refactor: format code and ensure newline at end of file in task and theme toggle components

### ⚙️ Miscellaneous Tasks

- Chore(release): v2.0.4

## [2.0.3] - 2025-11-05

### ⚙️ Miscellaneous Tasks

- Chore: update healtcheck
- Chore(release): v2.0.3

## [2.0.2] - 2025-11-02

### 🚀 Features

- Feat: add version display to app sidebar and expose app version globally

- Introduced a new component to show the application version in the sidebar footer.
- Updated to define a global constant from the package.json version.
- Modified to declare the constant for TypeScript support.

### 🐛 Bug Fixes

- Fix: update footer link to point directly to the documentation root

### ⚙️ Miscellaneous Tasks

- Chore: update depds
- Chore(release): v2.0.2

## [2.0.1] - 2025-11-02

### 🚀 Features

- Feat: enhance authentication configuration for cross-subdomain support and update API client paths
- Feat: refactor API routing to use separate Hono instance and update client API URL structure
- Feat: adds removing of a team member

### 🐛 Bug Fixes

- Fix: ensure API URL structure is consistent by handling trailing '/api' in base URL

### 🚜 Refactor

- Refactor: update navigation menu items in layout for clarity and improved user experience

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: remove deprecated docker-compose configuration files and clean up volume definitions
- Chore: remove deprecated docker-compose configuration files and clean up volume definitions
- Chore: update docker-compose to use latest images for api and web services
- Chore(release): v2.0.1

## [2.0.0] - 2025-10-23

### 🚀 Features

- Feat: better auth integration (#466)

* refactor: migrate to better-auth

* fix: migrate passwords, autofill on auth forms

* feat: implement better authentication system

- Refactor auth API with improved security and session handling
- Enhance authentication forms with better UX and validation
- Update auth provider with streamlined state management
- Improve sign-in/sign-up flows with better error handling
- Add enhanced user navigation and dashboard auth integration

Co-authored-by: Elliot Braem <elliot@ejlbraem.com>
Co-authored-by: Satwik Shresth <65219245+satwikShresth@users.noreply.github.com>

- chore: add TODO for production URL in auth configuration

---

Co-authored-by: Elliot Braem <elliot@ejlbraem.com>
Co-authored-by: Satwik Shresth <65219245+satwikShresth@users.noreply.github.com>

- Feat: implement onboarding flow and update routing (#469)

- Added a new onboarding flow component for workspace creation.
- Introduced a new route for onboarding under authenticated layout.
- Updated dashboard routing to redirect to onboarding instead of workspace creation.
- Removed the old workspace creation route to streamline the onboarding process.

### 🐛 Bug Fixes

- Fix: preserve formatting when copy/pasting in new task modal (#432) (#481)

### 💼 Changes

- [IMP] interactive controls and ARIA attributes (#485)

All interactive controls are accessible

- Add ARIA attributes and labels to buttons and controls.
- Improve keyboard navigation (Tab, Enter, Space, Arrow keys).
- Enhance focus management (focus indicators, focus trap where needed).
- Review areas handling keyboard events for accessibility best practices.
- Fix the JSX structure: ensure each <a> tag is properly opened and closed, with props in quotes.
- Add ARIA attributes, tabIndex, role, and keyboard handlers only once per element.
- Restore the correct children for each link.
- [REF]: update_task: optimize event publishing in updateTask function (#483)

The event publishing for status, priority, and assignee changes in update-task.ts is now parallelized using Promise.all.

Other controllers like create-task.ts, import-tasks.ts, create-notification.ts, and create-time-entry.ts publish a single event per operation, so parallelization is not needed there. If you want to optimize batch operations (e.g., importing multiple tasks), you could collect all event promises and use Promise.all for those as well.

- Change template from .Values.api.persistence to .Values.postgresql.persistence (#510)
- Version 2 (#570)

* refactor: moves to pathless authenticated route for protection

* feat: migrates web to use auth client organization methods

* fix: merge conflicts, route gen

* patches up organizations, adds missing relations and addresses idempotency (#1)

* fix: better-auth config

* fix: missing relations

* fix: migration file idepontency

* chore(deps): update better-auth to version 1.3.8 and add lastLoginMethod plugin

* chore(deps): update tailwindcss and related packages to version 4.1.13

* refactor: enhance database migration logging with emojis for better visibility

* chore: update favicon and logo assets, improve layout styles, and enhance font integration

* fix: update email placeholder in sign-in and sign-up forms for consistency

* fix: adjust button margin in sign-up form for improved layout

* feat: enhance sidebar navigation with search functionality and UI improvements

* fix: update active item styles in navigation components and adjust sign-in callback URL

* refactor: improve task card styling and layout in kanban board

* refactor: enhance task card layout and due date indicators in kanban board

* feat: add user avatar component and enhance sidebar navigation with workspace switcher

* refactor: update UI components for improved styling and layout in navigation and kanban board

* docs: update README with new logo and revised project description for clarity

* feat: add animation classes and keyframes for enhanced UI transitions in CSS

* refactor: update task card styling for improved readability and layout in kanban board

* refactor: update alias for utils to point to new library location

* refactor: implement collapsible sections in navigation components

* refactor: update page titles in dashboard and project board for better context

* feat: implement password hashing and verification using bcrypt in authentication

* refactor: improve user avatar component styling and update button sizes for consistency

* feat: add environment configuration and update service definitions for local development

* feat: implement magic link authentication and email sending functionality

* feat: update environment configuration and integrate dotenv-mono for improved variable management

* feat: initial task details page

* chore: update turbo package to version 2.5.6 in package.json and pnpm-lock.yaml

* refactor: enhance task card component with user avatars

* refactor: simplify column icon rendering and update icons in column definitions

* ci: fixing docker build

* ci: fixing docker build

* ci: i'm actually using react

* ci: not using react

* ci: including email package in build

* chore: update database configuration in .env.sample and adjust healthcheck user in docker-compose files

* ci: add back reactg import

* ci: build email package before main application in Dockerfile

* chore: removes react

* ci: excludes monorepo packages when building FE

* ci: update Dockerfile and package.json to streamline build process

* ci: add no_cache option and cleanup step to Docker manual workflow

* ci: update Dockerfile and package configurations for email package integration

* feat: add task management popovers for assignee, due date, priority, and status

* feat: implement team and label management features in the database schema and API

* feat: add health check endpoint and update Dockerfile health check command

* feat: enhance task management with activity tracking and updates for assignee, priority, and status

* feat: implement due date update functionality in task management with associated activity tracking

* feat: add label filtering support to task management, enhancing task visibility and organization

* feat: enhance task labels functionality with deduplication and improved filtering in the board view

* feat: integrate rich text editing for task description and title with improved state management

* feat: refactor create task modal with new task description editor and enhanced label management

* feat: enhance email invitation functionality

* feat: add GitHub sign-in support with environment variable configuration

* feat: initial docs refactor

* feat: update dependencies and enhance documentation layout with new features section

* feat: add team and team_member tables, enhance invitation and label tables with new columns, and implement foreign key constraints

* chore(release): v2.0.1-beta.2

* feat: implement workspace user email migration to user ID in workspace_member table

* feat: improve workspace user email migration

* feat: implement fixed workspace migration

* feat: implement fixed workspace migration to convert user_email to user_id

* feat: implement fixed workspace migration to convert user_email to user_id

* feat: implement fixed workspace migration to convert user_email to user_id

* fix: temporarily ignore error display in AuthProvider component

* fix: temporarily ignore error display in AuthProvider component

* feat: enhance HomePage layout with new PersonalStatement and SectionSeparator components

* feat: add Footer component and update HomePage layout to include it

* docs: initial v2 docs

* style: update layout styles for logo and links in documentation layout

* feat: initial new settings layout

* chore: upgrade Biome to version 2.0.6 and update configuration files

* feat: add documentation for GitHub and Google social providers, including setup and configuration guides

* feat: update account settings routes and navigation to include information and preferences sections

* style: update metadata titles and alt text in layout for consistency and branding

* feat: add general settings page for workspace management and update navigation to include it

* style: update AvatarFallback text color for improved visibility in workspace settings

* feat: improve backlog with new design

* feat: enhance page titles across various components for improved user experience

* feat: add navigation buttons for backlog and board in project layout

* refactor: remove framer-motion from AuthLayout for simpler rendering

* chore: unused import

* refactor: replace framer-motion header with standard HTML header for improved performance

* feat: implement project settings pages with navigation for general, visibility, integrations

* chore: remove unused import from get-github-integration controller

* chore: add npm dependency updates for email and docs packages in dependabot configuration

* chore: update lucide-react dependency to version 0.545.0 and adjust imports in project layout

* refactor: remove title prop from ProjectLayout in multiple components for consistency

* refactor: simplify className handling in ProjectLayout using cn utility

* chore: update page title and meta tags for improved branding and consistency

* refactor: update logo component to use currentColor

* feat: add due date selection functionality to task card context menu

* fix: update className in task card context menu for consistent styling

* feat: refactor project settings routes to support dynamic project IDs and remove deprecated routes

* feat: implement GitHub integration settings for project-specific configurations

* feat: add comment input and display components for task activities

* refactor: enhance label filtering logic in task modals and popovers for improved performance and consistency

* fix: trim whitespace in comment input and parsing to improve content handling

* feat: implement edition of comments

* style: lower icon for comment input

* style: lower icon for comment input

* style: update project name display to conditionally apply fontw

* ci: change cover

* docs: update layout and footer with new Discord link, add new font files, and remove unused assets

* chore: update React and Webpack dependencies, add a new Banner component to the documentation layout

* docs: add banner

* docs: update readme

* docs: update layout and hero components to announce the release of Kaneo v2 with new links and celebratory icons

* fix: correct error callback URL in sign-in process

* style: update priority icons with new color shades for better visibility

* style: update icon color for better visibility

* feat: add SuggestionMenuController

---

Co-authored-by: Elliot Braem <elliot@ejlbraem.com>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

### 🚜 Refactor

- Refactor: moves to pathless, protected authenticated routes and beforeLoad dashboard routing (#467)

* refactor: moves to pathless authenticated route for protection

* fix: uncomment

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore: removing bun.lock
- Chore(release): v2.0.0

## [1.2.4] - 2025-08-17

### 🚀 Features

- Feat: replace loading indicators with a new LoadingSkeleton component for improved UI consistency
- Feat(391): add "archive" and "planned" to the context menu of cards (#436)
- Feat(#383): add rich text editor for comments (#435)

- Replace textarea with TipTap editor in comment input
- Add MarkdownRenderer for formatted comment display
- Support line breaks, bold, italic, lists, and links
- Maintain backward compatibility with existing comments
- Use same editor as task descriptions for consistency

Fixes issue where line breaks were removed from comments.

- Feat: enhance metadata and sitemap for improved SEO and user experience

### 🐛 Bug Fixes

- Fix(#389): added archived to the calculation of "solved" tickets (#437)
- Fix: reorder imports in task-activities and task-comment components for consistency
- Fix some inaccuracies in the helm chart values, and add some doc (#454)

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.2.4

## [1.2.3] - 2025-08-06

### ⚙️ Miscellaneous Tasks

- Chore: adding description to imported issues
- Chore(release): v1.2.3

## [1.2.2] - 2025-08-06

### 🚀 Features

- Feat: implement GitHub issue handling for task status and priority changes

### 🐛 Bug Fixes

- Fix: update default API URL to localhost and add ASCII art logo in main entry file

### 📚 Documentation

- Docs: update environment setup instructions and add troubleshooting guide for common issues

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.2.2

## [1.2.1] - 2025-08-05

### 🚀 Features

- Feat: add delete task confirmation dialog to task card and task info components
- Feat: enhance task description formatting and skip GitHub issue creation for related tasks

### 📚 Documentation

- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Ci: export app for vercel deployment
- Ci: export app for vercel deployment
- Ci: export app for vercel deployment
- Chore(release): v1.2.1

## [1.2.0] - 2025-08-01

### 🐛 Bug Fixes

- Fix: resolve delete project dialog bug (#419)

Co-authored-by: Martin Mitev <martin.mitev@codechem.com>

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.2.0

## [1.1.9] - 2025-07-30

### 🚜 Refactor

- Refactor: update favicon and manifest files, remove unused icons, and add new site.webmanifest

### ⚙️ Miscellaneous Tasks

- Chore: add cursor files
- Chore(release): v1.1.9

## [1.1.8] - 2025-07-22

### 🚀 Features

- Feat: add croner for scheduled tasks and implement demo user setup

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.1.8

## [1.1.7] - 2025-07-22

### 🚀 Features

- Feat: enable demo mode in layout and dashboard components

### ⚙️ Miscellaneous Tasks

- Chore: enable automatic release notes generation in workflow
- Chore(release): v1.1.7

## [1.1.6] - 2025-07-22

### 🚜 Refactor

- Refactor: remove workspace retrieval logic from dashboard route

### 🎨 Styling

- Style: add class for button height adjustment in project settings

### ⚙️ Miscellaneous Tasks

- Chore: update changelog generation command to use pnpm
- Chore: update changelog generation command to use bun instead of pnpm
- Chore(release): v1.1.6

## [1.1.5] - 2025-07-21

### 🐛 Bug Fixes

- Fix: port number in documentation (#375)

### 📚 Documentation

- Docs: update contributors and sponsors

### 🎨 Styling

- Style: use a consistent design system (#363)

* style: make modal component follow new design system

* chore: accessibility issues

* style: enhance card gradient

* feat: implement sidebar navigation and UI components

* feat: add layout component and enhance sidebar functionality

* feat: add keyboard shortcut for sidebar toggle and enhance tooltip styling

* style: adjust padding in sidebar and layout header for improved spacing

* feat: adding shortcuts

* feat: enhance keyboard shortcuts for sidebar and notifications, update tooltip content

* feat: update notification table schema and enhance command palette functionality

* refactor: remove unused SidebarRail import and clean up notification dropdown code

* feat: enhance workspace and project creation modals with description field and UI improvements

* feat: update kanban board's design

* feat: implement database relations and enhance project queries for improved data handling

* feat: add user preferences management and enhance workspace settings with new features

* fix: update task label layout and adjust column header color for better visibility

* refactor: move column icon logic to a separate module and update ListView to utilize new functions

* fix: update ListView styles to allow for overflow scrolling in project columns

* refactor: restructure project routing

* feat: implement members management in workspace, including routing and UI updates

* feat: enhance project and workspace settings with due date calculations and UI improvements

* feat: update workspace settings UI with improved structure and unsaved changes alert

* refactor: remove unused Alert component import from workspace settings

* refactor: migrate display preferences to user preferences store and update related components

* chore: update package versions and enhance task card context menu with priority color integration

* refactor: improve workspace switcher keyboard shortcut display with dynamic modifier key text

* refactor: enhance backlog list view with user preferences integration

* feat: enhance command palette with task, project, and workspace

* feat: add keyboard shortcuts and tooltips for project and task creation in navigation and dashboard

* refactor: remove unused BoardFilters and TaskRowOverlay components

* refactor: remove unused setDemoUser function and clean up related code in index.ts

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.1.5

## [1.1.4] - 2025-07-10

### 🚀 Features

- Feat: implement GitHub issues import functionality
- Feat: implement task detail modal and enhance task interaction
- Feat: implement global search functionality

### 🐛 Bug Fixes

- Fix: update task detail modal to display assignee name

- Replaced userEmail with assigneeName in the PublicTaskDetailModal for improved clarity.
- Enhanced avatar display logic to handle null values for assignee details.

### ⚙️ Miscellaneous Tasks

- Chore: Update FUNDING.yml
- Chore(release): v1.1.4

## [1.1.0] - 2025-07-06

### 🚀 Features

- Feat: enhance task retrieval and display with assignee details

- Updated the getTask function to include assignee name and email by joining the userTable.
- Modified TaskCard component to display the assignee's name instead of userEmail.
- Adjusted CreateTaskModal to include assigneeEmail when creating a new task.
- Updated board route to correctly map assigneeName from task data.
- Refined Task type definition to align with the new task structure.

### 🐛 Bug Fixes

- Fix: update task assignee handling and improve task display

- Replaced userEmail with assigneeName in BacklogTaskRow for better clarity.
- Updated task assignment logic in BacklogListView to correctly map assigneeName and assigneeEmail.
- Ensured that null values are handled gracefully for assignee details in task filtering.
- Modified TaskEditPage to use router for navigation instead of Link component.

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.1.0

## [1.0.9] - 2025-07-05

### 🚀 Features

- Feat: update footer with operational status link and visual indicator
- Feat: add configuration endpoint and integrate config handling in sign-up flow

- Introduced a new `/config` endpoint to fetch application settings.
- Implemented config fetching in the sign-up route to conditionally
  disable registration based on settings.
- Updated AuthToggle component to hide registration link if registration
  is disabled.
- Feat: update layout configuration and metadata
- Feat: add documentation links to home layout with icons
- Feat: add theme selection options to command palette

### 🐛 Bug Fixes

- Fix: update Quick Start link in README to point to documentation

### 🚜 Refactor

- Refactor: remove environment variable checks
- Refactor: improve GitHub app initialization and error handling
- Refactor: enhance CreateTaskModal with improved label management and task creation flow
- Refactor: enhance Editor component layout and improve task description modal styling
- Refactor: simplify Editor component click handling and remove unused keydown event

### 🎨 Styling

- Style: update delete button styling for improved UX

### ⚙️ Miscellaneous Tasks

- Chore: update dependencies
- Chore(release): v1.0.9

## [1.0.2] - 2025-06-22

### 🚜 Refactor

- Refactor: simplify task data destructuring in handleTaskCreated function

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.0.2

## [1.0.1] - 2025-06-22

### 🚀 Features

- Feat: GitHub integration (#323)

* chore(deps): bump @hookform/resolvers from 3.10.0 to 5.1.1 in /apps/web

Bumps [@hookform/resolvers](https://github.com/react-hook-form/resolvers) from 3.10.0 to 5.1.1.

- [Release notes](https://github.com/react-hook-form/resolvers/releases)
- [Commits](https://github.com/react-hook-form/resolvers/compare/v3.10.0...v5.1.1)

---

updated-dependencies:

- dependency-name: "@hookform/resolvers"
  dependency-version: 5.1.1
  dependency-type: direct:production
  update-type: version-update:semver-major
  ...

Signed-off-by: dependabot[bot] <support@github.com>

- chore(deps): update zod to version 3.25.6

- refactor: replace Error with HTTPException

- chore(ci): specify biome version 1.9.4 in CI workflow

- chore(ci): update Biome version to 1.9.7 in CI workflow

- feat: enhance project settings form with unsaved changes warning

- feat: implement GitHub integration with create, delete, and verify functionalities

- chore: update build script in package.json to output ESM format

- chore: refine build script in package.json to include additional external packages

- chore(deps): update @octokit/webhooks and octokit versions in package.json and pnpm-lock.yaml

- refactor: remove unused repository ID retrieval and update webhook URLs in documentation

- feat: add GitHub app info endpoint and integrate it into the repository browser modal

- feat: increase repository listing limit to 500 for GitHub app integration

- feat: enhance GitHub comment formatting and task description handling

- feat: add GitHub integration documentation and setup guide enhancements

- chore(deps): bump @hookform/resolvers from 3.10.0 to 5.1.1 in /apps/web (#318)

- chore(deps): bump @hookform/resolvers from 3.10.0 to 5.1.1 in /apps/web

Bumps [@hookform/resolvers](https://github.com/react-hook-form/resolvers) from 3.10.0 to 5.1.1.

- [Release notes](https://github.com/react-hook-form/resolvers/releases)
- [Commits](https://github.com/react-hook-form/resolvers/compare/v3.10.0...v5.1.1)

---

updated-dependencies:

- dependency-name: "@hookform/resolvers"
  dependency-version: 5.1.1
  dependency-type: direct:production
  update-type: version-update:semver-major
  ...

Signed-off-by: dependabot[bot] <support@github.com>

- chore(deps): update zod to version 3.25.6

- refactor: replace Error with HTTPException

- chore(ci): specify biome version 1.9.4 in CI workflow

- chore(ci): update Biome version to 1.9.7 in CI workflow

- feat: enhance project settings form with unsaved changes warning

---

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: Andrej <aacevski@gmail.com>

- chore(release): v1.0.0

- fix: resolve merge conflicts in pnpm-lock.yaml and update @types/node dependencies

---

Signed-off-by: dependabot[bot] <support@github.com>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

### ⚙️ Miscellaneous Tasks

- Chore(release): v1.0.1

## [1.0.0] - 2025-06-20

### 🚀 Features

- Feat: comments ui proposal (#262)

* feat: add action buttons on comments

* feat: add comment deletion api and use it in front

* feat: update comment - ui

* feat: update comment - backend

* feat: update comment - add a callback

* feat: check user in backend when update or delete

* feat: plug create comment on comment creation workflow instead of create activity

* feat: only show cancel on the editing comment

- Feat(board): add CreateTaskModal for task creation functionality
- Feat(hero): update hero component to promote Kaneo Cloud with new icon and link
- Feat(index.html): add Plausible Analytics script for cloud.kaneo.app domain
- Feat: migrate from SQLite to PostgreSQL (#315)

* feat: migrate from SQLite to PostgreSQL

Implement PostgreSQL migration with updated configurations and documentation

- refactor: remove sidebar and navigation elements from layout

- feat: add public project components for enhanced user experience

* Introduced `CopyUrlButton` for easy URL copying.
* Added `ErrorView` to handle project not found scenarios.
* Implemented `PublicKanbanView` and `PublicListView` for task management views.
* Created `KaneoBranding` component for branding consistency.
* Developed `LoadingSkeleton` for loading states.
* Added `ThemeToggle` for user theme preferences.
* Established `task-card` and `task-row` components for task representation.
* Defined `DEFAULT_COLUMNS` for task organization in kanban and list views.
* Feat: update documentation with cloud version promotion
* Feat: add manifest and icons for Kaneo project management platform
* Feat: enhance project settings form with unsaved changes warning

### 🐛 Bug Fixes

- Fix: update metadata template for Kaneo project
- Fix: simplify metadata default title for Kaneo documentation
- Fix: update metadata title template for Kaneo documentation
- Fix: adjust metadata title template for Kaneo documentation

### 🚜 Refactor

- Refactor(api): integrate settings for demo mode and update user info display

- Refactored the API to use a settings utility for demo mode configuration.
- Updated user info component to limit email display width for better UI consistency.
- Refactor(task-card): remove console.log for task debugging
- Refactor: update animation durations and metadata for Kaneo project
- Refactor: replace Error with HTTPException

### 📚 Documentation

- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Chore(docker): remove health check from Dockerfile
- Chore: enhance contributing guidelines and README for clarity and accessibility

- Updated the CONTRIBUTING.md file to improve the structure and clarity of the
  contribution process, including clearer sections on getting started, making
  contributions, and development guidelines.
- Revised the README.md to better articulate the purpose of Kaneo, its features,
  and the setup process, including Docker Compose instructions and configuration
  options.
- Added tips for new contributors and emphasized community engagement through
  Discord and GitHub issues.
- Chore: update .gitignore to include cursor files

- Added .cursor to the .gitignore file to prevent cursor files from being tracked.
- Ensured consistency by retaining the existing .db entry.
- Chore: update Dockerfile to streamline dependencies and user setup

- Removed SQLite installation from the builder stage to reduce image size.
- Simplified user setup in the runtime stage by separating user creation from SQLite installation.
- Chore: comment out static asset caching configuration in nginx.conf
- Chore: reverting psql migrations
- Chore(ci): specify biome version 1.9.4 in CI workflow
- Chore(ci): update Biome version to 1.9.7 in CI workflow
- Chore(release): v1.0.0

## [0.4.0] - 2025-05-10

### 🚀 Features

- Feat: add registration control feature (#134)

- Introduced `ALLOW_REGISTRATION` environment variable to enable/disable new user registration.
- Updated sign-up logic to check registration settings.
- Enhanced documentation to reflect new registration control options.
- Adjusted Docker Compose and Helm chart configurations accordingly.
- Feat: disable create project and workspace buttons (#133)
- Feat: workspace details update and delete feature added (#119)

* feat: workspace details update and delete feature added

* feat: added user email check for delete

---

Co-authored-by: Andrej <44305048+aacevski@users.noreply.github.com>

- Feat: migrate to node.js (#138)

* chore: remove bun.lockb and update package manager to pnpm; add hono-api dependency

* feat: implement user authentication and workspace management

- Added user authentication middleware to handle session validation and management.
- Enhanced sign-in and sign-up controllers to utilize HTTP exceptions for error handling.
- Introduced workspace management features including create, read, update, and delete operations.
- Integrated dotenv for environment variable management and updated dependencies in pnpm-lock.yaml.
- Refactored API fetchers to align with new client structure and improve error handling.

* feat: add workspace user management API and update related components

- Introduced a new workspace user management API with routes for creating, deleting, inviting, and
  retrieving workspace users.
- Implemented controllers for handling workspace user operations, including validation using Zod.
- Updated the Hono API to include the new workspace user routes.
- Refactored frontend components to utilize the new API for fetching active workspace users and
  managing user assignments.
- Renamed hooks for clarity, changing `useActiveWorkspaceUsers` to `useGetActiveWorkspaceUsers`
  for consistency.

* feat: implement project and task management APIs

- Added project management API with routes for creating, retrieving, updating, and deleting
  projects.
- Introduced task management API with routes for creating, retrieving, updating tasks, and
  fetching tasks by project.
- Implemented controllers for project and task operations, utilizing Zod for validation.
- Updated Hono API to include new project and task routes.
- Refactored frontend components and fetchers to integrate with the new APIs and improve
  type safety.

* feat: enhance user authentication and session management

- Added a new endpoint to retrieve the current user session with the `/me` route.
- Updated authentication middleware to streamline session validation.
- Refactored frontend components to align with the new user session structure.
- Modified API client to include credentials in requests for improved session handling.

* refactor: simplify getWorkspaces function and update return value in updateWorkspace

- Removed the unnecessary Promise.all logic in getWorkspaces, returning workspaces
  directly.
- Updated the return statement in updateWorkspace to return the updated workspace
  directly instead of accessing the first element of the array.

* refactor: remove project, task, user, and workspace APIs

- Deleted project, task, user, and workspace management APIs along with their associated
  controllers and routes.
- Cleaned up the main API entry point by removing unused imports and middleware.
- Commented out session validation logic for future implementation.

* fix: improve error handling in updateProject function

- Replaced generic error throwing with HTTPException for better error response.
- Updated the error message for non-existing projects to return a 404 status code.

* feat: enhance demo mode functionality and improve authentication middleware

* feat: refactor database structure and enhance API functionality

- Introduced a new database module to centralize database interactions.
- Updated import paths across various controllers to reference the new database module.
- Added new dependencies for cryptographic functions and encoding.
- Enhanced TypeScript configuration for better module resolution and source mapping.
- Updated package versions in pnpm-lock.yaml for improved compatibility.

* refactor: move Hono API and related components

- Renamed the Hono API along with all associated routes, controllers, and configuration files.
- Cleaned up the project structure by removing unused files and dependencies.
- Updated the Dockerfile and configuration files to reflect the move of the Hono API.
- Ensured that the database schema and related utilities are preserved for future use.

* fix: update schema path in drizzle configuration

* feat: add Docker Compose configuration and enhance API error handling

- Introduced a new Docker Compose configuration file for local development.
- Updated API to throw HTTPException for failed task and workspace creation.
- Adjusted TypeScript configuration to include declaration files.
- Fixed port number for the API server to ensure correct operation.
- Improved error handling in session token validation and task number retrieval.

* chore: update lucide-react to version 0.486.0 and refine API routes

- Bumped lucide-react from 0.484.0 to 0.486.0 in pnpm-lock.yaml for improved compatibility.
- Simplified authentication middleware in the API by directly using the auth function.
- Updated task route to include 'tasks' in the path for clarity.
- Adjusted user info component styles for better alignment and visibility.
- Fixed API client URL to point to the correct port for local development.

* feat: implement Dockerfile for API and update TypeScript configuration

- Added Dockerfile for the API service to streamline the build and deployment process.
- Updated TypeScript configuration to use CommonJS module format and improved path references.
- Adjusted package.json scripts to include a build command using esbuild.
- Enhanced database schema definition for better clarity and structure.
- Updated pnpm-lock.yaml with new dependency versions for improved compatibility.

* feat: update drizzle-orm version and refactor task handling

* feat: add GitHub Actions workflow for tagging Docker images with :node tag

- Introduced a new workflow to tag web and API Docker images with the :node tag.
- Configured inputs for conditional tagging of images based on user selection.
- Implemented steps for logging into GitHub Container Registry and tagging images accordingly.

* feat: add push trigger for node tagging workflow

- Added a push trigger to the GitHub Actions workflow for tagging Docker images with the :node tag.
- Configured the trigger to activate on pushes to the feat/migrate-to-node-js branch.

* fix: update conditions for Docker image tagging in workflow

- Modified the conditions for tagging web and API Docker images to include a push event trigger.
- Ensured that images are tagged with the :node tag on both user input and push events.

* refactor: remove unused WebSocket hook and update API URL reference

* refactor: optimize Dockerfile for API and web services
  building.

* refactor: update CORS origin configuration in API

* fix: update service ports and configurations for local development

- Changed the web service port mapping from 5173:80 to 5173:5173 in Docker Compose and README.
- Updated the Dockerfile to expose port 5173 and adjusted the health check URL accordingly.
- Modified nginx configuration to listen on port 5173.
- Updated Kubernetes deployment template to reflect the new container port and added liveness/readiness probes.
- Revised NOTES.txt to clarify port forwarding instructions for accessing the application.

* chore: remove unused vite-env type definitions

- Deleted vite-env.d.ts files from the root and libs directory as they are no longer needed.

* feat: enhance workspace management and settings functionality

- Added description field to project and workspace update APIs.
- Implemented new workspace settings section in the sidebar for better navigation.
- Created a dedicated route for workspace settings with form handling for updates and deletion.
- Updated various dependencies in package.json for improved functionality and compatibility.
- Introduced new hooks for managing workspace updates and deletions.

* refactor: improve workspace settings sidebar layout

- Updated the WorkspaceSettings component to enhance the layout and styling of the sidebar.
- Introduced a header for the workspace section and adjusted link alignment for better user experience.
- Improved conditional rendering for sidebar items based on the sidebar's open state.

* ci: pdating node tagging

* ci: pdating node tagging

* ci: pdating node tagging

* ci: commenting type checking for now

* feat: implement database schema updates and workspace user management

- Added new SQL migration files to restructure the database schema, including the creation of new tables for activities, projects, tasks, users, workspaces, and workspace members.
- Updated the database schema in TypeScript to reflect changes in the new tables and their relationships.
- Enhanced workspace user management functionality by updating API routes and controllers to handle workspace user invitations and retrievals more effectively.
- Improved the user interface for workspace settings, including permission checks for modifying settings based on user roles.

* chore: update pre-commit script and format JSON files

* ci: remove node tagging workflow file

- Feat: add documentation site with Next.js and Fumadocs (#163)

* feat: add documentation site with Next.js and Fumadocs

* chore: update GitHub Actions workflow for documentation deployment

* chore: remove deprecated documentation source files

- Feat: set base path for documentation site to "/kaneo"
- Feat: add sitemap generation and Open Graph image support

- Introduced a new sitemap.ts file to generate a sitemap for the documentation site.
- Updated page.tsx to enhance metadata generation, including Open Graph and Twitter card support.
- Added route.ts for generating Open Graph images based on page content.
- Created a robots.txt file to guide search engine indexing.
- Feat: add Inter font files and integrate them into Open Graph image generation
- Feat: add Icon component for Open Graph image generation and update metadata structure
- Feat: enhance homepage metadata for SEO and social sharing

- Added Open Graph metadata to improve SEO and social media sharing capabilities.
- Updated layout file to include project title, description, and canonical URL.
- Removed redundant metadata from the homepage page file.
- Feat: add Plausible analytics script to layout components
- Feat: implement time tracking feature for tasks (#172)
- Feat: integrate project data fetching in task edit page

- Added useGetProject and useGetTasks hooks to retrieve project and task data.
- Implemented useEffect to set the project in the store when available.
- Feat: enhance CreateTaskModal with improved layout and scrolling (#183)
- Feat: add task import/export functionality
- Feat: update Hero component link to roadmap and add roadmap documentation
- Feat: add label management functionality
- Feat: delete a task option #122 (#216)

* feat: create delete task service

* feat: added delete task rout on controller

* feat: create fetchers to delete task

* feat: create a delete task mutation hook

* feat: added delete button

* feat: added delete function to delete button

* feat: clean tasks task when delete a task

* feat: back to board when delete a task

- Feat: add sorting functionality to task filters (#217)
- Feat: add "Edit on GitHub" link to documentation pages

- Integrated a new component to display an "Edit on GitHub" button.
- Updated the DocsPage component to include GitHub edit link functionality.
- Enhanced imports for better component usage and styling.
- Feat: add issue and pull request templates for better contribution guidelines
- Feat: enhance project settings with task data and project icon

- Added project icon to the project retrieval response.
- Integrated task data fetching in the ProjectSettings component.
- Updated state management to reflect fetched task data in the project store.
- Feat: right click card/row context menu (#238)

* feat: right click card context menu

* feat: right click card context menu

* refactor: remove arrow function from handleChange

* refactor: change to arrow functions

* style: fix delete task dark theme

* fix: invalidate tasks after deletion

* style: adjust context menu colors

* style: adjust context menu colors

* style: adjust context menu colors

- Feat(notification): implement notification system (#270)

* feat(notification): implement notification system with CRUD operations and database schema

* refactor(header): remove Header component and its associated functionality

### 🐛 Bug Fixes

- Fix: project is highlighted when backlog is active (#131)
- Fix: edit project slug max length (#137)
- Fix: fix workspace setting sidebar icon (#157)
- Fix: update Open Graph image generation and enhance metadata logging
- Fix: update Open Graph image URL to include full domain path
- Fix: streamline Open Graph image URL by consolidating domain path
- Fix: remove unnecessary logging of slug in metadata generation
- Fix: correct Open Graph image URL to use the proper domain path
- Fix: update Open Graph image URL to use the correct GitHub Pages domain
- Fix: update site name in Open Graph metadata and enhance layout for image generation
- Fix: update site name in Open Graph metadata and enhance layout for image generation
- Fix: add out directory to ignored files in biome.json
- Fix: update font file paths for Open Graph image generation
- Fix: remove title from SVG in Open Graph component and add lint ignore comment
- Fix: update base path and image URL for Open Graph metadata in documentation
- Fix: reorder import statements in layout file for consistency
- Fix: update port forwarding configuration in documentation and deployment files
- Fix: update environment variable handling and Dockerfile comments

- Changed VITE_API_URL in .env.production to include quotes.
- Updated Dockerfile comment for clarity regarding nginx pid file permissions.
- Enhanced env.sh to specifically handle KANEO_API_URL and provide warnings if not set.
- Modified hono.ts to use KANEO_API_URL directly in the client initialization.
- Added manualChunks configuration in vite.config.ts for build optimization.
- Fix: update API URL handling in client initialization
- Fix: update registration environment variable and improve error handling
- Fix: fixed the saving of the indent of the description of the task (#219)

I added a parseOptions to the useEditor hook parseOptions properties and
added the preserveWithSpace options to be full so it can parse the new
lines and the white spaces

- Fix: ensure tables are created only if they do not already exist

### 💼 Changes

- Chore/sponsors and contributors (#136)

* docs: update README with sponsors and contributors sections;

- add funding configuration and new workflow for updating contributors

* chore: update contributor token in workflow

### 🚜 Refactor

- Refactor(api): simplify delete project endpoint by removing workspaceId requirement
- Refactor: clean up API URL handling and remove unused WebSocket hook

- Updated API URL import to use VITE_API_URL consistently.
- Removed the deprecated useBoardWebSocket hook as it is no longer in use.
- Simplified the isDemoMode constant definition.
- Refactor: update Open Graph image generation to use local library and improve URL structure
- Refactor: rename docs package and enhance homepage layout

- Changed package name from "docs" to "@kaneo/docs" in package.json.
- Removed outdated README.md file.
- Updated homepage layout to include new components: Hero, Features, Community, Stats, and Footer.
- Added animations to components for improved user experience.
- Introduced new global CSS animations for fade-in effects.
- Created new components for community engagement and feature highlights.
- Updated documentation structure for better clarity and organization.
- Refactor: remove unused userEmail parameter from updateTimeEntry function
- Refactor: update registration settings to use disableRegistration flag
- Refactor(backlog): rename task columns from "To Do" to "Planned" and "Done" to "Archived"

### 📚 Documentation

- Docs: update README with sponsors and contributors sections; (#135)

- add funding configuration and new workflow for updating contributors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: update contributors and sponsors
- Docs: add YouTube Quick Start Guide link and embed video in documentation
- Docs: update contributors and sponsors

### 🎨 Styling

- Style: enhance layout and styling for Open Graph image generation
- Style: adjust layout and styling for Open Graph component
- Style: change width property to auto for improved layout in Open Graph component
- Style: adjust alignment of component in Open Graph generation

- Added `alignSelf: "flex-start"` to the component's style for improved layout consistency.
- Style: update TaskLabels component for improved dark mode support

### ⚙️ Miscellaneous Tasks

- Ci: pinning docker versions
- Chore: making demo users unique
- Chore: fix auto assign
- Chore: update contributor token in workflow to use GITHUB_TOKEN
- Chore: update .gitignore and add lucide-react dependency
- Chore: update GitHub Actions workflow to specify paths for API and web apps
- Chore: update GitHub Actions workflow to include all apps and packages
- Chore: updating pnpm-lock
- Chore: updating pnpm-lock
- Chore: update pre-commit hook to include build step and remove unused import

- Added a build step to the pre-commit hook for better preparation before commits.
- Removed unused import of useGetProject in the project settings component.
- Chore: update roadmap with issue links for planned features and improvements
- Chore: Update dependabot.yml
- Chore(release): v0.4.0

## [0.3.0] - 2025-03-26

### 🚀 Features

- Feat: adds acl's and removing of team members
- Feat: adds archiving of tasks
- Feat: adds backlog

### 🐛 Bug Fixes

- Fix: improves bakclog task row popover styles
- Fix: accessibility issues with workspace picker

### ⚙️ Miscellaneous Tasks

- Chore: updating contributors
- Chore(release): v0.3.0

## [0.2.0] - 2025-03-24

### 🚀 Features

- Feat: adding demo setup (#83)
- Feat: add alert for demo page (#85)

* feat: adding demo setup

* feat: add alert for demo mode

- Feat: making tasks editable (#97)
- Feat: migrating from rabbit mq to node's event emitter
- Feat: moving from websockets and using polling
- Feat: adding board filters
- Feat: adding position of tickets in columns
- Feat: adding rich text editor in create task modal
- Feat: adding toast component
- Feat: list view
- Feat: adding option to update/remove projects
- Feat: updating user info popup
- Feat: adding dynamic titles
- Feat: adding seo support
- Feat: improved seo
- Feat(frontend): :sparkles: adds cmd+k
- Feat(deployment): add Helm chart and improve container security (#116)

* feat(deployment): add Helm chart and improve container security

- Add Kubernetes Helm chart for deploying Kaneo
- Update README.md with Kubernetes deployment instructions
- Include documentation for various deployment scenarios
- Add .dockerignore files for api and web apps
- Implement non-root user for containers
- Optimize layer caching in Dockerfiles
- Add security headers in nginx config
- Enable gzip compression
- Improve static asset caching

Closes #80

- docs(kubernetes): improve Minikube deployment instructions

* Add local deployment guide with Minikube in main README
* Update ingress path patterns to use better regex capture groups
* Fix rewrite target annotation from /$2 to /$1
* Add detailed notes about ingress configuration
* Include OS-specific setup instructions for macOS, Linux, and Windows

Part of #80

---

Co-authored-by: Andrej <44305048+aacevski@users.noreply.github.com>

### 🐛 Bug Fixes

- Fix: making alert have only 12 rem height
- Fix: returing padding to board
- Fix: removing fixed height on alert
- Fix: making columns grow as much space as they have
- Fix: settings page had workspace selection screen
- Fix: making demo email unique
- Fix: lowering elysia version to 1.2.15
- Fix: Clear input fields when closing dialogs (#89)

* fix: enhance modals with improved focus management and state reset functionality

* fix: enhance modals with improved focus management and state reset functionality

* fix: remove unused refs and focus management from modals

* fix: update query key invalidation for workspace users in invite team member modal

- Fix: fixing desktop layout for task edition
- Fix: making new session for demo user and updating data purge for every hour
- Fix: setting demo sessions to 15m
- Fix: fixing desktop styles for task edit
- Fix: force field validation errors (#109)
- Fix drag and drop bug in task columns (#96)

* fix drag and drop bug in task columns

* remove console

* add <= for comparing index so it works perfect for change two adjacent task

---

Co-authored-by: Andrej <44305048+aacevski@users.noreply.github.com>

- Fix: making board skeletons full width
- Fix: making tooltip work on mobile
- Fix: adding loading spinner on task edit page
- Fix: showing empty state for workspaces
- Fix: loading tasks initially
- Fix: deciding scure of cookie based on request protocol
- Fix: renewing sessions on demo mode
- Fix: not returning from middleware
- Fix: removing console log
- Fix: removing un-setting to workspace and projects when going to settings
- Fix: session expired wasn't getting recreated on demo
- Fix: disabling inviting already invited users
- Fix: adapting list view on mobile drag
- Fix: adding clear all filters buttons, making responsive
- Fix: clear input fields when closing create task dialog (#115)

### 💼 Changes

- Add name of project on hovering when sidebar is close (#99)

* add name of project on hovering when sidebar is close

* fix biome

---

Co-authored-by: Andrej <44305048+aacevski@users.noreply.github.com>

- Deploying to main from @ usekaneo/kaneo@fa247d3f97d9a99accc33a62f64f9680edbe8df7 🚀

### 🚜 Refactor

- Refactor: updating types for controllers

### 📚 Documentation

- Docs: updating contributing guide

### ⚙️ Miscellaneous Tasks

- Chore: updating discord invite
- Chore: removing rabbitmq from readme
- Chore: adding explanation of .env variables
- Chore: updating readme
- Chore: updating logic for sidebar
- Chore: allow for devcontainer usage (#111)
- Chore: renaming repo / organization
- Chore: removing unused components
- Chore: added sponsors
- Chore: fixing sponsorship pipeline
- Ci: updating sponsorship pipeline
- Ci: updating gh token
- Ci: changing token
- Chore: updating readme
- Ci(frontend): adds cmdk dependency
- Chore: adding permissions to write to appuser
- Chore: adding permissions to write to appuser
- Chore: reverting changes regarding permissions
- Chore(release): v0.2.0

## [0.1.0] - 2025-02-22

### 🚀 Features

- Feat(create-turbo): create basic
- Feat(create-turbo): apply official-starter transform
- Feat(create-turbo): apply package-manager transform
- Feat: :construction_worker: adding workflow to lint project
- Feat: :construction_worker: updating workflow name
- Feat: :construction_worker: updating husky and commitlint
- Feat: :sparkles: finishing authentication, adding color modes
- Feat: :fire: migrating to sessions, using file routes, adding auth provider
- Feat: :sparkles: updating logo design
- Feat: :sparkles: adding crud for workspaces
- Feat: :fire: adding initial kanban board

added the whole kanban view with mock data

- Feat: :sparkles: adding projects

major overhaul of workspaces and adding projects as a sub-entity of workspaces

- Feat: :sparkles: adding marketing image
- Feat: :sparkles: adding marketing image
- Feat: :sparkles: adding marketing image
- Feat: :sparkles: adding marketing image
- Feat: :sparkles: initial commit for projects
- Feat: adding docker images and compose
- Feat: :sparkles: finishing socket communication for tasks
- Feat: adding project icons
- Feat: adding project slugs
- Feat: adding invites for users
- Feat: adding pending invited users screen
- Feat: adding sensors for dnd
- Feat: adding multi platform build
- Feat: initial task edit setup
- Feat: making manage teams screens responsive
- Feat: finishing responsive-ness on manage teams screens
- Feat: adding settings page
- Feat: changing cover image
- Feat: adding empty / error states
- Feat: Teams refactor (#70)

* feat: combining members and invites table into one

* feat: added events with rabbitmq, set up local docker

* style: cleaning up code

* ci: updating changelog

### 🐛 Bug Fixes

- Fix: :sparkles: format drizzle.config.ts
- Fix: :green_heart: fixing formatting in package.json
- Fix: :bug: fixing route generation for vite
- Fix: :construction_worker: fixing build on pipeline
- Fix: removing unused import
- Fix: :bug: fixing overflowing workspace names
- Fix: updating reamde
- Fix: :bug: fixing deleted workspaces being cached
- Fix: removing unused packages
- Fix: removing unused packages
- Fix: removing unused packages
- Fix: changing release branch
- Fix: fixing build context
- Fix: listing web's nginx conf
- Fix: updating docker context
- Fix: refactoring publishing flow
- Fix: :bug: remove unused import
- Fix: task title was overflowing when too long
- Fix: fixing long task titles
- Fix: reseting zustand after sign out
- Fix: fixing route selection and creating tasks with no asignee
- Fix: adding loading state for projects, sync ws when creating new tasks
- Fix: making sidebar on mobile floating
- Fix: improving scrolling on dnd
- Fix: wrong z-index on modals
- Fix: adding cursor button
- Fix: making settings not dependant on a workspaceId
- Fix: adding dynamic view height on sidebar
- Fix: improving padding for user info section
- Fix: making sidebar fixed
- Fix: fixing local development setup
- Fix: updated urls and removing urls
- Fix: major route refactor, adding empty / selection states
- Fix: updated mutateFn for sign in / up flow
- Fix: fixing empty states
- Fix: fixed but when preloading a workspace / project

### 💼 Changes

- Initial
- Add auth
- Create dependabot.yml
- Update dependabot.yml
- Merge pull request #15 from kaneo-app/dependabot/npm_and_yarn/apps/web/vite-6.0.7

chore(deps-dev): bump vite from 6.0.6 to 6.0.7 in /apps/web

- Merge pull request #13 from kaneo-app/dependabot/npm_and_yarn/packages/libs/elysia-1.2.10

chore(deps-dev): bump elysia from 1.2.9 to 1.2.10 in /packages/libs

- Merge pull request #12 from kaneo-app/dependabot/npm_and_yarn/apps/web/typescript-5.7.3

chore(deps-dev): bump typescript from 5.5.4 to 5.7.3 in /apps/web

- Merge pull request #11 from kaneo-app/dependabot/npm_and_yarn/packages/libs/types/bun-1.1.16

chore(deps-dev): bump @types/bun from 1.1.14 to 1.1.16 in /packages/libs

- Merge pull request #2 from kaneo-app/dependabot/npm_and_yarn/apps/api/drizzle-orm-0.38.4

chore(deps): bump drizzle-orm from 0.38.3 to 0.38.4 in /apps/api

- Merge pull request #4 from kaneo-app/dependabot/npm_and_yarn/apps/api/elysia-1.2.10

chore(deps): bump elysia from 1.2.9 to 1.2.10 in /apps/api

- Merge pull request #10 from kaneo-app/dependabot/npm_and_yarn/apps/web/tanstack/react-query-devtools-5.64.1

chore(deps): bump @tanstack/react-query-devtools from 5.62.12 to 5.64.1 in /apps/web

- Merge pull request #9 from kaneo-app/dependabot/npm_and_yarn/packages/libs/typescript-5.7.3

chore(deps-dev): bump typescript from 5.5.4 to 5.7.3 in /packages/libs

- Merge pull request #8 from kaneo-app/dependabot/npm_and_yarn/apps/web/types/node-22.10.7

chore(deps-dev): bump @types/node from 22.10.5 to 22.10.7 in /apps/web

- Merge pull request #5 from kaneo-app/dependabot/npm_and_yarn/apps/api/better-sqlite3-11.8.0

chore(deps): bump better-sqlite3 from 11.7.0 to 11.8.0 in /apps/api

- Merge pull request #3 from kaneo-app/dependabot/npm_and_yarn/apps/api/drizzle-kit-0.30.2

chore(deps): bump drizzle-kit from 0.30.1 to 0.30.2 in /apps/api

- Merge pull request #6 from kaneo-app/dependabot/npm_and_yarn/apps/web/multi-ff629d46e7

chore(deps): bump react and @types/react in /apps/web

- Merge branch 'main' into dependabot/npm_and_yarn/packages/libs/types/react-dom-19.0.3
- Merge pull request #14 from kaneo-app/dependabot/npm_and_yarn/packages/libs/types/react-dom-19.0.3

chore(deps-dev): bump @types/react-dom from 18.3.5 to 19.0.3 in /packages/libs

- Merge pull request #7 from kaneo-app/dependabot/npm_and_yarn/packages/libs/multi-ff629d46e7

chore(deps-dev): bump react and @types/react in /packages/libs

- Merge pull request #21 from kaneo-app/dependabot/npm_and_yarn/apps/web/zustand-5.0.3
- Merge pull request #19 from kaneo-app/dependabot/npm_and_yarn/apps/web/framer-motion-11.18.0
- Merge pull request #18 from kaneo-app/dependabot/npm_and_yarn/apps/web/tanstack/react-router-1.97.1
- Merge pull request #16 from kaneo-app/dependabot/npm_and_yarn/packages/libs/types/bun-1.1.17
- Merge pull request #20 from kaneo-app/dependabot/npm_and_yarn/apps/web/hookform/resolvers-3.10.0
- Merge pull request #17 from kaneo-app/dependabot/npm_and_yarn/apps/web/lucide-react-0.471.1
- Merge pull request #25 from kaneo-app/dependabot/npm_and_yarn/apps/web/postcss-8.5.1
- Merge pull request #29 from kaneo-app/dependabot/npm_and_yarn/packages/libs/types/bun-1.1.18
- Merge pull request #28 from kaneo-app/dependabot/npm_and_yarn/apps/web/tanstack/router-plugin-1.97.7
- Merge pull request #27 from kaneo-app/dependabot/npm_and_yarn/apps/web/framer-motion-12.0.1
- Merge pull request #26 from kaneo-app/dependabot/npm_and_yarn/apps/web/vite-6.0.11
- Merge pull request #23 from kaneo-app/dependabot/npm_and_yarn/apps/api/better-sqlite3-11.8.1
- Merge pull request #24 from kaneo-app/dependabot/npm_and_yarn/apps/web/lucide-react-0.473.0
- Merge pull request #35 from kaneo-app/dependabot/npm_and_yarn/packages/libs/types/bun-1.2.0
- Merge pull request #34 from kaneo-app/dependabot/npm_and_yarn/apps/web/radix-ui/react-tooltip-1.1.7

chore(deps): bump @radix-ui/react-tooltip from 1.1.6 to 1.1.7 in /apps/web

- Merge pull request #31 from kaneo-app/dependabot/npm_and_yarn/apps/web/radix-ui/react-dialog-1.1.5

chore(deps): bump @radix-ui/react-dialog from 1.1.4 to 1.1.5 in /apps/web

- Merge pull request #30 from kaneo-app/dependabot/npm_and_yarn/apps/web/types/node-22.10.8

chore(deps-dev): bump @types/node from 22.10.7 to 22.10.8 in /apps/web

- Merge branch 'main' into feat/add-projects
- Update ci.yml
- Update ci.yml
- Merge pull request #33 from kaneo-app/dependabot/npm_and_yarn/apps/web/radix-ui/react-dropdown-menu-2.1.5

chore(deps): bump @radix-ui/react-dropdown-menu from 2.1.4 to 2.1.5 in /apps/web

- Merge branch 'main' into aacevski-patch-1
- Merge pull request #36 from kaneo-app/aacevski-patch-1

ci: Update ci.yml

- Merge branch 'main' into feat/add-projects
- Merge pull request #42 from kaneo-app/dependabot/npm_and_yarn/apps/web/tanstack/react-router-1.97.14

chore(deps): bump @tanstack/react-router from 1.94.1 to 1.97.14 in /apps/web

- Merge pull request #41 from kaneo-app/dependabot/npm_and_yarn/apps/web/types/node-22.10.10

chore(deps-dev): bump @types/node from 22.10.7 to 22.10.10 in /apps/web

- Merge pull request #37 from kaneo-app/dependabot/npm_and_yarn/packages/libs/types/react-19.0.8

chore(deps-dev): bump @types/react from 19.0.7 to 19.0.8 in /packages/libs

- Merge pull request #40 from kaneo-app/dependabot/npm_and_yarn/apps/web/types/react-19.0.8

chore(deps-dev): bump @types/react from 19.0.7 to 19.0.8 in /apps/web

- Merge pull request #38 from kaneo-app/dependabot/npm_and_yarn/apps/web/lucide-react-0.474.0

chore(deps): bump lucide-react from 0.473.0 to 0.474.0 in /apps/web

- Merge pull request #39 from kaneo-app/dependabot/npm_and_yarn/apps/web/tanstack/router-devtools-1.97.14

chore(deps): bump @tanstack/router-devtools from 1.97.3 to 1.97.14 in /apps/web

- Merge branch 'main' into feat/add-projects
- Merge pull request #22 from kaneo-app/feat/add-projects

feat: :sparkles: initial commit for projects + tasks

- Merge pull request #43 from kaneo-app/fix/lower-ver

ci: lowering package version

- Update Dockerfile

### 🚜 Refactor

- Refactor: :recycle: cleaning up auth flow
- Refactor: :recycle: improving sidebar code
- Refactor: :recycle: adding workspace schemas, refactoring auth again...
- Refactor: :recycle: fixing build issues
- Refactor: :recycle: fixing build issues
- Refactor: :recycle: fixing build issues
- Refactor: :sparkles: improving code for projects fetching
- Refactor: :recycle: removing unused files
- Refactor: storing selected workspace and project in url

### 📚 Documentation

- Docs: :memo: adding readme
- Docs: Update README.md
- Docs: adding readme

### 🎨 Styling

- Style: :sparkles: formatting project with biome
- Style: :sparkles: formatting whole project with biome
- Style: making sidebar responsible, changing up workspace selection

### ⚙️ Miscellaneous Tasks

- Ci: :green_heart: fixed build and added it to pipeline
- Ci: :construction_worker: change build command
- Ci: :construction_worker: commenting build on pipeline for now, updating dependencies
- Ci: :construction_worker: using ubuntu with specific version
- Ci: :construction_worker: returning build command
- Ci: :construction_worker: returning build command
- Ci: :construction_worker: building only web
- Ci: :construction_worker: building only web
- Ci: :construction_worker: commenting build step
- Ci: create auto-assign.yml
- Chore: create LICENSE
- Ci: fix pipeline
- Ci: Update dependabot.yml
- Ci: update dependabot.yml
- Ci: update dependabot.yml
- Chore: updating react query
- Chore: moving to react 19
- Chore: bumping react-dom types
- Ci: pin auto assign version
- Ci: Update ci.yml
- Chore: upgrading to tailwind 4
- Ci: Update ci.yml
- Chore: updating pnpm-lock
- Chore: resolve conflicts
- Chore: updating turbo
- Chore: updating compose
- Ci: change ubuntu version
- Ci: adding conventional commits
- Ci: using diff actions for changelogs
- Chore(release): v0.1.0 [skip ci]
- Ci: finishing releases
- Ci: updating actions
- Ci: updating releases
- Chore(release): 0.1.1
- Ci: updating linting
- Chore: merging develop branch
- Chore(release): 0.1.2
- Chore(release): 0.1.3
- Chore(release): 0.1.4
- Ci: :construction_worker: updating changelog generation
- Ci: :construction_worker: updating changelog generation
- Ci: lowering package version
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Ci: :construction_worker: debugging changelog pipeline
- Chore(release): v0.1.0 [skip ci] (#44)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Ci: :construction_worker: debugging changelog pipeline
- Chore(release): v0.2.0 [skip ci] (#45)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Ci: :construction_worker: debugging changelog pipeline
- Chore(release): v0.3.0 [skip ci] (#46)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Chore(release): v0.4.0 [skip ci] (#47)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Ci: :construction_worker: adding changelog file
- Chore(release): v0.5.0 [skip ci] (#48)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Ci: :construction_worker: lowering version to 0.0.1
- Chore(release): v0.1.0 [skip ci] (#49)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Chore: Create FUNDING.yml
- Chore(release): v0.2.0 [skip ci] (#50)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Ci: :construction_worker: running certain actions when main files are changed
- Chore: Update FUNDING.yml
- Chore(release): v0.3.0 [skip ci] (#51)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Chore(release): v0.4.0 [skip ci] (#54)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Chore(release): v0.5.0 [skip ci] (#55)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Chore(release): v0.6.0 [skip ci] (#57)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>

- Ci: deploying on hetzner
- Ci: updating image url for web
- Ci: removing docker container name
- Ci: add load balancer
- Ci: add watchtower
- Ci: removing replicas
- Ci: adding volumes
- Chore: updating turbo
- Ci: fixing watchtower
- Ci: fixing api url
- Chore: lowered typebox version due to elysia uncompatibility
- Ci: fixing build
- Ci: adding back traefik
- Ci: adding back traefik
- Ci: fixing build
- Ci: fixing build
- Ci: fixing reverse proxy
- Chore: :art: adding seo
- Ci: updating dockerfile
- Ci: updating dockerfile
- Ci: updating lockfile
- Ci: updating dockerfile
- Ci: updating db path
- Ci: updating db path
- Ci: updating api dockerfile
- Ci: adding target platforms
- Ci: adding build platform on dockerfile
- Ci: adding build platform on dockerfile
- Ci: updating dockerfile for permissions
- Ci: updating dockerfile for permissions
- Ci: fixing dockerfile for api
- Ci: adding volumes
- Ci: updating compose
- Ci: updating volumes
- Ci: adding missing env variables
- Ci: updating cover image
- Ci: adding releases action
- Ci: adding releases action
- Ci: adding releases action
- Ci: adding releases action
- Chore(release): v0.7.0
- Chore: updating turborepo
- Ci: update readme (#71)

* feat: combining members and invites table into one

* feat: added events with rabbitmq, set up local docker

* style: cleaning up code

* ci: updating changelog

* ci: removing external volumes

* docs: update readme

- Chore(release): v0.1.0
- Ci: update changelog
- Ci: Update package.json
- Chore(release): v0.1.0
