import { windowId } from "@kaneo/libs";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getApiUrl } from "@/fetchers/get-api-url";
import type { ResumePreview } from "@/fetchers/integration-sync/types";
import getTask from "@/fetchers/task/get-task";
import { authClient } from "@/lib/auth-client";
import {
  hasSyncTaskSample,
  patchSyncTaskTitles,
} from "@/lib/patch-sync-task-titles";

export function getWsUrl(projectId: string) {
  const base = getApiUrl("ws");
  const wsBase = base.replace(/^http/, "ws");
  return `${wsBase}/${encodeURIComponent(projectId)}?windowId=${encodeURIComponent(windowId)}`;
}

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

/** Appointment events carry an appointmentId instead of a taskId. */
const APPOINTMENT_MESSAGE_TYPES = new Set([
  "APPOINTMENT_CREATED",
  "APPOINTMENT_UPDATED",
  "APPOINTMENT_DELETED",
]);

// Cloudflare closes idle WebSocket connections after 100 seconds of no traffic.
// We send a lightweight ping every 30 seconds to keep the connection alive.
const WS_PING_INTERVAL_MS = 30_000;

export function useProjectWebSocket(projectId: string) {
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!projectId || !session?.user?.id) return;

    retriesRef.current = 0;
    let disposed = false;
    const titleVersions = new Map<string, number>();

    function invalidateIntegrationSync() {
      queryClient.invalidateQueries({
        queryKey: ["integration-sync", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["integration-sync-preview", projectId],
      });
    }

    function clearPing() {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    }

    function connect() {
      const url = getWsUrl(projectId);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0; // Reset retries on successful connection
        // Start keepalive pings to prevent Cloudflare idle timeout (100s)
        clearPing();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // An open comparison needs a fresh token; other tasks and closed
          // dialogs must not cause provider reads during routine edits.
          if (
            message.taskId &&
            [
              "TASK_UPDATED",
              "TASK_LABEL_UPDATED",
              "TASK_MOVED",
              "TASK_DELETED",
            ].includes(message.type)
          )
            for (const query of queryClient.getQueryCache().findAll({
              queryKey: ["integration-sync-review", projectId],
              type: "active",
            })) {
              const review = query.state.data as ResumePreview | undefined;
              if ((review?.task.id ?? query.meta?.taskId) !== message.taskId)
                continue;
              const filters = { queryKey: query.queryKey, exact: true };
              // Invalidation reuses an initial fetch with no data. Reset it so
              // a pre-edit snapshot cannot become the first displayed token.
              if (!review) void queryClient.resetQueries(filters);
              else void queryClient.invalidateQueries(filters);
            }

          if (
            ["PROJECT_UPDATED", "TASK_LABEL_UPDATED"].includes(message.type) ||
            ["TASK_CREATED", "TASK_DELETED", "TASK_MOVED"].includes(
              message.type,
            )
          ) {
            invalidateIntegrationSync();
          }

          if (
            message.taskId &&
            message.taskTitleChanged &&
            hasSyncTaskSample(queryClient, projectId, message.taskId)
          ) {
            const taskId = message.taskId as string;
            const version = (titleVersions.get(taskId) ?? 0) + 1;
            titleVersions.set(taskId, version);
            // Read titles through the task API, which enforces task-read permission.
            void getTask(taskId, "board")
              .then((task) => {
                if (
                  !disposed &&
                  titleVersions.get(taskId) === version &&
                  task.projectId === projectId
                )
                  patchSyncTaskTitles(
                    queryClient,
                    projectId,
                    taskId,
                    task.title,
                  );
              })
              .catch(() => {});
          }

          if (APPOINTMENT_MESSAGE_TYPES.has(message.type)) {
            queryClient.invalidateQueries({
              queryKey: ["appointments", message.projectId],
            });
          } else if (message.type === "PROJECT_UPDATED") {
            queryClient.invalidateQueries({ queryKey: ["projects"] });
            queryClient.invalidateQueries({ queryKey: ["labels"] });
            if (message.linksChanged)
              queryClient.invalidateQueries({ queryKey: ["external-links"] });
          } else if (
            message.type === "TASK_UPDATED" ||
            message.type === "TASK_CREATED" ||
            message.type === "TASK_DELETED" ||
            message.type === "TASK_LABEL_UPDATED" ||
            message.type === "TASK_MOVED" ||
            message.type === "TASK_RELATION_UPDATED" ||
            message.type === "COMMENT_UPDATED"
          ) {
            queryClient.invalidateQueries({
              queryKey: ["tasks", message.projectId],
            });

            // A task edit can change its integration links, which are fetched
            // per task rather than with the board.
            if (
              (message.type === "TASK_UPDATED" ||
                message.type === "TASK_MOVED") &&
              message.taskId
            ) {
              queryClient.invalidateQueries({
                queryKey: ["external-links", message.taskId],
              });
            }

            if (message.type === "TASK_RELATION_UPDATED") {
              if (message.sourceTaskId) {
                queryClient.invalidateQueries({
                  queryKey: ["task", message.sourceTaskId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["task-relations", message.sourceTaskId],
                });
              }
              if (message.targetTaskId) {
                queryClient.invalidateQueries({
                  queryKey: ["task", message.targetTaskId],
                });
                queryClient.invalidateQueries({
                  queryKey: ["task-relations", message.targetTaskId],
                });
              }
              if (!message.sourceTaskId && !message.targetTaskId) {
                queryClient.invalidateQueries({
                  queryKey: ["task-relations"],
                });
              }
            } else {
              queryClient.invalidateQueries({
                queryKey: ["task", message.taskId],
              });
            }

            if (message.type === "TASK_LABEL_UPDATED") {
              queryClient.invalidateQueries({
                queryKey: ["labels", message.taskId],
              });
            }

            if (message.type === "COMMENT_UPDATED") {
              queryClient.invalidateQueries({
                queryKey: ["activities", message.taskId],
              });
              queryClient.invalidateQueries({
                queryKey: ["comments", message.taskId],
              });
            }
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        clearPing();
        wsRef.current = null;

        if (retriesRef.current < MAX_RETRIES) {
          const delay = BASE_DELAY * 2 ** retriesRef.current; // 1s, 2s, 4s, 8s, 16s
          retriesRef.current += 1;
          timeoutRef.current = setTimeout(connect, delay);
        }
      };
    }
    connect();

    return () => {
      disposed = true;
      retriesRef.current = MAX_RETRIES; // Prevent reconnect after unmount
      clearPing();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [projectId, session?.user?.id, queryClient]);
}
