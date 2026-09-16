import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  appointmentReminderSentTable,
  appointmentTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";

type UpdateAppointmentInput = {
  title: string;
  description?: string;
  startDate?: Date;
  dueDate?: Date;
  priority?: string;
  userId?: string;
  reminderOffsets?: number[] | null;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
  } | null;
  currentUserId?: string;
};

async function updateAppointment(id: string, input: UpdateAppointmentInput) {
  const [existing] = await db
    .select({
      id: appointmentTable.id,
      projectId: appointmentTable.projectId,
      userId: appointmentTable.userId,
      title: appointmentTable.title,
      description: appointmentTable.description,
      priority: appointmentTable.priority,
      startDate: appointmentTable.startDate,
      dueDate: appointmentTable.dueDate,
      reminderOffsets: appointmentTable.reminderOffsets,
    })
    .from(appointmentTable)
    .where(eq(appointmentTable.id, id))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, {
      message: "Appointment not found",
    });
  }

  const normalizedUserId = input.userId?.trim() || undefined;
  let assigneeName: string | null = null;

  if (normalizedUserId) {
    await assertAssignableUser(
      normalizedUserId,
      await getProjectWorkspaceId(existing.projectId),
    );

    const [assignee] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, normalizedUserId));
    assigneeName = assignee?.name ?? null;
  }

  const [updated] = await db
    .update(appointmentTable)
    .set({
      title: input.title,
      description: input.description ?? "",
      priority: input.priority ?? "medium",
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      reminderOffsets: input.reminderOffsets ?? null,
      recurrence: input.recurrence ?? null,
      userId: normalizedUserId ?? null,
    })
    .where(eq(appointmentTable.id, id))
    .returning();

  if (!updated) {
    throw new HTTPException(500, {
      message: "Failed to update appointment",
    });
  }

  // Reminders count down from the start date and `appointment_reminder_sent`
  // dedupes them per (appointment, offset). Moving or clearing a date must
  // therefore reset the history, or a stale row silently swallows the reminder
  // for the new date (same discipline as tasks).
  const offsetsChanged =
    JSON.stringify(existing.reminderOffsets ?? null) !==
    JSON.stringify(updated.reminderOffsets ?? null);
  const datesChanged =
    (updated.startDate?.getTime() ?? null) !==
      (existing.startDate?.getTime() ?? null) ||
    (updated.dueDate?.getTime() ?? null) !==
      (existing.dueDate?.getTime() ?? null);
  if (offsetsChanged || datesChanged) {
    await db
      .delete(appointmentReminderSentTable)
      .where(eq(appointmentReminderSentTable.appointmentId, id));
  }

  await publishEvent("appointment.updated", {
    appointmentId: updated.id,
    projectId: updated.projectId,
    userId: updated.userId ?? "",
    currentUserId: input.currentUserId,
    title: updated.title,
    oldAssigneeId: existing.userId ?? null,
    newAssigneeId: updated.userId ?? null,
    oldStartDate: existing.startDate,
    newStartDate: updated.startDate,
    oldDueDate: existing.dueDate,
    newDueDate: updated.dueDate,
    oldPriority: existing.priority,
    newPriority: updated.priority,
  });

  return { ...updated, assigneeName, assigneeId: updated.userId };
}

export default updateAppointment;
