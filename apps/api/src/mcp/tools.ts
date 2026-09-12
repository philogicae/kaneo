import { z } from "zod";

type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/** Minimal tool-registration contract shared by legacy and modern MCP servers. */
export type McpToolRegistrar = {
  registerTool(
    name: string,
    config: {
      description: string;
      inputSchema: z.ZodObject;
    },
    callback: (args: unknown) => Promise<McpToolResult>,
  ): unknown;
};

type ShapeToolServer = {
  registerTool(
    name: string,
    config: { description: string; inputSchema: z.ZodRawShape },
    callback: (args: unknown) => Promise<McpToolResult>,
  ): unknown;
};

export function toMcpToolRegistrar(server: ShapeToolServer): McpToolRegistrar {
  return {
    registerTool: (name, config, callback) =>
      server.registerTool(
        name,
        {
          description: config.description,
          inputSchema: config.inputSchema.shape,
        },
        (args) => callback(args),
      ),
  };
}

class ApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  async json<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...init,
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!res.ok) {
      const detail =
        typeof body === "object" && body !== null && "message" in body
          ? (body as { message: string }).message
          : typeof body === "string" && body.length > 0
            ? body.slice(0, 500)
            : `HTTP ${res.status}`;
      throw new Error(`${path}: ${detail}`);
    }
    return body as T;
  }
}

function textResult(data: unknown, isError = false): McpToolResult {
  const text =
    typeof data === "string" ? data : (JSON.stringify(data, null, 2) ?? "");
  return { content: [{ type: "text", text }], isError };
}

function errorResult(message: string): McpToolResult {
  return textResult({ error: message }, true);
}

function run(fn: () => Promise<unknown>): Promise<McpToolResult> {
  return fn()
    .then((data) => textResult(data))
    .catch((e: unknown) =>
      errorResult(e instanceof Error ? e.message : String(e)),
    );
}

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

function isTaskPriority(v: string): v is (typeof PRIORITIES)[number] {
  return (PRIORITIES as readonly string[]).includes(v);
}

function formatOptionalIso(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return undefined;
}

function buildFullTaskUpdateBody(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, string | number | undefined> {
  const positionRaw = patch.position ?? existing.position;
  const position =
    typeof positionRaw === "number"
      ? positionRaw
      : typeof positionRaw === "string"
        ? Number(positionRaw)
        : Number.NaN;
  if (!Number.isFinite(position))
    throw new Error(
      "Cannot update task: missing numeric `position` on existing task.",
    );

  const title =
    (patch.title as string) ??
    (typeof existing.title === "string" ? existing.title : undefined);
  if (!title) throw new Error("Cannot update task: missing title.");

  const description =
    patch.description !== undefined
      ? patch.description === null
        ? ""
        : String(patch.description)
      : existing.description == null
        ? ""
        : String(existing.description);

  const status =
    (patch.status as string) ??
    (typeof existing.status === "string" ? existing.status : undefined);
  if (!status) throw new Error("Cannot update task: missing status.");

  const priorityRaw =
    (patch.priority as string) ??
    (typeof existing.priority === "string" ? existing.priority : undefined);
  if (!priorityRaw || !isTaskPriority(priorityRaw))
    throw new Error("Cannot update task: invalid or missing priority.");

  const projectId =
    (patch.projectId as string) ??
    (typeof existing.projectId === "string" ? existing.projectId : undefined);
  if (!projectId) throw new Error("Cannot update task: missing projectId.");

  const userId =
    patch.userId !== undefined
      ? patch.userId === null
        ? ""
        : (patch.userId as string)
      : typeof existing.userId === "string"
        ? existing.userId
        : undefined;

  const startDate = formatOptionalIso(
    patch.startDate !== undefined ? patch.startDate : existing.startDate,
  );
  const dueDate = formatOptionalIso(
    patch.dueDate !== undefined ? patch.dueDate : existing.dueDate,
  );

  const body: Record<string, string | number | undefined> = {
    title,
    description,
    status,
    priority: priorityRaw,
    projectId,
    position,
  };
  if (startDate !== undefined) body.startDate = startDate;
  if (dueDate !== undefined) body.dueDate = dueDate;
  if (userId !== undefined) body.userId = userId;
  return body;
}

const prioritySchema = z.enum([
  "no-priority",
  "low",
  "medium",
  "high",
  "urgent",
]);
const nonEmptyString = z.string().trim().min(1);
const optionalNonEmptyString = nonEmptyString.optional();
const nullableOptionalNonEmptyString = nonEmptyString.nullable().optional();
const isoDateTimeSchema = z.string().datetime({ offset: true });
const optionalIsoDateTimeSchema = isoDateTimeSchema.optional();
const nullableOptionalIsoDateTimeSchema = isoDateTimeSchema
  .nullable()
  .optional();
const hexColorSchema = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "Expected a hex color like #FF6600",
  );

// Label colors must match the web palette in apps/web/src/constants/label-colors.ts.
export const LABEL_COLOR_SLUGS = [
  "gray",
  "dark-gray",
  "purple",
  "teal",
  "green",
  "yellow",
  "orange",
  "pink",
  "red",
  "sky",
  "blue",
  "cyan",
  "indigo",
  "fuchsia",
  "lime",
  "emerald",
] as const;

const labelColorSchema = z
  .string()
  .refine(
    (value) =>
      hexColorSchema.safeParse(value).success ||
      (LABEL_COLOR_SLUGS as readonly string[]).includes(value),
    `Expected a hex color like #FF6600 or a semantic name (${LABEL_COLOR_SLUGS.join(", ")})`,
  );

/** Register Kaneo's authenticated tool catalog on an MCP server adapter. */
export function registerMcpTools(
  server: McpToolRegistrar,
  baseUrl: string,
  token: string,
): void {
  const client = new ApiClient(baseUrl, token);
  // Public web origin for user-facing links, not the internal API baseUrl.
  const publicUrl = () =>
    (process.env.KANEO_CLIENT_URL || "http://localhost:5173").replace(
      /\/+$/,
      "",
    );
  const registerTool = <InputSchema extends z.ZodObject>(
    name: string,
    config: { description: string; inputSchema: InputSchema },
    callback: (args: z.output<InputSchema>) => Promise<McpToolResult>,
  ) =>
    server.registerTool(name, config, async (args) => {
      const parsed = config.inputSchema.safeParse(args);
      if (!parsed.success) {
        return errorResult(z.prettifyError(parsed.error));
      }
      return callback(parsed.data);
    });

  registerTool(
    "whoami",
    {
      description: "Return the current Kaneo session and user.",
      inputSchema: z.object({}),
    },
    async () =>
      run(() => client.json("/api/auth/get-session", { method: "GET" })),
  );

  registerTool(
    "list_workspaces",
    {
      description: "List workspaces the signed-in user can access.",
      inputSchema: z.object({}),
    },
    async () =>
      run(() => client.json("/api/auth/organization/list", { method: "GET" })),
  );

  registerTool(
    "list_projects",
    {
      description: "List projects in a workspace.",
      inputSchema: z.object({
        workspaceId: nonEmptyString.describe("Workspace ID"),
        includeArchived: z
          .boolean()
          .optional()
          .describe("Include archived projects"),
      }),
    },
    async (args) => {
      const qs = new URLSearchParams({ workspaceId: args.workspaceId });
      if (args.includeArchived === true) qs.set("includeArchived", "true");
      return run(() =>
        client.json(`/api/project?${qs.toString()}`, { method: "GET" }),
      );
    },
  );

  registerTool(
    "get_project",
    {
      description:
        "Get a single project by its projectId, including its columns and metadata.",
      inputSchema: z.object({
        projectId: nonEmptyString.describe("Project id (from list_projects)"),
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/project/${encodeURIComponent(args.projectId)}`),
      ),
  );

  registerTool(
    "create_project",
    {
      description: "Create a project in a workspace.",
      inputSchema: z.object({
        name: nonEmptyString,
        workspaceId: nonEmptyString,
        icon: nonEmptyString,
        slug: nonEmptyString,
        description: z.string().optional(),
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/project", {
          method: "POST",
          body: JSON.stringify({
            name: args.name,
            workspaceId: args.workspaceId,
            icon: args.icon,
            slug: args.slug,
            description: args.description,
          }),
        }),
      ),
  );

  registerTool(
    "update_project",
    {
      description:
        "Update project metadata (PATCH-style: only provided fields are changed).",
      inputSchema: z.object({
        projectId: nonEmptyString.describe("Project id (from list_projects)"),
        name: optionalNonEmptyString,
        icon: z.string().optional(),
        slug: optionalNonEmptyString,
        description: z.string().optional(),
        isPublic: z.boolean().optional(),
      }),
    },
    async (args) => {
      const { projectId, ...patch } = args;
      return run(async () => {
        const existing = (await client.json(
          `/api/project/${encodeURIComponent(projectId)}`,
          { method: "GET" },
        )) as Record<string, unknown>;
        const name =
          patch.name ??
          (typeof existing.name === "string" ? existing.name : "");
        if (!name) throw new Error("Cannot update project: missing name.");
        const icon =
          patch.icon !== undefined
            ? patch.icon
            : typeof existing.icon === "string"
              ? existing.icon
              : "Layout";
        const slug =
          patch.slug ??
          (typeof existing.slug === "string" ? existing.slug : "");
        if (!slug) throw new Error("Cannot update project: missing slug.");
        const description =
          patch.description !== undefined
            ? patch.description
            : typeof existing.description === "string"
              ? existing.description
              : "";
        const isPublic =
          patch.isPublic !== undefined
            ? patch.isPublic
            : typeof existing.isPublic === "boolean"
              ? existing.isPublic
              : false;
        return client.json(`/api/project/${encodeURIComponent(projectId)}`, {
          method: "PUT",
          body: JSON.stringify({ name, icon, slug, description, isPublic }),
        });
      });
    },
  );

  registerTool(
    "list_tasks",
    {
      description: "List tasks for a project (optionally filtered/sorted).",
      inputSchema: z.object({
        projectId: nonEmptyString,
        status: optionalNonEmptyString,
        priority: prioritySchema.optional(),
        assigneeId: optionalNonEmptyString,
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().optional(),
        sortBy: z
          .enum([
            "createdAt",
            "priority",
            "dueDate",
            "position",
            "title",
            "number",
          ])
          .optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        dueBefore: optionalIsoDateTimeSchema,
        dueAfter: optionalIsoDateTimeSchema,
      }),
    },
    async (args) => {
      const { projectId, ...rest } = args;
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
      const q = qs.toString();
      return run(() =>
        client.json(
          `/api/task/tasks/${encodeURIComponent(projectId)}${q ? `?${q}` : ""}`,
          { method: "GET" },
        ),
      );
    },
  );

  registerTool(
    "get_task",
    {
      description: "Get a task by ID.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/${encodeURIComponent(args.taskId)}`, {
          method: "GET",
        }),
      ),
  );

  registerTool(
    "create_task",
    {
      description: "Create a task in a project.",
      inputSchema: z.object({
        projectId: nonEmptyString,
        title: nonEmptyString,
        description: z.string(),
        priority: prioritySchema,
        status: nonEmptyString,
        startDate: optionalIsoDateTimeSchema,
        dueDate: optionalIsoDateTimeSchema,
        userId: optionalNonEmptyString,
      }),
    },
    async (args) => {
      const body: Record<string, string | undefined> = {
        title: args.title,
        description: args.description,
        priority: args.priority,
        status: args.status,
      };
      if (args.startDate !== undefined) body.startDate = args.startDate;
      if (args.dueDate !== undefined) body.dueDate = args.dueDate;
      if (args.userId !== undefined) body.userId = args.userId;
      return run(() =>
        client.json(`/api/task/${encodeURIComponent(args.projectId)}`, {
          method: "POST",
          body: JSON.stringify(body),
        }),
      );
    },
  );

  registerTool(
    "update_task",
    {
      description:
        "Update a task (fetches current task, merges fields, then full update).",
      inputSchema: z.object({
        taskId: nonEmptyString,
        title: optionalNonEmptyString,
        description: z.string().nullable().optional(),
        status: optionalNonEmptyString,
        priority: prioritySchema.optional(),
        projectId: optionalNonEmptyString,
        position: z.number().optional(),
        startDate: nullableOptionalIsoDateTimeSchema,
        dueDate: nullableOptionalIsoDateTimeSchema,
        userId: nullableOptionalNonEmptyString,
      }),
    },
    async (args) => {
      const { taskId, ...patch } = args;
      return run(async () => {
        const existing = (await client.json(
          `/api/task/${encodeURIComponent(taskId)}`,
          { method: "GET" },
        )) as Record<string, unknown>;
        const body = buildFullTaskUpdateBody(existing, patch);
        return client.json(`/api/task/${encodeURIComponent(taskId)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      });
    },
  );

  registerTool(
    "move_task",
    {
      description:
        "Move a task to another project (and optional column status).",
      inputSchema: z.object({
        taskId: nonEmptyString,
        destinationProjectId: nonEmptyString,
        destinationStatus: optionalNonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/move/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify({
            destinationProjectId: args.destinationProjectId,
            ...(args.destinationStatus !== undefined
              ? { destinationStatus: args.destinationStatus }
              : {}),
          }),
        }),
      ),
  );

  registerTool(
    "update_task_status",
    {
      description: "Update only the status (column) of a task.",
      inputSchema: z.object({ taskId: nonEmptyString, status: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/status/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify({ status: args.status }),
        }),
      ),
  );

  registerTool(
    "list_task_comments",
    {
      description: "List comments on a task.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.taskId)}`, {
          method: "GET",
        }),
      ),
  );

  registerTool(
    "create_task_comment",
    {
      description: "Add a comment to a task.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        content: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.taskId)}`, {
          method: "POST",
          body: JSON.stringify({ content: args.content }),
        }),
      ),
  );

  registerTool(
    "update_task_comment",
    {
      description: "Update one of your comments on a task.",
      inputSchema: z.object({
        commentId: nonEmptyString,
        content: nonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.commentId)}`, {
          method: "PUT",
          body: JSON.stringify({ content: args.content }),
        }),
      ),
  );

  registerTool(
    "delete_task_comment",
    {
      description: "Delete one of your comments from a task.",
      inputSchema: z.object({ commentId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/comment/${encodeURIComponent(args.commentId)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "list_workspace_labels",
    {
      description:
        "List labels defined in a workspace. The response mixes workspace-level labels (taskId null) with task-level copies attached to tasks; prefer taskId null entries for attach_label_to_task.",
      inputSchema: z.object({ workspaceId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/label/workspace/${encodeURIComponent(args.workspaceId)}`,
          { method: "GET" },
        ),
      ),
  );

  registerTool(
    "create_label",
    {
      description:
        "Create a label in a workspace (optionally attach to a task). color accepts a hex code (#4A5568) or a semantic palette name (dark-gray, purple, teal, green, orange, sky, yellow, pink, red, blue, cyan, indigo, fuchsia, lime, emerald, gray).",
      inputSchema: z.object({
        name: nonEmptyString,
        color: labelColorSchema,
        workspaceId: nonEmptyString,
        taskId: optionalNonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/label", {
          method: "POST",
          body: JSON.stringify({
            name: args.name,
            color: args.color,
            workspaceId: args.workspaceId,
            ...(args.taskId !== undefined ? { taskId: args.taskId } : {}),
          }),
        }),
      ),
  );

  registerTool(
    "attach_label_to_task",
    {
      description:
        "Attach an existing workspace-level label to a task (the API copies it onto the task). Attaching a label that is already attached to another task is refused: the API would move it, silently detaching it from that task.",
      inputSchema: z.object({
        labelId: nonEmptyString,
        taskId: nonEmptyString,
      }),
    },
    async (args) =>
      run(async () => {
        // The API moves a task-level label to the target task (deleting it
        // from its current one); refuse that so attaching stays
        // non-destructive when a task-level copy is passed by mistake.
        const label = (await client.json(
          `/api/label/${encodeURIComponent(args.labelId)}`,
          { method: "GET" },
        )) as { taskId?: string | null };
        if (label?.taskId && label.taskId !== args.taskId) {
          throw new Error(
            `Label is already attached to task ${label.taskId}; attaching it to another task would move it (detach it first, or use its workspace-level label).`,
          );
        }
        return client.json(
          `/api/label/${encodeURIComponent(args.labelId)}/task`,
          {
            method: "PUT",
            body: JSON.stringify({ taskId: args.taskId }),
          },
        );
      }),
  );

  registerTool(
    "detach_label_from_task",
    {
      description: "Detach a label from its current task.",
      inputSchema: z.object({ labelId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/label/${encodeURIComponent(args.labelId)}/task`, {
          method: "DELETE",
        }),
      ),
  );

  // Forum topic id schema: optional everywhere, null clears it. Positive
  // chat ids (private chats) are rejected for topics in the shared helpers below.
  const nullableThreadIdSchema = z.number().int().min(1).nullable().optional();

  type TelegramConfigShape = {
    bots: Array<{
      id: string;
      name: string | null;
      events: Record<string, boolean>;
      chats: Array<{
        id: string;
        chatId: string;
        label: string | null;
        rules: Array<{
          id: string;
          workspaceId: string;
          workspaceName: string | null;
          projectId: string | null;
          projectName: string | null;
          threadId: number | null;
          isActive: boolean;
        }>;
      }>;
    }>;
  };

  const getTelegramConfig = () =>
    client.json<TelegramConfigShape>("/api/telegram-config", {
      method: "GET",
    });

  const findBotOrFail = (
    args: { botId: string },
    config: TelegramConfigShape,
  ) => {
    const bot = config.bots.find((b) => b.id === args.botId);
    if (!bot) {
      const known = config.bots
        .map((b) => `${b.id}${b.name ? ` (${b.name})` : ""}`)
        .join(", ");
      throw new Error(
        `unknown_bot: bot ${args.botId} not found.${known ? ` Available bots: ${known}` : " No bots are configured yet."}`,
      );
    }
    return bot;
  };

  const assertTopicAllowed = (threadId: unknown, chatId: string) => {
    // Only numeric chat ids can be classified reliably: positive = private chat.
    if (threadId == null || chatId.startsWith("@")) return;
    const numeric = Number(chatId);
    if (!Number.isNaN(numeric) && numeric > 0) {
      throw new Error(
        `topic_not_allowed_on_dm: chat ${chatId} is a private chat (positive id); a forum topic id is only valid on a forum group (negative id). Omit threadId for DMs.`,
      );
    }
  };

  /** Shared create-rule flow for telegram_create_rule and the deprecated alias. */
  const telegramCreateRule = async (args: {
    botId: string;
    telegramChatId?: string | null;
    label?: string | null;
    workspaceId: string;
    projectId?: string | null;
    threadId?: number | null;
    isActive?: boolean;
  }) => {
    const bot = findBotOrFail({ botId: args.botId }, await getTelegramConfig());
    const wanted = args.telegramChatId ?? "";
    let chatRecord = bot.chats.find((c) => wanted && c.chatId === wanted);
    assertTopicAllowed(args.threadId, chatRecord?.chatId ?? wanted);
    if (!chatRecord) {
      if (!wanted) {
        throw new Error(
          "telegramChatId is required when the chat does not already exist on the bot",
        );
      }
      chatRecord = (await client.json(
        `/api/telegram-config/bot/${encodeURIComponent(args.botId)}/chat`,
        {
          method: "POST",
          body: JSON.stringify({
            chatId: wanted,
            label: args.label ?? wanted,
          }),
        },
      )) as TelegramConfigShape["bots"][number]["chats"][number];
    }

    if (!args.workspaceId) {
      return {
        created: false,
        chat: chatRecord,
        note: "Chat linked to the bot. Pass workspaceId to route notifications.",
      };
    }

    const existing = chatRecord.rules.find(
      (r) =>
        r.workspaceId === args.workspaceId &&
        (r.projectId ?? null) === (args.projectId ?? null),
    );
    if (existing) {
      return { created: false, rule: existing };
    }

    const [rule] = (await client.json(
      `/api/telegram-config/telegram-chat/${encodeURIComponent(chatRecord.id)}/rules`,
      {
        method: "POST",
        body: JSON.stringify({
          scopes: [
            {
              workspaceId: args.workspaceId,
              projectIds: args.projectId ? [args.projectId] : null,
            },
          ],
          threadId: args.threadId ?? null,
        }),
      },
    )) as Array<{
      id: string;
      workspaceId: string;
      workspaceName: string | null;
      projectId: string | null;
      projectName: string | null;
      threadId: number | null;
      isActive: boolean;
    }>;

    if (rule && args.isActive === false) {
      const [updated] = (await client.json(
        `/api/telegram-config/telegram-rule/${encodeURIComponent(rule.id)}`,
        { method: "PATCH", body: JSON.stringify({ isActive: false }) },
      )) as Array<{ id: string; isActive: boolean }>;
      return { created: true, rule: updated ?? rule };
    }
    return { created: true, rule };
  };

  registerTool(
    "telegram_list_bots",
    {
      description:
        "List the Telegram bots configured on the account, with their id, name and event filter. Call this first to get a botId for the chat/rule tools.",
      inputSchema: z.object({}),
    },
    async () =>
      run(async () => {
        const { bots } = await client.json<TelegramConfigShape>(
          "/api/telegram-config",
          { method: "GET" },
        );
        return bots.map((b) => ({
          id: b.id,
          name: b.name,
          events: b.events,
        }));
      }),
  );

  registerTool(
    "telegram_list_config",
    {
      description:
        "Show the full Telegram notification tree: each bot, its linked chats (telegramChatId, label, isGroup) and their routing rules (workspace/project scope, threadId, isActive). Read-only; use it to inspect routing before changing it.",
      inputSchema: z.object({
        botId: optionalNonEmptyString.describe(
          "Only include this stored bot (omit for every bot)",
        ),
      }),
    },
    async (args) =>
      run(async () => {
        const { bots } = await client.json<TelegramConfigShape>(
          "/api/telegram-config",
          { method: "GET" },
        );
        const filtered = args.botId
          ? bots.filter((b) => b.id === args.botId)
          : bots;
        if (args.botId && filtered.length === 0) {
          findBotOrFail({ botId: args.botId }, { bots });
        }
        return {
          bots: filtered.map((b) => ({
            id: b.id,
            name: b.name,
            chats: b.chats.map((c) => ({
              id: c.id,
              telegramChatId: c.chatId,
              label: c.label,
              isGroup: c.chatId.startsWith("-"),
              rules: c.rules,
            })),
          })),
        };
      }),
  );

  registerTool(
    "telegram_list_chats",
    {
      description:
        "List the chats linked to one bot: internal record id, telegramChatId, label and isGroup. The internal `id` is the telegramChatRecordId the other tools expect.",
      inputSchema: z.object({
        botId: nonEmptyString.describe(
          "Stored bot whose chats to list (from telegram_list_bots)",
        ),
      }),
    },
    async (args) =>
      run(async () => {
        const { bots } = await client.json<TelegramConfigShape>(
          "/api/telegram-config",
          { method: "GET" },
        );
        const bot = findBotOrFail(args, { bots });
        return bot.chats.map((c) => ({
          id: c.id,
          telegramChatId: c.chatId,
          label: c.label,
          isGroup: c.chatId.startsWith("-"),
        }));
      }),
  );

  registerTool(
    "telegram_list_rules",
    {
      description:
        "List Telegram routing rules, optionally filtered. Each row carries botId, chatId (internal record), telegramChatId and the rule scope (workspace/project, threadId, isActive).",
      inputSchema: z.object({
        botId: optionalNonEmptyString.describe("Only rules of this stored bot"),
        telegramChatRecordId: optionalNonEmptyString.describe(
          "Only rules of this internal chat record (from telegram_list_chats)",
        ),
        workspaceId: optionalNonEmptyString.describe(
          "Only rules routing this workspace",
        ),
        projectId: optionalNonEmptyString.describe(
          "Only rules routing this project",
        ),
      }),
    },
    async (args) =>
      run(async () => {
        const { bots } = await client.json<TelegramConfigShape>(
          "/api/telegram-config",
          { method: "GET" },
        );
        if (args.botId && !bots.some((b) => b.id === args.botId)) {
          findBotOrFail({ botId: args.botId }, { bots });
        }
        return bots.flatMap((b) =>
          b.chats.flatMap((c) =>
            c.rules
              .filter(
                (r) =>
                  (args.botId == null || b.id === args.botId) &&
                  (args.telegramChatRecordId == null ||
                    c.id === args.telegramChatRecordId) &&
                  (args.workspaceId == null ||
                    r.workspaceId === args.workspaceId) &&
                  (args.projectId == null || r.projectId === args.projectId),
              )
              .map((r) => ({ botId: b.id, chatId: c.id, ...r })),
          ),
        );
      }),
  );

  registerTool(
    "telegram_get_rule",
    {
      description:
        "Get one routing rule by its ruleId, with its bot, internal chatId, telegramChatId and scope.",
      inputSchema: z.object({
        ruleId: nonEmptyString.describe(
          "Rule id from telegram_list_rules or telegram_create_rule",
        ),
      }),
    },
    async (args) =>
      run(async () => {
        const { bots } = await client.json<TelegramConfigShape>(
          "/api/telegram-config",
          { method: "GET" },
        );
        for (const bot of bots) {
          for (const chat of bot.chats) {
            const rule = chat.rules.find((r) => r.id === args.ruleId);
            if (rule) {
              return {
                botId: bot.id,
                chatId: chat.id,
                telegramChatId: chat.chatId,
                ...rule,
              };
            }
          }
        }
        throw new Error(`unknown_rule: rule ${args.ruleId} not found`);
      }),
  );

  registerTool(
    "telegram_create_bot",
    {
      description:
        "Register a Telegram bot by its @BotFather token. The token shape is checked locally only, not against Telegram. Add routing afterwards with telegram_create_rule.",
      inputSchema: z.object({
        botToken: nonEmptyString.describe(
          "Bot token from @BotFather, e.g. 123456789:AA...",
        ),
        name: optionalNonEmptyString.describe("Optional display name"),
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/telegram-config/bot", {
          method: "POST",
          body: JSON.stringify({
            botToken: args.botToken,
            ...(args.name ? { name: args.name } : {}),
          }),
        }),
      ),
  );

  registerTool(
    "telegram_update_bot",
    {
      description:
        "Update a stored bot: rename it, rotate its token, or change which task events it sends. Omitted fields keep their current value.",
      inputSchema: z.object({
        botId: nonEmptyString.describe(
          "Stored bot id (from telegram_list_bots)",
        ),
        name: nullableOptionalNonEmptyString.describe(
          "New display name; null clears it",
        ),
        botToken: optionalNonEmptyString.describe(
          "Replacement @BotFather token (rotates the stored one)",
        ),
        events: z
          .object({
            taskCreated: z.boolean().optional(),
            taskStatusChanged: z.boolean().optional(),
            taskPriorityChanged: z.boolean().optional(),
            taskTitleChanged: z.boolean().optional(),
            taskDescriptionChanged: z.boolean().optional(),
            taskCommentCreated: z.boolean().optional(),
          })
          .optional(),
      }),
    },
    async (args) => {
      const body = Object.fromEntries(
        Object.entries({
          name: args.name,
          botToken: args.botToken,
          events: args.events,
        }).filter(([, v]) => v !== undefined),
      );
      return run(() =>
        client.json(
          `/api/telegram-config/bot/${encodeURIComponent(args.botId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        ),
      );
    },
  );

  registerTool(
    "telegram_delete_bot",
    {
      description:
        "Delete a stored bot and cascade to all its chats and routing rules. Irreversible; check telegram_list_config first.",
      inputSchema: z.object({
        botId: nonEmptyString.describe(
          "Stored bot id (from telegram_list_bots)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/telegram-config/bot/${encodeURIComponent(args.botId)}`,
          {
            method: "DELETE",
          },
        ),
      ),
  );

  registerTool(
    "telegram_create_chat",
    {
      description:
        "Link a Telegram chat/group/channel to a bot. The label is the display name in workspace settings and defaults to the raw chat id. Linking alone sends nothing; use telegram_create_rule to route notifications.",
      inputSchema: z.object({
        botId: nonEmptyString.describe(
          "Stored bot to attach the chat to (from telegram_list_bots)",
        ),
        telegramChatId: nonEmptyString.describe(
          "Telegram chat id (negative, e.g. -1001234567890) or @username for a channel",
        ),
        label: optionalNonEmptyString.describe(
          "Display label for the chat (defaults to the chat id)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/telegram-config/bot/${encodeURIComponent(args.botId)}/chat`,
          {
            method: "POST",
            body: JSON.stringify({
              chatId: args.telegramChatId,
              ...(args.label ? { label: args.label } : {}),
            }),
          },
        ),
      ),
  );

  registerTool(
    "telegram_update_chat",
    {
      description:
        "Update a linked chat's display label or its Telegram chat id. Identify the record by its internal telegramChatRecordId.",
      inputSchema: z.object({
        telegramChatRecordId: nonEmptyString.describe(
          "Internal chat record id (from telegram_list_chats)",
        ),
        telegramChatId: optionalNonEmptyString.describe(
          "Replacement Telegram chat id",
        ),
        label: nullableOptionalNonEmptyString.describe(
          "New display label; null clears it",
        ),
      }),
    },
    async (args) => {
      const body = Object.fromEntries(
        Object.entries({
          chatId: args.telegramChatId,
          label: args.label,
        }).filter(([, v]) => v !== undefined),
      );
      return run(() =>
        client.json(
          `/api/telegram-config/telegram-chat/${encodeURIComponent(args.telegramChatRecordId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        ),
      );
    },
  );

  registerTool(
    "telegram_delete_chat",
    {
      description:
        "Delete a linked chat record and cascade to all its routing rules. Irreversible.",
      inputSchema: z.object({
        telegramChatRecordId: nonEmptyString.describe(
          "Internal chat record id (from telegram_list_chats)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/telegram-config/telegram-chat/${encodeURIComponent(args.telegramChatRecordId)}`,
          { method: "DELETE" },
        ),
      ),
  );

  registerTool(
    "telegram_create_rule",
    {
      description:
        "Route a bot's task notifications into a chat, for a whole workspace or a single project. Links the chat first when telegramChatId is new. A duplicate rule returns the existing one with created: false. Use threadId only for a forum topic (negative chat id); omit or null for DMs and plain groups.",
      inputSchema: z.object({
        botId: nonEmptyString.describe(
          "Stored bot id (from telegram_list_bots)",
        ),
        telegramChatId: optionalNonEmptyString.describe(
          "Telegram chat id; required only when the chat is not linked to the bot yet",
        ),
        label: optionalNonEmptyString.describe(
          "Label for the chat if it gets linked now (defaults to the chat id)",
        ),
        workspaceId: nonEmptyString.describe(
          "Workspace whose notifications route to the chat",
        ),
        projectId: nullableOptionalNonEmptyString.describe(
          "Limit routing to this project; omit or null for the whole workspace",
        ),
        threadId: nullableThreadIdSchema.describe(
          "Forum topic id (forum groups only); omit or null for no topic",
        ),
        isActive: z
          .boolean()
          .optional()
          .describe("Whether the new rule is active (default true)"),
      }),
    },
    async (args) => run(() => telegramCreateRule(args)),
  );

  registerTool(
    "telegram_update_rule",
    {
      description:
        "Update a routing rule. projectIds replaces the project scope (null routes the whole workspace), threadId null clears the forum topic, isActive toggles it. Only provided fields change.",
      inputSchema: z.object({
        ruleId: nonEmptyString.describe(
          "Rule id (from telegram_list_rules or telegram_get_rule)",
        ),
        projectIds: z
          .array(nonEmptyString)
          .nullable()
          .optional()
          .describe(
            "Replacement list of project ids; null routes every project of the workspace",
          ),
        threadId: nullableThreadIdSchema.describe(
          "Forum topic id; null clears it (forum groups only)",
        ),
        isActive: z.boolean().optional().describe("Enable or disable the rule"),
      }),
    },
    async (args) => {
      const body = Object.fromEntries(
        Object.entries({
          projectIds: args.projectIds,
          threadId: args.threadId,
          isActive: args.isActive,
        }).filter(([, v]) => v !== undefined),
      );
      return run(() =>
        client.json(
          `/api/telegram-config/telegram-rule/${encodeURIComponent(args.ruleId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        ),
      );
    },
  );

  registerTool(
    "telegram_delete_rule",
    {
      description:
        "Delete a routing rule, stopping its notifications. The linked chat is kept; delete it separately with telegram_delete_chat.",
      inputSchema: z.object({
        ruleId: nonEmptyString.describe("Rule id (from telegram_list_rules)"),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/telegram-config/telegram-rule/${encodeURIComponent(args.ruleId)}`,
          { method: "DELETE" },
        ),
      ),
  );

  registerTool(
    "telegram_configure_notifications",
    {
      description:
        "Deprecated alias of telegram_create_rule, kept for one release. Prefer telegram_create_rule, whose args are telegramChatId/label/threadId; this alias keeps the legacy chatId/chatLabel/topicId names.",
      inputSchema: z.object({
        botId: nonEmptyString.describe(
          "Stored bot id (from telegram_list_bots)",
        ),
        chatId: nonEmptyString.describe(
          "Deprecated name for telegramChatId (numeric or @username)",
        ),
        chatLabel: optionalNonEmptyString.describe("Deprecated name for label"),
        workspaceId: optionalNonEmptyString.describe(
          "Route the whole workspace (or the single projectId) into the chat",
        ),
        projectId: optionalNonEmptyString.describe(
          "Restrict routing to one project of workspaceId",
        ),
        topicId: nullableThreadIdSchema.describe(
          "Deprecated name for threadId (forum groups only)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        telegramCreateRule({
          botId: args.botId,
          telegramChatId: args.chatId,
          label: args.chatLabel,
          workspaceId: args.workspaceId ?? "",
          projectId: args.projectId,
          threadId: args.topicId ?? null,
        }),
      ),
  );

  registerTool(
    "create_task_relation",
    {
      description:
        "Create a relation between two tasks. relationType: 'subtask' (sourceTaskId is the parent, targetTaskId the child), 'blocks' (sourceTaskId blocks targetTaskId), or 'related' (bidirectional).",
      inputSchema: z.object({
        sourceTaskId: nonEmptyString,
        targetTaskId: nonEmptyString,
        relationType: z.enum(["subtask", "blocks", "related"]),
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/task-relation", {
          method: "POST",
          body: JSON.stringify({
            sourceTaskId: args.sourceTaskId,
            targetTaskId: args.targetTaskId,
            relationType: args.relationType,
          }),
        }),
      ),
  );

  registerTool(
    "get_task_relations",
    {
      description:
        "List all relations (subtask/blocks/related) involving a task.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task-relation/${encodeURIComponent(args.taskId)}`, {
          method: "GET",
        }),
      ),
  );

  registerTool(
    "delete_task_relation",
    {
      description: "Delete a task relation by its relationId.",
      inputSchema: z.object({
        relationId: nonEmptyString.describe(
          "Relation id (from get_task_relations)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/task-relation/${encodeURIComponent(args.relationId)}`,
          {
            method: "DELETE",
          },
        ),
      ),
  );

  registerTool(
    "delete_label",
    {
      description:
        "Delete a label by its labelId. Deleting a workspace-level label (taskId null) also deletes its task-level copies.",
      inputSchema: z.object({
        labelId: nonEmptyString.describe(
          "Label id (from list_workspace_labels)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/label/${encodeURIComponent(args.labelId)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "list_workspace_members",
    {
      description:
        "List the members of a workspace. Use this to resolve the user ID an assignee tool expects.",
      inputSchema: z.object({ workspaceId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/workspace/${encodeURIComponent(args.workspaceId)}/members`,
        ),
      ),
  );

  registerTool(
    "get_public_url",
    {
      description:
        "Return this Kaneo instance's public base URL (KANEO_CLIENT_URL). Use it to build user-facing links such as workspace invite links.",
      inputSchema: z.object({}),
    },
    async () => textResult({ url: publicUrl() }),
  );

  registerTool(
    "get_workspace_invite_link",
    {
      description:
        "Return a workspace's shareable invite link URL. Prefers the default link (no expiry, unlimited uses) and falls back to another usable link; errors when every link is expired or exhausted.",
      inputSchema: z.object({
        workspaceId: nonEmptyString.describe(
          "Workspace id (from list_workspaces)",
        ),
      }),
    },
    async (args) =>
      run(async () => {
        const links = await client.json<
          Array<{
            token: string;
            expiresAt: string | null;
            maxUses: number | null;
            usedCount: number;
          }>
        >(
          `/api/workspace-sharing?workspaceId=${encodeURIComponent(args.workspaceId)}`,
          { method: "GET" },
        );
        const usable = links.filter(
          (link) =>
            (link.expiresAt === null ||
              Date.parse(link.expiresAt) > Date.now()) &&
            (link.maxUses === null || link.usedCount < link.maxUses),
        );
        const link =
          usable.find(
            (candidate) =>
              candidate.expiresAt === null && candidate.maxUses === null,
          ) ?? usable[0];
        if (!link) {
          throw new Error(
            "No usable invite link for this workspace; create one from workspace settings first.",
          );
        }
        return {
          workspaceId: args.workspaceId,
          url: `${publicUrl()}/invitation/link/${link.token}`,
          token: link.token,
          expiresAt: link.expiresAt,
          maxUses: link.maxUses,
          usedCount: link.usedCount,
        };
      }),
  );

  registerTool(
    "search",
    {
      description:
        "Search across tasks, projects, workspaces, comments, and activities.",
      inputSchema: z.object({
        q: nonEmptyString.describe("Search query"),
        type: z
          .enum([
            "all",
            "tasks",
            "projects",
            "workspaces",
            "comments",
            "activities",
          ])
          .optional()
          .describe("Restrict results to one kind. Defaults to all."),
        workspaceId: optionalNonEmptyString.describe("Limit to one workspace"),
        projectId: optionalNonEmptyString.describe("Limit to one project"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum results, 1 to 50. Defaults to 20."),
      }),
    },
    async (args) => {
      const qs = new URLSearchParams({ q: args.q });
      if (args.type) qs.set("type", args.type);
      if (args.workspaceId) qs.set("workspaceId", args.workspaceId);
      if (args.projectId) qs.set("projectId", args.projectId);
      if (args.limit !== undefined) qs.set("limit", String(args.limit));
      return run(() => client.json(`/api/search?${qs.toString()}`));
    },
  );

  registerTool(
    "list_project_columns",
    {
      description:
        "List a project's columns. Their slugs are the values update_task_status and create_task accept as a status.",
      inputSchema: z.object({ projectId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/column/${encodeURIComponent(args.projectId)}`),
      ),
  );

  registerTool(
    "create_column",
    {
      description:
        "Create a board/backlog column in a project. The slug is derived from the name.",
      inputSchema: z.object({
        projectId: nonEmptyString,
        name: nonEmptyString,
        icon: optionalNonEmptyString,
        color: hexColorSchema.optional(),
        isFinal: z.boolean().optional(),
      }),
    },
    async (args) =>
      run(() => {
        const body: Record<string, unknown> = { name: args.name };
        if (args.icon !== undefined) body.icon = args.icon;
        if (args.color !== undefined) body.color = args.color;
        if (args.isFinal !== undefined) body.isFinal = args.isFinal;
        return client.json(
          `/api/column/${encodeURIComponent(args.projectId)}`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
      }),
  );

  registerTool(
    "update_column",
    {
      description:
        "Rename or restyle a column. Omit icon/color to keep them; pass null to clear.",
      inputSchema: z.object({
        columnId: nonEmptyString,
        name: optionalNonEmptyString,
        icon: nullableOptionalNonEmptyString,
        color: hexColorSchema.nullable().optional(),
        isFinal: z.boolean().optional(),
      }),
    },
    async (args) =>
      run(() => {
        const body: Record<string, unknown> = {};
        if (args.name !== undefined) body.name = args.name;
        if (args.icon !== undefined) body.icon = args.icon;
        if (args.color !== undefined) body.color = args.color;
        if (args.isFinal !== undefined) body.isFinal = args.isFinal;
        return client.json(`/api/column/${encodeURIComponent(args.columnId)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      }),
  );

  registerTool(
    "reorder_columns",
    {
      description:
        "Set the order of a project's columns. Every column must be listed with its new position.",
      inputSchema: z.object({
        projectId: nonEmptyString,
        columns: z
          .array(
            z.object({
              id: nonEmptyString,
              position: z.number().int().nonnegative(),
            }),
          )
          .min(1),
      }),
    },
    async (args) =>
      run(() =>
        client.json(
          `/api/column/reorder/${encodeURIComponent(args.projectId)}`,
          {
            method: "PUT",
            body: JSON.stringify({ columns: args.columns }),
          },
        ),
      ),
  );

  registerTool(
    "delete_column",
    {
      description:
        "Delete a column. It must be empty — move or delete its tasks first.",
      inputSchema: z.object({ columnId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/column/${encodeURIComponent(args.columnId)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "bulk_update_tasks",
    {
      description:
        "Apply one operation to many tasks at once (backlog triage, bulk triage of a calendar or Gantt selection). All tasks must belong to the same workspace.",
      inputSchema: z.object({
        taskIds: z.array(nonEmptyString).min(1),
        operation: z.enum([
          "updateStatus",
          "updatePriority",
          "updateAssignee",
          "delete",
          "addLabel",
          "removeLabel",
          "updateDueDate",
        ]),
        value: z
          .string()
          .nullable()
          .optional()
          .describe(
            "New value for the operation. Unused by delete; null clears an assignee or due date.",
          ),
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/task/bulk", {
          method: "PATCH",
          body: JSON.stringify({
            taskIds: args.taskIds,
            operation: args.operation,
            ...(args.value !== undefined ? { value: args.value } : {}),
          }),
        }),
      ),
  );

  registerTool(
    "delete_task",
    {
      description: "Delete a task by ID.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/${encodeURIComponent(args.taskId)}`, {
          method: "DELETE",
        }),
      ),
  );

  registerTool(
    "update_task_assignee",
    {
      description:
        "Assign a task to a workspace member, or pass a null userId to unassign it.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        userId: nonEmptyString
          .nullable()
          .describe("Member user ID, or null to unassign"),
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/assignee/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify({ userId: args.userId }),
        }),
      ),
  );

  registerTool(
    "update_task_due_date",
    {
      description: "Set a task's due date. Omit dueDate to clear it.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        dueDate: optionalIsoDateTimeSchema,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/task/due-date/${encodeURIComponent(args.taskId)}`, {
          method: "PUT",
          body: JSON.stringify(
            args.dueDate === undefined ? {} : { dueDate: args.dueDate },
          ),
        }),
      ),
  );

  registerTool(
    "list_task_time_entries",
    {
      description: "List the time entries logged against a task.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/time-entry/task/${encodeURIComponent(args.taskId)}`),
      ),
  );

  registerTool(
    "get_time_entry",
    {
      description:
        "Get a single time entry by its timeEntryId (from list_task_time_entries).",
      inputSchema: z.object({
        timeEntryId: nonEmptyString.describe(
          "Time entry id (from list_task_time_entries)",
        ),
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/time-entry/${encodeURIComponent(args.timeEntryId)}`),
      ),
  );

  registerTool(
    "create_time_entry",
    {
      description:
        "Log time against a task. Omit endTime to leave the entry running.",
      inputSchema: z.object({
        taskId: nonEmptyString,
        startTime: isoDateTimeSchema,
        endTime: optionalIsoDateTimeSchema,
        description: optionalNonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json("/api/time-entry", {
          method: "POST",
          body: JSON.stringify({
            taskId: args.taskId,
            startTime: args.startTime,
            ...(args.endTime ? { endTime: args.endTime } : {}),
            ...(args.description ? { description: args.description } : {}),
          }),
        }),
      ),
  );

  registerTool(
    "update_time_entry",
    {
      description:
        "Update a time entry by its timeEntryId. startTime is required; omitting endTime keeps the stored one. startTime cannot be later than the end time.",
      inputSchema: z.object({
        timeEntryId: nonEmptyString.describe(
          "Time entry id (from list_task_time_entries)",
        ),
        startTime: isoDateTimeSchema,
        endTime: optionalIsoDateTimeSchema,
        description: optionalNonEmptyString,
      }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/time-entry/${encodeURIComponent(args.timeEntryId)}`, {
          method: "PUT",
          body: JSON.stringify({
            startTime: args.startTime,
            ...(args.endTime ? { endTime: args.endTime } : {}),
            ...(args.description ? { description: args.description } : {}),
          }),
        }),
      ),
  );

  registerTool(
    "list_task_activity",
    {
      description: "List a task's activity history.",
      inputSchema: z.object({ taskId: nonEmptyString }),
    },
    async (args) =>
      run(() =>
        client.json(`/api/activity/${encodeURIComponent(args.taskId)}`),
      ),
  );

  registerTool(
    "list_notifications",
    {
      description: "List the signed-in user's notifications.",
      inputSchema: z.object({}),
    },
    async () => run(() => client.json("/api/notification")),
  );
}
