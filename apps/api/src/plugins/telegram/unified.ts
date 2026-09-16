import { and, eq, inArray, isNull, or } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  telegramBotTable,
  telegramChatTable,
  telegramRuleTable,
} from "../../database/schema";
import type { TelegramEventKey } from "./config";
import { defaultTelegramEvents, normalizeTelegramConfig } from "./config";
import {
  buildTelegramAction,
  getAppointmentTelegramEventData,
  getTelegramEventData,
  sendTelegramMessage,
  type TelegramActionInput,
} from "./events";

// Map the dispatch action to the per-bot event filter key (same vocabulary as
// the legacy per-project integration).
const EVENT_KEY_BY_ACTION: Record<
  TelegramActionInput["kind"],
  TelegramEventKey
> = {
  created: "taskCreated",
  statusChanged: "taskStatusChanged",
  priorityChanged: "taskPriorityChanged",
  titleChanged: "taskTitleChanged",
  descriptionChanged: "taskDescriptionChanged",
  commentCreated: "taskCommentCreated",
  mentioned: "taskMentionCreated",
  appointmentCreated: "appointmentCreated",
  appointmentRescheduled: "appointmentUpdated",
  appointmentReassigned: "appointmentUpdated",
};

// Both entities flow through the same dispatcher; the id field tells which
// table backs the message data.
export type UnifiedTelegramDispatchEvent =
  | { taskId: string; projectId: string; userId: string | null }
  | { appointmentId: string; projectId: string; userId: string | null }
  | {
      taskId: string;
      projectId: string;
      userId: string | null;
      mentionedUserIds: string[];
    };

// Unified rules supersede the per-project telegram integration: when any
// active rule matches, the legacy per-project config is skipped so a project
// configured both ways does not receive duplicate notifications.
export async function dispatchUnifiedTelegram(
  event: UnifiedTelegramDispatchEvent,
  action: TelegramActionInput,
): Promise<boolean> {
  const entityId =
    "appointmentId" in event ? event.appointmentId : event.taskId;
  // Mentions are personal: only rules owned by a mentioned member receive
  // them, never the project-wide channels.
  const mentionedUserIds =
    "mentionedUserIds" in event ? event.mentionedUserIds : undefined;
  const matches = await getMatchingRules(event.projectId, mentionedUserIds);
  if (matches.length === 0) {
    // The dispatch is fire-and-forget on the event bus; without this line a
    // dead rule produces zero evidence (seen live: a hung pool connection
    // silently swallowed a task.created notification).
    console.log("[telegram] unified dispatch: no matching rule", {
      projectId: event.projectId,
      entityId,
      action: action.kind,
    });
    // A mention with no matching personal rule stays silent instead of
    // falling back to the project channel.
    return mentionedUserIds !== undefined;
  }

  const data =
    "appointmentId" in event
      ? await getAppointmentTelegramEventData(
          event.appointmentId,
          event.projectId,
          event.userId,
        )
      : await getTelegramEventData(event.taskId, event.projectId, event.userId);
  if (!data) {
    // Entity is gone (e.g. deleted mid-flight): consider it handled so the
    // legacy path stays silent too.
    console.warn("[telegram] unified dispatch: event data unavailable", {
      projectId: event.projectId,
      entityId,
    });
    return true;
  }

  const actionText = buildTelegramAction(action);
  const eventKey = EVENT_KEY_BY_ACTION[action.kind];

  await Promise.all(
    matches.map(async ({ bot, chat, rule }) => {
      // Per-bot event filter; absent keys fall back to the plugin defaults.
      const events: Record<TelegramEventKey, boolean> = {
        ...defaultTelegramEvents,
        ...(bot.events ?? {}),
      };
      if (!events[eventKey]) {
        console.log("[telegram] unified dispatch: event disabled for bot", {
          botId: bot.id,
          eventKey,
          entityId,
        });
        return;
      }

      const config = normalizeTelegramConfig({
        botToken: bot.botToken,
        chatId: chat.chatId,
        threadId: rule.threadId ?? null,
        chatLabel: chat.label ?? null,
        events: null,
      });
      try {
        await sendTelegramMessage(config, actionText, data);
        console.log("[telegram] unified dispatch: sent", {
          botId: bot.id,
          eventKey,
          entityId,
          threadId: rule.threadId ?? null,
        });
      } catch (error) {
        // sendTelegramMessage already reports its own failures; this log
        // only guarantees the dispatch outcome is visible in one place.
        console.error("[telegram] unified dispatch: send failed", {
          botId: bot.id,
          eventKey,
          entityId,
          error,
        });
      }
    }),
  );

  return true;
}

// Targets for out-of-band sends (e.g. scheduled reminders): active unified
// rules matching the project, with the bot token and chat to post to.
export async function getUnifiedTelegramTargets(projectId: string) {
  return getMatchingRules(projectId);
}

async function getMatchingRules(
  projectId: string,
  mentionedUserIds?: string[],
) {
  return db
    .select({
      rule: telegramRuleTable,
      chat: telegramChatTable,
      bot: telegramBotTable,
    })
    .from(telegramRuleTable)
    .innerJoin(
      telegramChatTable,
      eq(telegramRuleTable.chatId, telegramChatTable.id),
    )
    .innerJoin(
      telegramBotTable,
      eq(telegramChatTable.botId, telegramBotTable.id),
    )
    .innerJoin(projectTable, eq(projectTable.id, projectId))
    .where(
      and(
        eq(telegramRuleTable.isActive, true),
        // Rules are workspace-scoped to the bot's own workspace; a project
        // either has a specific rule or falls back to the workspace-wide rule.
        eq(telegramRuleTable.workspaceId, projectTable.workspaceId),
        or(
          isNull(telegramRuleTable.projectId),
          eq(telegramRuleTable.projectId, projectId),
        ),
        // Mention dispatches only reach rules whose bot belongs to a
        // mentioned member.
        ...(mentionedUserIds && mentionedUserIds.length > 0
          ? [inArray(telegramBotTable.userId, mentionedUserIds)]
          : []),
      ),
    );
}
