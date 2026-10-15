import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { appointmentTable, userTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assertAssignableUser } from "../../utils/assert-assignable-user";

type CreateAppointmentInput = {
  projectId: string;
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

async function createAppointment({
  projectId,
  title,
  description,
  startDate,
  dueDate,
  priority,
  userId,
  reminderOffsets,
  recurrence,
  currentUserId,
}: CreateAppointmentInput) {
  const normalizedUserId = userId?.trim() || undefined;
  let assigneeName: string | null = null;

  if (normalizedUserId) {
    await assertAssignableUser(normalizedUserId, projectId);

    const [assignee] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, normalizedUserId));
    assigneeName = assignee?.name ?? null;
  }

  const appointment = await db.transaction(async (tx) => {
    const [counters] = await tx
      .select({
        nextNumber: sql<number>`coalesce(max(${appointmentTable.number}), 0) + 1`,
        nextPosition: sql<number>`coalesce(max(${appointmentTable.position}), 0) + 1`,
      })
      .from(appointmentTable)
      .where(eq(appointmentTable.projectId, projectId));

    const [created] = await tx
      .insert(appointmentTable)
      .values({
        projectId,
        userId: normalizedUserId ?? null,
        title: title || "",
        description: description || "",
        priority: priority || "medium",
        startDate: startDate ?? null,
        dueDate: dueDate ?? null,
        reminderOffsets: reminderOffsets ?? null,
        recurrence: recurrence ?? null,
        number: counters?.nextNumber ?? 1,
        position: counters?.nextPosition ?? 1,
      })
      .returning();

    return created;
  });

  if (!appointment) {
    throw new HTTPException(500, {
      message: "Failed to create appointment",
    });
  }

  await publishEvent("appointment.created", {
    appointmentId: appointment.id,
    projectId: appointment.projectId,
    userId: appointment.userId ?? "",
    currentUserId,
    title: appointment.title,
    description: appointment.description,
    priority: appointment.priority,
    startDate: appointment.startDate,
    dueDate: appointment.dueDate,
    number: appointment.number,
    type: "created",
  });

  return { ...appointment, assigneeName, assigneeId: appointment.userId };
}

export default createAppointment;
