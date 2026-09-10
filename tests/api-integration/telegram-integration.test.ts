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

describe("API integration: Telegram notifications", () => {
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

  it("sends a Telegram message when a task is created", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
      name: "Aurora",
      slug: "AUR",
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const settingsPath = `/api/telegram-integration/project/${project.id}`;
    const created = await app.request(settingsPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken, chatId, chatLabel: "Ops chat" }),
    });
    expect(created.status).toBe(200);

    const taskResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Telegram probe",
        description: "",
        status: "to-do",
        priority: "medium",
      }),
    });
    expect(taskResponse.status).toBe(200);

    await vi.waitFor(() => {
      expect(telegramFetchCalls).toHaveLength(1);
    });

    const call = telegramFetchCalls[0];
    expect(call.url).toBe(telegramSendUrl);
    const body = call.body as {
      chat_id: string;
      text: string;
      parse_mode?: string;
      link_preview_options?: { is_disabled: boolean };
      message_thread_id?: number;
    };
    expect(body.chat_id).toBe(chatId);
    expect(body.text).toContain("Telegram probe");
    expect(body.text).toContain("Aurora");
    // Compact format: the action is the last line.
    expect(body.text).toContain("⚡ Task created");
    expect(body.parse_mode).toBe("HTML");
    // Notifications stay compact: no link preview (recent fix, must hold).
    expect(body.link_preview_options?.is_disabled).toBe(true);
  });

  it("sends a Telegram message when a task status changes", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    await app.request(`/api/telegram-integration/project/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botToken,
        chatId,
        events: { taskStatusChanged: true },
      }),
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Status probe",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    const statusResponse = await app.request(`/api/task/status/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(statusResponse.status).toBe(200);

    await vi.waitFor(() => {
      expect(telegramFetchCalls).toHaveLength(1);
    });

    const body = telegramFetchCalls[0]?.body as { text: string };
    expect(body.text).toContain("Status probe");
    // Status renders as an icon next to the task; the action line spells the
    // transition out.
    expect(body.text).toContain("✅");
    expect(body.text).toContain("To Do → Done");
  });

  it("stays silent when the integration is disabled", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const settingsPath = `/api/telegram-integration/project/${project.id}`;
    await app.request(settingsPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botToken, chatId }),
    });
    const disabled = await app.request(settingsPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    expect(disabled.status).toBe(200);

    const taskResponse = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Silent probe",
        description: "",
        status: "to-do",
        priority: "medium",
      }),
    });
    expect(taskResponse.status).toBe(200);

    // Give the async dispatch a chance to misbehave before asserting.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(telegramFetchCalls).toHaveLength(0);

    const stored = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.projectId, project.id),
    });
    expect(stored?.isActive).toBe(false);
  });
});
