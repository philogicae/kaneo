# Setup & Provisioning

Use this procedure only for requested setup. First inventory what exists; reuse it rather than resetting it. For tool semantics see [mcp-guidelines.md](mcp-guidelines.md); for task qualification see [lifecycle.md](lifecycle.md).

## Capability boundary

| Operation                                                               | Supported path in this fork                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Identify the account, list workspaces and members                       | MCP: `whoami`, `list_workspaces`, `list_workspace_members`                  |
| Create a user account                                                   | Web signup or configured OAuth/SSO; no user-creation MCP tool               |
| Create/rename a workspace or edit its description                       | Web UI; no workspace-write MCP tool                                         |
| Invite by email, accept invitations, change membership or roles         | Web UI; no corresponding MCP tools                                          |
| Retrieve an existing shareable invitation                               | MCP: `get_workspace_invite_link`; creating/revoking links is web-only       |
| Create/update projects, columns and labels                              | MCP where listed in the connected catalog; `update_label` renames/recolors, project archive has its own tools |
| Archive/unarchive a project                                             | MCP: `archive_project` / `unarchive_project` (`archived` task status is different) |
| Configure custom fields, templates, assets or non-Telegram integrations | Web UI; no corresponding MCP tools                                          |

An API endpoint existing in the codebase does not make it an MCP tool. Hand off unavailable operations with the exact UI action, desired outcome and read-back check. Do not change server settings or improvise auth API calls to complete setup.

## Users, invitations and permissions

- Users self-register or use configured SSO/OAuth. `DISABLE_REGISTRATION=true` disables **public** registration, not all onboarding: valid email invitations or usable shareable links allow registration; the initial empty-instance signup is also exempt. The first-user bootstrap promotes an eligible non-anonymous account to instance admin.
- Creating an account and joining a workspace are different steps. Send an invitation only to an explicitly approved recipient; after acceptance, verify membership before assigning work. A pending email invitation is not a member.
- Shareable links grant the **member** role, can be reusable, and are credentials: anyone holding one may join while it remains valid. For targeted onboarding, prefer an email invitation with the intended role; confirm before distributing an unlimited link. An invitation URL contains the token, so “share the URL, not the token” does not make it non-secret.
- `get_workspace_invite_link` retrieves an existing usable link; it does not create one. It prefers a non-expiring unlimited link. If none is usable, an authorized user must create one in workspace settings. Do not fetch a link during an unrelated inventory.
- Keep **instance roles** separate from **workspace roles**. Workspace creator = static `owner`. Defaults `admin`, `member`, `viewer` are seeded, editable workspace roles; custom roles also exist. Their effective permissions can differ between workspaces. Do not infer authorization from the role name alone.
- In the default permissions, `member` can create projects and update tasks but lacks `task:assign`; assignment requires the appropriate permission, not just workspace membership. Resolve the intended assignee from `list_workspace_members`: each row's **`id` is the user ID** to pass as `userId`, not a membership ID. Instance admins are also assignable by the API, but never guess an admin ID or assign outside the intended team.

### Onboard a person

1. Confirm the instance/account, exact workspace, intended person, role and invitation method. Inspect existing members by identity, not display name alone.
2. If absent, hand off signup/invitation to the authorized user in the web UI, or retrieve a shareable link only if explicitly requested. Never report an invitation as accepted before checking.
3. After acceptance, re-run `list_workspace_members`, resolve the returned `id`, and verify the intended role in settings. Authentication as one account cannot prove another user's effective access.
4. Assign a real task only when requested; do not create a “test user” or dummy task in a real workspace to verify setup.

## Workspaces

Workspaces are authorization boundaries; projects are containers inside them. Choose the right boundary before adding people or projects.

- With `DISABLE_WORKSPACE_CREATION=true`, only an **instance admin**, not merely a workspace admin, may create workspaces. Use the web creation flow and then resolve the resulting workspace using `list_workspaces`.
- Creation attempts to seed editable default roles and an unlimited default invite link. These hooks are best-effort, with boot-time backfill; verify availability when needed instead of promising the link always exists.
- Choose a clear non-empty name and useful description explaining what belongs there. `<scope>: <kind>` is a convention, not an API format requirement. Do not rename existing workspaces just to normalize them.
- Labels are workspace-scoped. A newly created workspace has no label set; inspect before creating a minimal set appropriate to the requested workflow. Setup is additive and resumable, not a full-workspace cleanup.

## Label conventions

**Color = category** is a recommended taxonomy, not a schema constraint. Reuse an established taxonomy where it differs. Palette names are preferable to hex equivalents because values are stored verbatim.

| Color       | Category              | Suggested labels                                                                                                                                                                 |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purple`    | Type of work          | `bug`, `feature`, `enhancement`, `chore`, `refactor`, `docs`, `research`, `idea`                                                                                                 |
| `teal`      | Area / domain         | `API`, `backend`, `frontend`, `UI/UX`, `infra`, `devops`, `database`, `security`, `testing`, `mobile`, `desktop`, `data`, `automation`, `networking`, `observability`, `tooling` |
| `yellow`    | Machine / environment | `machine:<host>` for a real, relevant target                                                                                                                                     |
| `dark-gray` | Branch scope          | `branch:<name>` using the exact branch, including slashes                                                                                                                        |
| `pink`      | State flag            | `blocked`                                                                                                                                                                        |
| `orange`    | Legacy urgency flag   | Reuse `urgent` only if the workspace already requires it; task **priority** is authoritative                                                                                     |

Dev work can use branch/machine labels; support or personal work usually needs only type, relevant areas and blockers. Neither seed fictional `main`/`dev` branches nor forbid a support ticket from having a real machine scope. Create only relevant labels, not the entire example vocabulary by default.

### Idempotent label setup

1. Call `list_workspace_labels`; it returns definitions (`taskId: null`) by default. Pass `includeCopies: true` only if you also need task-scoped copies; the identity is workspace + exact name for a definition, task + exact name for a copy.
2. If the definition exists, reuse its ID. `create_label` silently returns an existing same-scope label and ignores the proposed color; inspect the result.
3. For a missing definition, use `create_label` with `workspaceId`, `name`, `color`, and **no `taskId`**. Attach separately with the definition's ID when needed.
4. Re-list definitions and compare names/colors to the requested set. Report conflicts instead of trying delete/recreate. `update_label` renames or recolors a definition (it fetches, merges then PUTs); a name collision with another workspace label is rejected, and renaming cascades to task copies.

Examples are MCP call envelopes, not commands to execute automatically. Replace every `<...>` placeholder with a verified value; tests check their argument schemas, not the existence of those IDs.

```json
{
  "tool": "create_label",
  "arguments": {
    "workspaceId": "<workspace-id>",
    "name": "bug",
    "color": "purple"
  }
}
```

Never detach copies to “save” them before deleting a definition: detaching **deletes** the copy, and deleting a definition cascades to task copies. Neither operation preserves them.

## Projects

1. Use `list_projects` with `includeArchived: true` in the intended workspace before creating. Match by name, description and repository/product context; a matching name alone is not identity. Ask whether to reuse an archived project rather than duplicating it.
2. `create_project` requires `name`, `slug`, `icon`, `workspaceId`; include a useful `description`. Prefer the real repository/product name; `slug` is the display prefix in `<PREFIX>-<number>`, not the opaque `projectId`. A short uppercase code (usually 2–4 letters) is a convention, not an enforced uniqueness guarantee. Avoid collisions within the workspace; never rename a prefix casually.
3. `icon` is a Lucide icon name such as `Layout` or `Bot`. Description: purpose, what belongs here, repo/stack pointer if relevant. Do not invent URLs.
4. Creation seeds `to-do`, `in-progress`, `in-review`, `done` (final). Read `list_project_columns` and reuse them; do not create duplicates. A renamed column keeps its slug. Column colors require hex, unlike label colors which also accept palette names.
5. Confirm metadata and workspace with `get_project`. Set up only missing labels/columns needed by the workflow. Leave public visibility unchanged unless explicitly asked to publish; `isPublic` is not routine metadata.
6. If a project requires custom fields without defaults, MCP `create_task` cannot supply them. Use the web task form; do not remove the requirement or fill unknown fields arbitrarily.

```json
{
  "tool": "create_project",
  "arguments": {
    "workspaceId": "<workspace-id>",
    "name": "service-console",
    "slug": "SVC",
    "icon": "Layout",
    "description": "Delivery work for the service console: API, web interface and regression coverage."
  }
}
```

A partially completed setup should report the verified workspace/project IDs, what was reused/created, and exact remaining UI steps. Do not blindly repeat creates after timeouts.

## Notifications

- **In-app:** `list_notifications` reads notifications newest-first (`limit`/`offset`, default 50, max 200); it does not acknowledge them or update preferences. Users configure their own preferences in settings.
- **Telegram:** first inspect `telegram_list_config`; reuse the existing bot → chat → rule chain. Confirm the recipient, workspace/project scope and event filter **before enabling routing**, because notifications can disclose private task content. See [Telegram routing](mcp-guidelines.md#telegram-routing-model).
- If no bot exists, prefer entering its BotFather token directly in account settings rather than pasting credentials into chat. `telegram_create_bot` accepts a token but validates its shape locally, not Telegram connectivity. Never include it in evidence.
- Link the verified chat using `telegram_create_chat`, then route with `telegram_create_rule`; the convenience tool `telegram_configure_notifications` can do both. Linking alone does not deliver notifications. Read back the rule; a stored rule is not proof a message was delivered. Ask before any external test message.
- Discord, Slack, Mattermost, Gitea, GitHub and generic webhooks use the web UI, not MCP provisioning tools. Existing integrations can react to task writes; do not generate dummy events in production to test them.
