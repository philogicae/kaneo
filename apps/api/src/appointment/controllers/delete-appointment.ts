import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { appointmentTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function deleteAppointment(id: string, currentUserId?: string) {
  const [deleted] = await db
    .delete(appointmentTable)
    .where(eq(appointmentTable.id, id))
    .returning({
      id: appointmentTable.id,
      projectId: appointmentTable.projectId,
      userId: appointmentTable.userId,
      title: appointmentTable.title,
    });

  if (!deleted) {
    throw new HTTPException(404, {
      message: "Appointment not found",
    });
  }

  await publishEvent("appointment.deleted", {
    appointmentId: deleted.id,
    projectId: deleted.projectId,
    userId: deleted.userId ?? "",
    currentUserId,
    title: deleted.title,
  });

  return { id: deleted.id };
}

export default deleteAppointment;
