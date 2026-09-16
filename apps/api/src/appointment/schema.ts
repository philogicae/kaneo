import { z } from "../openapi";
import { recurrenceRule, reminderOffsets } from "../task/schema";
import { VALID_PRIORITIES } from "../task/validate-task-fields";

export const appointmentParam = z.object({ id: z.string() });

export const listAppointmentsQuery = z.object({
  projectId: z.string(),
});

const priority = z.enum(VALID_PRIORITIES);

export const createAppointmentBody = z.object({
  projectId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  priority: priority.optional(),
  userId: z.string().optional().openapi({ description: "Assignee, if any." }),
  reminderOffsets,
  recurrence: recurrenceRule,
});

export const updateAppointmentBody = createAppointmentBody.omit({
  projectId: true,
});

export const appointmentFromTaskBody = z.object({
  taskId: z.string(),
});
