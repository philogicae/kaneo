import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../../database/schema";
import type {
  PluginContext,
  TaskCommentCreatedEvent,
  TaskCreatedEvent,
  TaskDescriptionChangedEvent,
  TaskPriorityChangedEvent,
  TaskStatusChangedEvent,
  TaskTitleChangedEvent,
} from "../types";
import { postToTelegram } from "./client";
import type {
  NormalizedTelegramConfig,
  TelegramConfig,
  TelegramEventKey,
} from "./config";
import { normalizeTelegramConfig, validateTelegramConfig } from "./config";

type TelegramEventData = {
  taskTitle: string;
  taskNumber: number | null;
  projectName: string;
  taskUrl: string | null;
  projectUrl: string | null;
  actorName: string | null;
  status: string | null;
  priority: string | null;
};

function isEnabled(config: TelegramConfig, key: TelegramEventKey): boolean {
  return config.events?.[key] ?? false;
}

function toSentenceCase(value: string | null): string {
  if (!value) return "Unknown";
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function redactBotToken(botToken: string): string {
  const [prefix, suffix = ""] = botToken.split(":", 2);
  if (!suffix) {
    return "redacted";
  }

  return `${prefix}:${
    suffix.length > 8 ? `${suffix.slice(0, 4)}…${suffix.slice(-4)}` : "••••"
  }`;
}

function getSafeTelegramTargetIdentifier(config: TelegramConfig): string {
  const hash = createHash("sha256")
    .update(`${config.chatId}:${config.threadId ?? "none"}`)
    .digest("hex")
    .slice(0, 12);

  return `tg:${hash}`;
}

function getTaskUrl(
  clientUrl: string | undefined,
  workspaceId: string,
  projectId: string,
  taskId: string,
): string | null {
  const normalizedClientUrl = clientUrl?.trim();
  if (!normalizedClientUrl) {
    return null;
  }

  try {
    return new URL(
      `/dashboard/workspace/${workspaceId}/project/${projectId}/task/${taskId}`,
      normalizedClientUrl,
    ).toString();
  } catch {
    return null;
  }
}

function getProjectUrl(
  clientUrl: string | undefined,
  workspaceId: string,
  projectId: string,
): string | null {
  const normalizedClientUrl = clientUrl?.trim();
  if (!normalizedClientUrl) {
    return null;
  }

  try {
    return new URL(
      `/dashboard/workspace/${workspaceId}/project/${projectId}`,
      normalizedClientUrl,
    ).toString();
  } catch {
    return null;
  }
}

async function getTelegramEventData(
  taskId: string,
  projectId: string,
  userId: string | null,
): Promise<TelegramEventData | null> {
  const taskPromise = db
    .select({
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      projectName: projectTable.name,
      projectId: projectTable.id,
      workspaceId: workspaceTable.id,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(and(eq(taskTable.id, taskId), eq(projectTable.id, projectId)))
    .limit(1);

  const userPromise = userId
    ? db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1)
    : Promise.resolve([]);

  const [[taskRow], [user]] = await Promise.all([taskPromise, userPromise]);

  if (!taskRow) {
    return null;
  }

  return {
    taskTitle: taskRow.title,
    taskNumber: taskRow.number,
    projectName: taskRow.projectName,
    taskUrl: getTaskUrl(
      process.env.KANEO_CLIENT_URL,
      taskRow.workspaceId,
      taskRow.projectId,
      taskId,
    ),
    projectUrl: getProjectUrl(
      process.env.KANEO_CLIENT_URL,
      taskRow.workspaceId,
      taskRow.projectId,
    ),
    actorName: user?.name ?? null,
    status: taskRow.status,
    priority: taskRow.priority,
  };
}

// Status values are column slugs; custom columns fall back to a generic icon.
const STATUS_ICONS: Record<string, string> = {
  "to-do": "📋",
  "in-progress": "🔄",
  "in-review": "👀",
  done: "✅",
  archived: "🗄️",
  planned: "📥",
};

const STATUS_ICON_FALLBACK = "📌";

const PRIORITY_ICONS: Record<string, string> = {
  urgent: "🔥",
  high: "🔴",
  medium: "🟠",
  low: "🟢",
};

const PRIORITY_ICON_FALLBACK = "⚪";

function getStatusIcon(status: string | null): string {
  if (!status) return STATUS_ICON_FALLBACK;
  return STATUS_ICONS[status] ?? STATUS_ICON_FALLBACK;
}

function getPriorityIcon(priority: string | null): string {
  if (!priority) return PRIORITY_ICON_FALLBACK;
  return PRIORITY_ICONS[priority] ?? PRIORITY_ICON_FALLBACK;
}

// Compact notification format (validated with the user):
//   📁 <project link>
//   🔷 <task code + title link> <status icon> <priority icon>
//   👤 <actor>
//   ⚡ <action>
async function sendTelegramMessage(
  config: NormalizedTelegramConfig,
  action: string,
  data: TelegramEventData,
): Promise<void> {
  const issueKey =
    data.taskNumber !== null ? `#${data.taskNumber}` : "Task update";
  const taskLabel = `${issueKey} ${data.taskTitle}`;
  const escapedTaskLabel = escapeHtml(taskLabel);
  const taskLine = data.taskUrl
    ? `<a href="${escapeHtml(data.taskUrl)}">${escapedTaskLabel}</a>`
    : escapedTaskLabel;
  const escapedProjectName = escapeHtml(data.projectName);
  const projectLine = data.projectUrl
    ? `<a href="${escapeHtml(data.projectUrl)}">${escapedProjectName}</a>`
    : escapedProjectName;

  const lines = [
    `📁 ${projectLine}`,
    `🔷 ${taskLine} ${getStatusIcon(data.status)} ${getPriorityIcon(data.priority)}`,
    `👤 ${escapeHtml(data.actorName ?? "Kaneo")}`,
    `⚡ ${escapeHtml(action)}`,
  ];

  try {
    await postToTelegram(config.botToken, {
      chat_id: config.chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      message_thread_id: config.threadId,
    });
  } catch (error) {
    console.error("sendTelegramMessage postToTelegram failed", {
      error,
      botToken: redactBotToken(config.botToken),
      telegramTarget: getSafeTelegramTargetIdentifier(config),
      taskUrl: data.taskUrl,
    });
  }
}

type TelegramMessageContent = {
  action: string;
};

// Discriminated action descriptions shared by the per-project handlers and the
// unified (workspace rules) dispatch path.
export type TelegramActionInput =
  | { kind: "created" }
  | { kind: "statusChanged"; oldStatus: string | null; newStatus: string }
  | { kind: "priorityChanged"; oldPriority: string | null; newPriority: string }
  | { kind: "titleChanged"; oldTitle: string; newTitle: string }
  | { kind: "descriptionChanged"; newDescription: string | null }
  | { kind: "commentCreated"; comment: string };

export function buildTelegramAction(input: TelegramActionInput): string {
  switch (input.kind) {
    case "created":
      return "Task created";
    case "statusChanged":
      return input.oldStatus
        ? `${toSentenceCase(input.oldStatus)} → ${toSentenceCase(input.newStatus)}`
        : `Status → ${toSentenceCase(input.newStatus)}`;
    case "priorityChanged":
      return input.oldPriority
        ? `${toSentenceCase(input.oldPriority)} → ${toSentenceCase(input.newPriority)}`
        : `Priority → ${toSentenceCase(input.newPriority)}`;
    case "titleChanged":
      return `Title: "${truncate(input.oldTitle, 60)}" → "${truncate(input.newTitle, 60)}"`;
    case "descriptionChanged":
      return input.newDescription
        ? `Description: ${truncate(input.newDescription.replace(/\s+/g, " "), 100)}`
        : "Description updated";
    case "commentCreated": {
      // create-comment publishes "**{name}** commented:\n> {content}"; the actor
      // is already rendered on its own line, so keep only the comment content.
      const content = input.comment.replace(
        /^\*\*[^*]+\*\* commented:\n>\s?/,
        "",
      );
      return `Comment: ${truncate(content.replace(/\s+/g, " "), 100)}`;
    }
  }
}

async function runTelegramHandler(
  context: PluginContext,
  event: {
    taskId: string;
    projectId: string;
    userId: string | null;
  },
  featureKey: TelegramEventKey,
  buildMessage: () => TelegramMessageContent,
): Promise<void> {
  const validation = validateTelegramConfig(context.config);
  if (!validation.valid) {
    console.error("Invalid Telegram plugin config; skipping event dispatch", {
      errors: validation.errors,
      config: context.config,
      featureKey,
      projectId: event.projectId,
      taskId: event.taskId,
    });
    return;
  }

  const config = normalizeTelegramConfig(context.config as TelegramConfig);
  if (!isEnabled(config, featureKey)) return;

  const data = await getTelegramEventData(
    event.taskId,
    event.projectId,
    event.userId,
  );
  if (!data) return;

  const { action } = buildMessage();
  await sendTelegramMessage(config, action, data);
}

export { getTelegramEventData, sendTelegramMessage };

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskCreated", () => ({
    action: buildTelegramAction({ kind: "created" }),
  }));
}

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskStatusChanged", () => ({
    action: buildTelegramAction({
      kind: "statusChanged",
      oldStatus: event.oldStatus ?? null,
      newStatus: event.newStatus,
    }),
  }));
}

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskPriorityChanged", () => ({
    action: buildTelegramAction({
      kind: "priorityChanged",
      oldPriority: event.oldPriority ?? null,
      newPriority: event.newPriority,
    }),
  }));
}

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskTitleChanged", () => ({
    action: buildTelegramAction({
      kind: "titleChanged",
      oldTitle: event.oldTitle,
      newTitle: event.newTitle,
    }),
  }));
}

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskDescriptionChanged", () => ({
    action: buildTelegramAction({
      kind: "descriptionChanged",
      newDescription: event.newDescription,
    }),
  }));
}

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await runTelegramHandler(context, event, "taskCommentCreated", () => ({
    action: buildTelegramAction({
      kind: "commentCreated",
      comment: event.comment,
    }),
  }));
}
