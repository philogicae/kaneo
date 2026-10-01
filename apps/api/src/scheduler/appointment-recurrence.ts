import { and, eq, isNotNull, sql } from "drizzle-orm";
import db from "../database";
import { appointmentTable } from "../database/schema";
import { publishEvent } from "../events";
import { type RecurrenceRule, shiftRecurrenceDate } from "../task/recurrence";

type DueAppointment = typeof appointmentTable.$inferSelect;

// Upper bound for skipping missed periods; a chain decades behind still
// converges (interval >= 1 day, so 10k periods is far beyond any real data).
const MAX_SKIPPED_OCCURRENCES = 10_000;

// Recurring appointments spawn their next occurrence once the current one has
// ended (its due date, or its start date when there is no due date). The rule
// moves to the new occurrence, so the chain advances exactly once per period;
// the claim below keeps concurrent scheduler instances from double-spawning.
export async function checkAppointmentRecurrence(): Promise<{
  degraded: boolean;
}> {
  const now = new Date();
  let degraded = false;

  const due = await db
    .select()
    .from(appointmentTable)
    .where(
      and(
        isNotNull(appointmentTable.recurrence),
        sql`COALESCE(${appointmentTable.dueDate}, ${appointmentTable.startDate}) IS NOT NULL`,
        sql`COALESCE(${appointmentTable.dueDate}, ${appointmentTable.startDate}) <= ${now.getTime()}`,
      ),
    );

  for (const appointment of due) {
    try {
      await spawnNextOccurrence(appointment);
    } catch (error) {
      degraded = true;
      console.error("Failed to spawn recurring appointment", {
        appointmentId: appointment.id,
        error,
      });
    }
  }

  return { degraded };
}

async function spawnNextOccurrence(appointment: DueAppointment): Promise<void> {
  const rule = appointment.recurrence as RecurrenceRule | null;
  if (!rule) return;

  // Missed occurrences (the instance was down, or the chain fell behind) are
  // skipped so the series stays aligned with its frequency instead of
  // back-filling historical appointments one tick at a time.
  const now = new Date();
  let nextStart = shiftRecurrenceDate(appointment.startDate, rule);
  let nextDue = shiftRecurrenceDate(appointment.dueDate, rule);
  let skipped = 0;
  while (
    skipped < MAX_SKIPPED_OCCURRENCES &&
    (nextDue ?? nextStart) !== null &&
    ((nextDue ?? nextStart) as Date).getTime() <= now.getTime()
  ) {
    nextStart = shiftRecurrenceDate(nextStart, rule);
    nextDue = shiftRecurrenceDate(nextDue, rule);
    skipped += 1;
  }

  const created = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(appointmentTable)
      .set({ recurrence: null })
      .where(
        and(
          eq(appointmentTable.id, appointment.id),
          isNotNull(appointmentTable.recurrence),
        ),
      )
      .returning({ id: appointmentTable.id });

    if (!claimed) return null;

    const [counters] = await tx
      .select({
        nextNumber: sql<number>`coalesce(max(${appointmentTable.number}), 0) + 1`,
        nextPosition: sql<number>`coalesce(max(${appointmentTable.position}), 0) + 1`,
      })
      .from(appointmentTable)
      .where(eq(appointmentTable.projectId, appointment.projectId));

    const [row] = await tx
      .insert(appointmentTable)
      .values({
        projectId: appointment.projectId,
        userId: appointment.userId,
        title: appointment.title,
        description: appointment.description,
        priority: appointment.priority,
        startDate: nextStart,
        dueDate: nextDue,
        reminderOffsets: appointment.reminderOffsets,
        recurrence: rule,
        number: counters?.nextNumber ?? 1,
        position: counters?.nextPosition ?? 1,
      })
      .returning();

    return row ?? null;
  });

  if (!created) return;

  // The new occurrence appears in every calendar view and the source loses its
  // rule (an update every connected client should pick up).
  await publishEvent("appointment.created", {
    appointmentId: created.id,
    projectId: created.projectId,
    userId: created.userId ?? "",
    title: created.title,
    description: created.description,
    priority: created.priority,
    startDate: created.startDate,
    dueDate: created.dueDate,
    number: created.number,
    spawnedFromRecurrenceId: appointment.id,
    type: "created",
  });
  await publishEvent("appointment.updated", {
    appointmentId: appointment.id,
    projectId: appointment.projectId,
    userId: appointment.userId ?? "",
    title: appointment.title,
    type: "recurrence_advanced",
  });
}
