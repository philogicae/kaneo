import { existsSync, readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type McpToolRegistrar,
  registerMcpTools,
} from "../../apps/api/src/mcp/tools";

type ToolCallback = (args: unknown) => Promise<{
  content: Array<{ text: string }>;
  isError?: boolean;
}>;

function collectTools() {
  const tools = new Map<string, ToolCallback>();
  const registrar: McpToolRegistrar = {
    registerTool: (name, _config, callback) => tools.set(name, callback),
  };
  registerMcpTools(registrar, "http://api.test", "test-token");
  return tools;
}

const tools = collectTools();

function call(name: string, args: unknown = {}) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool ${name} is not registered`);
  return tool(args);
}

let apiFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  apiFetch = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", apiFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function lastRequest() {
  const [input, init] = apiFetch.mock.calls.at(-1) as [
    RequestInfo | URL,
    RequestInit | undefined,
  ];
  return {
    url: String(input),
    method: init?.method ?? "GET",
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
    auth: new Headers(init?.headers).get("authorization"),
  };
}

describe("Kaneo skill contract", () => {
  const skillRoot = new URL("../../skills/kaneo/", import.meta.url);
  const documents = [
    "SKILL.md",
    ...readdirSync(new URL("references/", skillRoot))
      .filter((name) => name.endsWith(".md"))
      .map((name) => `references/${name}`),
  ].map((path) => ({
    path,
    text: readFileSync(new URL(path, skillRoot), "utf8"),
  }));

  it("ships a discoverable entry point with resolvable local references", () => {
    expect(documents[0]?.text).toMatch(
      /^---\nname: kaneo\ndescription: .+\nversion: \d+\.\d+\.\d+\n---/,
    );
    for (const { path, text } of documents) {
      for (const [, target] of text.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
        expect(
          existsSync(new URL(target, new URL(path, skillRoot))),
          target,
        ).toBe(true);
      }
    }
  });

  it("documents every registered tool and no nonexistent tool in the catalog", () => {
    const guidelines = documents.find(({ path }) =>
      path.endsWith("mcp-guidelines.md"),
    );
    const catalog = guidelines?.text
      .split("## Tool catalog\n")[1]
      ?.split("\n## ")[0];
    expect(catalog).toBeDefined();
    const names = [...(catalog ?? "").matchAll(/`([a-z]+(?:_[a-z]+)*)`/g)];
    expect([...new Set(names.map((match) => match[1]))].sort()).toEqual(
      [...tools.keys()].sort(),
    );
  });

  it("validates all documented call examples against the registered schemas", () => {
    const schemas = new Map<
      string,
      Parameters<McpToolRegistrar["registerTool"]>[1]["inputSchema"]
    >();
    registerMcpTools(
      { registerTool: (name, config) => schemas.set(name, config.inputSchema) },
      "http://api.test",
      "test-token",
    );
    let exampleCount = 0;
    for (const { path, text } of documents) {
      for (const [, json] of text.matchAll(/```json\n([\s\S]*?)\n```/g)) {
        const example = JSON.parse(json ?? "");
        const schema = schemas.get(example.tool);
        expect(schema, `${path}: ${example.tool}`).toBeDefined();
        const result = schema?.strict().safeParse(example.arguments);
        expect(result?.success, `${path}: ${JSON.stringify(result)}`).toBe(
          true,
        );
        exampleCount++;
      }
    }
    expect(exampleCount).toBeGreaterThan(0);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});

describe("MCP tool catalog", () => {
  it("resolves workspace members", async () => {
    await call("list_workspace_members", { workspaceId: "ws 1" });

    const request = lastRequest();
    expect(request.url).toBe("http://api.test/api/workspace/ws%201/members");
    expect(request.auth).toBe("Bearer test-token");
  });

  it("passes only the search filters that were supplied", async () => {
    await call("search", { q: "login bug" });
    expect(lastRequest().url).toBe("http://api.test/api/search?q=login+bug");

    await call("search", {
      q: "login bug",
      type: "tasks",
      projectId: "p1",
      limit: 5,
    });
    const url = new URL(lastRequest().url);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: "login bug",
      type: "tasks",
      projectId: "p1",
      limit: "5",
    });

    await call("search", { q: "kickoff", type: "appointments" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/search?q=kickoff&type=appointments",
    );
  });

  it("rejects a search limit above the API maximum", async () => {
    const result = await call("search", { q: "x", limit: 500 });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("lists the columns whose slugs are valid task statuses", async () => {
    await call("list_project_columns", { projectId: "p1" });

    expect(lastRequest().url).toBe("http://api.test/api/column/p1");
  });

  it("creates a column with optional styling", async () => {
    await call("create_column", {
      projectId: "p1",
      name: "In review",
      isFinal: false,
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/column/p1",
      method: "POST",
      body: { name: "In review", isFinal: false },
    });

    await call("create_column", {
      projectId: "p1",
      name: "Done",
      color: "red",
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("updates a column and clears optional fields with null", async () => {
    await call("update_column", { columnId: "c1", name: "Backlog" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/column/c1",
      method: "PUT",
      body: { name: "Backlog" },
    });

    await call("update_column", { columnId: "c1", color: null, icon: null });
    expect(lastRequest().body).toEqual({ color: null, icon: null });
  });

  it("reorders columns by position", async () => {
    await call("reorder_columns", {
      projectId: "p1",
      columns: [
        { id: "c2", position: 0 },
        { id: "c1", position: 1 },
      ],
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/column/reorder/p1",
      method: "PUT",
      body: {
        columns: [
          { id: "c2", position: 0 },
          { id: "c1", position: 1 },
        ],
      },
    });
  });

  it("deletes an empty column", async () => {
    await call("delete_column", { columnId: "c1" });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/column/c1",
      method: "DELETE",
    });
  });

  it("bulk updates tasks", async () => {
    await call("bulk_update_tasks", {
      taskIds: ["t1", "t2"],
      operation: "updateStatus",
      value: "done",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/bulk",
      method: "PATCH",
      body: { taskIds: ["t1", "t2"], operation: "updateStatus", value: "done" },
    });

    await call("bulk_update_tasks", { taskIds: ["t1"], operation: "delete" });
    expect(lastRequest().body).toEqual({
      taskIds: ["t1"],
      operation: "delete",
    });
  });

  it("rejects an unknown bulk operation before calling the API", async () => {
    const result = await call("bulk_update_tasks", {
      taskIds: ["t1"],
      operation: "archive",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("deletes a task", async () => {
    await call("delete_task", { taskId: "t1" });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/t1",
      method: "DELETE",
    });
  });

  it("assigns and unassigns a task", async () => {
    await call("update_task_assignee", { taskId: "t1", userId: "u1" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/assignee/t1",
      method: "PUT",
      body: { userId: "u1" },
    });

    await call("update_task_assignee", { taskId: "t1", userId: null });
    expect(lastRequest().body).toEqual({ userId: null });
  });

  it("rejects an empty assignee id rather than sending it", async () => {
    const result = await call("update_task_assignee", {
      taskId: "t1",
      userId: "",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("sets and clears a due date", async () => {
    await call("update_task_due_date", {
      taskId: "t1",
      dueDate: "2026-09-01T10:00:00Z",
    });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/due-date/t1",
      method: "PUT",
      body: { dueDate: "2026-09-01T10:00:00Z" },
    });

    await call("update_task_due_date", { taskId: "t1" });
    expect(lastRequest().body).toEqual({});
  });

  it("rejects a due date that is not an ISO date-time", async () => {
    const result = await call("update_task_due_date", {
      taskId: "t1",
      dueDate: "next tuesday",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("passes reminder offsets through update_task, including a clear", async () => {
    const existingTask = {
      id: "t1",
      title: "Task",
      description: "d",
      status: "to-do",
      priority: "medium",
      projectId: "p1",
      position: 1,
      startDate: "2026-09-20T10:00:00.000Z",
    };

    apiFetch.mockResolvedValueOnce(Response.json(existingTask));
    await call("update_task", { taskId: "t1", reminderOffsets: [120, 15] });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/t1",
      method: "PUT",
      body: expect.objectContaining({ reminderOffsets: [120, 15] }),
    });

    apiFetch.mockResolvedValueOnce(Response.json(existingTask));
    await call("update_task", { taskId: "t1", reminderOffsets: null });
    expect(lastRequest().body).toMatchObject({ reminderOffsets: null });
  });

  it("rejects invalid reminder offsets before calling the API", async () => {
    const result = await call("update_task", {
      taskId: "t1",
      reminderOffsets: [0],
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("accepts reminder offsets when creating a task", async () => {
    await call("create_task", {
      projectId: "p1",
      title: "Task",
      description: "",
      priority: "medium",
      status: "to-do",
      startDate: "2026-09-20T10:00:00Z",
      reminderOffsets: [1440],
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/p1",
      method: "POST",
      body: expect.objectContaining({ reminderOffsets: [1440] }),
    });
  });

  it("previews the Jev qualification of a task", async () => {
    await call("qualify_task", {
      projectId: "p1",
      title: "Fix login redirect loop",
      description: "Users bounce between the callback and the sign-in page.",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/task/qualify/p1",
      method: "POST",
      body: {
        title: "Fix login redirect loop",
        description: "Users bounce between the callback and the sign-in page.",
      },
    });
  });

  it("passes an optional priority hint to qualify_task", async () => {
    await call("qualify_task", {
      projectId: "p1",
      title: "Fix login redirect loop",
      priority: "high",
    });

    expect(lastRequest().body).toEqual({
      title: "Fix login redirect loop",
      priority: "high",
    });
  });

  it("passes recurrence through create_task and update_task, including a clear", async () => {
    await call("create_task", {
      projectId: "p1",
      title: "Task",
      description: "",
      priority: "medium",
      status: "to-do",
      recurrence: { frequency: "weekly", interval: 2 },
    });

    expect(lastRequest().body).toMatchObject({
      recurrence: { frequency: "weekly", interval: 2 },
    });

    const existingTask = {
      id: "t1",
      title: "Task",
      description: "d",
      status: "to-do",
      priority: "medium",
      projectId: "p1",
      position: 1,
    };

    apiFetch.mockResolvedValueOnce(Response.json(existingTask));
    await call("update_task", {
      taskId: "t1",
      recurrence: { frequency: "monthly", interval: 1 },
    });
    expect(lastRequest().body).toMatchObject({
      recurrence: { frequency: "monthly", interval: 1 },
    });

    apiFetch.mockResolvedValueOnce(Response.json(existingTask));
    await call("update_task", { taskId: "t1", recurrence: null });
    expect(lastRequest().body).toMatchObject({ recurrence: null });
  });

  it("rejects an invalid recurrence before calling the API", async () => {
    const result = await call("create_task", {
      projectId: "p1",
      title: "Task",
      description: "",
      priority: "medium",
      status: "to-do",
      recurrence: { frequency: "yearly", interval: 1 },
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("deletes a time entry", async () => {
    await call("delete_time_entry", { timeEntryId: "te1" });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/time-entry/te1",
      method: "DELETE",
    });
  });

  it("pages activity, comments and time entries with bounded defaults", async () => {
    await call("list_task_activity", { taskId: "t1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/activity/t1?limit=50&offset=0",
    );

    await call("list_task_activity", { taskId: "t1", limit: 10, offset: 20 });
    expect(lastRequest().url).toBe(
      "http://api.test/api/activity/t1?limit=10&offset=20",
    );

    await call("list_task_comments", { taskId: "t1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/comment/t1?limit=50&offset=0",
    );

    await call("list_task_time_entries", { taskId: "t1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/time-entry/task/t1?limit=50&offset=0",
    );
  });

  it("applies bounded defaults to list_tasks and get_project", async () => {
    await call("list_tasks", { projectId: "p1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/task/tasks/p1?page=1&limit=50",
    );

    await call("list_tasks", { projectId: "p1", page: 3, limit: 25 });
    expect(lastRequest().url).toBe(
      "http://api.test/api/task/tasks/p1?page=3&limit=25",
    );

    await call("get_project", { projectId: "p1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/project/p1?tasksLimit=50&tasksOffset=0",
    );

    await call("get_project", {
      projectId: "p1",
      tasksLimit: 10,
      tasksOffset: 20,
    });
    expect(lastRequest().url).toBe(
      "http://api.test/api/project/p1?tasksLimit=10&tasksOffset=20",
    );
  });

  it("converts local times with the user timezone (summer and winter)", async () => {
    await call("create_task", {
      projectId: "p1",
      title: "Task",
      description: "",
      priority: "medium",
      status: "to-do",
      startDate: "2026-09-14T14:00:00",
      timezone: "Europe/Bucharest",
    });
    expect(lastRequest().body).toMatchObject({
      startDate: "2026-09-14T11:00:00.000Z",
    });

    await call("update_task_due_date", {
      taskId: "t1",
      dueDate: "2026-01-14T14:00:00",
      timezone: "Europe/Bucharest",
    });
    expect(lastRequest().body).toEqual({
      dueDate: "2026-01-14T12:00:00.000Z",
    });
  });

  it("rejects a local time without a timezone before calling the API", async () => {
    const result = await call("create_task", {
      projectId: "p1",
      title: "Task",
      description: "",
      priority: "medium",
      status: "to-do",
      startDate: "2026-09-14T14:00:00",
    });

    expect(result.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("keeps an explicit offset untouched", async () => {
    await call("update_task_due_date", {
      taskId: "t1",
      dueDate: "2026-09-14T14:00:00+03:00",
    });

    expect(lastRequest().body).toEqual({
      dueDate: "2026-09-14T14:00:00+03:00",
    });
  });

  it("reads time entries for a task and by id", async () => {
    await call("list_task_time_entries", { taskId: "t1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/time-entry/task/t1?limit=50&offset=0",
    );

    await call("get_time_entry", { timeEntryId: "te1" });
    expect(lastRequest().url).toBe("http://api.test/api/time-entry/te1");
  });

  it("creates a running time entry when endTime is omitted", async () => {
    await call("create_time_entry", {
      taskId: "t1",
      startTime: "2026-08-10T09:00:00Z",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/time-entry",
      method: "POST",
      body: { taskId: "t1", startTime: "2026-08-10T09:00:00Z" },
    });
    expect(lastRequest().body).not.toHaveProperty("endTime");
  });

  it("updates a time entry", async () => {
    await call("update_time_entry", {
      timeEntryId: "te1",
      startTime: "2026-08-10T09:00:00Z",
      endTime: "2026-08-10T10:30:00Z",
      description: "pairing",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/time-entry/te1",
      method: "PUT",
      body: {
        startTime: "2026-08-10T09:00:00Z",
        endTime: "2026-08-10T10:30:00Z",
        description: "pairing",
      },
    });
  });

  it("reads task activity and notifications", async () => {
    await call("list_task_activity", { taskId: "t1" });
    expect(lastRequest().url).toBe(
      "http://api.test/api/activity/t1?limit=50&offset=0",
    );

    await call("list_notifications");
    expect(lastRequest().url).toBe("http://api.test/api/notification");
  });

  it("surfaces an API failure as a tool error", async () => {
    apiFetch.mockResolvedValueOnce(
      Response.json({ message: "Task not found" }, { status: 404 }),
    );

    const result = await call("delete_task", { taskId: "missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Task not found");
  });
});

describe("MCP telegram rule and project description tools", () => {
  it("sends projectIds as an array when creating a project-scoped rule", async () => {
    apiFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/telegram-config")) {
        return Response.json({
          bots: [
            {
              id: "bot-1",
              name: "B",
              chats: [{ id: "chat-1", chatId: "-1001", label: "L", rules: [] }],
            },
          ],
        });
      }
      return Response.json({ ok: true });
    });

    await call("telegram_create_rule", {
      botId: "bot-1",
      telegramChatId: "-1001",
      workspaceId: "ws-1",
      projectId: "proj-1",
      threadId: null,
    });

    const request = lastRequest();
    expect(request.url).toBe(
      "http://api.test/api/telegram-config/telegram-chat/chat-1/rules",
    );
    // The REST API rejects a bare string: projectIds must be an array.
    expect(request.body.scopes).toEqual([
      { workspaceId: "ws-1", projectIds: ["proj-1"] },
    ]);
  });

  it("creates a project with a description", async () => {
    await call("create_project", {
      name: "P",
      workspaceId: "ws-1",
      icon: "Rocket",
      slug: "p",
      description: "hello",
    });

    const request = lastRequest();
    expect(request.url).toBe("http://api.test/api/project");
    expect(request.body).toEqual({
      name: "P",
      workspaceId: "ws-1",
      icon: "Rocket",
      slug: "p",
      description: "hello",
    });
  });

  it("omits the project description when it is not provided", async () => {
    await call("create_project", {
      name: "P",
      workspaceId: "ws-1",
      icon: "Rocket",
      slug: "p",
    });

    expect(lastRequest().body).toEqual({
      name: "P",
      workspaceId: "ws-1",
      icon: "Rocket",
      slug: "p",
    });
  });

  it("registers telegram_configure_notifications", () => {
    expect(tools.has("telegram_configure_notifications")).toBe(true);
  });
});

describe("MCP instance and workspace invite-link tools", () => {
  const originalClientUrl = process.env.KANEO_CLIENT_URL;

  beforeEach(() => {
    process.env.KANEO_CLIENT_URL = "https://kaneo.example.com/";
  });

  afterEach(() => {
    if (originalClientUrl === undefined) {
      delete process.env.KANEO_CLIENT_URL;
    } else {
      process.env.KANEO_CLIENT_URL = originalClientUrl;
    }
  });

  it("returns the public URL without a trailing slash", async () => {
    const result = await call("get_public_url");
    expect(JSON.parse(result.content[0].text)).toEqual({
      url: "https://kaneo.example.com",
    });
  });

  it("returns the default workspace invite link as a full URL", async () => {
    apiFetch.mockResolvedValueOnce(
      Response.json([
        {
          token: "limited",
          expiresAt: "2020-01-01T00:00:00.000Z",
          maxUses: 1,
          usedCount: 0,
        },
        {
          token: "default",
          expiresAt: null,
          maxUses: null,
          usedCount: 3,
        },
      ]),
    );

    const result = await call("get_workspace_invite_link", {
      workspaceId: "ws 1",
    });

    expect(lastRequest().url).toBe(
      "http://api.test/api/workspace-sharing?workspaceId=ws%201",
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      workspaceId: "ws 1",
      url: "https://kaneo.example.com/invitation/link/default",
      token: "default",
      maxUses: null,
    });
  });
});

describe("MCP appointment tools", () => {
  const existingAppointment = {
    id: "a1",
    projectId: "p1",
    position: 1,
    number: 1,
    userId: "u1",
    title: "Kickoff",
    description: "Intro call",
    priority: "high",
    startDate: "2026-09-20T09:00:00.000Z",
    dueDate: "2026-09-20T10:00:00.000Z",
    createdAt: "2026-09-16T08:00:00.000Z",
    assigneeName: "Dev",
    assigneeId: "u1",
  };

  it("lists and reads appointments", async () => {
    await call("list_appointments", { projectId: "p 1" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/appointment?projectId=p%201",
      method: "GET",
    });

    await call("get_appointment", { appointmentId: "a1" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/appointment/a1",
      method: "GET",
    });
  });

  it("creates an appointment and converts local times with the user timezone", async () => {
    await call("create_appointment", {
      projectId: "p1",
      title: "Kickoff",
      description: "Intro call",
      priority: "high",
      userId: "u1",
      startDate: "2026-09-14T14:00:00",
      timezone: "Europe/Bucharest",
    });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/appointment",
      method: "POST",
      body: {
        projectId: "p1",
        title: "Kickoff",
        description: "Intro call",
        priority: "high",
        userId: "u1",
        startDate: "2026-09-14T11:00:00.000Z",
      },
    });
  });

  it("creates an appointment with only the required fields", async () => {
    await call("create_appointment", { projectId: "p1", title: "Kickoff" });

    expect(lastRequest().body).toEqual({ projectId: "p1", title: "Kickoff" });
  });

  it("rejects an unknown priority or a local date without timezone", async () => {
    const badPriority = await call("create_appointment", {
      projectId: "p1",
      title: "Kickoff",
      priority: "critical",
    });
    expect(badPriority.isError).toBe(true);

    const noTimezone = await call("create_appointment", {
      projectId: "p1",
      title: "Kickoff",
      startDate: "2026-09-14T14:00:00",
    });
    expect(noTimezone.isError).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("merges a partial appointment update into a full body", async () => {
    apiFetch.mockResolvedValueOnce(Response.json(existingAppointment));

    await call("update_appointment", { appointmentId: "a1", title: "Updated" });

    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/appointment/a1",
      method: "PUT",
      body: {
        title: "Updated",
        description: "Intro call",
        priority: "high",
        startDate: "2026-09-20T09:00:00.000Z",
        dueDate: "2026-09-20T10:00:00.000Z",
        userId: "u1",
      },
    });
  });

  it("clears appointment dates and assignee with null", async () => {
    apiFetch.mockResolvedValueOnce(Response.json(existingAppointment));

    await call("update_appointment", {
      appointmentId: "a1",
      startDate: null,
      dueDate: null,
      userId: null,
    });

    expect(lastRequest().body).toEqual({
      title: "Kickoff",
      description: "Intro call",
      priority: "high",
      userId: "",
    });
  });

  it("deletes an appointment and converts a backlog task", async () => {
    await call("delete_appointment", { appointmentId: "a1" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/appointment/a1",
      method: "DELETE",
    });

    await call("move_task_to_appointments", { taskId: "t1" });
    expect(lastRequest()).toMatchObject({
      url: "http://api.test/api/appointment/from-task",
      method: "POST",
      body: { taskId: "t1" },
    });
  });
});
