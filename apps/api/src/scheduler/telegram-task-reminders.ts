import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import db from "../database";
import {
  columnTable,
  taskReminderSentTable,
  taskTable,
} from "../database/schema";
import { normalizeTelegramConfig } from "../plugins/telegram/config";
import {
  getTelegramEventData,
  sendTelegramMessage,
} from "../plugins/telegram/events";
import { getUnifiedTelegramTargets } from "../plugins/telegram/unified";
import { REMINDER_WINDOW_MINUTES } from "./reminder-timing";

const MINUTE_MS = 60 * 1000;

// Telegram reminders for tasks with explicit per-task reminder offsets
// (task.reminder_offsets, minutes before the start date). Delivery goes through
// the unified Telegram config (workspace rules); without a matching rule the
// reminder has no channel and is skipped silently, like other Telegram sends.
export async function checkTelegramTaskReminders(): Promise<{
  degraded: boolean;
}> {
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - REMINDER_WINDOW_MINUTES * MINUTE_MS,
  );
  let degraded = false;

  const tasks = await getTasksNeedingTelegramReminder(windowStart, now);

  for (const task of tasks) {
    const offsets = parseOffsets(task.reminderOffsets);
    for (const offset of offsets) {
      const sendAt = task.startDate.getTime() - offset * MINUTE_MS;
      if (sendAt < windowStart.getTime() || sendAt > now.getTime()) {
        continue;
      }

      try {
        await processTelegramReminder(task, offset);
      } catch (error) {
        degraded = true;
        console.error("Failed to process Telegram task reminder", {
          taskId: task.id,
          offset,
          error,
        });
      }
    }
  }

  return { degraded };
}

type CandidateTask = {
  id: string;
  title: string;
  startDate: Date;
  projectId: string;
  reminderOffsets: unknown;
};

async function getTasksNeedingTelegramReminder(
  windowStart: Date,
  windowEnd: Date,
): Promise<CandidateTask[]> {
  const rows = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      startDate: taskTable.startDate,
      projectId: taskTable.projectId,
      reminderOffsets: taskTable.reminderOffsets,
    })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(${taskTable.reminderOffsets}) AS o
          WHERE ${taskTable.startDate} - (o::int * interval '1 minute')
            BETWEEN ${windowStart.toISOString()} AND ${windowEnd.toISOString()}
        )`,
        // The EXISTS above guarantees a start date, but the planner still
        // needs the non-null predicate for the interval arithmetic.
        isNotNull(taskTable.startDate),
        or(isNull(columnTable.isFinal), eq(columnTable.isFinal, false)),
        // Archived tasks keep their start date but should not notify anyone
        ne(taskTable.status, "archived"),
      ),
    );

  // The EXISTS predicate guarantees a start date; narrow for the scheduler loop.
  return rows.filter(
    (row): row is typeof row & { startDate: Date } => row.startDate !== null,
  );
}

function parseOffsets(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (offset): offset is number =>
      typeof offset === "number" && Number.isFinite(offset) && offset > 0,
  );
}

function formatLeadTime(minutes: number): string {
  if (minutes >= 60 * 24 && minutes % (60 * 24) === 0) {
    const days = minutes / (60 * 24);
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

async function processTelegramReminder(
  task: CandidateTask,
  offset: number,
): Promise<void> {
  const targets = await getUnifiedTelegramTargets(task.projectId);

  // Record first for crash-safe dedupe; rolled back when nothing could be
  // delivered so a later tick can retry.
  const [inserted] = await db
    .insert(taskReminderSentTable)
    .values({
      taskId: task.id,
      reminderType: `telegram_unified:${offset}`,
    })
    .onConflictDoNothing({
      target: [
        taskReminderSentTable.taskId,
        taskReminderSentTable.reminderType,
      ],
    })
    .returning();

  if (!inserted) return;

  if (targets.length === 0) {
    await db
      .delete(taskReminderSentTable)
      .where(eq(taskReminderSentTable.id, inserted.id));
    return;
  }

  const data = await getTelegramEventData(task.id, task.projectId, null);
  if (!data) {
    await db
      .delete(taskReminderSentTable)
      .where(eq(taskReminderSentTable.id, inserted.id));
    return;
  }

  const action = `Reminder: starts in ${formatLeadTime(offset)}`;

  // sendTelegramMessage logs and swallows send failures by design, matching
  // every other Telegram delivery in this codebase; the sent row stays so the
  // reminder is not retried for a task the operator was told about.
  await Promise.all(
    targets.map(async ({ bot, chat, rule }) => {
      const config = normalizeTelegramConfig({
        botToken: bot.botToken,
        chatId: chat.chatId,
        threadId: rule.threadId ?? null,
        chatLabel: chat.label ?? null,
        events: null,
      });
      await sendTelegramMessage(config, action, data);
    }),
  );
}
