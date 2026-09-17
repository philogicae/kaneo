## [1.0.6] - 2026-09-17

### 🚀 Features

- _(ci)_ Add maintainer-triggered Peekareq screenshots
- Add focused Peekareq previews and accessibility findings
- Expand MCP tooling, project analytics and workspace UX
- Unified telegram bots, per-task reminders and task recurrence
- Shareable workspace invite links with default-link backfill
- Reminder rescheduling discipline, MCP datetime args and bounded pagination
- Unified Notifications page (General/Telegram/Discord/Slack tabs, per-project Discord/Slack management, legacy Telegram route dropped); personal mention events for Telegram/Discord/Slack (separate from comments, both on by default, mentions target the mentioned member's Telegram rules); unified Appointments/Calendar/Gantt dashboard tabs + MCP and Skill links; charts ranges 1w/1m/3m/6m/12m/all; copyable skill URL block and served-page frontmatter (name/description/version); fix: week calendar header/column alignment, appointment reminder chips 15m/1h/2h/1d/1w with theme-aware selected state; chore: translate 28 new keys across 19 locales + alphabetize all i18n files, mcp-install skill reference, docs/openapi refresh
- Board charts period/unit dropdowns with independent window and unit (3 months/day defaults, hourly→monthly buckets, dynamic averages); global access teams and scoped invitations (workspace×project scope bundles, manual grants or teams, materialised at acceptance, dynamic on team edits) enforced across project routes, project lists, global search and private assets; Teams settings page and invitation scope tree; additive migration 0003; openapi + i18n refreshed
- Scope assignee lists, notifications and project WebSockets to project access (GET /api/project/{id}/members; assignability moved from workspace membership to canAccessProject across task/appointment create/update/assignee/bulk/import; notifications dropped at creation when the recipient cannot open the project, all emitters pass projectId; /ws/:projectId upgrade enforces project access); editable direct project grants for existing members (GET/PUT /api/workspace/{workspaceId}/members/{userId}/access — all-projects lifts the scope to full, clearing removes the orphaned scoped membership, invitation:create guard — plus Manage access dialog on the Members page); a scoped member keeps the project they create via a direct grant; fix: dashboard charts default to the last month by day with a one-time persisted-preference migration 6m/3m→1m; openapi + i18n (9 keys × 20 locales) + integration tests refreshed

### 🐛 Bug Fixes

- _(ci)_ Filter Peekareq commands with a Cloudflare webhook
- _(ci)_ Use Cloudflare-compatible GitHub requests
- Ground Peekareq custom-field screenshots in fixtures
- Fall back when Peekareq's model provider is throttled
- _(billing)_ Keep cancelled subscriptions entitled until the paid period ends
- Harden MCP auth and label flows, rework self-hosted compose
- _(web)_ Keep drag & drop active while a board or backlog sort is applied
- Telegram verify loop, board sort/filter hydration, per-workspace label identity
- Default the Compose host data mount to the ./data directory instead of ./data/kaneo.db so the WAL/SHM sidecars are persisted; chore: dependency lockfile refresh, biome 2.5.13→2.5.14 and docs alignment

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors

### 🚜 Refactor

- Migrate PostgreSQL to local libSQL (Turso) storage
- Drop SaaS dependencies for local-disk asset storage

### 🧪 Testing

- _(ci)_ Isolate screenshot publisher test identities
- _(billing)_ Separate act from assert in entitlement tests

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.25.0 [skip ci]
- _(infra)_ Modernize runtime and deploy stack
- Fork cleanup — drop upstream release, site, helm and stdio-mcp machinery
- _(ci)_ Per-workspace coverage reporting and test-infra hardening
- Add changelog

## [2.24.0] - 2026-09-11

### 🚀 Features

- Add custom fields support
- Add optimistic drag-and-drop reordering to CustomFieldEditor
- Add an unset action for optional dropdown/boolean and date fields
- _(i18n)_ Add Azerbaijani (az-AZ) translation
- Redirect to default project

### 🐛 Bug Fixes

- Resolve biome lint errors
- Trim value to prevent whitespace issues
- Dropdown options parsing error
- Filters no longer return only cached field
- Resolve missing lint errors
- Unused customFields validator
- Harden dropdown options parsing
- Revert dropdown fix that make CI check fail
- Inject default values for required fields on task creation
- Misplaced translation for custom field editor
- Add custom fields migration
- Regenerate custom fields migration
- Drizzle journal formating
- Drizzle migration formatting
- Reported issue
- Filtering issue for new field
- Prevent concurrent custom field reorders
- Replace per-field queries with grouped query
- Reject invalid calendar dates in task fields
- Use canUpdateTasks for task editing instead of canManageTasks
- Lint the conflicted create-task file
- Create task not inserting custom field
- Invalidate field value after task creation
- Use the new api schema and response format
- CustomFields order on task card field icon
- Incorrect/missing invalidateQueries
- Add missing fieldPosition to custom field values response
- _(api)_ Skip archived tasks in due date reminders
- _(api)_ Skip archived tasks in due date reminders
- _(npm)_ Fixing CVE-2026-75604
- _(i18n)_ Sync Mattermost keys across locales
- Merge conflict
- Unit test failing
- Lint issue
- Outdated openapi.json
- _(i18n)_ Restore Simplified Chinese translations for Mattermost integration
- Duplicate projects fetch on load
- Unhandled projects fetch errors
- Use fresh project data
- Remove unused catch binding
- _(web)_ Defer Shiki highlighter loading on task page
- _(reviews)_ Suggestion fixes from ai bots
- _(ci)_ Pnpm i18n:check:fix

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors

### 🚜 Refactor

- Use transaction for custom fields insert
- Fetch custom field values per project

### 🧪 Testing

- _(api)_ Add custom field integration tests

### ⚙️ Miscellaneous Tasks

- Add expect log to CI to identify error
- _(db)_ Regenerate migration SQL after conflict resolution
- _(db)_ Fix formatting on drizzle meta files
- _(db)_ Resolve database migration conflict
- _(db)_ Resolve database migration conflict
- _(release)_ V2.24.0 [skip ci]

## [2.23.2] - 2026-09-07

### 🐛 Bug Fixes

- _(mcp)_ Accept refresh_token grant on register

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.23.2 [skip ci]

## [2.23.1] - 2026-09-06

### 🐛 Bug Fixes

- _(web)_ Use location.href for the sign-in redirect param

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.23.1 [skip ci]

## [2.23.0] - 2026-09-06

### 🚀 Features

- _(i18n)_ Add Japanese (ja-JP) translation
- _(i18n)_ Localize auth and notification emails for Japanese
- _(mattermost)_ Add native Mattermost integration
- Added polish translations
- Added task item counters
- Added green highlight when all tasks are completed
- Center Gantt chart on today and add jump-to-today button
- _(i18n)_ Add jumpToToday translation key

### 🐛 Bug Fixes

- _(api)_ Make notifications and seat reconciliation survive replicas
- _(api)_ Correct five defects that fail silently
- _(api)_ Close five workspace-scoping gaps
- _(api)_ Replace the seat-reconciliation advisory lock with a job lease
- _(web)_ Resolve the root error boundary's translation keys
- _(api)_ Read the raw body in task permission middleware
- _(api)_ Restore the entitlement check on project creation
- _(api)_ Correct route contracts flagged in review
- _(api)_ Close the remaining gaps in the auth schema emitter
- _(i18n)_ Drop unused \_one plural keys from ja-JP
- Added `enableServiceLinks` field
- Added `extraEnvFrom` field
- Added `topologySpreadConstraints` field
- Fixed typos in README
- Default argument ordering in `enableServiceLinks`
- _(auth)_ Prevent 401 retry storm and redirect to sign-in
- _(review)_ Adding review suggestions
- _(auth)_ Prevent 401 retry storm for pending invitations
- _(mattermost)_ Harden webhook configuration
- _(mattermost)_ Use ES2020-compatible text escaping
- Typos and bad AI translations
- Added polish plurals
- Added more translations and fixed wording
- Corrected translations
- _(i18n)_ Add tasks.title to every locale and fix pl-PL formatting
- _(web)_ Let task labels use card width
- Hide mark as planned for planned tasks
- Make task removal discoverable and calendar states distinct
- _(web)_ Protect unsaved task input
- _(web)_ Address discard review feedback
- Project nav width in different language
- _(web)_ Preserve project menu minimum width
- _(i18n)_ Sync Polish task discard translations with main
- _(web)_ Preserve imported label colors
- Make the OpenAPI artifact and its check environment independent
- Pin the export environment instead of rewriting the servers block
- Keep the OpenAPI check stable across CRLF checkouts
- _(ci)_ Preserve OpenAPI checker argument boundaries
- `clsx` -> `cn`
- Sorted imports
- _(lint)_ Collapse get-task-item-stats test call to one line
- _(web)_ Ignore invalid checklist closing fences
- _(gantt)_ Re-arm auto-center on project switch and inset scroll-padding for the task rail
- _(web)_ Center Gantt after filtered project becomes visible
- _(mattermost)_ Resolve main conflicts and migrate OpenAPI routes

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors

### 🚜 Refactor

- _(api)_ Generate the OpenAPI spec from Zod instead of rewriting it

### 🎨 Styling

- Drop the explanatory comments added with the recent fixes

### 🧪 Testing

- _(web)_ Cover task label overflow contract
- Cover task deletion state synchronization
- _(web)_ Cover browser-supported label colors
- Add regression coverage for Gantt jump-to-today
- _(gantt)_ Cover project-switch re-centering, scroll-padding, and empty-filter disable

### ⚙️ Miscellaneous Tasks

- Build release notes from pull requests and credit contributors
- _(i18n)_ Sync the locale files and teach the checker about plurals
- Gate locale drift on pnpm i18n:check
- Fail when the API reference drifts from the routes
- Build workspace packages before exporting the OpenAPI document
- Sync reviewed main into Polish locale branch
- _(i18n)_ Add jumpToToday key to de-DE
- _(i18n)_ Regenerate schema.json with jumpToToday key
- _(i18n)_ Add jumpToToday key to el-GR
- _(i18n)_ Add jumpToToday key to es-ES
- _(i18n)_ Add jumpToToday key to fr-FR
- _(i18n)_ Add jumpToToday key to hi-IN
- _(i18n)_ Add jumpToToday key to id-ID
- _(i18n)_ Add jumpToToday key to it-IT
- _(i18n)_ Add jumpToToday key to ja-JP
- _(i18n)_ Add jumpToToday key to ko-KR
- _(i18n)_ Add jumpToToday key to mk-MK
- _(i18n)_ Add jumpToToday key to nl-NL
- _(i18n)_ Add jumpToToday key to pt-BR
- _(i18n)_ Add jumpToToday key to ru-RU
- _(i18n)_ Add jumpToToday key to tr-TR
- _(i18n)_ Add jumpToToday key to uk-UA
- _(i18n)_ Add jumpToToday key to vi-VN
- _(i18n)_ Add jumpToToday key to zh-CN
- Sync Gantt navigation and translate its Polish label
- _(release)_ V2.23.0 [skip ci]

## [2.22.0] - 2026-08-21

### 🚀 Features

- _(site)_ Add blog section with alternatives round-ups

### 🐛 Bug Fixes

- _(api)_ Return 404 when a label does not exist
- _(ci)_ Stop the release chart gate requesting packages write

### 📚 Documentation

- Update contributors and sponsors
- Describe the release flow in the agent guide

### ⚙️ Miscellaneous Tasks

- Gate the release on the image and chart builds
- Tighten monorepo hygiene
- Let turbo pass DATABASE_URL through to the integration tests
- _(release)_ V2.22.0 [skip ci]

## [2.21.0] - 2026-08-20

### 🚀 Features

- _(site)_ Add comparison and guide content engine
- _(auth)_ Let admins restrict workspace creation to instance admins
- _(web)_ Add a monthly calendar view to projects

### 🐛 Bug Fixes

- _(web)_ Prevent auth client timeout by optimizing i18n loading
- Apply CodeRabbit auto-fixes
- _(web,sentry)_ Handle Safari "TypeError: Load failed" network errors
- _(web)_ Classify Safari 'Load failed' as a network error
- _(web,sentry)_ Narrow Safari 'Load failed' suppression to auth-session path
- _(api)_ Add timeout to Turnstile verification
- _(api)_ Reject malformed Turnstile timeout env values
- _(web,i18n)_ Preload all namespaces after init and locale change
- _(web,sentry)_ Ignore third-party adware/extension errors from cdn77.org
- _(web)_ Prevent Tiptap TransformError from duplicate Link extension
- _(web)_ Prevent Shiki highlighter crash on stale dynamic module load
- Apply CodeRabbit auto-fixes
- _(web)_ Clear shiki stale-chunk reload flag after successful init
- Apply CodeRabbit auto-fixes
- _(web)_ Track readOnly in ref so handleClick sees current mode
- _(api)_ Gzip API responses to shrink large board payloads
- _(web)_ Preserve MIME metadata for unknown files
- Increase card title font size
- Remove text-sm
- _(auth)_ Address coderabbit/qodo review on workspace-creation gating
- _(web)_ Address calendar view review feedback
- _(web)_ Announce the scheduled range in calendar task bars
- _(docker)_ Preserve web runtime placeholders
- _(coolify)_ Pin the Kaneo image to a release tag
- _(coolify)_ Track the latest release instead of a broken pinned tag
- _(email)_ Let the workspace invitation template render without copy

### 📚 Documentation

- Add Coolify deployment instructions and Docker Compose file
- Update Coolify deployment instructions to clarify KANEO_API_URL usage

### 🚜 Refactor

- Simplify conditional checks with optional chaining and clean up lint warnings
- _(planka-import)_ Drop the dead author parameter from formatComment

### ⚙️ Miscellaneous Tasks

- _(i18n)_ Seed calendar view keys for non-English locales
- _(i18n)_ Regenerate the locale schema
- _(i18n)_ Seed the calendar loadError key for non-English locales
- _(i18n)_ Regenerate the locale schema for loadError
- _(i18n)_ Add Korean translations for the calendar view
- _(i18n)_ Reseed the calendar taskAriaLabel for non-English locales
- _(i18n)_ Add the range placeholder to the Korean calendar task label
- Migrate supported runtime to Node 24
- _(mcp)_ Drop the Node 24 engines constraint
- _(coolify)_ Name the compose file compose.coolify.yml
- _(release)_ V2.21.0

## [2.20.0] - 2026-08-19

### 🚀 Features

- _(web)_ Emit source maps, switch to captureReactException, mount a safe root crash fallback
- _(api)_ Drop workspace identifiers from Sentry integration breadcrumbs
- Provision Sentry alert rules from sentry/alerts.json
- _(scripts)_ Update existing alerts instead of skipping
- Provision Sentry dashboards from sentry/dashboards.json
- _(design)_ Replace Cal Sans and Paper Mono with Geist

### 🐛 Bug Fixes

- _(review)_ Qodo/coderabbit suggestions
- _(review)_ Qodo/coderabbit suggestions
- _(review)_ Qodo/coderabbit suggestions
- _(ci)_ Failing test
- _(ci)_ Failing test and code review recommendations
- Apply CodeRabbit auto-fixes
- Apply CodeRabbit auto-fixes
- _(scripts)_ Surface Sentry API errors in provision-sentry-alerts
- _(sentry/alerts)_ Add missing API fields and URL-encode GET params
- _(sentry/alerts)_ Add resolution condition + drop tokenized query params
- _(sentry/alerts)_ Migrate to span dataset, add triggers to metric workflows
- _(scripts)_ Inject datasetSource + conditions fields Sentry requires
- _(sentry/dashboards)_ Add limit:10 to every query
- _(sentry/dashboards)_ Inject limit:10 on time-series widgets
- _(sentry/alerts)_ Drop /projects/ prefix from detector endpoint
- _(sentry)_ Review-batch fixes across provision scripts and specs
- _(sentry)_ Qodo review-batch (issue projects, cron coverage, region)
- _(sentry/alerts)_ Propagate detector lookup failures
- _(sentry/alerts)_ Declare cron SLUGS as an array
- _(sentry)_ Ignore Safari extension runtime.sendMessage() errors
- _(web,sentry)_ Remove unnecessary Sentry capture for auth fetch errors
- _(web,sentry)_ Reduce noise from auth fetch errors and validate API URL
- _(web,sentry)_ Ignore Facebook in-app browser postMessage errors
- _(seer)_ Removed throw
- _(test)_ Stop integration test hook and case timeouts
- _(web,sentry)_ Handle authClient.getSession() network errors in workspace settings
- _(web)_ Prevent Shiki highlighter crash on dynamic module load failure
- _(web)_ Handle shiki initializer rejection in comment editor
- _(web)_ Track session-fetch failure and skip setActive fallback

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors

### 🧪 Testing

- Derive reset helper from Postgres catalog, not schema registry
- Tighten reset helper regression coverage
- Quote catalog table names through quoteIdentifier
- Drop redundant precondition in third reset test

### ⚙️ Miscellaneous Tasks

- Switch docker build-push secret input from secrets to secret-files
- _(release)_ V2.20.0

## [2.19.1] - 2026-08-15

### 🐛 Bug Fixes

- _(web)_ Save a description to the task it was typed in (#1600)

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.19.1

## [2.19.0] - 2026-08-15

### 🚀 Features

- _(api)_ Enrich Sentry with profiling and user attribution
- _(github)_ Move the task back when an issue is reopened (#1518)

### 🐛 Bug Fixes

- _(api)_ Isolate Sentry user scope to per-request async context
- _(api)_ Validate Sentry sample rate env vars are in 0..1
- _(api)_ Scope Sentry user per-request via withIsolationScope
- _(web)_ Keep task description editor alive across task switches (#1581)
- GitHub-imported tasks without priority label get priority=null and can never be edited (#1583)
- _(github)_ Keep a webhook delivery alive when link metadata will not parse (#1526)
- Derive a project key from non-Latin names (#1517)
- _(auth)_ Secure cookies on HTTPS deployments (#1560)
- _(web)_ Respect granular task permissions (#1520)
- _(task)_ Repair the null priority that blocks every edit, and move tasks by column slug (#1594)

### 📚 Documentation

- Add AI contribution guidelines (#1593)

### 🎨 Styling

- _(contributing)_ Drop the en dash from the AI guidance

### 🧪 Testing

- _(web)_ Drain input-otp timers before cleanup in verify-otp
- _(web)_ Mock the capability the description editor actually calls
- _(web)_ Cover the crash #1580 actually reported

### ⚙️ Miscellaneous Tasks

- Fix biome lint config for 2.5.x
- _(api)_ Drop redundant return type on parseSampleRate
- _(release)_ V2.19.0

## [2.18.0] - 2026-08-12

### 🚀 Features

- _(account)_ Change avatar and delete account

### 🐛 Bug Fixes

- _(web)_ Restore the backdrop behind settings modals

### 📚 Documentation

- Update contributors and sponsors
- Document changing your avatar and deleting your account

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.18.0

## [2.17.6] - 2026-08-11

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.6

## [planka-import-v0.2.0] - 2026-08-11

### 🐛 Bug Fixes

- _(planka-import)_ Explain unmatched assignees, keep dependencies, attribute comments

## [2.17.5] - 2026-08-11

### 🐛 Bug Fixes

- _(billing)_ Send one trial reminder per owner, not per workspace

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.5

## [2.17.4] - 2026-08-11

### 🐛 Bug Fixes

- _(billing)_ Throttle trial reminders so they cannot exhaust the quota

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.4

## [2.17.3] - 2026-08-11

### 🚀 Features

- _(billing)_ Email trial reminders before and after expiry

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.3

## [planka-import-v0.1.2] - 2026-08-11

### 🐛 Bug Fixes

- _(planka-import)_ Default to the real Kaneo Cloud host

### 📚 Documentation

- _(agents)_ Revamp project guidance (#1564)

## [2.17.2] - 2026-08-11

### 🐛 Bug Fixes

- _(billing)_ Grant the trial once per owner, not per workspace
- _(auth)_ Resolve the client IP behind multiple proxy hops

### 📚 Documentation

- Remove the v1 migration guide

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.2

## [planka-import-v0.1.1] - 2026-08-11

### 🚀 Features

- _(planka-import)_ Authenticate with a PLANKA API key

### 🎨 Styling

- _(planka-import)_ Drop em and en dashes from prose and output

### ⚙️ Miscellaneous Tasks

- _(planka-import)_ Publish 0.1.1

## [planka-import-v0.1.0] - 2026-08-11

### 🚀 Features

- _(planka-import)_ Add PLANKA to Kaneo migration CLI
- _(site)_ Add PLANKA comparison page

### 🐛 Bug Fixes

- Use internal URL for MCP tool requests (#1556)

### 📚 Documentation

- Update contributors and sponsors
- Add PLANKA migration guide

### ⚙️ Miscellaneous Tasks

- Publish @kaneo/planka-import on version bump

## [mcp-v0.1.11] - 2026-08-10

### ⚙️ Miscellaneous Tasks

- _(mcp)_ Publish 0.1.11

## [2.17.1] - 2026-08-10

### 🐛 Bug Fixes

- _(security)_ Block the shared address space in webhook destinations (#1523)
- _(github)_ Match a branch whose title segment is empty (#1522)
- Preserve time entry end time (#1554)
- _(time-entry)_ Reject a start time later than the end time

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.1

## [mcp-v0.1.10] - 2026-08-10

### ⚙️ Miscellaneous Tasks

- _(mcp)_ Publish 0.1.10 with the new tools

## [2.17.0] - 2026-08-10

### 🚀 Features

- _(mcp)_ Support stateless 2026 protocol (#1540)
- _(mcp)_ Expose members, search, columns, time and activity tools

### 🐛 Bug Fixes

- _(web)_ Omit unassigned userId when creating tasks (#1552)
- _(mcp)_ Guard media type and share the tool registrar

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.17.0

## [2.16.4] - 2026-08-10

### 🐛 Bug Fixes

- _(auth)_ Let invited users sign up with OAuth in invite-only mode

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.16.4

## [2.16.3] - 2026-08-10

### 🐛 Bug Fixes

- _(task)_ Treat blank assignee id as unassigned on task creation

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.16.3

## [2.16.2] - 2026-08-10

### 🐛 Bug Fixes

- _(web)_ Handle unhandled promise rejection from authClient.getSession()
- _(web)_ Preserve full location in auth redirect
- _(task)_ Validate assignee existence on task creation
- _(pr)_ Responding to AI pr reviews
- _(web)_ Avoid nested buttons in alert dialog footers
- _(ci)_ Failure in ci after fix
- _(web)_ Prevent TypeError when relatedTarget is not an Element
- _(gitea-integration)_ Handle invalid JSON from non-Gitea URLs
- _(gitea-integration)_ Structured failure response and test coverage
- _(gitea)_ Classify /user 404 as not-a-gitea-instance

### 🚜 Refactor

- _(web)_ Drop redundant throw check and explicit return annotation

### 🧪 Testing

- Add regression test for relatedTarget TypeError in editor mouseleave
- _(task)_ Cover whitespace-padded and whitespace-only assignee userIds

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.16.2

## [2.16.1] - 2026-08-09

### 🐛 Bug Fixes

- Strip quoted runtime placeholders
- Address placeholder cleanup reviews

### ⚙️ Miscellaneous Tasks

- _(deps)_ Bump actions/checkout from 6.0.2 to 7.0.1
- _(release)_ V2.16.1

## [2.16.0] - 2026-08-09

### 🚀 Features

- _(projects)_ Add drag-and-drop project reordering
- _(web)_ Add Mermaid diagram preview support
- _(web)_ Improve Mermaid diagram rendering and error handling
- _(web)_ Localize Mermaid rendering errors
- Refactor settings layout to use Sheet component and improve mobile responsiveness

### 🐛 Bug Fixes

- _(projects)_ Address reorder review findings
- _(projects)_ Show reorder handle on touch and cover archived ordering
- _(projects)_ Keep omitted projects at their existing rank on reorder
- _(projects)_ Rework project drag-and-drop interaction
- _(web)_ Stop the mermaid render cache evicting diagrams still on screen
- _(web)_ Use column isFinal for due-date badges on public views
- Polish mobile settings layout
- _(web)_ Make settings rows responsive and align their typography

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Add Emil Kowalski's design engineering skills
- _(release)_ V2.16.0

## [2.15.0] - 2026-08-08

### 🚀 Features

- _(billing)_ Reconcile drifted seat counts hourly

### 🐛 Bug Fixes

- _(billing)_ Keep failed webhooks replayable and preserve subscription dates

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.15.0

## [2.14.0] - 2026-08-07

### 🚀 Features

- _(i18n)_ Add Brazilian Portuguese (pt-BR) locale

### 🐛 Bug Fixes

- _(helm)_ Set postgresql Deployment update strategy to Recreate
- _(i18n)_ Use pt-BR copy for workspace invitation emails
- _(i18n)_ Complete translations for all locales

### ⚙️ Miscellaneous Tasks

- Add Contributor Covenant Code of Conduct
- _(release)_ V2.14.0

## [2.13.2] - 2026-08-07

### 🚀 Features

- _(api)_ Tag Sentry events with the app release

### ⚙️ Miscellaneous Tasks

- Trim comments in Sentry instrumentation
- _(release)_ V2.13.2

## [2.13.1] - 2026-08-07

### 🚀 Features

- Add web Sentry SDK with session replay and opt-in API tracing

### 🐛 Bug Fixes

- _(web)_ Correct link to the API reference in the nav menu
- _(deps)_ Patch 16 disclosed advisories through the overrides
- _(web)_ Stop warning about due dates on completed tasks
- _(deps)_ Drop the next override so the site really gets next 16
- _(web)_ Use Shiki's JavaScript regex engine to avoid WebAssembly
- _(deps)_ Sync lockfile with the babel override
- _(mcp)_ Cap pending OAuth authorization requests

### 📚 Documentation

- Unwrap hard-wrapped prose
- Update contributors and sponsors
- Update contributors and sponsors

### 🧪 Testing

- _(mcp)_ Port cross-replica flow test from #1493

### ⚙️ Miscellaneous Tasks

- Upgrade to typescript 7 and next 16.3
- Allow manual dispatch of the ci workflow
- Cache the site build output in turbo
- _(release)_ V2.13.1

## [mcp-v0.1.9] - 2026-08-05

### 🐛 Bug Fixes

- _(mcp)_ Correct the docs URL in package metadata

### 📚 Documentation

- Make the Kaneo docs the source of truth for drim

## [2.13.0] - 2026-08-05

### 🚀 Features

- _(web)_ Pick a project in the create-task modal when none is in scope

### 🐛 Bug Fixes

- _(web)_ Show language names without region in the locale picker
- _(gitea)_ Record the external link before publishing task.created
- _(github)_ Comment the task link on issues created from Kaneo
- _(mcp)_ Store OAuth state in Postgres so multiple replicas work
- _(api)_ Stop returning integration secrets from the external-link route
- _(api)_ Block SSRF through the Gitea integration endpoints
- _(web)_ Reject non-http URLs in attachment and issue-link nodes
- _(mcp)_ Bind streamable sessions to the user that created them
- _(api)_ Reject traversal in finalized task image keys
- _(api)_ Stop reflecting arbitrary origins in production

### 📚 Documentation

- Add a security policy

### ⚡ Performance

- _(web)_ Render list and backlog rows from the task payload

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.13.0

## [2.12.2] - 2026-08-04

### 🐛 Bug Fixes

- _(deps)_ Align the better-auth override with 1.6.25

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Refresh sponsors daily and deploy the site after updates
- _(release)_ V2.12.2

## [mcp-v0.1.8] - 2026-08-04

### 🚀 Features

- _(mcp)_ Publish to the official MCP Registry

### 🐛 Bug Fixes

- _(ci)_ Registry description limit and idempotent MCP Registry publish

## [mcp-v0.1.7] - 2026-08-04

### ⚙️ Miscellaneous Tasks

- _(mcp)_ Publish 0.1.7 with official npm metadata

## [mcp-v0.1.6] - 2026-08-04

### 🚀 Features

- _(web)_ Add invitation link and clipboard helpers
- _(web)_ Surface the workspace invitation link in the UI
- _(i18n)_ Add Vietnamese (vi-VN) locale
- Add Hindi (hi-IN) locale translation
- Add zh-CN locale
- _(i18n)_ Add Italian (it-IT) translation

### 🐛 Bug Fixes

- Resolve workspace access from the id the handler acts on
- Serve public-project assets to anonymous callers
- Enforce bulk task permissions
- Fail closed for mixed-workspace bulk tasks
- Preserve bulk task validation responses
- CVE-2026-69192 security vulnerability
- Move overrides to workspace config
- _(deps)_ Bump next to 15.5.21 to patch 8 disclosed advisories
- _(deps)_ Raise next override floor to 15.5.21 so the bump actually resolves
- _(email)_ Stop forcing SMTP auth when no credentials are set
- Prevent task number gaps during partial import failures
- Persist task title activity atomically
- _(api)_ Stop embedding task rows in the project list response
- _(api)_ Scope task aggregates by workspace join instead of project ID list
- _(project)_ Allow one-character names and keys
- _(web)_ Search tasks by issue identifier
- _(web)_ Guard nullable task identifiers
- Keep planned subtasks in backlog
- Wait for subtask status columns
- Add date validation for task create/update to prevent Invalid Date in DB
- Address code review feedback for date validation
- Include labels in task export to prevent data loss on round-trip
- _(auth)_ Let invited users without an account register
- _(web)_ Restore ResizeObserver stub and correct invite-flow comment
- _(email)_ Fix Biome formatting in password-reset template
- Complete all 1598 translation keys for Hindi locale
- Translate remaining externalLinks.issue and branch keys to Hindi
- _(api)_ Github install and label detachment bug
- _(api)_ Resolve bugs in api tests
- _(api)_ Coderabbit/qodo reviews
- _(api)_ Coderabbit nitpick
- _(tests)_ Update label test
- Apply triage follow-ups for #1461, #1464 and #1470
- _(i18n)_ Translate invite-flow strings and language labels across locales
- Resolve all TypeScript errors across api and web

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors

### ⚡ Performance

- _(web)_ Avoid per-task kanban metadata requests

### 🎨 Styling

- Fix biome formatting for import-tasks
- Fix biome formatting for validate-dates files

### 🧪 Testing

- Read the bound id through drizzle's dialect, not queryChunks
- _(api-integration)_ Add isSmtpConfigured to email mock

### ⚙️ Miscellaneous Tasks

- Enforce typecheck and fix cold-start dev
- Remove em dashes repo-wide and shorten Macedonia in legal copy
- Upgrade npm before publishing @kaneo/mcp
- Run mcp publish on Node 24 for OIDC-capable npm
- Drop token auth remnants so npm uses trusted publishing

## [2.12.1] - 2026-07-30

### 🚀 Features

- _(site)_ Add Jira, Trello, and Linear comparison pages for SEO
- Switch Cloud pricing to USD and replace Product Hunt button with Pricing

### 📚 Documentation

- _(site)_ Remove em dashes from comparison copy

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.12.1

## [2.12.0] - 2026-07-30

### 🚀 Features

- Deep-link pricing CTAs through signup to checkout

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.12.0

## [2.11.0] - 2026-07-30

### 🚀 Features

- _(web)_ Add dismissible trial nudge in sidebar

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.11.0

## [2.10.0] - 2026-07-30

### 🚀 Features

- Add Saturday week-start option
- _(billing)_ Add Kaneo Cloud subscriptions via Creem
- _(billing)_ Polish billing settings page UI
- _(billing)_ Merge Kaneo Cloud subscriptions via Creem

### 🐛 Bug Fixes

- Address week-start validation and i18n feedback
- Add Saturday translations for all locales
- _(i18n)_ Correct Greek Saturday translation

### 🧪 Testing

- _(api)_ Keep project task counter in sync with seeded fixtures
- _(billing)_ Live-verify entitlement enforcement and seat sync

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.10.0

## [2.9.10] - 2026-07-28

### 🚀 Features

- _(site)_ Add pricing, privacy policy, and terms pages

### 🐛 Bug Fixes

- _(api)_ Allocate task numbers atomically via per-project counter
- _(api)_ Return 401 instead of 500 for invalid API keys

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.10

## [2.9.9] - 2026-07-27

### 🚀 Features

- _(site)_ Add homepage sponsors section with public sponsor sync
- _(site)_ Make founding sponsorship a badge for all early backers
- _(api)_ Add optional Sentry error tracking via SENTRY_DSN

### 🐛 Bug Fixes

- _(mcp)_ Emit type declarations for the package exports entry

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(mcp)_ Publish to npm automatically on version bump
- _(mcp)_ 0.1.6
- _(release)_ V2.9.9

## [2.9.8] - 2026-07-19

### 🚀 Features

- Webhook events, unicode slugs, board sort (#1408)

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.8

## [2.9.7] - 2026-07-18

### 🚀 Features

- _(web)_ Motion and fluidity polish pass (#1407)

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.7

## [2.9.6] - 2026-07-18

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.6

## [2.9.5] - 2026-07-18

### 🚀 Features

- Complete task reminders and notifications (#1399)

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.5

## [2.9.4] - 2026-07-17

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.4

## [2.9.3] - 2026-07-17

### 🚀 Features

- _(i18n)_ Complete French translations (#1359)
- _(i18n)_ Turkish language support (#1366)

### 🐛 Bug Fixes

- _(auth)_ Fall back for custom OAuth profile names (#1360)
- _(email)_ Translate French workspace invitations (#1390)
- _(docker)_ Allow nginx revision rebuilds in apk pin (#1405)
- _(web)_ Load status options from columns query (#1404)
- Load task statuses on direct page visits (#1403)

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.3

## [2.9.2] - 2026-07-16

### 🚀 Features

- Standardize avatar fallback initials (#1401)

### 🐛 Bug Fixes

- _(api)_ Enforce scoped API key permissions (#1374)
- _(auth)_ Enforce disabled local login (#1375)
- _(editor)_ Reject active embed URL schemes (#1376)
- _(gitea)_ Restrict webhook secret access (#1377)
- _(gitea)_ Bind webhooks to signed integration (#1378)
- _(mcp)_ Require explicit OAuth consent (#1372)
- _(assets)_ Prevent active content execution (#1373)
- _(labels)_ Enforce task workspace boundary (#1380)
- _(mcp)_ Validate registered redirect URIs (#1381)
- _(api)_ Prioritize project workspace lookup (#1383)
- _(tasks)_ Prevent cross-workspace moves (#1384)
- _(tasks)_ Prevent cross-workspace relations (#1385)
- _(auth)_ Protect invitation acceptance from unverified accounts (#1386)
- _(auth)_ Require verified email for account linking (#1387)
- _(comments)_ Unify API and activity storage (#1389)
- _(auth)_ Restore guest sign-in access (#1391)

### 📚 Documentation

- _(security)_ Remove public default MinIO credentials (#1382)

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.2

## [2.9.1] - 2026-07-15

### 🚀 Features

- _(i18n)_ Add Indonesian locale
- Add DISABLE_EMAIL_OTP_SIGN_IN for password sign-in with SMTP
- Add DISABLE_EMAIL_OTP_SIGN_IN for password sign-in with SMTP (#1319)
- _(settings)_ Add workspace labels management page with CRUD
- Workspace Label Settings (#1344)

### 🐛 Bug Fixes

- _(charts/ci)_ Adding dynamic versioning in helm ci
- _(ci)_ Resolving concern from qodo/coderabbit
- _(i18n)_ Make workspace roles settings translatable
- _(docker)_ Stop nightly arm64 build hanging on native bcrypt
- _(board)_ Reflect disabled card dragging
- _(docker)_ Update pinned nginx package
- _(docs)_ Validate local OpenAPI reference
- Address OpenAPI review feedback
- Propagate label color changes to existing task assignments
- _(label)_ Cascade delete task-level label copies when workspace label is deleted
- Destructure columns from createProjectFixture in label tests
- Replace onClose with onOpenChange in labels settings dialogs
- Publish label deletion events and sync to GitHub/Gitea when labels are cascaded from workspace
- Reset shared invalidate spy between useUpdateLabel tests
- Invalidate labels query cache on workspace-level label deletion
- Guard Enter key handlers in labels dialogs with isPending state
- Replace invalid vi.Mock type references with imported Mock type
- Add debug logging for device authorize CI failure
- _(labels)_ Address workspace label review
- _(chart)_ Generate per-release auth secret
- _(chart)_ Require explicit auth secret
- _(chart)_ Provide auth secret in validation matrix
- _(chart)_ Require explicit auth secret (#1379)
- _(site)_ Use official Product Hunt logo
- _(charts/ci)_ Fixing the publishing steps for helm chart
- _(qodo)_ Applying fixes recommended by qodo review
- _(review)_ Further updates from code review
- _(helm)_ App version fix, guard, and trigger added
- _(ci)_ Grant actions: write to trigger-helm-publish
- _(ci)_ Pass inputs.version via env to github-script
- _(ci)_ Use in release main-branch guard
- Prevent oversized workflow column drag preview (#1394)
- Clean up drag preview on component unmount
- Make drag preview non-interactive
- Prevent oversized workflow column drag preview (#1394)

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- _(workspace)_ Add workspace label management docs
- Update contributors and sponsors
- Update contributors and sponsors

### 🧪 Testing

- _(label)_ Add integration tests for label deletion cascade

### ⚙️ Miscellaneous Tasks

- _(nightly)_ Use GH_PACKAGE_TOKEN to push GHCR images
- Rerun documentation deployment
- Remove .plans directory from tracking
- Adds docs container to local compose for development viewing
- _(release)_ V2.9.1

## [2.9.0] - 2026-06-30

### 🚀 Features

- _(comments)_ @mention workspace members in task comments (#1353)
- _(tasks)_ Notify members @mentioned in a task description (#1353)

### 🐛 Bug Fixes

- _(auth)_ Link OIDC sign-in to existing same-email accounts (#987)
- _(auth)_ Allow unverified users to accept workspace invitations

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.9.0

## [2.8.0] - 2026-06-30

### 🚀 Features

- _(mcp)_ Support KANEO_API_KEY for non-interactive auth
- _(notifications)_ Opt-in flag to allow private webhook destinations

### 🐛 Bug Fixes

- _(api)_ Drop malformed Better Auth schema fields from OpenAPI output
- _(auth)_ Claim device code before approve/deny (better-auth 1.6.11)
- _(subtasks)_ Make the leading checkbox toggle completion (#1352)

### 🚜 Refactor

- _(subtasks)_ One checkbox per row, drop the selection checkbox

### ⚙️ Miscellaneous Tasks

- _(ci)_ Bump GitHub Actions off the deprecated Node 20/16 runtimes
- _(security)_ Bump vulnerable deps to patched versions
- _(release)_ V2.8.0

## [2.7.8] - 2026-06-29

### 🚀 Features

- Custom OAuth auto login, allow disabling the Login Form
- _(helm)_ Prep for helm chart publishing
- _(ci)_ Add helm chart publishing
- _(mcp)_ Add task-relation and label-delete tools
- Support AWS IAM roles for S3 storage (#1342)
- _(comments)_ Allow users to delete their own comments (#1322)
- _(notifications)_ Notification inbox with real-time WebSocket updates (#1324)

### 🐛 Bug Fixes

- _(comment)_ Improve comment formatting in task event publication.
- Auto-login failure can leave the sign-in page permanently stuck on skeleton
- ErrorCallbackURL redirect loop, empty <p>, integration test
- _(helm)_ Resolve agent reviews and suggestions
- _(helm)_ Define KANEO_POSTGRES_PASSWORD before DATABASE_URL (#1309)
- _(deps)_ Allow @hono/node-server v2 so the #1292 upgrade takes effect (#1313)
- _(docs)_ Updating README.md for helm chart. Replaced steps and added clear direction
- _(docs)_ Resolving qodo suggestions
- Add enabled guard to useGetTask
- _(mcp)_ Guard delete_label against workspace labels
- _(bug)_ Added normalizedApiServerUrl to resolve asset url
- _(tests)_ Added integration tests for fix validation
- _(bug)_ Derive fallback asset URL from request origin instead of hardcoded localhost:1337
- _(docs)_ Resolves bug 1346 (#1350)
- Use custom column names in webhook status reports (#1343)
- Add WebSocket keepalive pings and DB connection timeouts (#1323)
- Use LF line endings in husky commit-msg hook
- _(notifications)_ Full-bleed inbox dropdown and drop duplicate query key
- _(docker)_ Bump pinned nginx to 1.28.3-r4
- _(github-integration)_ Surface server error text on verify failure
- _(command-palette)_ Default to planned status when creating a task from backlog
- _(permissions)_ Let members with create-only permission create tasks
- _(task-relations)_ Distinguish "blocked by" from "blocks"
- _(editor)_ Add table row/column controls to the bubble menu

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors

### 🧪 Testing

- _(mcp)_ Cover task-relation and label-delete tools

### ⚙️ Miscellaneous Tasks

- _(helm)_ Bump chart to 0.4.2 (#1310)
- _(dependabot)_ Group non-major npm updates per package (#1311)
- _(security)_ Override transitive deps to patched versions (#1312)
- Add nightly builds
- Harden nightly workflow
- Disable checkout credential persistence
- Enforce LF line endings for husky hooks via .gitattributes
- _(release)_ V2.7.8

## [2.7.7] - 2026-05-29

### 🐛 Bug Fixes

- _(web)_ Empty unset KANEO\_\* placeholders so self-hosted signup works
- _(ci)_ Build internal deps before running tests
- _(ci)_ Route test:integration through turbo so deps are built first

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.7.7

## [2.7.6] - 2026-05-29

### 🚀 Features

- _(auth)_ Cloud abuse-mitigation gates for sign-up and invites

### 🐛 Bug Fixes

- _(permissions)_ Compile package to dist for prod node runtime
- _(docker)_ Build @kaneo/permissions in web stages too
- _(rbac)_ Chunk default-role seed insert to stay under bind-param cap
- _(github)_ Skip issues opened by the configured app bot

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.7.6

## [2.7.5] - 2026-05-27

### 🚀 Features

- Workspace RBAC with custom roles and instance admin
- _(rbac)_ Gate workspace UI on server-checked permissions
- _(web)_ Move members page back to workspace sidebar with new table design
- _(web)_ Ownership transfer in workspace general settings
- Workspace RBAC with custom roles and instance admin (#1253)
- _(site)_ Add product hunt landing badge

### 🐛 Bug Fixes

- _(rbac)_ Address PR review feedback (build, tests, label permissions)
- _(rbac)_ Address review bot comments
- _(deps)_ Regenerate pnpm-lock.yaml (stale next@16 reference)
- _(rbac)_ Address CodeRabbit follow-up on admin promotion and sign-in flash
- _(auth)_ Widen ac to AccessControl for organization() typing
- _(rbac)_ Address Qodo re-review (admin promotion, registration, instance status)
- _(rbac)_ Validate custom-role permission JSON before authorizing
- _(web)_ Align invite member modal styling
- _(web)_ Ensure active workspace is set when deep-linking to settings
- _(web)_ Invalidate the right caches on workspace user role update
- _(github)_ Accept \n-escaped and base64-encoded GITHUB_PRIVATE_KEY
- _(columns)_ Allow workflow icon updates
- _(docker)_ Bump pinned nginx to 1.28.3-r2 in Dockerfile.kaneo
- _(ci)_ Use RELEASE_TOKEN PAT so release events fire downstream
- _(package)_ Revert version to 2.7.4 in package.json

### 📚 Documentation

- Update contributors and sponsors

### 🚜 Refactor

- _(auth)_ Type the admin-promotion hook's user via UserWithAnonymous

### 🧪 Testing

- _(rbac)_ Cover all built-in + custom roles in workspace permissions
- _(rbac)_ Expand coverage to every gated resource

### ⚙️ Miscellaneous Tasks

- _(db)_ Renumber RBAC migrations to 0030/0031 for main's 0029 fk_indexes
- _(ci)_ Notify Discord on new issues only
- _(ci)_ Notify Discord on new releases with full notes
- Merge main into feat/workspace-rbac
- _(release)_ V2.7.5
- _(release)_ V2.7.5

### 💼 Other

- Bring in main (resolve journal conflict + renumber RBAC migrations)

## [2.7.4] - 2026-05-18

### 🚀 Features

- _(api)_ Add S3 key prefix support and auto-delete orphaned assets (#1258)

### 🐛 Bug Fixes

- _(api)_ Restore atomic ownership check on activity comment writes

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.7.4

## [2.7.3] - 2026-05-18

### 🚀 Features

- _(site)_ Add Product Hunt launch badge to hero
- _(i18n)_ Add Korean (ko-KR) translation (#1229)

### 🐛 Bug Fixes

- Replace em dash with hyphen in titles and metadata
- _(web)_ Fix websocket path (#1228)
- Properly construct WS URL
- Inconsistent import extension
- _(db)_ Add missing foreign key indexes (#1226)
- Remove duplicate import tasks modal close button (#1264)
- Emit task.status_changed for git webhook status updates (#1263)
- _(api)_ Resolve issue #1231 (#1257)

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(security)_ Align pnpm overrides with bumped deps and resolve next alerts (#1271)
- _(release)_ V2.7.3

## [2.7.2] - 2026-05-05

### 🚀 Features

- _(chart)_ Add kaneo.extraEnv for arbitrary env vars

### ⚙️ Miscellaneous Tasks

- _(docs)_ Updating repo with 127.0.0.1 for health checks (#1225)
- _(release)_ V2.7.2

## [2.7.1] - 2026-05-04

### 🚀 Features

- Import/export task re-enabled
- _(web)_ 404 not found page for task page
- _(ui)_ Move create task to top and display permanently
- Custom logout url for automatic logout from idp
- Add websockets for realtime collaboration
- Add Redis-backed broadcast adapter for WebSocket scaling
- Add redis sentinal and cluster support

### 🐛 Bug Fixes

- Update healthcheck URL to use 127.0.0.1
- Feature_request.yml
- Copy task link
- Move task
- Use correct column slug property
- Missing properties of Task type
- Unused project route
- Some CodeRabbit suggetions
- CodeRabbit suggetions
- CodeRabbit suggetions applied
- BulkUpdateTasks never fires WebSocket events
- _(type)_ BroadcastAdapter is defined as an interface
- Missing projectId in WS broadcast
- Project membership authorization check to the WebSocket /ws/:projectId endpoint
- Get /api/oauth/id-token is implemented inline
- WebSocket retry counter not reset on project change
- Hardcoded "done" check for strike-through styling
- Broadcast task-relation.refresh on status update. For task details view updates
- Move WebSocket endpoint under API path. For new single docker image

### 📚 Documentation

- Update contributors and sponsors
- Sync CLAUDE.md pnpm pin to 10.32.1

### 🚜 Refactor

- Made feature_request easier to fill out

### 🧪 Testing

- Add unit tests for websocket broadcast and event system

### ⚙️ Miscellaneous Tasks

- Update •gitignore add IDE specific folder
- _(type)_ Typesafety
- Add SEO setup, asset refresh, and UI polish
- Refresh brand assets across site and web
- Change logo width from 300 to 450
- _(release)_ V2.7.1
- _(release)_ V2.7.1

## [2.7.0] - 2026-05-01

### 🚀 Features

- _(deploy)_ Add single kaneo container combining API and web
- _(deploy)_ Reduce required env vars for combined image
- _(deploy)_ Refactor Helm chart and drim docs to single kaneo image

### 🐛 Bug Fixes

- Run apikey migration after drizzle and drop user_id not null
- _(deploy)_ Fix entrypoint exit codes, scan triggers, and docs drift
- _(deploy)_ Pin nginx to 1.28.3-r0 for reproducible builds
- _(deploy)_ Restore postgres host port 5432 in compose and docs
- _(deploy)_ Resolve CR PR notes
- _(deploy)_ Missing mcp well-known routes
- _(deploy)_ Env.sh fails editing nginx-qodo
- _(deploy)_ Whitespace in env.example
- _(deploy)_ Helm update to avoid losing CORS allowlist
- _(deploy)_ Double-slash bug in url
- _(deploy)_ Nit pick
- _(deploy)_ Preserve status of process that failed
- _(deploy)_ Aligning .env.sample
- _(deploy)_ Removing hardcord postgres ports-but really should be 5432 be default
- _(deploy)_ Fix Biome error in runner

### 📚 Documentation

- Update contributors and sponsors
- _(deploy)_ Update env examples to reflect reduced required vars

### 🎨 Styling

- Format drizzle 0028 snapshot for Biome CI

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.7.0

## [2.6.9] - 2026-04-21

### 🚀 Features

- Add configurable first day of week

### 🐛 Bug Fixes

- Restore board label filters after reload
- _(web)_ Sync task label mutations into tasks cache
- _(ui)_ Align task label text vertically
- Align task list checkboxes to top
- .github/ISSUE_TEMPLATE/bug_report.yml

### 🚜 Refactor

- Made bug_report easier and faster to fill out

### ⚙️ Miscellaneous Tasks

- Merge origin/main into fix/1200-label-shows-as-active
- _(release)_ V2.6.9

## [2.6.8] - 2026-04-13

### 🚀 Features

- _(nginx)_ Update well-known endpoints to serve MCP OAuth discovery JSON

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.8

## [2.6.7] - 2026-04-13

### 🐛 Bug Fixes

- _(docker)_ Update nginx configuration for environment variable handling

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.7

## [2.6.6] - 2026-04-13

### 🚀 Features

- _(api)_ Add mcp redirects

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.6

## [2.6.5] - 2026-04-13

### 🐛 Bug Fixes

- _(api)_ Remove trailing '/api' from KANEO_API_URL in routing

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.5

## [2.6.4] - 2026-04-13

### 🚀 Features

- _(mcp)_ Add OAuth 2.0 well-known endpoints for authorization server

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.4

## [2.6.3] - 2026-04-13

### 🚀 Features

- _(mcp)_ Implement device authorization flow with polling mechanism

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.3

## [2.6.2] - 2026-04-13

### 🚀 Features

- _(mcp)_ Implement Model Context Protocol server with HTTP and stdio support

### 🐛 Bug Fixes

- _(api)_ Simplify visit function in normalizeEmptyAndEnumSchemas

### ⚙️ Miscellaneous Tasks

- Rerun build
- _(release)_ V2.6.2

## [2.6.1] - 2026-04-12

### 🚀 Features

- _(api)_ Add normalizeEmptyAndEnumSchemas function for OpenAPI spec processing

### 🐛 Bug Fixes

- _(api)_ Avoid checksum query params in presigned S3 uploads
- _(docs)_ Update OpenAPI URL to use the production endpoint
- _(web)_ Show all workspace members in assignee popovers
- _(task)_ Use renamed project column names in status popovers
- _(task)_ Load sidebar status metadata from columns and restore default status i18n

### 📚 Documentation

- Update contributors and sponsors

### ⚡ Performance

- _(web)_ Incrementally render assignee popover members

### 🎨 Styling

- _(web)_ Apply biome formatting for status label updates

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.6.1

## [2.6.0] - 2026-04-07

### 🚀 Features

- Add kaneo mcp app
- New docs for mcp; allow mcp by default
- _(mcp)_ Add interactive installer
- _(mcp)_ Support multi-target installer
- _(mcp)_ Harden install/auth tools and align device auth docs
- Separate github sso and integration
- _(web)_ Show exact comment timestamp on relative time hover
- _(i18n)_ Add Russian and Ukrainian locales
- _(docs)_ Add mcp docs

### 🐛 Bug Fixes

- Fix dist url
- _(mcp)_ Harden auth and tool validation
- _(mcp)_ Harden install merge, prompts, and device code validation
- _(mcp)_ Tighten install validation, merge errors, and config parsing
- _(mcp)_ Validate custom path in resolveTargetConfigPath
- Use refs for comment submit/cancel shortcuts in TipTap handler
- _(web)_ Repair comment timestamp tooltip
- Persist project icon from general settings
- _(mcp)_ Harden auth, timeouts, and project update payloads
- _(mcp)_ Guard device-flow polling and project fallback types
- _(mcp)_ Harden project update/auth timeout/install chmod
- Downgrade dependabot/fetch-metadata to version 2
- Apps/api/Dockerfile to reduce vulnerabilities
- Address CodeRabbit review comments
- _(web)_ Use column.id in task move popover
- _(web)_ Prefer column.name over slug-derived label in move popover

### 📚 Documentation

- Update contributors and sponsors

### 🧪 Testing

- _(mcp)_ Account for abort signal in device flow fetch assertion

### ⚙️ Miscellaneous Tasks

- _(mcp)_ Add package repository metadata
- _(mcp)_ Update open and zod
- _(mcp)_ Bump version to 0.1.3
- _(mcp)_ Bump version to 0.1.4
- Move MCP package and harden publish workflow
- _(mcp)_ 0.1.5
- _(release)_ V2.6.0

## [2.5.3] - 2026-04-03

### 🚀 Features

- Add account notification delivery settings
- Add user-based Gotify notifications
- Harden notification prefs schema, delivery, OpenAPI, and i18n
- Add project settings to sidebar project menu
- Init es-ES translations
- Add Spanish support
- More translations
- Webhook translations
- Finished translations
- Include Spanish in language selector
- _(auth)_ Add device authorization flow for CLI and external apps
- _(docs)_ Add otp rfc 8628 to docs
- Add coss primitives documentation and rules
- Add due date reminders scheduler

### 🐛 Bug Fixes

- Notification preferences secrets and locale strings
- Harden secret encryption guard and normalize error handling
- _(api)_ Reorder notification project migration constraint
- Show all board columns on public project link
- Applied suggestions
- Sort imports
- Fix device auth route validation and bearer handling
- _(api)_ Harden auth error handling and device query parsing
- _(api)_ Tighten bearer parsing and initialize api auth email
- _(api)_ Reject unauthenticated cookie fallback in asset auth
- _(api,test)_ Preserve bearer sessions on auth routes
- Notification preference schema bootstrap
- Enable all configured notification channels
- Stop column migration from restoring deleted default columns
- Read workspace description from organization field
- Update lodash to version 4.18.0

### 📚 Documentation

- Add account notifications guide

### ⚙️ Miscellaneous Tasks

- Format notification preference database files
- Merge upstream/main and resolve conflicts
- Format drizzle metadata
- _(release)_ V2.5.3

## [2.5.2] - 2026-04-02

### 🚀 Features

- _(web)_ Move-task popover on task toolbar with readable select labels
- _(ci)_ Add lint and unit workflow
- _(ci)_ Extract api app startup
- _(ci)_ Add api vitest suite
- _(ci)_ Add api integration scaffolding
- _(ci)_ Add api project integration harness
- _(ci)_ Add api task integration tests
- _(ci)_ Disable default api unit coverage and add test:coverage script
- _(test)_ Extract resolveApiBaseUrl and add libs unit tests
- _(test)_ Add vitest config and initial web unit tests
- _(test)_ Add otp email template render smoke test
- _(test)_ Add label api integration tests and readme
- _(api)_ Set userEmail for API key auth and document public routes

### 🐛 Bug Fixes

- Accept dbOrTx, add subscribeToEvent, fix status lookup,error handling, error toast, french
- _(ci)_ Mock email package in integration tests
- _(ci)_ Use postgres admin db for tests
- _(ci)_ Exclude coverage output from biome checks
- _(libs)_ Strip trailing slash before appending /api in resolveApiBaseUrl
- _(api)_ Document health route and harden asset auth handling
- _(api)_ Create projects transactionally
- _(github)_ Preserve zero-valued task numbers
- _(github)_ Only ignore missing label removals
- _(ci,github)_ Tighten workflow token scope and preserve zero task numbers

### 📚 Documentation

- Document testing commands and workflows

### 🚜 Refactor

- _(api)_ Realign index.ts with upstream shape

### 🎨 Styling

- Apply biome formatting to test tooling files

### 🧪 Testing

- _(integration)_ Harden DATABASE_URL handling and fixtures
- _(api)_ Tighten GitHub label helper assertions
- _(web)_ Align Vitest aliases with Vite
- _(integration)_ Refuse non-test databases
- _(integration)_ Match mocked email contracts
- _(integration)_ Clear custom oauth env vars
- _(api)_ Stabilize max upload size assertion
- _(integration)_ Map seeded columns by slug
- _(api)_ Fix upload limit assertion input
- Formatting s3 test
- Add integration coverage for labels, tasks, and openapi
- Add integration coverage for labels, tasks, and openapi

### ⚙️ Miscellaneous Tasks

- Merge upstream main into cursor/upstream-synchronization-dea9
- _(api)_ Dedupe unit test script
- Add monorepo build job
- Merge upstream/main into feat/add-testing
- _(release)_ V2.5.2

### 💼 Other

- Require Node 20.19 in repo and CI

## [2.5.1] - 2026-04-01

### 🐛 Bug Fixes

- _(api)_ Dedupe task numbers before unique constraint in migration 0021

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.5.1

## [2.5.0] - 2026-04-01

### 🚀 Features

- _(web)_ Render supportedLocales from resources.ts
- _(api)_ Add Gitea integration schema for OpenAPI
- _(api)_ Create workflow rules for Gitea column migration
- _(api)_ Add Gitea plugin with webhooks and sync helpers
- _(api)_ Add Gitea integration REST API
- _(api)_ Register Gitea routes and webhook endpoint
- _(api)_ Sync task labels to Gitea
- _(web)_ Add Gitea integration fetchers and query hooks
- _(web)_ Extend external links for Gitea sources and icons
- _(web)_ Add Gitea integration settings and workflow UI
- _(i18n)_ Add Gitea integration strings
- _(api)_ Add activity/label updatedAt, indexes, and task number uniqueness
- _(web)_ Localize Gitea webhook controls and copy feedback
- _(api)_ Add task.updated_at column and migration
- _(integrations)_ Add project telegram integration
- _(api)_ Publish integration events for Telegram CRUD

### 🐛 Bug Fixes

- _(web)_ Use shared default locale in preferences labels
- Make macedonian first language
- _(web)_ Isolate active workspace per tab via URL
- _(api)_ Align integration response contracts
- _(gitea-api)_ Harden webhook and sync handling
- _(gitea-web)_ Tighten verification and repository browser behavior
- _(i18n)_ Translate gitea integration labels
- _(api)_ Harden gitea integration imports
- _(api)_ Harden gitea webhook sync
- _(web)_ Protect gitea webhook secrets
- _(api)_ Handle duplicate activity and label rows on integration inserts
- _(api)_ Harden Gitea import, API client, and webhooks
- _(gitea)_ Map upstream errors, tighten sync, and fix bulk labels
- _(gitea)_ Align fetch timeout, label api bodies, and webhook events
- Resolve label alignment issues
- Remove inner css styling for tailwind class
- Remove unnecessary testing changes
- _(api)_ Harden workspace access JSON body parsing
- _(telegram)_ Harden integration validation and error handling
- _(api)_ Harden telegram integration config handling
- _(telegram)_ Redact sensitive config, avoid re-enabling, and skip no-op updates
- _(web)_ Treat missing Telegram integration as empty state
- _(backlog)_ Simplify label rendering in dropdown menu

### 📚 Documentation

- Add Gitea integration setup guide
- _(integrations)_ Add telegram setup guide

### 🚜 Refactor

- _(api)_ Share telegram event schema and sanitize logs

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.5.0

## [2.4.4] - 2026-03-30

### 🚀 Features

- Add French locale (fr-FR) translations
- _(integrations)_ Add Slack integration
- _(integrations)_ Add Discord integration
- _(integrations)_ Add generic outgoing webhooks
- _(webhooks)_ Persist generic webhook delivery health
- _(docs)_ Add outgoing webhooks
- Add Macedonian language option to preferences

### 🐛 Bug Fixes

- _(ci)_ Use GITHUB_TOKEN for dependabot fetch-metadata
- _(integrations)_ Address review findings
- _(discord)_ Hide webhook secrets and upsert integration
- _(discord)_ Redact webhook failures in logs
- _(discord)_ Preserve dirty integration form state
- _(web)_ Normalize API base URLs
- _(slack)_ Keep webhook URLs write-only
- _(api)_ Tighten webhook URL validation and dedupe Discord event handling
- Guard generic webhook secret normalization
- _(docs)_ Refine docs for outgoing webhooks
- Integration security and quality issues, add Discord/Slack docs
- _(ci)_ Update Biome version to 2.4.8 and fix schema.json formatting

### ⚙️ Miscellaneous Tasks

- _(ci)_ Fix deprecated Node.js 20 actions in release workflow
- _(ci)_ Bump Docker actions to Node.js 24 compatible versions
- _(ci)_ Bump dependabot/fetch-metadata to v3
- _(webhooks)_ Simplify generic webhook validation
- _(slack)_ Simplify config validation
- _(release)_ V2.4.4

## [2.4.3] - 2026-03-29

### 🚀 Features

- Add Greek locale file
- Add el-GR translations
- Add Greek locale
- Add el-GR translation
- Add greek language to schema
- Added support for el-GR language
- Added support for el-GR
- _(i18n)_ Add Macedonian (mk-MK) translation

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.4.3

## [2.4.2] - 2026-03-29

### 🚀 Features

- _(api)_ Add user locale and event_data columns for i18n
- _(api)_ Wire user locale into auth and API validation
- _(api)_ Persist structured activity and notification events for i18n
- _(i18n)_ Add English and German translation catalogs and schema
- _(i18n)_ Add check, report, and schema maintenance scripts
- _(web)_ Add i18next, locale hook, and Vite i18n integration
- _(web)_ Sync locale with auth session and account preferences
- _(email)_ Localize workspace invitation template
- _(web)_ Internationalize routes and notification types
- _(web)_ Internationalize components and task filter hooks
- Add initial configuration for Coderabbit integration (#1099)

### 🐛 Bug Fixes

- _(api)_ Restore activity search for event data
- _(email)_ Localize auth sign-in emails
- _(auth)_ Localize invitation email subject
- _(web)_ Correct backlog priority filter chip label
- _(web)_ Preserve exact locale matching in resolver
- _(web)_ Invalidate session after locale updates
- _(web)_ Refresh bulk priority labels on locale change
- _(web)_ Make backlog due-date labels explicit
- _(ui)_ TouchAction on the sortable row style object is now conditional on isDragging (#1098)
- Resolve i18n review issues and improve UI components
- _(deps)_ Patch security vulnerabilities in transitive dependencies
- _(docker)_ Copy i18n directory into web container build context

### 📚 Documentation

- Document i18n contribution workflow
- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Fix biome ci (formatting, dead code, ignore coverage)
- _(web)_ Remove non-English list view comment
- _(release)_ V2.4.2
- Revert version to 2.4.1
- _(release)_ V2.4.2

## [2.4.1] - 2026-03-27

### 🚀 Features

- _(ui)_ Gantt chart resize dates (#1095)
- _(ui)_ Refine ArchiveTasksModal layout and alignment (#1091)

### 🐛 Bug Fixes

- _(web)_ Resolve Biome noArrayIndexKey lint in shortcuts, repo modal, and error display (#1096)
- Validate task status and priority inputs across all API endpoints (#1093)

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.4.1

## [2.4.0] - 2026-03-26

### 🚀 Features

- Gantt view and task start date (#1083)

### 🐛 Bug Fixes

- Mark optional Organization fields as nullable in OpenAPI spec (#1090)
- Enforce user ownership in notification endpoints (#1089)
- Fix public project access after getTasks response shape change (#1088)
- Prevent start date after due date and improve activity messages
- Improve task sidebar icon button styling
- Resolve picomatch security vulnerabilities

### ⚙️ Miscellaneous Tasks

- Fix vurnrebilities
- _(release)_ V2.4.0

## [2.3.16] - 2026-03-24

### 🐛 Bug Fixes

- Subtasks default priority (#1080)
- _(ui)_ Make subtasks appear after creation without refresh (#1084)

### ⚙️ Miscellaneous Tasks

- Update pnpm-lock.yaml
- _(release)_ V2.3.16

## [2.3.15] - 2026-03-23

### 🚀 Features

- Add bulk assign labels, priority & deadlines
- Add bulk assign labels, priority & deadlines

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.15

## [2.3.14] - 2026-03-23

### 🚀 Features

- Replace browser confirm with Archive modal
- _(web)_ Refine breadcrumb and workspace switcher styling
- _(api,web)_ Add subtasks and task relations
- _(web)_ Redesign subtasks UI with bulk actions
- _(web)_ Add relations to task detail, animated subtasks, and keyboard nav
- _(auth)_ Allow OIDC-only user registration

### 🐛 Bug Fixes

- _(api)_ Only apply task pagination when explicitly requested

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.13
- Update biome dependency to version 2.4.8 in configuration files
- Formatting
- _(release)_ V2.3.14

## [2.3.13] - 2026-03-22

### 🚀 Features

- _(web)_ Refine breadcrumb and workspace switcher styling

### 🐛 Bug Fixes

- _(api)_ Only apply task pagination when explicitly requested

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.13

## [2.3.12] - 2026-03-21

### 🚀 Features

- Better label color support
- _(api)_ Add pagination, bulk ops, comments, members, and project archival
- _(web)_ Add sorting controls to board, backlog, and list views
- _(api,web)_ Add global search with short-id support

### 🐛 Bug Fixes

- _(api,web)_ Fix kanban position persistence and task numbering
- _(api)_ Consolidate migrations into single 0015 without duplicate asset table
- Project key input limit

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.12

## [2.3.11] - 2026-03-14

### 🚀 Features

- _(api,web)_ Fix task access and editor link handling

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.11

## [2.3.10] - 2026-03-14

### 🐛 Bug Fixes

- Due date calendar width
- Mistake with regex
- _(web)_ Preserve text color on autofilled inputs in dark theme

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.10

## [2.3.9] - 2026-03-13

### 🚀 Features

- Enhance file upload functionality for attachments

### 🐛 Bug Fixes

- File upload with umlauts

### 📚 Documentation

- Add storage backends guide and update references for image uploads
- Update object storage documentation to clarify upload options and sizes

### ⚙️ Miscellaneous Tasks

- Update deps
- _(release)_ V2.3.9

## [2.3.8] - 2026-03-11

### 🚀 Features

- Add image upload functionality to task descriptions and comments

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.8

## [2.3.7] - 2026-03-11

### 🐛 Bug Fixes

- Update actions/checkout version to v6 in workflow files

### 🚜 Refactor

- Update email templates

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.7

## [2.3.6] - 2026-03-11

### 🚀 Features

- Redesign task details page

### 🐛 Bug Fixes

- Update auto-merge conditions and change merge strategy to squash
- Update better-auth and tiptap dependencies to latest versions
- Update packageManager version to pnpm@10.32.1

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Fix security issues
- _(release)_ V2.3.6

## [2.3.4] - 2026-03-05

### 🚀 Features

- Openapi spec + migrations
- Add operation summary generation for OpenAPI specs

### 🐛 Bug Fixes

- Update API server URL to use HTTPS
- Update organization paths to include auth prefix
- Update task assignee retrieval to use user table

### 📚 Documentation

- Update openapi spec
- Update openapi
- Fix openapi

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.4

## [2.3.3] - 2026-03-04

### 🐛 Bug Fixes

- Api keys couldn't be created

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.3.3

## [2.3.2] - 2026-03-03

### 🐛 Bug Fixes

- Update auth logic and add apiKey dependency
- Consolidate imports from better-auth/api

### ⚙️ Miscellaneous Tasks

- Update deps
- _(release)_ V2.3.2

## [2.3.1] - 2026-03-02

### 🚀 Features

- Implement FadeIn component for smooth animations in landing pages
- Add Plausible analytics scripts for tracking
- _(settings)_ Refresh settings sidebars and project/workspace UX
- _(tasks)_ Improve bulk selection, column actions, and task detail popovers

### 🐛 Bug Fixes

- Favicon
- _(types)_ Align client models and add reliable web typecheck command

### 📚 Documentation

- Update contributors and sponsors

### 🚜 Refactor

- _(ui)_ Remove Radix Slot and use Base UI render composition

### ⚙️ Miscellaneous Tasks

- Update deps
- Update deps
- _(release)_ V2.3.1

## [2.3.0] - 2026-02-25

### 🚀 Features

- _(web)_ Persist board filters and polish linear-style filter chips
- _(web)_ Revamp dashboard shell navigation and header controls
- _(web)_ Polish kanban and backlog interactions
- Improve styles for filters
- _(web)_ Implement board search functionality and integrate with task filters
- Add app preview in landing page

### 📚 Documentation

- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Switch to mintlify
- Add new landing page
- Add new landing page
- Add new landing page
- Update contributors and sponsors

### 🚜 Refactor

- _(web)_ Update coss ui wrappers for menu and popover primitives
- Simplify CommandDialog usage in SearchCommandMenu and TaskCard components

### 🎨 Styling

- Adds coss ui & base ui

### ⚙️ Miscellaneous Tasks

- Fix linting issues
- Update deps
- Fix conflicts
- Fix linting
- _(release)_ V2.3.0

## [2.2.1] - 2026-02-16

### 🐛 Bug Fixes

- Apps/web/Dockerfile to reduce vulnerabilities

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.2.1

## [2.2.0] - 2026-02-09

### 🚀 Features

- _(columns)_ Add column management
- Update getColumnIcon to accept isFinal parameter and apply changes across components
- Enhance task status management with new utility functions and improved status update logic

### 📚 Documentation

- Update CLAUDE.md to clarify validation tools, code style guidelines, and pre-commit hook checks
- Update contributors and sponsors

### 🚜 Refactor

- Rename upsertMigrationWorkflowRule to ensureMigrationWorkflowRule and update migration logic for workflow rules

### ⚙️ Miscellaneous Tasks

- Update dependencies
- _(release)_ V2.2.0

## [2.1.24] - 2026-02-05

### 🐛 Bug Fixes

- _(tasks)_ Fix task deletion

### 📚 Documentation

- Update contributors and sponsors

### 🚜 Refactor

- _(auth)_ Remove unused onSuccess prop from OtpSignInForm component

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.24

## [2.1.23] - 2026-01-17

### ⚙️ Miscellaneous Tasks

- Update pnpm
- _(release)_ V2.1.23

## [2.1.21] - 2026-01-12

### 🚀 Features

- Integrate input-otp component for OTP verification

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.21

## [2.1.20] - 2026-01-11

### 🐛 Bug Fixes

- Correct wording in OTP email template for improved clarity

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.20

## [2.1.19] - 2026-01-11

### 🐛 Bug Fixes

- Update OTP email text for clarity

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.19

## [2.1.18] - 2026-01-11

### 🚀 Features

- Enhance task due date management with clearing functionality and UI improvements

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.18

## [2.1.17] - 2026-01-11

### 🚜 Refactor

- Remove admin authentication and update user retrieval in activity comments

### ⚙️ Miscellaneous Tasks

- Add esbuild override to package.json for version control
- _(release)_ V2.1.17

## [2.1.16] - 2026-01-11

### 🚀 Features

- Add admin authentication and enhance task comment event with user details

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.16

## [2.1.15] - 2026-01-11

### 🚀 Features

- Integrate Bun for documentation generation and add OpenAPI fetching scripts
- Implement task comment creation event handling and integrate with GitHub plugin

### 📚 Documentation

- Update contributors and sponsors
- Add drim CLI tool for one-click deployment and enhance installation instructions
- Update documentation structure
- Add SMTP configuration details to environment setup and documentation
- Update redirect URIs for Discord, GitHub, and Google social providers

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.15

## [2.1.14] - 2026-01-10

### 🚀 Features

- Enhance GitHub integration documentation
- Improve invites for smtp off users

### 📚 Documentation

- Update readme

### 🚜 Refactor

- Simplify task details sheet structure and add keyboard escape functionality for closing
- Remove optional workspaceId query validator from project endpoint

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.14

## [2.1.13] - 2026-01-09

### 🚀 Features

- Enhance touch interactions and improve drag-and-drop responsiveness in Kanban board

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.13

## [2.1.12] - 2026-01-09

### 🚀 Features

- Add keyboard shortcuts help dialog and enhance task selection with focus management

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.12

## [2.1.11] - 2026-01-08

### 🚀 Features

- Enhance GitHub issue and pull request handling matching
- Add bulk select toolbar on backlog and list view
- Improve github integration, fix invitation bugs, move to otp, email templates improvements

### ⚙️ Miscellaneous Tasks

- Update globals package version to 17.0.0
- _(release)_ V2.1.11

## [2.1.10] - 2026-01-05

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.10

## [2.1.9] - 2026-01-04

### 🚜 Refactor

- Streamline external link handling by importing ExternalLink type and updating fetch logic

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.9

## [2.1.8] - 2026-01-04

### 🚀 Features

- Enhance auto-merge workflow for Dependabot PRs
- Enhance email invitation handling with SMTP configuration check
- Implement bulk selection and actions for tasks with a new toolbar and menu
- Update issue import functionality to include closed issues and handle pull request links

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.8

### 💼 Other

- Fix workspace switching
- Fix workspace switching

## [2.1.7] - 2026-01-04

### 🚀 Features

- Add external link and integration tables with relations
- Enhance activity schema and GitHub integration
- Add task title and description change events to GitHub integration
- Enhance GitHub issue import functionality
- Improve repository listing for GitHub installations
- Integrate pull request display in task row with hover card support

### 🐛 Bug Fixes

- Adjust docs link

### 📚 Documentation

- Add railway docs
- Update contributors and sponsors

### 🚜 Refactor

- Remove unused Button import from page-actions component

### ⚙️ Miscellaneous Tasks

- Update deps
- _(release)_ V2.1.7

## [2.1.6] - 2025-12-20

### 🚀 Features

- Add access control to API endpoints
- Add GitHub webhook handling and workspace access validation

### 📚 Documentation

- Update environment variable documentation and redirect URIs for social providers
- Update AUTH_SECRET generation command to use base64

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.6

## [2.1.5] - 2025-12-16

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.1.5

## [2.1.4] - 2025-12-15

### 🚀 Features

- _(api)_ Enhance workspace access validation with API key support
- _(docs)_ Create initial DocsPage component with redirect to core documentation

### 🐛 Bug Fixes

- _(auth)_ Improve OAuth scopes handling and update redirect URI in documentation

### 📚 Documentation

- Update contributors and sponsors
- Add sponsorship information to README and issue template, and include sponsor link in layout
- Update backend API guidelines
- Update AUTH_SECRET documentation and enhance API key management UI

### 🚜 Refactor

- _(api)_ Reorganize workspace access validation logic
- Change interface declarations to type aliases for consistency
- _(api)_ Update schemas to use picklists for status, priority, and type fields

### ⚙️ Miscellaneous Tasks

- Update GitHub funding user from 'usekaneo' to 'andrejsshell'
- Add sponsors badge to README
- Update deps
- _(release)_ V2.1.4

## [2.1.1] - 2025-12-13

### 🚀 Features

- _(auth)_ Add custom OAuth provider support
- _(db)_ Add api key table schema
- _(db)_ Add api key relations
- _(db)_ Add api key migration
- _(db)_ Export api key table from database
- _(api)_ Add workspace access validation utility
- _(auth)_ Add api key authentication middleware
- _(api)_ Add OpenAPI endpoint and documentation handler
- _(web)_ Add api key types
- _(web)_ Add api key query hook
- _(web)_ Add create api key mutation hook
- _(web)_ Add delete api key mutation hook
- _(web)_ Add api key table component
- _(web)_ Add create api key dialog component
- _(web)_ Add api key created modal component
- _(web)_ Add developer settings page
- _(web)_ Add developer tab to account settings
- _(docs)_ Add OpenAPI specification file
- _(docs)_ Add OpenAPI parsing utilities
- _(docs)_ Add OpenAPI API route
- _(docs)_ Add API page client component
- _(docs)_ Add API page server component
- _(docs)_ Add documentation generation script
- _(docs)_ Update source configuration for new structure
- _(docs)_ Update docs page for API routes
- _(docs)_ Update docs layout navigation
- _(api)_ Add shared response schemas for OpenAPI documentation
- _(api)_ Replace v.any() with proper type schemas in all routes
- _(docs)_ Add API overview page with endpoint cards
- _(docs)_ Add redirects from old documentation paths
- _(docs)_ Update internal links to new documentation structure
- _(docs)_ Configure docs generator to group endpoints by domain
- Add DISABLE_GUEST_ACCESS environment variable
- _(database)_ Update workspace slug handling
- _(auth)_ Add support for custom OAuth/OIDC provider integration
- _(auth)_ Add support for custom OAuth/OIDC provider integration
- _(database)_ Update workspace slug handling
- _(api)_ Implement workspace access middleware for project routes
- _(api)_ Add Discord and guest access sign-in options to config schema
- _(api)_ Add updatedAt field to githubIntegrationSchema
- _(api)_ Implement updateTimeEntry functionality in time-entry API
- _(api)_ Enhance deleteComment function to return deleted comment
- _(api)_ Add event subscriptions for task activity tracking
- _(api)_ Enhance event subscriptions for task and workspace notifications
- _(api)_ Improve API key verification and error handling
- _(api)_ Remove optional description field from label schema
- _(api)_ Update OpenAPI schema and dependencies
- _(docs)_ Add authentication guide and update API documentation
- _(api)_ Validate task creation data and update notification content

### 🐛 Bug Fixes

- Resolve linter issues
- Prevent create task modal from closing on outside click
- _(api)_ Improve query validation and update API URL structure

### 📚 Documentation

- Reorganize documentation into core folder
- Add API documentation meta file
- Add activity endpoint documentation
- Add comments endpoint documentation
- Add label endpoint documentation
- Add project endpoint documentation
- Add task endpoint documentation
- Add notification endpoint documentation
- Add time entry endpoint documentation
- Add github integration endpoint documentation
- Add config and search endpoint documentation
- Remove old documentation files
- Document DISABLE_GUEST_ACCESS environment variable
- Add Discord SSO documentation
- Document DISABLE_GUEST_ACCESS environment variable

### 🚜 Refactor

- _(api)_ Add OpenAPI schema to config endpoint
- _(api)_ Add OpenAPI schemas to activity endpoints
- _(api)_ Add OpenAPI schemas to label endpoints
- _(api)_ Add OpenAPI schemas to project endpoints
- _(api)_ Add OpenAPI schemas to task endpoints
- _(api)_ Add OpenAPI schemas to notification endpoints
- _(api)_ Add OpenAPI schemas to time entry endpoints
- _(api)_ Add OpenAPI schemas to search endpoints
- _(api)_ Add OpenAPI schemas to github integration endpoints

### 🎨 Styling

- _(docs)_ Update global styles
- Adjust spacing for guest access separator in sign-up component
- Adjust spacing for guest access separator in sign-up component
- Adjust spacing for guest access separator in sign-up component
- Adjust spacing for guest access separator in sign-up component

### ⚙️ Miscellaneous Tasks

- _(db)_ Update migration journal
- _(api)_ Add hono-openapi dependency
- _(web)_ Regenerate route tree
- _(web)_ Update auth client configuration
- _(docs)_ Update dependencies
- Update lockfile
- _(docs)_ Regenerate API documentation with updated schemas
- _(api)_ Remove unused imports from config route
- _(release)_ V2.0.9
- _(docs)_ Update contributing and environment setup documentation
- _(release)_ V2.1.1

## [2.0.9] - 2025-12-10

### 🚀 Features

- _(database)_ Update session and workspace schemas
- Add DISABLE_GUEST_ACCESS environment variable

### 🐛 Bug Fixes

- Prevent create task modal from closing on outside click

### 📚 Documentation

- Document DISABLE_GUEST_ACCESS environment variable
- Add Discord SSO documentation

### 🎨 Styling

- Adjust spacing for guest access separator in sign-up component
- Adjust spacing for guest access separator in sign-up component

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.0.9

### 💼 Other

- Check list won't save #640 (#656)

## [2.0.8] - 2025-12-09

### 🚀 Features

- _(auth)_ Add support for custom OAuth/OIDC provider integration

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.0.8

## [2.0.7] - 2025-12-08

### 🚀 Features

- _(migration)_ Update invitation table to add created_at column with default value handling

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.0.7

## [2.0.6] - 2025-12-08

### 🚀 Features

- _(auth)_ Enhance base URL handling and trusted origins

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.0.6

## [2.0.5] - 2025-12-07

### 🚀 Features

- _(migration)_ Rename active_workspace_id to active_organization_id

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.0.5

## [2.0.4] - 2025-12-05

### 🚀 Features

- _(email)_ Add option to enable RequireTLS (#630)
- Add ThemeToggleDropdown component and integrate into AppSidebar (#652)

### 🐛 Bug Fixes

- Standardize title separator from ⎯ to — across metadata and layout files
- Fix Status not updating when moved in the grid (#638)

### 📚 Documentation

- Update contributors and sponsors

### 🎨 Styling

- Refactor: format code and ensure newline at end of file in task and theme toggle components

### ⚙️ Miscellaneous Tasks

- _(release)_ V2.0.4

## [2.0.3] - 2025-11-05

### ⚙️ Miscellaneous Tasks

- Update healtcheck
- _(release)_ V2.0.3

## [2.0.2] - 2025-11-02

### 🚀 Features

- Add version display to app sidebar and expose app version globally

### 🐛 Bug Fixes

- Update footer link to point directly to the documentation root

### ⚙️ Miscellaneous Tasks

- Update depds
- _(release)_ V2.0.2

## [2.0.1] - 2025-11-02

### 🚀 Features

- Enhance authentication configuration for cross-subdomain support and update API client paths
- Refactor API routing to use separate Hono instance and update client API URL structure
- Adds removing of a team member

### 🐛 Bug Fixes

- Ensure API URL structure is consistent by handling trailing '/api' in base URL

### 📚 Documentation

- Update contributors and sponsors

### 🚜 Refactor

- Update navigation menu items in layout for clarity and improved user experience

### ⚙️ Miscellaneous Tasks

- Remove deprecated docker-compose configuration files and clean up volume definitions
- Remove deprecated docker-compose configuration files and clean up volume definitions
- Update docker-compose to use latest images for api and web services
- _(release)_ V2.0.1

## [2.0.0] - 2025-10-23

### 🚀 Features

- Better auth integration (#466)
- Implement onboarding flow and update routing (#469)

### 🐛 Bug Fixes

- Preserve formatting when copy/pasting in new task modal (#432) (#481)

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors

### 🚜 Refactor

- Moves to pathless, protected authenticated routes and beforeLoad dashboard routing (#467)

### ⚙️ Miscellaneous Tasks

- Removing bun.lock
- _(release)_ V2.0.0

### 💼 Other

- Update_task: optimize event publishing in updateTask function (#483)

## [1.2.4] - 2025-08-17

### 🚀 Features

- Replace loading indicators with a new LoadingSkeleton component for improved UI consistency
- _(391)_ Add "archive" and "planned" to the context menu of cards (#436)
- _(#383)_ Add rich text editor for comments (#435)
- Enhance metadata and sitemap for improved SEO and user experience

### 🐛 Bug Fixes

- _(#389)_ Added archived to the calculation of "solved" tickets (#437)
- Reorder imports in task-activities and task-comment components for consistency

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.2.4

## [1.2.3] - 2025-08-06

### ⚙️ Miscellaneous Tasks

- Adding description to imported issues
- _(release)_ V1.2.3

## [1.2.2] - 2025-08-06

### 🚀 Features

- Implement GitHub issue handling for task status and priority changes

### 🐛 Bug Fixes

- Update default API URL to localhost and add ASCII art logo in main entry file

### 📚 Documentation

- Update environment setup instructions and add troubleshooting guide for common issues

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.2.2

## [1.2.1] - 2025-08-05

### 🚀 Features

- Add delete task confirmation dialog to task card and task info components
- Enhance task description formatting and skip GitHub issue creation for related tasks

### 📚 Documentation

- Update contributors and sponsors

### ⚙️ Miscellaneous Tasks

- Export app for vercel deployment
- Export app for vercel deployment
- Export app for vercel deployment
- _(release)_ V1.2.1

## [1.2.0] - 2025-08-01

### 🐛 Bug Fixes

- Resolve delete project dialog bug (#419)

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.2.0

## [1.1.9] - 2025-07-30

### 🚜 Refactor

- Update favicon and manifest files, remove unused icons, and add new site.webmanifest

### ⚙️ Miscellaneous Tasks

- Add cursor files
- _(release)_ V1.1.9

## [1.1.8] - 2025-07-22

### 🚀 Features

- Add croner for scheduled tasks and implement demo user setup

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.1.8

## [1.1.7] - 2025-07-22

### 🚀 Features

- Enable demo mode in layout and dashboard components

### ⚙️ Miscellaneous Tasks

- Enable automatic release notes generation in workflow
- _(release)_ V1.1.7

## [1.1.6] - 2025-07-22

### 🚜 Refactor

- Remove workspace retrieval logic from dashboard route

### 🎨 Styling

- Add class for button height adjustment in project settings

### ⚙️ Miscellaneous Tasks

- Update changelog generation command to use pnpm
- Update changelog generation command to use bun instead of pnpm
- _(release)_ V1.1.6

## [1.1.5] - 2025-07-21

### 🐛 Bug Fixes

- Port number in documentation (#375)

### 📚 Documentation

- Update contributors and sponsors

### 🎨 Styling

- Use a consistent design system (#363)

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.1.5

## [1.1.4] - 2025-07-10

### 🚀 Features

- Implement GitHub issues import functionality
- Implement task detail modal and enhance task interaction
- Implement global search functionality

### 🐛 Bug Fixes

- Update task detail modal to display assignee name

### ⚙️ Miscellaneous Tasks

- Update FUNDING.yml
- _(release)_ V1.1.4

## [1.1.0] - 2025-07-06

### 🚀 Features

- Enhance task retrieval and display with assignee details

### 🐛 Bug Fixes

- Update task assignee handling and improve task display

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.1.0

## [1.0.9] - 2025-07-05

### 🚀 Features

- Update footer with operational status link and visual indicator
- Add configuration endpoint and integrate config handling in sign-up flow
- Update layout configuration and metadata
- Add documentation links to home layout with icons
- Add theme selection options to command palette

### 🐛 Bug Fixes

- Update Quick Start link in README to point to documentation

### 🚜 Refactor

- Remove environment variable checks
- Improve GitHub app initialization and error handling
- Enhance CreateTaskModal with improved label management and task creation flow
- Enhance Editor component layout and improve task description modal styling
- Simplify Editor component click handling and remove unused keydown event

### 🎨 Styling

- Update delete button styling for improved UX

### ⚙️ Miscellaneous Tasks

- Update dependencies
- _(release)_ V1.0.9

## [1.0.2] - 2025-06-22

### 🚜 Refactor

- Simplify task data destructuring in handleTaskCreated function

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.0.2

## [1.0.1] - 2025-06-22

### 🚀 Features

- GitHub integration (#323)

### ⚙️ Miscellaneous Tasks

- _(release)_ V1.0.1

## [1.0.0] - 2025-06-20

### 🚀 Features

- Comments ui proposal (#262)
- _(board)_ Add CreateTaskModal for task creation functionality
- _(hero)_ Update hero component to promote Kaneo Cloud with new icon and link
- _(index.html)_ Add Plausible Analytics script for cloud.kaneo.app domain
- Migrate from SQLite to PostgreSQL (#315)
- Update documentation with cloud version promotion
- Add manifest and icons for Kaneo project management platform
- Enhance project settings form with unsaved changes warning

### 🐛 Bug Fixes

- Update metadata template for Kaneo project
- Simplify metadata default title for Kaneo documentation
- Update metadata title template for Kaneo documentation
- Adjust metadata title template for Kaneo documentation

### 📚 Documentation

- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors

### 🚜 Refactor

- _(api)_ Integrate settings for demo mode and update user info display
- _(task-card)_ Remove console.log for task debugging
- Update animation durations and metadata for Kaneo project
- Replace Error with HTTPException

### ⚙️ Miscellaneous Tasks

- _(docker)_ Remove health check from Dockerfile
- Enhance contributing guidelines and README for clarity and accessibility
- Update .gitignore to include cursor files
- Update Dockerfile to streamline dependencies and user setup
- Comment out static asset caching configuration in nginx.conf
- Reverting psql migrations
- _(ci)_ Specify biome version 1.9.4 in CI workflow
- _(ci)_ Update Biome version to 1.9.7 in CI workflow
- _(release)_ V1.0.0

## [0.4.0] - 2025-05-10

### 🚀 Features

- Add registration control feature (#134)
- Disable create project and workspace buttons (#133)
- Workspace details update and delete feature added (#119)
- Migrate to node.js (#138)
- Add documentation site with Next.js and Fumadocs (#163)
- Set base path for documentation site to "/kaneo"
- Add sitemap generation and Open Graph image support
- Add Inter font files and integrate them into Open Graph image generation
- Add Icon component for Open Graph image generation and update metadata structure
- Enhance homepage metadata for SEO and social sharing
- Add Plausible analytics script to layout components
- Implement time tracking feature for tasks (#172)
- Integrate project data fetching in task edit page
- Enhance CreateTaskModal with improved layout and scrolling (#183)
- Add task import/export functionality
- Update Hero component link to roadmap and add roadmap documentation
- Add label management functionality
- Delete a task option #122 (#216)
- Add sorting functionality to task filters (#217)
- Add "Edit on GitHub" link to documentation pages
- Add issue and pull request templates for better contribution guidelines
- Enhance project settings with task data and project icon
- Right click card/row context menu (#238)
- _(notification)_ Implement notification system (#270)

### 🐛 Bug Fixes

- Project is highlighted when backlog is active (#131)
- Edit project slug max length (#137)
- Fix workspace setting sidebar icon (#157)
- Update Open Graph image generation and enhance metadata logging
- Update Open Graph image URL to include full domain path
- Streamline Open Graph image URL by consolidating domain path
- Remove unnecessary logging of slug in metadata generation
- Correct Open Graph image URL to use the proper domain path
- Update Open Graph image URL to use the correct GitHub Pages domain
- Update site name in Open Graph metadata and enhance layout for image generation
- Update site name in Open Graph metadata and enhance layout for image generation
- Add out directory to ignored files in biome.json
- Update font file paths for Open Graph image generation
- Remove title from SVG in Open Graph component and add lint ignore comment
- Update base path and image URL for Open Graph metadata in documentation
- Reorder import statements in layout file for consistency
- Update port forwarding configuration in documentation and deployment files
- Update environment variable handling and Dockerfile comments
- Update API URL handling in client initialization
- Update registration environment variable and improve error handling
- Fixed the saving of the indent of the description of the task (#219)
- Ensure tables are created only if they do not already exist

### 📚 Documentation

- Update README with sponsors and contributors sections; (#135)
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Update contributors and sponsors
- Add YouTube Quick Start Guide link and embed video in documentation
- Update contributors and sponsors

### 🚜 Refactor

- _(api)_ Simplify delete project endpoint by removing workspaceId requirement
- Clean up API URL handling and remove unused WebSocket hook
- Update Open Graph image generation to use local library and improve URL structure
- Rename docs package and enhance homepage layout
- Remove unused userEmail parameter from updateTimeEntry function
- Update registration settings to use disableRegistration flag
- _(backlog)_ Rename task columns from "To Do" to "Planned" and "Done" to "Archived"

### 🎨 Styling

- Enhance layout and styling for Open Graph image generation
- Adjust layout and styling for Open Graph component
- Change width property to auto for improved layout in Open Graph component
- Adjust alignment of component in Open Graph generation
- Update TaskLabels component for improved dark mode support

### ⚙️ Miscellaneous Tasks

- Pinning docker versions
- Making demo users unique
- Fix auto assign
- Update contributor token in workflow to use GITHUB_TOKEN
- Update .gitignore and add lucide-react dependency
- Update GitHub Actions workflow to specify paths for API and web apps
- Update GitHub Actions workflow to include all apps and packages
- Updating pnpm-lock
- Updating pnpm-lock
- Update pre-commit hook to include build step and remove unused import
- Update roadmap with issue links for planned features and improvements
- Update dependabot.yml
- _(release)_ V0.4.0

## [0.3.0] - 2025-03-26

### 🚀 Features

- Adds acl's and removing of team members
- Adds archiving of tasks
- Adds backlog

### 🐛 Bug Fixes

- Improves bakclog task row popover styles
- Accessibility issues with workspace picker

### ⚙️ Miscellaneous Tasks

- Updating contributors
- _(release)_ V0.3.0

## [0.2.0] - 2025-03-24

### 🚀 Features

- Adding demo setup (#83)
- Add alert for demo page (#85)
- Making tasks editable (#97)
- Migrating from rabbit mq to node's event emitter
- Moving from websockets and using polling
- Adding board filters
- Adding position of tickets in columns
- Adding rich text editor in create task modal
- Adding toast component
- List view
- Adding option to update/remove projects
- Updating user info popup
- Adding dynamic titles
- Adding seo support
- Improved seo
- _(frontend)_ :sparkles: adds cmd+k
- _(deployment)_ Add Helm chart and improve container security (#116)

### 🐛 Bug Fixes

- Making alert have only 12 rem height
- Returing padding to board
- Removing fixed height on alert
- Making columns grow as much space as they have
- Settings page had workspace selection screen
- Making demo email unique
- Lowering elysia version to 1.2.15
- Clear input fields when closing dialogs (#89)
- Fixing desktop layout for task edition
- Making new session for demo user and updating data purge for every hour
- Setting demo sessions to 15m
- Fixing desktop styles for task edit
- Force field validation errors (#109)
- Making board skeletons full width
- Making tooltip work on mobile
- Adding loading spinner on task edit page
- Showing empty state for workspaces
- Loading tasks initially
- Deciding scure of cookie based on request protocol
- Renewing sessions on demo mode
- Not returning from middleware
- Removing console log
- Removing un-setting to workspace and projects when going to settings
- Session expired wasn't getting recreated on demo
- Disabling inviting already invited users
- Adapting list view on mobile drag
- Adding clear all filters buttons, making responsive
- Clear input fields when closing create task dialog (#115)

### 📚 Documentation

- Updating contributing guide

### 🚜 Refactor

- Updating types for controllers

### ⚙️ Miscellaneous Tasks

- Updating discord invite
- Removing rabbitmq from readme
- Adding explanation of .env variables
- Updating readme
- Updating logic for sidebar
- Allow for devcontainer usage (#111)
- Renaming repo / organization
- Removing unused components
- Added sponsors
- Fixing sponsorship pipeline
- Updating sponsorship pipeline
- Updating gh token
- Changing token
- Updating readme
- _(frontend)_ Adds cmdk dependency
- Adding permissions to write to appuser
- Adding permissions to write to appuser
- Reverting changes regarding permissions
- _(release)_ V0.2.0

## [0.1.0] - 2025-02-22

### 🚀 Features

- _(create-turbo)_ Create basic
- _(create-turbo)_ Apply official-starter transform
- _(create-turbo)_ Apply package-manager transform
- :construction_worker: adding workflow to lint project
- :construction_worker: updating workflow name
- :construction_worker: updating husky and commitlint
- :sparkles: finishing authentication, adding color modes
- :fire: migrating to sessions, using file routes, adding auth provider
- :sparkles: updating logo design
- :sparkles: adding crud for workspaces
- :fire: adding initial kanban board
- :sparkles: adding projects
- :sparkles: adding marketing image
- :sparkles: adding marketing image
- :sparkles: adding marketing image
- :sparkles: adding marketing image
- :sparkles: initial commit for projects
- Adding docker images and compose
- :sparkles: finishing socket communication for tasks
- Adding project icons
- Adding project slugs
- Adding invites for users
- Adding pending invited users screen
- Adding sensors for dnd
- Adding multi platform build
- Initial task edit setup
- Making manage teams screens responsive
- Finishing responsive-ness on manage teams screens
- Adding settings page
- Changing cover image
- Adding empty / error states
- Teams refactor (#70)

### 🐛 Bug Fixes

- :sparkles: format drizzle.config.ts
- :green_heart: fixing formatting in package.json
- :bug: fixing route generation for vite
- :construction_worker: fixing build on pipeline
- Removing unused import
- :bug: fixing overflowing workspace names
- Updating reamde
- :bug: fixing deleted workspaces being cached
- Removing unused packages
- Removing unused packages
- Removing unused packages
- Changing release branch
- Fixing build context
- Listing web's nginx conf
- Updating docker context
- Refactoring publishing flow
- :bug: remove unused import
- Task title was overflowing when too long
- Fixing long task titles
- Reseting zustand after sign out
- Fixing route selection and creating tasks with no asignee
- Adding loading state for projects, sync ws when creating new tasks
- Making sidebar on mobile floating
- Improving scrolling on dnd
- Wrong z-index on modals
- Adding cursor button
- Making settings not dependant on a workspaceId
- Adding dynamic view height on sidebar
- Improving padding for user info section
- Making sidebar fixed
- Fixing local development setup
- Updated urls and removing urls
- Major route refactor, adding empty / selection states
- Updated mutateFn for sign in / up flow
- Fixing empty states
- Fixed but when preloading a workspace / project

### 📚 Documentation

- :memo: adding readme
- Update README.md
- Adding readme

### 🚜 Refactor

- :recycle: cleaning up auth flow
- :recycle: improving sidebar code
- :recycle: adding workspace schemas, refactoring auth again...
- :recycle: fixing build issues
- :recycle: fixing build issues
- :recycle: fixing build issues
- :sparkles: improving code for projects fetching
- :recycle: removing unused files
- Storing selected workspace and project in url

### 🎨 Styling

- :sparkles: formatting project with biome
- :sparkles: formatting whole project with biome
- Making sidebar responsible, changing up workspace selection

### ⚙️ Miscellaneous Tasks

- :green_heart: fixed build and added it to pipeline
- :construction_worker: change build command
- :construction_worker: commenting build on pipeline for now, updating dependencies
- :construction_worker: using ubuntu with specific version
- :construction_worker: returning build command
- :construction_worker: returning build command
- :construction_worker: building only web
- :construction_worker: building only web
- :construction_worker: commenting build step
- Create auto-assign.yml
- Create LICENSE
- Fix pipeline
- Update dependabot.yml
- Update dependabot.yml
- Update dependabot.yml
- Updating react query
- Moving to react 19
- Bumping react-dom types
- Pin auto assign version
- Update ci.yml
- Upgrading to tailwind 4
- Update ci.yml
- Updating pnpm-lock
- Resolve conflicts
- Updating turbo
- Updating compose
- Change ubuntu version
- Adding conventional commits
- Using diff actions for changelogs
- _(release)_ V0.1.0 [skip ci]
- Finishing releases
- Updating actions
- Updating releases
- _(release)_ 0.1.1
- Updating linting
- Merging develop branch
- _(release)_ 0.1.2
- _(release)_ 0.1.3
- _(release)_ 0.1.4
- :construction_worker: updating changelog generation
- :construction_worker: updating changelog generation
- Lowering package version
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- :construction_worker: debugging changelog pipeline
- _(release)_ V0.1.0 [skip ci] (#44)
- :construction_worker: debugging changelog pipeline
- _(release)_ V0.2.0 [skip ci] (#45)
- :construction_worker: debugging changelog pipeline
- _(release)_ V0.3.0 [skip ci] (#46)
- _(release)_ V0.4.0 [skip ci] (#47)
- :construction_worker: adding changelog file
- _(release)_ V0.5.0 [skip ci] (#48)
- :construction_worker: lowering version to 0.0.1
- _(release)_ V0.1.0 [skip ci] (#49)
- Create FUNDING.yml
- _(release)_ V0.2.0 [skip ci] (#50)
- :construction_worker: running certain actions when main files are changed
- Update FUNDING.yml
- _(release)_ V0.3.0 [skip ci] (#51)
- _(release)_ V0.4.0 [skip ci] (#54)
- _(release)_ V0.5.0 [skip ci] (#55)
- _(release)_ V0.6.0 [skip ci] (#57)
- Deploying on hetzner
- Updating image url for web
- Removing docker container name
- Add load balancer
- Add watchtower
- Removing replicas
- Adding volumes
- Updating turbo
- Fixing watchtower
- Fixing api url
- Lowered typebox version due to elysia uncompatibility
- Fixing build
- Adding back traefik
- Adding back traefik
- Fixing build
- Fixing build
- Fixing reverse proxy
- :art: adding seo
- Updating dockerfile
- Updating dockerfile
- Updating lockfile
- Updating dockerfile
- Updating db path
- Updating db path
- Updating api dockerfile
- Adding target platforms
- Adding build platform on dockerfile
- Adding build platform on dockerfile
- Updating dockerfile for permissions
- Updating dockerfile for permissions
- Fixing dockerfile for api
- Adding volumes
- Updating compose
- Updating volumes
- Adding missing env variables
- Updating cover image
- Adding releases action
- Adding releases action
- Adding releases action
- Adding releases action
- _(release)_ V0.7.0
- Updating turborepo
- Update readme (#71)
- _(release)_ V0.1.0
- Update changelog
- Update package.json
- _(release)_ V0.1.0
