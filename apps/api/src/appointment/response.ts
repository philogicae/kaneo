import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

const priorityDescription = "One of: no-priority, low, medium, high, urgent.";

export const appointmentSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    position: z.number().nullable().openapi({
      description: "Manual order among the project's appointments, ascending.",
    }),
    number: z.number().nullable().openapi({
      description: "Per-project appointment counter.",
    }),
    userId: z
      .string()
      .nullable()
      .openapi({ description: "The assignee, if any." }),
    title: z.string(),
    description: z.string().nullable(),
    priority: z.string().openapi({ description: priorityDescription }),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    reminderOffsets: z.array(z.number()).nullable().openapi({
      description:
        "Reminder offsets in minutes before the appointment's start date (Telegram reminders).",
    }),
    recurrence: z
      .object({
        frequency: z.enum(["daily", "weekly", "monthly"]),
        interval: z.number(),
      })
      .nullable()
      .openapi({
        description:
          "Recurrence of the appointment; the next occurrence is spawned when the current one ends.",
      }),
    createdAt: responseTimestamp,
    assigneeName: z.string().nullable(),
    assigneeId: z.string().nullable(),
  })
  .openapi("Appointment");

export const appointmentListSchema = z
  .array(appointmentSchema)
  .openapi("AppointmentList");
