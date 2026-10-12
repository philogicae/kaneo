import { z } from "../openapi";
import { recurrenceRule, reminderOffsets } from "../task/schema";
import { VALID_PRIORITIES } from "../task/validate-task-fields";
import { pagingNumber } from "../utils/paging";

export const appointmentParam = z.object({ id: z.string() });

export const listAppointmentsQuery = z.object({
  projectId: z.string(),
  // Optional: without them the full list is returned, which is what the
  // calendar and Gantt views consume; agents page explicitly.
  limit: pagingNumber(1, 200)
    .optional()
    .openapi({ description: "Maximum appointments to return." }),
  offset: pagingNumber(0, 1_000_000)
    .optional()
    .openapi({ description: "Appointments to skip; use with limit to page." }),
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
