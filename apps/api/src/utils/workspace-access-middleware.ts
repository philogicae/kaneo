import { and, eq, inArray } from "drizzle-orm";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { canAccessProject } from "./access-scope";
import { validateWorkspaceAccess } from "./validate-workspace-access";

type WorkspaceIdSource =
  | { type: "query"; key: string }
  | { type: "body"; key: string }
  | { type: "param"; key: string }
  | {
      type: "lookup";
      resource:
        | "project"
        | "task"
        | "appointment"
        | "milestone"
        | "label"
        | "timeEntry"
        | "activity"
        | "comment"
        | "column"
        | "workflowRule"
        | "customField"
        | "telegramRule";
      idKey: string;
    }
  | { type: "lookupQuery"; resource: "project"; key: string }
  | {
      type: "lookupMany";
      resource: "task";
      idKey: string;
    };

type WorkspaceAccessMiddlewareConfig = {
  sources: WorkspaceIdSource[];
  // When true, a request that carries no workspace id skips the access check
  // instead of failing; the handler must then scope by the user's own
  // memberships. Never enable for handlers that trust the workspace id.
  optional?: boolean;
};

type AccessTarget = {
  workspaceId: string | null;
  // Set when the addressed resource belongs to a single project, so scoped
  // members can be checked against their project grants.
  projectId: string | null;
};

const NO_TARGET: AccessTarget = { workspaceId: null, projectId: null };

async function readJsonObjectBody(
  c: Context,
): Promise<Record<string, unknown>> {
  const raw = (await c.req.json().catch(() => ({}))) || {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

export function workspaceAccessMiddleware(
  config: WorkspaceAccessMiddlewareConfig,
) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");

    if (!userId) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    let workspaceId: string | null = null;
    let projectId: string | null = null;
    let bulkProjectIds: string[] | null = null;

    for (const source of config.sources) {
      if (source.type === "query") {
        workspaceId = c.req.query(source.key) || null;
      } else if (source.type === "body") {
        const body = await readJsonObjectBody(c);
        const bodyValue = body[source.key];
        workspaceId = typeof bodyValue === "string" ? bodyValue : null;
      } else if (source.type === "param") {
        workspaceId = c.req.param(source.key) || null;
      } else if (source.type === "lookup") {
        const body = await readJsonObjectBody(c);
        const bodyId = body[source.idKey];
        const idFromBody = typeof bodyId === "string" ? bodyId : null;
        // Only accept the id from the same place the handler will read it
        // (path param or JSON body). Accepting it from the query string let a
        // caller authorize against one resource (`?taskId=<mine>`) while the
        // handler acted on another (`{"taskId": "<someone else's>"}`).
        const id = c.req.param(source.idKey) || idFromBody;
        if (id) {
          const target = await resolveAccessTarget(source.resource, id);
          workspaceId = target.workspaceId;
          projectId = target.projectId;
        }
      } else if (source.type === "lookupQuery") {
        const id = c.req.query(source.key);
        if (id) {
          const target = await resolveAccessTarget(source.resource, id);
          workspaceId = target.workspaceId;
          projectId = target.projectId;
        }
      } else if (source.type === "lookupMany") {
        const body = await readJsonObjectBody(c);
        const ids = body[source.idKey];
        if (Array.isArray(ids)) {
          const taskIds = ids.filter(
            (id): id is string => typeof id === "string",
          );
          if (taskIds.length > 0) {
            const tasks = await db
              .select({
                workspaceId: schema.projectTable.workspaceId,
                projectId: schema.taskTable.projectId,
              })
              .from(schema.taskTable)
              .innerJoin(
                schema.projectTable,
                eq(schema.taskTable.projectId, schema.projectTable.id),
              )
              .where(inArray(schema.taskTable.id, taskIds));
            const workspaceIds = [
              ...new Set(tasks.map((task) => task.workspaceId)),
            ];
            if (workspaceIds.length === 0) {
              throw new HTTPException(404, { message: "No tasks found" });
            }
            if (workspaceIds.length > 1) {
              throw new HTTPException(400, {
                message: "All tasks must belong to the same workspace",
              });
            }
            workspaceId = workspaceIds[0] ?? null;
            bulkProjectIds = [...new Set(tasks.map((task) => task.projectId))];
          }
        }
      }

      if (workspaceId) {
        break;
      }
    }

    if (!workspaceId) {
      if (config.optional) {
        return next();
      }
      throw new HTTPException(400, {
        message: "Workspace ID could not be determined",
      });
    }

    const apiKey = c.get("apiKey");
    const apiKeyId = apiKey?.id;

    await validateWorkspaceAccess(userId, workspaceId, apiKeyId);

    if (projectId) {
      await assertProjectAccess(userId, projectId);
    }

    if (bulkProjectIds) {
      for (const id of bulkProjectIds) {
        await assertProjectAccess(userId, id);
      }
    }

    c.set("workspaceId", workspaceId);

    return next();
  };
}

async function assertProjectAccess(userId: string, projectId: string) {
  if (!(await canAccessProject(userId, projectId))) {
    throw new HTTPException(403, {
      message: "No access to this project",
    });
  }
}

async function resolveAccessTarget(
  resource:
    | "project"
    | "task"
    | "appointment"
    | "milestone"
    | "label"
    | "timeEntry"
    | "activity"
    | "comment"
    | "column"
    | "workflowRule"
    | "customField"
    | "telegramRule",
  id: string,
): Promise<AccessTarget> {
  try {
    switch (resource) {
      case "project": {
        const [project] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.projectTable.id,
          })
          .from(schema.projectTable)
          .where(eq(schema.projectTable.id, id))
          .limit(1);
        return {
          workspaceId: project?.workspaceId ?? null,
          projectId: project?.projectId ?? null,
        };
      }

      case "task": {
        const [task] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.taskTable.projectId,
          })
          .from(schema.taskTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.taskTable.id, id))
          .limit(1);
        return {
          workspaceId: task?.workspaceId ?? null,
          projectId: task?.projectId ?? null,
        };
      }

      case "appointment": {
        const [appointment] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.appointmentTable.projectId,
          })
          .from(schema.appointmentTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.appointmentTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.appointmentTable.id, id))
          .limit(1);
        return {
          workspaceId: appointment?.workspaceId ?? null,
          projectId: appointment?.projectId ?? null,
        };
      }

      case "milestone": {
        const [milestone] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.milestoneTable.projectId,
          })
          .from(schema.milestoneTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.milestoneTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.milestoneTable.id, id))
          .limit(1);
        return {
          workspaceId: milestone?.workspaceId ?? null,
          projectId: milestone?.projectId ?? null,
        };
      }

      case "label": {
        const [label] = await db
          .select({
            workspaceId: schema.labelTable.workspaceId,
            taskId: schema.labelTable.taskId,
          })
          .from(schema.labelTable)
          .where(eq(schema.labelTable.id, id))
          .limit(1);
        if (!label) return NO_TARGET;
        // Legacy task-scoped copies can carry a null workspaceId; resolve the
        // project (and workspace) through the task they belong to.
        if (label.taskId) {
          const taskTarget = await resolveAccessTarget("task", label.taskId);
          return {
            workspaceId: label.workspaceId ?? taskTarget.workspaceId,
            projectId: taskTarget.projectId,
          };
        }
        return { workspaceId: label.workspaceId ?? null, projectId: null };
      }

      case "timeEntry": {
        const [timeEntry] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.taskTable.projectId,
          })
          .from(schema.timeEntryTable)
          .innerJoin(
            schema.taskTable,
            eq(schema.timeEntryTable.taskId, schema.taskTable.id),
          )
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.timeEntryTable.id, id))
          .limit(1);
        return {
          workspaceId: timeEntry?.workspaceId ?? null,
          projectId: timeEntry?.projectId ?? null,
        };
      }

      case "activity": {
        const [activity] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.taskTable.projectId,
          })
          .from(schema.activityTable)
          .innerJoin(
            schema.taskTable,
            eq(schema.activityTable.taskId, schema.taskTable.id),
          )
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.activityTable.id, id))
          .limit(1);
        return {
          workspaceId: activity?.workspaceId ?? null,
          projectId: activity?.projectId ?? null,
        };
      }

      case "comment": {
        const [comment] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.taskTable.projectId,
          })
          .from(schema.activityTable)
          .innerJoin(
            schema.taskTable,
            eq(schema.activityTable.taskId, schema.taskTable.id),
          )
          .innerJoin(
            schema.projectTable,
            eq(schema.taskTable.projectId, schema.projectTable.id),
          )
          .where(
            and(
              eq(schema.activityTable.id, id),
              eq(schema.activityTable.type, "comment"),
            ),
          )
          .limit(1);
        return {
          workspaceId: comment?.workspaceId ?? null,
          projectId: comment?.projectId ?? null,
        };
      }

      case "column": {
        const [column] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.columnTable.projectId,
          })
          .from(schema.columnTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.columnTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.columnTable.id, id))
          .limit(1);
        return {
          workspaceId: column?.workspaceId ?? null,
          projectId: column?.projectId ?? null,
        };
      }

      case "workflowRule": {
        const [workflowRule] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.workflowRuleTable.projectId,
          })
          .from(schema.workflowRuleTable)
          .innerJoin(
            schema.projectTable,
            eq(schema.workflowRuleTable.projectId, schema.projectTable.id),
          )
          .where(eq(schema.workflowRuleTable.id, id))
          .limit(1);
        return {
          workspaceId: workflowRule?.workspaceId ?? null,
          projectId: workflowRule?.projectId ?? null,
        };
      }

      case "customField": {
        const [field] = await db
          .select({
            workspaceId: schema.projectTable.workspaceId,
            projectId: schema.customFieldDefinitionTable.projectId,
          })
          .from(schema.customFieldDefinitionTable)
          .innerJoin(
            schema.projectTable,
            eq(
              schema.customFieldDefinitionTable.projectId,
              schema.projectTable.id,
            ),
          )
          .where(eq(schema.customFieldDefinitionTable.id, id))
          .limit(1);
        return {
          workspaceId: field?.workspaceId ?? null,
          projectId: field?.projectId ?? null,
        };
      }
      case "telegramRule": {
        // A rule stores its own target workspace, which the bot owner must be
        // allowed to manage.
        const [telegramRule] = await db
          .select({ workspaceId: schema.telegramRuleTable.workspaceId })
          .from(schema.telegramRuleTable)
          .where(eq(schema.telegramRuleTable.id, id))
          .limit(1);
        return {
          workspaceId: telegramRule?.workspaceId ?? null,
          projectId: null,
        };
      }

      default:
        return NO_TARGET;
    }
  } catch (error) {
    console.error(`Error looking up workspaceId for ${resource}:`, error);
    return NO_TARGET;
  }
}

export const workspaceAccess = {
  fromQuery: (key = "workspaceId", options?: { optional?: boolean }) =>
    workspaceAccessMiddleware({
      sources: [{ type: "query", key }],
      optional: options?.optional,
    }),

  fromBody: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "body", key }] }),

  fromParam: (key = "workspaceId") =>
    workspaceAccessMiddleware({ sources: [{ type: "param", key }] }),

  fromAppointment: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "appointment", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromProjectQuery: (key = "projectId") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookupQuery", resource: "project", key }],
    }),

  fromProject: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "project", idKey }],
    }),

  fromTask: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "task", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromTaskId: (idKey = "taskId") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "task", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromTasks: (idKey = "taskIds") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookupMany", resource: "task", idKey }],
    }),

  fromMilestone: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "milestone", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromLabel: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "label", idKey },
        // Task-scoped labels can (in legacy data) carry a null workspaceId;
        // resolving the described task's workspace keeps attach/detach
        // working and authorizes against the task's workspace instead.
        { type: "lookup", resource: "task", idKey: "taskId" },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromTimeEntry: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "timeEntry", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromActivity: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "activity", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromComment: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "comment", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromColumn: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "column", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromWorkflowRule: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "workflowRule", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),

  fromCustomField: (idKey = "id") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "customField", idKey }],
    }),

  fromTelegramRule: (idKey = "telegramRuleId") =>
    workspaceAccessMiddleware({
      sources: [{ type: "lookup", resource: "telegramRule", idKey }],
    }),

  fromProjectId: (idKey = "projectId") =>
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "project", idKey },
        { type: "query", key: "workspaceId" },
      ],
    }),
};
