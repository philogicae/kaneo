import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { initializePlugins } from "../../apps/api/src/plugins";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// 10-digit prefix, 35-char suffix: matches the bot token schema exactly.
const botToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const chatId = "-100200300";
const telegramSendUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

const telegramFetchCalls: { url: string; body: unknown }[] = [];

async function stubTelegramFetch(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  telegramFetchCalls.push({
    url: String(_input),
    body: init?.body ? JSON.parse(String(init.body)) : null,
  });
  return new Response(JSON.stringify({ ok: true, result: {} }), {
    status: 200,
  });
}

// Plugins and event subscriptions are process-level singletons; the dev
// server wires them in runStartupTasks, tests must do it explicitly.
let pluginsInitialized = false;

beforeEach(async () => {
  await resetTestDatabase();
  telegramFetchCalls.length = 0;
  vi.stubGlobal("fetch", vi.fn(stubTelegramFetch));
  if (!pluginsInitialized) {
    initializePlugins();
    pluginsInitialized = true;
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function seedScene() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: owner.workspace.id,
    name: "Orbit",
    slug: "ORB",
  });
  return { owner, project };
}

async function seedWorkspaceMember(workspaceId: string) {
  const userId = `user-${randomUUID()}`;
  await db.insert(schema.userTable).values({
    id: userId,
    email: `${userId}@example.com`,
    emailVerified: true,
    name: `Member ${userId.slice(-6)}`,
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role: "member",
    joinedAt: new Date(),
  });
  return { id: userId };
}

function notificationsFor(userId: string) {
  return db
    .select()
    .from(schema.notificationTable)
    .where(eq(schema.notificationTable.userId, userId));
}

async function createAppointment(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  body: Record<string, unknown>,
) {
  const response = await app.request("/api/appointment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      startDate: "2026-09-20T09:00:00.000Z",
      dueDate: "2026-09-20T10:00:00.000Z",
      ...body,
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { id: string };
}

describe("appointment notifications", () => {
  it("notifies an assignee who did not create the appointment", async () => {
    const { owner, project } = await seedScene();
    const member = await seedWorkspaceMember(owner.workspace.id);
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const appointment = await createAppointment(app, project.id, {
      title: "Design review",
      userId: member.id,
    });

    await vi.waitFor(async () => {
      const rows = await notificationsFor(member.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe("appointment_created");
      expect(rows[0]?.resourceType).toBe("appointment");
      expect(rows[0]?.resourceId).toBe(appointment.id);
      expect(rows[0]?.eventData).toMatchObject({
        appointmentTitle: "Design review",
        projectId: project.id,
        workspaceId: owner.workspace.id,
      });
    });

    expect(await notificationsFor(owner.user.id)).toHaveLength(0);
  });

  it("notifies the assignee when the appointment is rescheduled", async () => {
    const { owner, project } = await seedScene();
    const member = await seedWorkspaceMember(owner.workspace.id);
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const appointment = await createAppointment(app, project.id, {
      title: "Design review",
      userId: member.id,
    });

    // Let the creation notification land before changing the dates.
    await vi.waitFor(async () => {
      expect(await notificationsFor(member.id)).toHaveLength(1);
    });

    const updated = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Design review",
        userId: member.id,
        startDate: "2026-09-21T09:00:00.000Z",
        dueDate: "2026-09-21T10:00:00.000Z",
      }),
    });
    expect(updated.status).toBe(200);

    await vi.waitFor(async () => {
      expect(await notificationsFor(member.id)).toHaveLength(2);
    });

    const rows = await notificationsFor(member.id);
    const rescheduled = rows.find((row) => row.type === "appointment_updated");
    expect(rescheduled?.eventData).toMatchObject({ changeType: "rescheduled" });
  });

  it("notifies the new assignee when the appointment changes hands", async () => {
    const { owner, project } = await seedScene();
    const member = await seedWorkspaceMember(owner.workspace.id);
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const appointment = await createAppointment(app, project.id, {
      title: "Handover",
    });

    // An unassigned appointment produces no notification.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await notificationsFor(member.id)).toHaveLength(0);

    const updated = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Handover", userId: member.id }),
    });
    expect(updated.status).toBe(200);

    await vi.waitFor(async () => {
      const rows = await notificationsFor(member.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.type).toBe("appointment_updated");
      expect(rows[0]?.eventData).toMatchObject({ changeType: "assignee" });
    });
  });

  it("stays silent for the member making the change", async () => {
    const { owner, project } = await seedScene();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const appointment = await createAppointment(app, project.id, {
      title: "Self review",
      userId: owner.user.id,
    });

    const updated = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Self review",
        userId: owner.user.id,
        startDate: "2026-09-22T09:00:00.000Z",
        dueDate: "2026-09-22T10:00:00.000Z",
      }),
    });
    expect(updated.status).toBe(200);

    // Give both async subscribers a chance to misbehave before asserting.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await notificationsFor(owner.user.id)).toHaveLength(0);
  });

  it("honours the assignment preference", async () => {
    const { owner, project } = await seedScene();
    const member = await seedWorkspaceMember(owner.workspace.id);
    await db
      .insert(schema.userNotificationPreferenceTable)
      .values({ userId: member.id, taskAssignmentEnabled: false });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await createAppointment(app, project.id, {
      title: "Muted review",
      userId: member.id,
    });

    // Give the subscriber a chance to misbehave before asserting.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await notificationsFor(member.id)).toHaveLength(0);
  });

  it("sends unified Telegram messages for creation and reschedule", async () => {
    const { owner, project } = await seedScene();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const [bot] = await db
      .insert(schema.telegramBotTable)
      .values({ userId: owner.user.id, botToken })
      .returning();
    const [chat] = await db
      .insert(schema.telegramChatTable)
      .values({ botId: bot.id, chatId })
      .returning();
    await db.insert(schema.telegramRuleTable).values({
      chatId: chat.id,
      workspaceId: owner.workspace.id,
      projectId: project.id,
      isActive: true,
    });

    const appointment = await createAppointment(app, project.id, {
      title: "Planning",
    });

    await vi.waitFor(() => {
      expect(telegramFetchCalls).toHaveLength(1);
    });

    const created = telegramFetchCalls[0];
    expect(created.url).toBe(telegramSendUrl);
    const createdBody = created.body as { text: string };
    expect(createdBody.text).toContain("Planning");
    expect(createdBody.text).toContain("Orbit");
    expect(createdBody.text).toContain("📅");
    expect(createdBody.text).toContain("⚡ Appointment created");
    expect(createdBody.text).toContain("/appointments");

    const updated = await app.request(`/api/appointment/${appointment.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Planning",
        startDate: "2026-09-23T09:00:00.000Z",
        dueDate: "2026-09-23T10:00:00.000Z",
      }),
    });
    expect(updated.status).toBe(200);

    await vi.waitFor(() => {
      expect(telegramFetchCalls).toHaveLength(2);
    });

    const rescheduledBody = telegramFetchCalls[1]?.body as { text: string };
    expect(rescheduledBody.text).toContain("⚡ Appointment rescheduled");
  });
});
