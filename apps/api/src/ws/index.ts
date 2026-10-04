import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import db from "../database";
import {
  projectTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { subscribeToEvent } from "../events";
import {
  hasInstanceAdminRole,
  instanceAdminRoleSql,
} from "../utils/instance-admin-role";
import type {
  BroadcastAdapter,
  BroadcastMessage,
  ProjectBroadcastMessage,
  UserBroadcast,
  UserBroadcastMessage,
} from "./broadcast-adapter";
import {
  getRelationSourceProject,
  getSubtaskParentProjects,
} from "../task/get-subtask-parent-projects";
import { InMemoryBroadcastAdapter } from "./in-memory-broadcast-adapter";

const INSTANCE_ID = randomUUID();

/** In-flight workspace lookups, so one broadcast pass costs one query. */
const workspaceLookups = new Map<string, Promise<string | null>>();
/** In-flight membership lookups, keyed per broadcast batch. */
const authorizationLookups = new Map<
  string,
  Promise<{ workspaceId: string | null; members: Set<string> } | null>
>();

type ProjectConnection = {
  ws: WSContext;
  userId: string;
  initiatorId: string;
  // The workspace the project belonged to when the connection opened, so a
  // later revocation of that workspace can close this connection.
  workspaceId: string;
};

type UserConnection = {
  ws: WSContext;
};

/**
 * User-scoped connections: tracks WebSocket connections keyed by userId.
 * Used for delivering user-targeted events like NOTIFICATION_CREATED.
 */
const userConnections = new Map<string, Set<UserConnection>>();

export function addUserConnection(userId: string, ws: WSContext) {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  const conn: UserConnection = { ws };
  userConnections.get(userId)?.add(conn);
  return conn;
}

export function removeUserConnection(userId: string, conn: UserConnection) {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(conn);
    if (connections.size === 0) {
      userConnections.delete(userId);
    }
  }
}

export function broadcastToUser(userId: string, message: UserBroadcastMessage) {
  deliverToLocalUserConnections(userId, message);

  if (!adapter) {
    return;
  }

  void adapter
    .publishToUser({ userId, message, origin: INSTANCE_ID })
    .catch((err) => {
      console.error("Failed to publish a user broadcast:", err);
    });
}

function deliverToLocalUserConnections(
  userId: string,
  message: UserBroadcastMessage,
) {
  const connections = userConnections.get(userId);
  if (!connections) return;

  const payload = JSON.stringify(message);
  // A deleted account keeps nothing: tell the client, then hang up rather than
  // leave a socket it can never authenticate again.
  const allAccessRevoked = message.type === "USER_ACCESS_REVOKED";
  for (const conn of connections) {
    try {
      conn.ws.send(payload);
    } catch {
      connections.delete(conn);
    }
    if (allAccessRevoked) {
      connections.delete(conn);
      try {
        conn.ws.close(1008, "User access revoked");
      } catch {
        // Already closed.
      }
    }
  }
  if (connections.size === 0) {
    userConnections.delete(userId);
  }
}

/**
 * Close project connections a user can no longer reach through a workspace.
 *
 * A membership removal must not leave an open socket feeding a client data
 * from a workspace it can no longer open.
 */
export function revokeLocalWorkspaceConnections(
  userId: string,
  workspaceId: string,
) {
  for (const [projectId, connections] of projectConnections) {
    for (const conn of [...connections]) {
      if (conn.userId !== userId || conn.workspaceId !== workspaceId) continue;
      removeConnection(projectId, conn);
      try {
        conn.ws.close(1008, "Workspace access revoked");
      } catch {
        // Already closed.
      }
    }
  }
}

/**
 * Tell a client that one of its workspaces is no longer reachable, so it can
 * drop cached data for it.
 *
 * An instance admin keeps its connections: the role is global, so losing a
 * workspace membership does not remove their access. `force` is for account
 * deletion, where every session goes regardless of role.
 */
export async function revokeWorkspaceConnections(
  userId: string,
  workspaceId: string,
  options: { force?: boolean; role?: string | null } = {},
) {
  if (!options.force) {
    try {
      const [user] =
        "role" in options
          ? [{ role: options.role }]
          : await db
              .select({ userId: userTable.id, role: userTable.role })
              .from(userTable)
              .where(eq(userTable.id, userId));
      if (hasInstanceAdminRole(user?.role)) return;
    } catch (error) {
      console.error("Failed to read role after membership removal:", error);
    }
  }
  revokeLocalWorkspaceConnections(userId, workspaceId);
  broadcastToUser(userId, {
    type: "WORKSPACE_ACCESS_REVOKED",
    workspaceId,
  });
}

/**
 * Close every connection a deleted account still holds.
 *
 * The account row is gone, so no membership lookup can tell a client what it may
 * still open: close all of it and say so once.
 */
export function revokeUserConnections(userId: string) {
  for (const [projectId, connections] of projectConnections) {
    for (const conn of [...connections]) {
      if (conn.userId !== userId) continue;
      removeConnection(projectId, conn);
      try {
        conn.ws.close(1008, "User access revoked");
      } catch {
        // Already closed.
      }
    }
  }
  broadcastToUser(userId, { type: "USER_ACCESS_REVOKED" });
}

/**
 * Local connections: each instance tracks only its own WebSocket connections.
 */
const projectConnections = new Map<string, Set<ProjectConnection>>();

/**
 * Batching queues and timers local per-instance.
 * They accumulate messages before flushing to the broadcast adapter.
 */
const projectBroadcastQueues = new Map<
  string,
  Map<string, { message: ProjectBroadcastMessage; excludeInitiatorId?: string }>
>();
const projectBroadcastTimeouts = new Map<
  string,
  ReturnType<typeof setTimeout>
>();

let adapter: BroadcastAdapter | null = null;

// --- Subscribe to incoming broadcasts and deliver to local connections ---
export async function initializeWebSocketAdapter() {
  if (adapter) return;

  const nextAdapter = new InMemoryBroadcastAdapter();

  try {
    await nextAdapter.subscribe((msg: BroadcastMessage) => {
      deliverToLocalConnections(
        msg.projectId,
        msg.message,
        msg.excludeInitiatorId,
        msg.authorizationBatch,
      );
    });
    await nextAdapter.subscribeToUser((msg: UserBroadcast) => {
      if (msg.origin === INSTANCE_ID) {
        return;
      }
      deliverToLocalUserConnections(msg.userId, msg.message);
    });
  } catch (err) {
    await nextAdapter.shutdown().catch(() => {});
    throw err;
  }

  adapter = nextAdapter;
  console.log(`📡 WebSockets Initialized using: "${adapter.constructor.name}"`);
}

export async function shutdownWebSocketAdapter() {
  const pendingQueues = [...projectBroadcastQueues.entries()];

  for (const timeout of projectBroadcastTimeouts.values()) {
    clearTimeout(timeout);
  }
  projectBroadcastTimeouts.clear();
  projectBroadcastQueues.clear();

  const currentAdapter = adapter;
  if (currentAdapter) {
    await Promise.allSettled(
      pendingQueues.flatMap(([projectId, queue]) =>
        [...queue.values()].map(({ message, excludeInitiatorId }) =>
          currentAdapter.publish({ projectId, message, excludeInitiatorId }),
        ),
      ),
    );
  }

  await currentAdapter?.shutdown();
  adapter = null;
}

/**
 * A project's current workspace, coalesced across concurrent deliveries.
 */
function currentProjectWorkspace(projectId: string) {
  let pending = workspaceLookups.get(projectId);
  if (!pending) {
    pending = db
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .limit(1)
      .then(([project]) => project?.workspaceId ?? null)
      .finally(() => workspaceLookups.delete(projectId));
    workspaceLookups.set(projectId, pending);
  }
  return pending;
}

/**
 * Who may still receive a project's broadcasts.
 *
 * Membership can be revoked, or the project moved, while a socket stays open,
 * so every delivery re-checks the workspace and the recipients' membership
 * instead of trusting the connection that was authorized at upgrade time.
 * Lookups are keyed per broadcast so one pass over a queue costs one query.
 */
function currentBroadcastAccess(
  projectId: string,
  recipients: Array<{ userId: string }>,
  authorizationBatch: string,
) {
  const userIds = [...new Set(recipients.map((conn) => conn.userId))].sort();
  const key = JSON.stringify([projectId, authorizationBatch, userIds]);
  let pending = authorizationLookups.get(key);
  if (!pending) {
    pending = (async () => {
      let workspaceId: string | null;
      try {
        workspaceId = await currentProjectWorkspace(projectId);
      } catch (error) {
        console.error("Failed to validate project broadcast access:", error);
        return null;
      }

      let members = new Set<string>();
      if (workspaceId) {
        try {
          const rows = await db
            .select({ userId: workspaceUserTable.userId })
            .from(workspaceUserTable)
            .where(
              and(
                eq(workspaceUserTable.workspaceId, workspaceId),
                inArray(workspaceUserTable.userId, userIds),
              ),
            );
          members = new Set(rows.map((row) => row.userId));

          // An instance admin is not a workspace member but may still open the
          // project, so they stay a valid recipient.
          const nonmembers = userIds.filter((userId) => !members.has(userId));
          if (nonmembers.length > 0) {
            const admins = await db
              .select({ userId: userTable.id, role: userTable.role })
              .from(userTable)
              .where(
                and(
                  inArray(userTable.id, nonmembers),
                  instanceAdminRoleSql(userTable.role),
                ),
              );
            for (const admin of admins) members.add(admin.userId);
          }
        } catch (error) {
          console.error("Failed to validate broadcast membership:", error);
          return null;
        }
      }
      return { workspaceId, members };
    })().finally(() => authorizationLookups.delete(key));
    authorizationLookups.set(key, pending);
  }
  return pending;
}

async function deliverToLocalConnections(
  projectId: string,
  message: ProjectBroadcastMessage,
  excludeInitiatorId?: string,
  authorizationBatch: string = randomUUID(),
) {
  // A move invalidates every open connection for the project, so the notice
  // replaces whatever was queued for it.
  if (message.type === "PROJECT_MOVED") {
    closeLocalProjectConnections(projectId);
    return;
  }

  const connections = projectConnections.get(projectId);
  if (!connections) return;
  const recipients = [...connections];

  const access = await currentBroadcastAccess(
    projectId,
    recipients,
    authorizationBatch,
  );
  if (!access) return;
  const { workspaceId, members } = access;

  const payload = JSON.stringify(message);
  for (const conn of recipients) {
    // A revocation may have closed this connection while the lookup ran.
    if (!projectConnections.get(projectId)?.has(conn)) continue;
    if (conn.workspaceId !== workspaceId || !members.has(conn.userId)) {
      removeConnection(projectId, conn);
      try {
        conn.ws.close(
          1008,
          conn.workspaceId !== workspaceId
            ? "Project workspace changed"
            : "Workspace access revoked",
        );
      } catch {
        // Already closed.
      }
      continue;
    }
    if (excludeInitiatorId && conn.initiatorId === excludeInitiatorId) continue;
    try {
      conn.ws.send(payload);
    } catch {
      removeConnection(projectId, conn);
    }
  }
  if (projectConnections.get(projectId)?.size === 0) {
    projectConnections.delete(projectId);
  }
}

function closeLocalProjectConnections(projectId: string) {
  // Anything still queued was addressed to the workspace the project just
  // left, so it is dropped rather than delivered.
  const timeout = projectBroadcastTimeouts.get(projectId);
  if (timeout) clearTimeout(timeout);
  projectBroadcastTimeouts.delete(projectId);
  projectBroadcastQueues.delete(projectId);

  const connections = projectConnections.get(projectId);
  projectConnections.delete(projectId);
  for (const conn of connections ?? []) {
    // Tell the client why before closing, so it can drop its cached board
    // instead of treating the close as a network fault.
    try {
      conn.ws.send(JSON.stringify({ type: "PROJECT_MOVED", projectId }));
    } catch {
      // The socket may already be closed.
    }
    try {
      conn.ws.close(1008, "Project workspace changed");
    } catch {
      // Already closed.
    }
  }
}

export function addConnection(
  projectId: string,
  ws: WSContext,
  userId: string,
  initiatorId: string,
  workspaceId: string,
) {
  if (!projectConnections.has(projectId)) {
    projectConnections.set(projectId, new Set());
  }
  const conn: ProjectConnection = { ws, userId, initiatorId, workspaceId };
  projectConnections.get(projectId)?.add(conn);
  return conn;
}

export function removeConnection(projectId: string, conn: ProjectConnection) {
  const connections = projectConnections.get(projectId);
  if (connections) {
    connections.delete(conn);
    if (connections.size === 0) {
      projectConnections.delete(projectId);
    }
  }
}

/**
 * Drop every connection watching a project and tell the clients why.
 *
 * A project move changes its workspace, so connections opened under the old
 * workspace are no longer authorized; the client reconnects (or gives up) after
 * receiving PROJECT_MOVED.
 */
export async function closeProjectConnections(projectId: string) {
  closeLocalProjectConnections(projectId);
  try {
    await adapter?.publish({
      projectId,
      message: { type: "PROJECT_MOVED", projectId },
    });
  } catch (error) {
    // Delivery also re-checks the workspace, so a missed cross-instance notice
    // cannot leave stale connections receiving future project updates.
    console.error("Failed to publish project move:", error);
  }
}

export function broadcastToProject(
  projectId: string,
  message: ProjectBroadcastMessage,
  excludeInitiatorId?: string,
) {
  if (!adapter) {
    console.warn("broadcastToProject called before adapter initialization");
    return;
  }

  if (!projectBroadcastQueues.has(projectId)) {
    projectBroadcastQueues.set(projectId, new Map());
  }

  const messageKey = `${message.type}:${message.taskId ?? ""}:${message.sourceTaskId ?? ""}:${message.targetTaskId ?? ""}`;
  const previous = projectBroadcastQueues.get(projectId)?.get(messageKey);
  projectBroadcastQueues.get(projectId)?.set(messageKey, {
    message: {
      ...message,
      ...(previous?.message.linksChanged ? { linksChanged: true } : {}),
      ...(previous?.message.taskTitleChanged ? { taskTitleChanged: true } : {}),
    },
    excludeInitiatorId,
  });

  if (projectBroadcastTimeouts.has(projectId)) {
    return;
  }

  const timeout = setTimeout(() => {
    projectBroadcastTimeouts.delete(projectId);
    const queue = projectBroadcastQueues.get(projectId);
    projectBroadcastQueues.delete(projectId);

    if (!queue || !adapter) return;

    // Only messages flushed together may share an authorization snapshot, so a
    // later burst always re-checks membership.
    const authorizationBatch = randomUUID();

    // Publish each queued message through the adapter
    for (const { message: msg, excludeInitiatorId: exId } of queue.values()) {
      void adapter
        .publish({
          projectId,
          message: msg,
          excludeInitiatorId: exId,
          authorizationBatch,
        })
        .catch((err) => {
          console.error(
            `Failed to publish broadcast for project ${projectId}:`,
            err,
          );
        });
    }
  }, 100);

  projectBroadcastTimeouts.set(projectId, timeout);
}

type TaskEvent = {
  titleChanged?: boolean;
  id: string | undefined;
  projectId: string;
  userId: string;
  initiatorId?: string;
  taskId: string;
  sourceTaskId: string | undefined;
  targetTaskId: string | undefined;
  // A status change already refreshed its parent boards; do not repeat it.
  skipSubtaskParentRefresh?: boolean;
};

const taskUpdateEvents = [
  "task.created",
  "task.updated",
  "task.deleted",
  "task.status_changed",
  "task.priority_changed",
  "task.unassigned",
  "task.assignee_changed",
  "task.due_date_changed",
  "task.title_changed",
  "task.description_changed",
  "task.label_assigned",
  "task.label_unassigned",
  "task.label_created",
  "task.label_deleted",
  "task-relation.created",
  "task-relation.deleted",
  "comment.created",
  "comment.deleted",
  "comment.updated",
];

// Appointments live in their own collection: viewers of the Appointments,
// Calendar and Gantt views get dedicated messages so they can invalidate the
// appointment queries without refetching the board.
const appointmentUpdateEvents = [
  "appointment.created",
  "appointment.updated",
  "appointment.deleted",
];

subscribeToEvent<{
  taskId: string;
  userId: string;
  initiatorId?: string;
  type: string;
  content: string;
  fromProjectId: string;
  fromProjectName: string;
  toProjectId: string;
  toProjectName: string;
  oldStatus: string;
  newStatus: string;
}>("task.moved", async (data) => {
  const { fromProjectId, initiatorId, toProjectId, taskId } = data;

  broadcastToProject(
    toProjectId,
    { type: "TASK_MOVED", projectId: toProjectId, taskId },
    initiatorId,
  );
  broadcastToProject(
    fromProjectId,
    { type: "TASK_MOVED", projectId: fromProjectId, taskId },
    initiatorId,
  );
  refreshParentBoards(await getSubtaskParentProjects([taskId]), toProjectId);
});

// A subtask's counters live on its parents' boards, which may be different
// projects the mutating window is not even displaying. Include the initiating
// window: its local mutation refreshes the child project, while it may be
// displaying a different parent board. Never send child data.
function refreshParentBoards(
  projects: { projectId: string }[],
  currentProjectId = "",
) {
  for (const { projectId } of projects) {
    if (projectId === currentProjectId) continue;
    broadcastToProject(projectId, {
      type: "TASK_RELATION_UPDATED",
      projectId,
      taskId: "",
    });
  }
}

subscribeToEvent<{ projects: { projectId: string }[] }>(
  "subtask-parents.refresh",
  async ({ projects }) => {
    refreshParentBoards(projects);
  },
);

subscribeToEvent<{
  projectId: string;
  userId: string;
  initiatorId?: string;
}>("task-relation.refresh", async (data) => {
  const { projectId, initiatorId } = data;
  if (!projectId) return;

  broadcastToProject(
    projectId,
    {
      type: "TASK_RELATION_UPDATED",
      projectId,
      taskId: "",
      sourceTaskId: undefined,
      targetTaskId: undefined,
    },
    initiatorId,
  );
});

// A project-level change (background, archive state) has no task id, so it is
// broadcast on its own rather than through the task event list.
subscribeToEvent<{
  projectId: string;
  initiatorId?: string;
  linksChanged?: boolean;
}>("project.updated", async (data) => {
  if (!data.projectId) return;
  broadcastToProject(data.projectId, {
    type: "PROJECT_UPDATED",
    projectId: data.projectId,
    ...(data.linksChanged ? { linksChanged: true } : {}),
  });
});

subscribeToEvent<{ notificationId: string; userId: string }>(
  "notification.created",
  async (data) => {
    if (data.userId) {
      broadcastToUser(data.userId, { type: "NOTIFICATION_CREATED" });
    }
  },
);

for (const eventName of taskUpdateEvents) {
  subscribeToEvent<TaskEvent>(eventName, async (data) => {
    const { projectId, initiatorId } = data;
    const taskId = data.taskId;

    if (!projectId || !taskId) return;
    let type: string;
    switch (eventName) {
      case "task.created":
        type = "TASK_CREATED";
        break;
      case "task.deleted":
        type = "TASK_DELETED";
        break;
      case "task-relation.created":
      case "task-relation.deleted":
        type = "TASK_RELATION_UPDATED";
        break;
      case "task.label_assigned":
      case "task.label_unassigned":
      case "task.label_created":
      case "task.label_deleted":
        type = "TASK_LABEL_UPDATED";
        break;
      case "comment.created":
      case "comment.deleted":
      case "comment.updated":
        type = "COMMENT_UPDATED";
        break;
      default:
        type = "TASK_UPDATED";
    }

    broadcastToProject(
      projectId,
      {
        type,
        projectId,
        taskId: taskId,
        sourceTaskId: data.sourceTaskId,
        targetTaskId: data.targetTaskId,
        ...(eventName === "task.title_changed" || data.titleChanged
          ? { taskTitleChanged: true }
          : {}),
      },
      initiatorId,
    );

    if (eventName === "task.status_changed" && !data.skipSubtaskParentRefresh) {
      refreshParentBoards(await getSubtaskParentProjects([taskId]), projectId);
    } else if (eventName === "task-relation.deleted" && data.sourceTaskId) {
      // The relation row is gone by broadcast time, so the parent board has to
      // be found from the source task that still exists.
      refreshParentBoards(
        await getRelationSourceProject(data.sourceTaskId),
        projectId,
      );
    }
  });
}

type AppointmentEvent = {
  appointmentId: string;
  projectId: string;
  initiatorId?: string;
};

for (const eventName of appointmentUpdateEvents) {
  subscribeToEvent<AppointmentEvent>(eventName, async (data) => {
    const { projectId, appointmentId, initiatorId } = data;
    if (!projectId || !appointmentId) return;

    const type =
      eventName === "appointment.created"
        ? "APPOINTMENT_CREATED"
        : eventName === "appointment.deleted"
          ? "APPOINTMENT_DELETED"
          : "APPOINTMENT_UPDATED";

    broadcastToProject(
      projectId,
      { type, projectId, appointmentId },
      initiatorId,
    );
  });
}
