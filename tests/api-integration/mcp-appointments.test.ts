import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const protocolVersion = "2026-07-28";

function toolCallRequest(
  name: string,
  args: Record<string, unknown>,
  apiKey: string,
  id = 1,
) {
  return {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "mcp-method": "tools/call",
      "mcp-name": name,
      "mcp-protocol-version": protocolVersion,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: {
        name,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": protocolVersion,
          "io.modelcontextprotocol/clientInfo": {
            name: "kaneo-integration-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  } as const;
}

type ToolCallBody = {
  result: {
    content: Array<{ text: string }>;
    isError?: boolean;
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

async function toolResult(response: Response): Promise<ToolCallBody> {
  const text = await response.text();
  const data = text
    .split("\n")
    .find((line) => line.startsWith("data: "))
    ?.slice(6);
  return JSON.parse(data ?? text) as ToolCallBody;
}

function payload<T>(body: ToolCallBody): T {
  return JSON.parse(body.result.content[0].text) as T;
}

describe("MCP appointment tools over the HTTP endpoint", () => {
  let app: ReturnType<typeof createApp>["app"];
  let apiKey: string;
  let userId: string;
  let projectId: string;
  let columns: Awaited<ReturnType<typeof createProjectFixture>>["columns"];

  beforeEach(async () => {
    await resetTestDatabase();
    ({ app } = createApp());
    // The MCP tools proxy the REST API over HTTP using the internal API URL;
    // route those calls straight into this app instance instead of a socket.
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
      app.fetch(new Request(String(input), init)),
    );
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    userId = user.id;
    const { project, columns: projectColumns } = await createProjectFixture({
      workspaceId: workspace.id,
      name: "Orbit",
      slug: "ORB",
    });
    projectId = project.id;
    columns = projectColumns;

    const key = await auth.api.createApiKey({
      body: { name: "mcp-appointments", userId },
    });
    if (!key) {
      throw new Error("API key creation failed");
    }
    apiKey = key.key;
  });

  it("creates, updates, lists and deletes appointments", async () => {
    const created = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest(
          "create_appointment",
          {
            projectId,
            title: "Design review",
            description: "Walk through the weekly grid",
            startDate: "2026-09-20T09:00:00.000Z",
            dueDate: "2026-09-20T10:00:00.000Z",
            priority: "high",
            userId,
          },
          apiKey,
        ),
      ),
    );
    expect(created.result.isError).toBeFalsy();
    const appointment = payload<{
      id: string;
      title: string;
      priority: string;
      startDate: string;
      assigneeName: string | null;
    }>(created);
    expect(appointment.title).toBe("Design review");
    expect(appointment.priority).toBe("high");
    expect(appointment.startDate).toBe("2026-09-20T09:00:00.000Z");
    expect(appointment.assigneeName).toBe("Integration Test User");

    // A partial update must merge: the API replaces the whole record, so the
    // description, dates, priority and assignee have to survive a title-only
    // patch.
    const updated = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest(
          "update_appointment",
          { appointmentId: appointment.id, title: "Design review (final)" },
          apiKey,
          2,
        ),
      ),
    );
    expect(updated.result.isError).toBeFalsy();
    const updatedAppointment = payload<{
      title: string;
      description: string;
      priority: string;
      startDate: string;
      dueDate: string;
      userId: string;
    }>(updated);
    expect(updatedAppointment).toMatchObject({
      title: "Design review (final)",
      description: "Walk through the weekly grid",
      priority: "high",
      startDate: "2026-09-20T09:00:00.000Z",
      dueDate: "2026-09-20T10:00:00.000Z",
      userId,
    });

    const listed = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest("list_appointments", { projectId }, apiKey, 3),
      ),
    );
    expect(payload<Array<{ id: string }>>(listed).map((row) => row.id)).toEqual(
      [appointment.id],
    );

    const [persisted] = await db
      .select({ title: schema.appointmentTable.title })
      .from(schema.appointmentTable)
      .where(eq(schema.appointmentTable.id, appointment.id));
    expect(persisted?.title).toBe("Design review (final)");

    const deleted = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest(
          "delete_appointment",
          { appointmentId: appointment.id },
          apiKey,
          4,
        ),
      ),
    );
    expect(deleted.result.isError).toBeFalsy();
    const [removed] = await db
      .select({ id: schema.appointmentTable.id })
      .from(schema.appointmentTable)
      .where(eq(schema.appointmentTable.id, appointment.id));
    expect(removed).toBeUndefined();
  });

  it("rejects a local date without timezone before reaching the API", async () => {
    const result = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest(
          "create_appointment",
          {
            projectId,
            title: "No timezone",
            startDate: "2026-09-20T09:00:00",
          },
          apiKey,
        ),
      ),
    );

    expect(result.result.isError).toBe(true);
    expect(result.result.content[0].text).toContain("timezone");
  });

  it("moves a backlog task to appointments and refuses a board task", async () => {
    const [plannedTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId,
        title: "Kickoff call",
        status: "planned",
        columnId: null,
        priority: "high",
        number: 1,
        position: 1,
        startDate: new Date("2026-09-20T08:00:00.000Z"),
      })
      .returning();

    const [boardTask] = await db
      .insert(schema.taskTable)
      .values({
        projectId,
        title: "Board task",
        status: "to-do",
        columnId: columns.todo.id,
        priority: "low",
        number: 2,
        position: 1,
      })
      .returning();

    const moved = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest(
          "move_task_to_appointments",
          { taskId: plannedTask.id },
          apiKey,
        ),
      ),
    );
    expect(moved.result.isError).toBeFalsy();
    expect(payload<{ title: string; startDate: string }>(moved)).toMatchObject({
      title: "Kickoff call",
      startDate: "2026-09-20T08:00:00.000Z",
    });

    const [taskRow] = await db
      .select({ id: schema.taskTable.id })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, plannedTask.id));
    expect(taskRow).toBeUndefined();

    const rejected = await toolResult(
      await app.request(
        "/api/mcp",
        toolCallRequest(
          "move_task_to_appointments",
          { taskId: boardTask.id },
          apiKey,
          2,
        ),
      ),
    );
    expect(rejected.result.isError).toBe(true);
    expect(rejected.result.content[0].text).toContain("backlog");
  });
});
