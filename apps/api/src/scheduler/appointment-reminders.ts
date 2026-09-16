import { and, eq, isNotNull, sql } from "drizzle-orm";
import db from "../database";
import {
  appointmentReminderSentTable,
  appointmentTable,
  projectTable,
  workspaceTable,
} from "../database/schema";
import { normalizeTelegramConfig } from "../plugins/telegram/config";
import { sendTelegramMessage } from "../plugins/telegram/events";
import { getUnifiedTelegramTargets } from "../plugins/telegram/unified";
import {
  formatReminderLeadTime,
  REMINDER_WINDOW_MINUTES,
} from "./reminder-timing";

const MINUTE_MS = 60 * 1000;

type CandidateAppointment = {
  id: string;
  title: string;
  startDate: Date;
  projectId: string;
  reminderOffsets: unknown;
};

// Telegram reminders for appointments with explicit reminder offsets
// (appointment.reminder_offsets, minutes before the start date), mirroring the
// task reminder pass. Delivery goes through the unified Telegram config
// (workspace rules); without a matching rule the reminder is skipped silently.
export async function checkAppointmentReminders(): Promise<{
  degraded: boolean;
}> {
  const now = new Date();
  const windowStart = new Date(
    now.getTime() - REMINDER_WINDOW_MINUTES * MINUTE_MS,
  );
  let degraded = false;

  const appointments = await getAppointmentsNeedingReminder(windowStart, now);

  for (const appointment of appointments) {
    const offsets = parseOffsets(appointment.reminderOffsets);
    for (const offset of offsets) {
      const sendAt = appointment.startDate.getTime() - offset * MINUTE_MS;
      if (sendAt < windowStart.getTime() || sendAt > now.getTime()) {
        continue;
      }

      try {
        await processReminder(appointment, offset);
      } catch (error) {
        degraded = true;
        console.error("Failed to process appointment reminder", {
          appointmentId: appointment.id,
          offset,
          error,
        });
      }
    }
  }

  return { degraded };
}

async function getAppointmentsNeedingReminder(
  windowStart: Date,
  windowEnd: Date,
): Promise<CandidateAppointment[]> {
  const rows = await db
    .select({
      id: appointmentTable.id,
      title: appointmentTable.title,
      startDate: appointmentTable.startDate,
      projectId: appointmentTable.projectId,
      reminderOffsets: appointmentTable.reminderOffsets,
    })
    .from(appointmentTable)
    .where(
      and(
        sql`EXISTS (
          SELECT 1
          FROM json_each(${appointmentTable.reminderOffsets}) AS o
          WHERE ${appointmentTable.startDate} - (CAST(o.value AS INTEGER) * ${MINUTE_MS})
            BETWEEN ${windowStart.getTime()} AND ${windowEnd.getTime()}
        )`,
        // The EXISTS above guarantees a start date, but the interval
        // arithmetic still needs the non-null predicate.
        isNotNull(appointmentTable.startDate),
      ),
    );

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

async function processReminder(
  appointment: CandidateAppointment,
  offset: number,
): Promise<void> {
  const targets = await getUnifiedTelegramTargets(appointment.projectId);

  // Record first for crash-safe dedupe; rolled back when nothing could be
  // delivered so a later tick can retry.
  const [inserted] = await db
    .insert(appointmentReminderSentTable)
    .values({
      appointmentId: appointment.id,
      reminderType: `telegram_unified:${offset}`,
    })
    .onConflictDoNothing({
      target: [
        appointmentReminderSentTable.appointmentId,
        appointmentReminderSentTable.reminderType,
      ],
    })
    .returning();

  if (!inserted) return;

  if (targets.length === 0) {
    await db
      .delete(appointmentReminderSentTable)
      .where(eq(appointmentReminderSentTable.id, inserted.id));
    return;
  }

  const data = await getAppointmentTelegramData(
    appointment.id,
    appointment.projectId,
  );
  if (!data) {
    await db
      .delete(appointmentReminderSentTable)
      .where(eq(appointmentReminderSentTable.id, inserted.id));
    return;
  }

  const action = `Reminder: starts in ${formatReminderLeadTime(offset)}`;

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

async function getAppointmentTelegramData(
  appointmentId: string,
  projectId: string,
) {
  const [row] = await db
    .select({
      title: appointmentTable.title,
      priority: appointmentTable.priority,
      projectName: projectTable.name,
      projectId: projectTable.id,
      workspaceId: workspaceTable.id,
    })
    .from(appointmentTable)
    .innerJoin(projectTable, eq(appointmentTable.projectId, projectTable.id))
    .innerJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
    .where(
      and(
        eq(appointmentTable.id, appointmentId),
        eq(projectTable.id, projectId),
      ),
    )
    .limit(1);

  if (!row) return null;

  const clientUrl = (
    process.env.KANEO_CLIENT_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");
  const projectUrl = `${clientUrl}/dashboard/workspace/${row.workspaceId}/project/${row.projectId}`;

  return {
    taskTitle: row.title,
    taskNumber: null,
    projectName: row.projectName,
    taskUrl: `${projectUrl}/appointments`,
    projectUrl,
    actorName: null,
    status: "appointment",
    priority: row.priority,
    kind: "appointment" as const,
  };
}
