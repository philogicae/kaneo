import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const MINUTE_MS = 60 * 1000;

const { getUnifiedTelegramTargets, sendTelegramMessage } = vi.hoisted(() => ({
  getUnifiedTelegramTargets: vi.fn<() => Promise<unknown[]>>(async () => []),
  sendTelegramMessage: vi.fn<
    (
      config: unknown,
      action: string,
      data: Record<string, unknown>,
    ) => Promise<void>
  >(async () => {}),
}));

vi.mock(
  "../../apps/api/src/plugins/telegram/unified",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../apps/api/src/plugins/telegram/unified")
      >();
    return { ...actual, getUnifiedTelegramTargets };
  },
);

vi.mock(
  "../../apps/api/src/plugins/telegram/events",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../apps/api/src/plugins/telegram/events")
      >();
    return { ...actual, sendTelegramMessage };
  },
);

const { default: db, schema } = await import("../../apps/api/src/database");
const { createApp } = await import("../../apps/api/src/index");
const { checkAppointmentRecurrence } = await import(
  "../../apps/api/src/scheduler/appointment-recurrence"
);
const { checkAppointmentReminders } = await import(
  "../../apps/api/src/scheduler/appointment-reminders"
);
const { mockAuthenticatedSession } = await import("./helpers/auth");
const { resetTestDatabase } = await import("./helpers/database");
const { createProjectFixture, createWorkspaceMember } = await import(
  "./helpers/fixtures"
);

const telegramTarget = {
  bot: { botToken: "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw" },
  chat: { chatId: "-1001234567890", label: "Ops" },
  rule: { threadId: null },
};

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  getUnifiedTelegramTargets.mockResolvedValue([]);
});

async function seedScene() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Orbit",
    slug: "ORB",
  });
  return { user, workspace, project };
}

let nextAppointmentNumber = 1;

async function seedAppointment(
  scene: Awaited<ReturnType<typeof seedScene>>,
  overrides: Partial<typeof schema.appointmentTable.$inferInsert> = {},
) {
  const number = nextAppointmentNumber++;
  const [appointment] = await db
    .insert(schema.appointmentTable)
    .values({
      projectId: scene.project.id,
      userId: scene.user.id,
      title: `Appointment ${number}`,
      priority: "medium",
      number,
      position: number,
      ...overrides,
    })
    .returning();

  if (!appointment) throw new Error("Failed to seed appointment fixture");
  return appointment;
}

describe("appointment reminders and recurrence API", () => {
  it("persists reminders and recurrence, and clears them with null", async () => {
    const { user, project } = await seedScene();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const created = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Weekly sync",
        startDate: "2026-09-20T09:00:00.000Z",
        dueDate: "2026-09-20T10:00:00.000Z",
        reminderOffsets: [60, 1440],
        recurrence: { frequency: "weekly", interval: 2 },
      }),
    });
    expect(created.status).toBe(200);
    const appointment = (await created.json()) as {
      id: string;
      reminderOffsets: number[];
      recurrence: { frequency: string; interval: number };
    };
    expect(appointment.reminderOffsets).toEqual([60, 1440]);
    expect(appointment.recurrence).toEqual({
      frequency: "weekly",
      interval: 2,
    });

    const listed = await app.request(
      `/api/appointment?projectId=${project.id}`,
    );
    const rows = (await listed.json()) as Array<{
      reminderOffsets: number[];
      recurrence: { frequency: string } | null;
    }>;
    expect(rows[0]?.reminderOffsets).toEqual([60, 1440]);

    const cleared = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Weekly sync",
        reminderOffsets: null,
        recurrence: null,
      }),
    });
    expect(cleared.status).toBe(200);
    const clearedBody = (await cleared.json()) as {
      reminderOffsets: number[] | null;
      recurrence: unknown;
    };
    expect(clearedBody.reminderOffsets).toBeNull();
    expect(clearedBody.recurrence).toBeNull();
  });

  it("rejects invalid reminder offsets and recurrence", async () => {
    const { user, project } = await seedScene();
    mockAuthenticatedSession(user);
    const { app } = createApp();

    const badOffset = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Bad reminder",
        reminderOffsets: [0],
      }),
    });
    expect(badOffset.status).toBe(400);

    const badRecurrence = await app.request("/api/appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        title: "Bad recurrence",
        recurrence: { frequency: "yearly", interval: 1 },
      }),
    });
    expect(badRecurrence.status).toBe(400);
  });
});

describe("appointment recurrence scheduling", () => {
  it("spawns the next occurrence once and clears the source rule", async () => {
    const scene = await seedScene();
    // Started 25h ago with a 30-minute duration: the first shifted occurrence
    // already ended, so the scheduler must skip to the next upcoming slot.
    const pastStart = new Date(Date.now() - 25 * 60 * MINUTE_MS);
    const source = await seedAppointment(scene, {
      title: "Daily standup",
      priority: "high",
      startDate: pastStart,
      dueDate: new Date(pastStart.getTime() + 30 * MINUTE_MS),
      reminderOffsets: [15],
      recurrence: { frequency: "daily", interval: 1 },
    });

    await checkAppointmentRecurrence();

    const rows = await db
      .select()
      .from(schema.appointmentTable)
      .where(eq(schema.appointmentTable.projectId, scene.project.id));
    expect(rows).toHaveLength(2);

    const sourceRow = rows.find((row) => row.id === source.id);
    expect(sourceRow?.recurrence).toBeNull();

    const child = rows.find((row) => row.id !== source.id);
    expect(child).toMatchObject({
      title: "Daily standup",
      priority: "high",
      reminderOffsets: [15],
      recurrence: { frequency: "daily", interval: 1 },
    });
    expect(child?.startDate?.getTime()).toBe(
      pastStart.getTime() + 48 * 60 * MINUTE_MS,
    );
    expect(child?.dueDate?.getTime()).toBe(
      pastStart.getTime() + 48 * 60 * MINUTE_MS + 30 * MINUTE_MS,
    );

    // A second pass must not spawn a duplicate.
    await checkAppointmentRecurrence();
    const after = await db
      .select()
      .from(schema.appointmentTable)
      .where(eq(schema.appointmentTable.projectId, scene.project.id));
    expect(after).toHaveLength(2);
  });

  it("leaves appointments without a rule untouched", async () => {
    const scene = await seedScene();
    await seedAppointment(scene, {
      startDate: new Date(Date.now() - 60 * MINUTE_MS),
      dueDate: new Date(Date.now() - 30 * MINUTE_MS),
    });

    await checkAppointmentRecurrence();

    const rows = await db
      .select()
      .from(schema.appointmentTable)
      .where(eq(schema.appointmentTable.projectId, scene.project.id));
    expect(rows).toHaveLength(1);
  });
});

describe("appointment Telegram reminders", () => {
  function startInsideReminderWindow(offsetMinutes: number) {
    // sendAt = start - offset lands five minutes in the past, inside the
    // trailing REMINDER_WINDOW_MINUTES window.
    return new Date(Date.now() + (offsetMinutes - 5) * MINUTE_MS);
  }

  it("sends one reminder per offset and dedupes it", async () => {
    const scene = await seedScene();
    getUnifiedTelegramTargets.mockResolvedValue([telegramTarget]);
    const appointment = await seedAppointment(scene, {
      title: "Kickoff call",
      startDate: startInsideReminderWindow(60),
      dueDate: new Date(Date.now() + 80 * MINUTE_MS),
      reminderOffsets: [60],
    });

    await checkAppointmentReminders();

    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [, action, data] = sendTelegramMessage.mock.calls[0] ?? [];
    expect(action).toBe("Reminder: starts in 1 hour");
    expect(data).toMatchObject({
      taskTitle: "Kickoff call",
      kind: "appointment",
      status: "appointment",
    });

    const sent = await db
      .select({
        reminderType: schema.appointmentReminderSentTable.reminderType,
      })
      .from(schema.appointmentReminderSentTable)
      .where(
        eq(schema.appointmentReminderSentTable.appointmentId, appointment.id),
      );
    expect(sent.map((row) => row.reminderType)).toEqual([
      "telegram_unified:60",
    ]);

    await checkAppointmentReminders();
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
  });

  it("re-arms the reminder when the appointment is rescheduled", async () => {
    const scene = await seedScene();
    getUnifiedTelegramTargets.mockResolvedValue([telegramTarget]);
    const start = startInsideReminderWindow(60);
    const appointment = await seedAppointment(scene, {
      title: "Kickoff call",
      startDate: start,
      dueDate: new Date(start.getTime() + 60 * MINUTE_MS),
      reminderOffsets: [60],
    });

    await checkAppointmentReminders();
    expect(sendTelegramMessage).toHaveBeenCalledTimes(1);

    mockAuthenticatedSession(scene.user);
    const { app } = createApp();
    const moved = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Kickoff call",
        startDate: new Date(start.getTime() + 2 * 60 * MINUTE_MS).toISOString(),
        dueDate: new Date(start.getTime() + 3 * 60 * MINUTE_MS).toISOString(),
        reminderOffsets: [60],
      }),
    });
    expect(moved.status).toBe(200);

    const sentAfterMove = await db
      .select({ id: schema.appointmentReminderSentTable.id })
      .from(schema.appointmentReminderSentTable)
      .where(
        eq(schema.appointmentReminderSentTable.appointmentId, appointment.id),
      );
    expect(sentAfterMove).toHaveLength(0);
  });

  it("records nothing when no Telegram rule covers the project", async () => {
    const scene = await seedScene();
    const appointment = await seedAppointment(scene, {
      startDate: startInsideReminderWindow(60),
      dueDate: new Date(Date.now() + 80 * MINUTE_MS),
      reminderOffsets: [60],
    });

    await checkAppointmentReminders();

    expect(sendTelegramMessage).not.toHaveBeenCalled();
    const sent = await db
      .select({ id: schema.appointmentReminderSentTable.id })
      .from(schema.appointmentReminderSentTable)
      .where(
        eq(schema.appointmentReminderSentTable.appointmentId, appointment.id),
      );
    expect(sent).toHaveLength(0);
  });
});
