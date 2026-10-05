import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { appointmentTable, userTable } from "../../database/schema";

const appointmentSelection = {
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
};

async function getAppointment(id: string) {
  const [appointment] = await db
    .select(appointmentSelection)
    .from(appointmentTable)
    .leftJoin(userTable, eq(appointmentTable.userId, userTable.id))
    .where(eq(appointmentTable.id, id))
    .limit(1);

  if (!appointment) {
    throw new HTTPException(404, {
      message: "Appointment not found",
    });
  }

  return { ...appointment, assigneeId: appointment.userId };
}

export { appointmentSelection };
export default getAppointment;
