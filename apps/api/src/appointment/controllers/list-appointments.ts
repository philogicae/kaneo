import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { appointmentTable, userTable } from "../../database/schema";

async function listAppointments(
  projectId: string,
  paging: { limit?: number; offset?: number } = {},
) {
  const query = db
    .select({
      id: appointmentTable.id,
      projectId: appointmentTable.projectId,
      position: appointmentTable.position,
      number: appointmentTable.number,
      userId: appointmentTable.userId,
      title: appointmentTable.title,
      description: appointmentTable.description,
      priority: appointmentTable.priority,
      startDate: appointmentTable.startDate,
      dueDate: appointmentTable.dueDate,
      reminderOffsets: appointmentTable.reminderOffsets,
      recurrence: appointmentTable.recurrence,
      createdAt: appointmentTable.createdAt,
      assigneeName: userTable.name,
      assigneeId: appointmentTable.userId,
    })
    .from(appointmentTable)
    .leftJoin(userTable, eq(appointmentTable.userId, userTable.id))
    .where(eq(appointmentTable.projectId, projectId))
    .orderBy(asc(appointmentTable.startDate), asc(appointmentTable.position));

  // No limit means "the whole collection": the calendar and Gantt views rely
  // on it, so pagination only applies when the caller asks for a page.
  if (paging.limit === undefined && paging.offset === undefined) {
    return query;
  }
  return query.limit(paging.limit ?? 50).offset(paging.offset ?? 0);
}

export default listAppointments;
