# Task Lifecycle

Use this delivery convention unless the project's explicit workflow differs. The API validates statuses and permissions; it does **not** enforce qualification, ownership coordination or human acceptance. For call shapes, pagination and side effects see [mcp-guidelines.md](mcp-guidelines.md).

## Status model

A task's `status` is a **column slug** from `list_project_columns` or a reserved virtual status:

| Status / column                          | Recommended meaning                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `planned`                                | Backlog: ideas, unqualified requests, unanswered questions; off the board            |
| Ready column (default `to-do`)           | Scoped, acceptance criteria set, actionable                                          |
| Active column (default `in-progress`)    | Owned work actually in progress                                                      |
| Review column (default `in-review`)      | Implementation and local verification complete; awaiting acceptance                  |
| Final column (`isFinal`, default `done`) | Accepted with evidence                                                               |
| `archived`                               | Off-board history; use for rejected, stale or superseded work with a recorded reason |

Map custom workflows explicitly; column position or display name alone does not establish its meaning. A blocked column may exist on a customized board. Renaming a column does not change its slug. Changing `isFinal` affects completion semantics, not just appearance. `planned` and `archived` cannot be board-column slugs.

## Qualification gate

Before promoting backlog work, require:

- outcome-oriented title;
- context, scope/non-goals and observable acceptance criteria;
- correct project and priority based on impact, not a duplicate urgency label;
- type/area labels required by the project, plus exact `branch:<name>` only for branch-scoped work;
- known dependencies and blockers, using `blocks` or `subtask` relations when there are existing tasks.

Unclear work stays in `planned`, with what is known and the exact open question. Do not invent a reproduction, assignee, deadline or acceptance criterion as an established fact. A provisional proposed criterion can be recorded as needing confirmation. Filing a backlog item means queued, not delivered.

## File or qualify work

1. Search the relevant workspace/project for the same outcome, including all statuses. `search` has no status parameter; omit status filters in paginated `list_tasks` when checking the full project. Include archived projects if the scope may live there. See [complete lookup](mcp-guidelines.md#search-and-pagination).
2. Read plausible matches and their comments/relations. Update the canonical task when it is genuinely the same issue; do not reopen a rejected or completed task automatically. A new occurrence with distinct scope/evidence may warrant a linked follow-up rather than rewriting an accepted history.
3. For new work, pass `projectId`, `title`, `description`, `priority`, **and an explicit `status`** to `create_task`. Use `planned` unless qualified. The response is authoritative: keep the final `priority` and `labels` it reports. Labels it did not apply (especially `branch:<name>`) are separate calls, not a `labels` argument on task creation.
4. Attach the required labels and dependencies, then read back the task and attachments with the appropriate tools. If setup stops halfway, keep scope truthful and report the missing parts before promoting it.

Example envelope; replace placeholders with verified IDs, and do not execute merely because this example is loaded:

```json
{
  "tool": "create_task",
  "arguments": {
    "projectId": "<project-id>",
    "title": "Clarify the export failure",
    "description": "Reported behavior: export did not finish. Still needed: reproduction steps, expected output and observable acceptance criteria.",
    "priority": "no-priority",
    "status": "planned"
  }
}
```

## Claim, transition and finish

- **Backlog → ready:** the gate passes. Fill missing scope and attach required labels/dependencies before promotion, not afterwards.
- **Ready → active:** substantive work starts now. Read the assignee, recent activity and dependencies; resolve the intended owner using member `id` → tool `userId`. Coordinate before taking over another person's task. Prefer one active implementation task per agent.
- **Claiming is not locking.** Assigning and changing status are separate writes, with no compare-and-swap claim. Serialize them and re-read ownership/status before working. A failed assignment must not be reported as a successful claim.
- **Active → review:** acceptance criteria are implemented and relevant checks passed. Add a concise evidence comment before changing status; record checks not run and remaining limitations. Failed required checks mean not ready for review under this convention.
- **Review → done:** required review/acceptance actually happened and evidence covers the criteria. Local tests alone do not imply user acceptance. Completing a recurring task may create its next occurrence; do not mark it done as a probe or repeatedly toggle final status.
- **Review fails:** record the failure; return to active only if a fix starts now, otherwise ready or backlog according to actionability.
- **Blocked:** use the project's agreed blocked state/label, or keep the truthful column and comment blocker, remaining work, next action and owner. Remove a `blocked` label only once resolved. Do not force every blocked task into backlog; use `planned` when the scope is no longer actionable or qualified.
- **Rejected/stale/superseded:** archive only when within the requested scope, and explain why. Archiving preserves history; it is not equivalent to delivered Done.
- **Regressions:** reuse the canonical task for the same unresolved outcome; for a distinct regression, link a scoped follow-up. Respect explicit project rules about reopening versus follow-ups.

Evidence comment envelope:

```json
{
  "tool": "create_task_comment",
  "arguments": {
    "taskId": "<task-id>",
    "content": "Verification: <command/check and environment>. Result: <observed outcome>. Acceptance criteria covered: <criteria>. Not run or blocked: <limitations>. Next: <reviewer/action>."
  }
}
```

## Wrong project or wrong collection

- `move_task` works only between projects **in the same workspace**. Resolve both projects and destination columns first. Use this tool, not `update_task.projectId`, for relocation.
- `destinationStatus` must be a destination **column** slug: `planned`/`archived` are not accepted by this move endpoint. If omitted, it preserves a matching column slug or falls back to the first column. A backlog/archived task therefore lands on the board. To retain a virtual status, plan a second `update_task_status` after the move and verify both calls; it is not atomic and may emit notifications. Report a partial move immediately if the second step fails.
- Moving keeps the opaque task ID but allocates a destination number and changes the display prefix. Refresh references, project context and branch scope; don't duplicate the task to preserve its old short ID.
- A dated task is still a task. Appointments are a separate collection without the task workflow/history features. Do not convert a task just to make it appear in a calendar.
- **Conversion is destructive:** `move_task_to_appointments` accepts only `planned` tasks, creates a new appointment ID and deletes the task row. It copies core fields, not task comments/activity, labels, relations, time entries, assets, custom fields, reminders or recurrence; task-linked rows can cascade away. Require explicit confirmation of this loss. Adding a “backup” comment to the task does not preserve it. Prefer keeping the task and setting dates when history must survive.

## Evidence and read-back

- Descriptions = stable scope; comments = findings, decisions, blockers and verification, one per meaningful milestone, not per tool call. Do not fabricate evidence or silently rewrite another person's comments.
- Read back task fields with `get_task`; labels with `list_task_labels`; comments with `list_task_comments`; dependencies with `get_task_relations`. See the full verification table in [MCP guidelines](mcp-guidelines.md#read-back-and-recovery).
- Follow-ups discovered during authorized delivery are filed when project rules require it and reported before implementation. An audit of this skill alone must not create live tracking data.
- End with truthful states: unfinished work is not Done; locally verified work awaiting acceptance is not accepted. Never delete tasks, comments or history without explicit authorization.
