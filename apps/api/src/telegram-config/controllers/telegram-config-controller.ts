import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  telegramBotTable,
  telegramChatTable,
  telegramRuleTable,
  workspaceTable,
} from "../../database/schema";
import {
  getTelegramChat,
  getTelegramMe,
  getTelegramUpdates,
} from "../../plugins/telegram/client";
import {
  defaultTelegramEvents,
  type TelegramEventKey,
  telegramEventKeys,
} from "../../plugins/telegram/config";
import { hasWorkspacePermission } from "../../utils/require-workspace-permission";

function maskBotToken(value: string): string {
  const [prefix, suffix = ""] = value.split(":", 2);
  if (!suffix) {
    return "Configured";
  }

  const maskedSuffix =
    suffix.length > 8 ? `${suffix.slice(0, 4)}…${suffix.slice(-4)}` : "••••";
  return `${prefix}:${maskedSuffix}`;
}

// Shape-only reuse of the canonical token regex from the telegram plugin
// config; the unified config does not carry a per-bot chat, so validate the
// token against a placeholder chat.
function assertValidBotToken(botToken: string): void {
  const [prefix, suffix = ""] = botToken.trim().split(":", 2);
  const valid =
    /^\d{1,10}$/.test(prefix || "") &&
    /^[A-Za-z0-9_-]{30,}$/.test(suffix || "");
  if (!valid) {
    throw new HTTPException(400, {
      message: "Enter a valid Telegram bot token",
    });
  }
}

export type TelegramBotRow = typeof telegramBotTable.$inferSelect;
export type TelegramChatRow = typeof telegramChatTable.$inferSelect;
export type TelegramRuleRow = typeof telegramRuleTable.$inferSelect;

export function toBotResponse(row: TelegramBotRow) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name ?? null,
    botTokenConfigured: Boolean(row.botToken),
    maskedBotToken: maskBotToken(row.botToken),
    // Defaults merged in so the UI toggles always show the effective state.
    events: { ...defaultTelegramEvents, ...(row.events ?? {}) },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toChatResponse(row: TelegramChatRow) {
  return {
    id: row.id,
    botId: row.botId,
    chatId: row.chatId,
    label: row.label ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toRuleResponse(
  row: TelegramRuleRow,
  names?: { workspaceName?: string | null; projectName?: string | null },
) {
  return {
    id: row.id,
    chatId: row.chatId,
    workspaceId: row.workspaceId,
    workspaceName: names?.workspaceName ?? null,
    projectId: row.projectId ?? null,
    projectName: names?.projectName ?? null,
    threadId: row.threadId ?? null,
    isActive: row.isActive ?? true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireOwnedBot(botId: string, userId: string) {
  const [bot] = await db
    .select()
    .from(telegramBotTable)
    .where(
      and(eq(telegramBotTable.id, botId), eq(telegramBotTable.userId, userId)),
    )
    .limit(1);

  if (!bot) {
    throw new HTTPException(404, { message: "Telegram bot not found" });
  }

  return bot;
}

async function requireOwnedChat(chatRowId: string, userId: string) {
  const [chat] = await db
    .select({
      chat: telegramChatTable,
      bot: telegramBotTable,
    })
    .from(telegramChatTable)
    .innerJoin(
      telegramBotTable,
      eq(telegramChatTable.botId, telegramBotTable.id),
    )
    .where(
      and(
        eq(telegramChatTable.id, chatRowId),
        eq(telegramBotTable.userId, userId),
      ),
    )
    .limit(1);

  if (!chat) {
    throw new HTTPException(404, { message: "Telegram chat not found" });
  }

  return chat;
}

// Only users holding workspace:manage_settings on the target workspace may
// route its notifications anywhere.
async function assertCanManageWorkspace(
  c: Context,
  workspaceId: string,
): Promise<void> {
  c.set("workspaceId", workspaceId);
  const allowed = await hasWorkspacePermission(c, {
    workspace: ["manage_settings"],
  });
  if (!allowed) {
    throw new HTTPException(403, {
      message: "Missing workspace:manage_settings for the target workspace",
    });
  }
}

export async function getUserTelegramConfig(userId: string) {
  const bots = await db.query.telegramBotTable.findMany({
    where: eq(telegramBotTable.userId, userId),
    orderBy: (bot, { asc }) => [asc(bot.createdAt)],
    with: {
      chats: {
        orderBy: (chat, { asc }) => [asc(chat.createdAt)],
        with: {
          rules: {
            orderBy: (rule, { asc }) => [asc(rule.createdAt)],
          },
        },
      },
    },
  });

  const workspaceIds = [
    ...new Set(
      bots.flatMap((bot) =>
        bot.chats.flatMap((chat) => chat.rules.map((rule) => rule.workspaceId)),
      ),
    ),
  ];
  const projectIds = [
    ...new Set(
      bots
        .flatMap((bot) => bot.chats)
        .flatMap((chat) => chat.rules)
        .map((rule) => rule.projectId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [workspaces, projects] = await Promise.all([
    workspaceIds.length
      ? db
          .select({ id: workspaceTable.id, name: workspaceTable.name })
          .from(workspaceTable)
          .where(inArray(workspaceTable.id, workspaceIds))
      : Promise.resolve([]),
    projectIds.length
      ? db
          .select({ id: projectTable.id, name: projectTable.name })
          .from(projectTable)
          .where(inArray(projectTable.id, projectIds))
      : Promise.resolve([]),
  ]);

  const workspaceNames = new Map(workspaces.map((w) => [w.id, w.name]));
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  return {
    bots: bots.map((bot) => ({
      ...toBotResponse(bot),
      chats: bot.chats.map((chat) => ({
        ...toChatResponse(chat),
        rules: chat.rules.map((rule) =>
          toRuleResponse(rule, {
            workspaceName: workspaceNames.get(rule.workspaceId) ?? null,
            projectName: rule.projectId
              ? (projectNames.get(rule.projectId) ?? null)
              : null,
          }),
        ),
      })),
    })),
  };
}

export async function createTelegramBot(
  userId: string,
  body: { botToken: string; name?: string },
) {
  const botToken = body.botToken.trim();
  assertValidBotToken(botToken);

  const existing = await db
    .select({ id: telegramBotTable.id })
    .from(telegramBotTable)
    .where(
      and(
        eq(telegramBotTable.userId, userId),
        eq(telegramBotTable.botToken, botToken),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new HTTPException(400, {
      message: "This bot token is already configured in your account",
    });
  }

  const [row] = await db
    .insert(telegramBotTable)
    .values({
      userId,
      botToken,
      name: body.name?.trim() || null,
    })
    .returning();

  if (!row) {
    throw new HTTPException(500, { message: "Failed to save Telegram bot" });
  }

  return toBotResponse(row);
}

export async function updateTelegramBot(
  userId: string,
  botId: string,
  body: {
    botToken?: string;
    name?: string | null;
    events?: Partial<Record<TelegramEventKey, boolean>>;
  },
) {
  const bot = await requireOwnedBot(botId, userId);

  const patch: Partial<TelegramBotRow> = {};
  if (body.botToken !== undefined) {
    const botToken = body.botToken.trim();
    assertValidBotToken(botToken);
    patch.botToken = botToken;
  }
  if (body.name !== undefined) {
    patch.name = body.name?.trim() || null;
  }
  if (body.events !== undefined) {
    // Only the known event keys are kept; absent keys fall back to the
    // plugin defaults at dispatch time.
    const events: Partial<Record<TelegramEventKey, boolean>> = {};
    for (const key of telegramEventKeys) {
      const value = body.events[key];
      if (typeof value === "boolean") {
        events[key] = value;
      }
    }
    patch.events = events;
  }

  if (Object.keys(patch).length === 0) {
    return toBotResponse(bot);
  }

  const [row] = await db
    .update(telegramBotTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(telegramBotTable.id, botId))
    .returning();

  if (!row) {
    throw new HTTPException(500, { message: "Failed to save Telegram bot" });
  }

  return toBotResponse(row);
}

export async function deleteTelegramBot(
  userId: string,
  botId: string,
): Promise<void> {
  await requireOwnedBot(botId, userId);
  await db.delete(telegramBotTable).where(eq(telegramBotTable.id, botId));
}

export async function createTelegramChat(
  userId: string,
  botId: string,
  body: { chatId: string; label?: string },
) {
  await requireOwnedBot(botId, userId);

  const chatId = body.chatId.trim();
  if (!chatId) {
    throw new HTTPException(400, { message: "Chat ID is required" });
  }

  const existing = await db
    .select({ id: telegramChatTable.id })
    .from(telegramChatTable)
    .where(
      and(
        eq(telegramChatTable.botId, botId),
        eq(telegramChatTable.chatId, chatId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new HTTPException(400, {
      message: "This chat is already configured for the bot",
    });
  }

  const [row] = await db
    .insert(telegramChatTable)
    .values({
      botId,
      chatId,
      label: body.label?.trim() || null,
    })
    .returning();

  if (!row) {
    throw new HTTPException(500, { message: "Failed to save Telegram chat" });
  }

  return toChatResponse(row);
}

export async function updateTelegramChat(
  userId: string,
  chatRowId: string,
  body: { chatId?: string; label?: string | null },
) {
  await requireOwnedChat(chatRowId, userId);

  const patch: Partial<TelegramChatRow> = {};
  if (body.chatId !== undefined) {
    const chatId = body.chatId.trim();
    if (!chatId) {
      throw new HTTPException(400, { message: "Chat ID is required" });
    }
    patch.chatId = chatId;
  }
  if (body.label !== undefined) {
    patch.label = body.label?.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  await db
    .update(telegramChatTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(telegramChatTable.id, chatRowId));
}

export async function deleteTelegramChat(
  userId: string,
  chatRowId: string,
): Promise<void> {
  await requireOwnedChat(chatRowId, userId);
  await db.delete(telegramChatTable).where(eq(telegramChatTable.id, chatRowId));
}

async function assertProjectsInWorkspace(
  workspaceId: string,
  projectIds: string[],
) {
  if (projectIds.length === 0) return;
  const projects = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        inArray(projectTable.id, projectIds),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );

  if (projects.length !== new Set(projectIds).size) {
    throw new HTTPException(400, {
      message: "Project does not belong to the selected workspace",
    });
  }
}

export type TelegramRuleScope = {
  workspaceId: string;
  // null = every project of the workspace.
  projectIds: string[] | null;
};

export async function createTelegramRules(
  c: Context,
  userId: string,
  chatRowId: string,
  body: { scopes: TelegramRuleScope[]; threadId?: number | null },
) {
  await requireOwnedChat(chatRowId, userId);

  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    throw new HTTPException(400, {
      message: "Select at least one workspace",
    });
  }

  if (body.scopes.length > 50) {
    throw new HTTPException(400, { message: "Too many scopes at once" });
  }

  const created = [];
  for (const scope of body.scopes) {
    await assertCanManageWorkspace(c, scope.workspaceId);
    const projectIds = scope.projectIds ? [...new Set(scope.projectIds)] : null;
    await assertProjectsInWorkspace(scope.workspaceId, projectIds ?? []);

    // null projectIds → one workspace-wide rule; otherwise one rule per
    // project so individual projects can be removed later.
    const targets: (string | null)[] = projectIds ?? [null];

    for (const projectId of targets) {
      const duplicateWhere = projectId
        ? and(
            eq(telegramRuleTable.chatId, chatRowId),
            eq(telegramRuleTable.workspaceId, scope.workspaceId),
            eq(telegramRuleTable.projectId, projectId),
          )
        : and(
            eq(telegramRuleTable.chatId, chatRowId),
            eq(telegramRuleTable.workspaceId, scope.workspaceId),
            isNull(telegramRuleTable.projectId),
          );

      const [duplicate] = await db
        .select({ id: telegramRuleTable.id })
        .from(telegramRuleTable)
        .where(duplicateWhere)
        .limit(1);

      if (duplicate) {
        continue;
      }

      const [row] = await db
        .insert(telegramRuleTable)
        .values({
          chatId: chatRowId,
          workspaceId: scope.workspaceId,
          projectId,
          threadId: body.threadId ?? null,
          isActive: true,
        })
        .returning();

      if (row) {
        created.push(row);
      }
    }
  }

  return created.map((row) => toRuleResponse(row));
}

export async function updateTelegramRule(
  c: Context,
  userId: string,
  ruleId: string,
  body: {
    projectIds?: string[] | null;
    threadId?: number | null;
    isActive?: boolean;
  },
) {
  const existing = await db
    .select()
    .from(telegramRuleTable)
    .where(eq(telegramRuleTable.id, ruleId))
    .limit(1);

  const rule = existing[0];
  if (!rule) {
    throw new HTTPException(404, { message: "Telegram rule not found" });
  }

  await requireOwnedChat(rule.chatId, userId);
  await assertCanManageWorkspace(c, rule.workspaceId);

  if (body.projectIds !== undefined) {
    const projectIds = body.projectIds ? [...new Set(body.projectIds)] : null;
    await assertProjectsInWorkspace(rule.workspaceId, projectIds ?? []);
    // The scope is rewritten: replace the workspace's rules on this chat with
    // the requested set (workspace-wide or per project).
    await db
      .delete(telegramRuleTable)
      .where(
        and(
          eq(telegramRuleTable.chatId, rule.chatId),
          eq(telegramRuleTable.workspaceId, rule.workspaceId),
        ),
      );

    const targets: (string | null)[] = projectIds ?? [null];
    for (const projectId of targets) {
      await db.insert(telegramRuleTable).values({
        chatId: rule.chatId,
        workspaceId: rule.workspaceId,
        projectId,
        threadId: body.threadId ?? rule.threadId ?? null,
        isActive: body.isActive ?? rule.isActive ?? true,
      });
    }

    if (targets.length === 0) {
      return [];
    }

    const rows = await db
      .select()
      .from(telegramRuleTable)
      .where(
        and(
          eq(telegramRuleTable.chatId, rule.chatId),
          eq(telegramRuleTable.workspaceId, rule.workspaceId),
        ),
      );
    return rows.map((row) => toRuleResponse(row));
  }

  const patch: Partial<TelegramRuleRow> = {};
  if (body.threadId !== undefined) {
    patch.threadId = body.threadId;
  }
  if (body.isActive !== undefined) {
    patch.isActive = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return [toRuleResponse(rule)];
  }

  const [row] = await db
    .update(telegramRuleTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(telegramRuleTable.id, ruleId))
    .returning();

  if (!row) {
    throw new HTTPException(500, { message: "Failed to save Telegram rule" });
  }

  return [toRuleResponse(row)];
}

export async function deleteTelegramRule(
  c: Context,
  userId: string,
  ruleId: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(telegramRuleTable)
    .where(eq(telegramRuleTable.id, ruleId))
    .limit(1);

  const rule = existing[0];
  if (!rule) {
    throw new HTTPException(404, { message: "Telegram rule not found" });
  }

  await requireOwnedChat(rule.chatId, userId);
  await assertCanManageWorkspace(c, rule.workspaceId);

  await db.delete(telegramRuleTable).where(eq(telegramRuleTable.id, ruleId));
}

export type TelegramVerifyResult = {
  bot: {
    id: number;
    username: string | null;
    name: string | null;
  } | null;
  chat: {
    id: number;
    title: string | null;
    username: string | null;
    isForum: boolean | null;
  } | null;
};

export async function verifyTelegram(
  c: Context,
  userId: string,
  body: {
    botToken?: string;
    botId?: string;
    chatId?: string;
    telegramChatId?: string;
  },
): Promise<TelegramVerifyResult> {
  if (!body.botToken && !body.botId && !body.telegramChatId) {
    throw new HTTPException(400, {
      message: "Provide a bot token, bot id, or chat to verify",
    });
  }

  let botToken = body.botToken?.trim();
  let chatId = body.chatId?.trim();

  if (body.botId) {
    const bot = await requireOwnedBot(body.botId, userId);
    botToken = bot.botToken;
  }

  if (body.telegramChatId) {
    const { chat, bot } = await requireOwnedChat(body.telegramChatId, userId);
    botToken = botToken ?? bot.botToken;
    chatId = chatId ?? chat.chatId;
  }

  if (!botToken) {
    throw new HTTPException(400, {
      message: "A bot token (or stored bot) is required to verify",
    });
  }

  void c;
  const result: TelegramVerifyResult = { bot: null, chat: null };

  // Verify the bot itself whenever a raw token or stored bot was provided.
  if (body.botToken || body.botId) {
    const me = await getTelegramMe(botToken);
    if (!me.ok) {
      throw new HTTPException(400, { message: `Telegram: ${me.error}` });
    }
    result.bot = {
      id: me.bot.id,
      username: me.bot.username ?? null,
      name: me.bot.first_name ?? null,
    };
  }

  if (chatId) {
    const chatResult = await getTelegramChat(botToken, chatId);
    if (!chatResult.ok) {
      throw new HTTPException(400, {
        message: `Telegram: ${chatResult.error}`,
      });
    }
    result.chat = {
      id: chatResult.chat.id,
      title: chatResult.chat.title ?? null,
      username: chatResult.chat.username ?? null,
      isForum: chatResult.chat.is_forum ?? null,
    };
  }

  return result;
}

export type TelegramTopic = {
  id: number;
  title: string;
};

// Live topic discovery for the rule dialog: while it is open, the UI polls
// this and the user posts a message inside a forum topic, which the bot
// receives through getUpdates (topics cannot be listed any other way).
export async function listTelegramTopics(
  userId: string,
  chatRowId: string,
): Promise<TelegramTopic[]> {
  const { chat, bot } = await requireOwnedChat(chatRowId, userId);

  const result = await getTelegramUpdates(bot.botToken);
  if (!result.ok) {
    throw new HTTPException(400, { message: `Telegram: ${result.error}` });
  }

  const topics = new Map<number, string>();
  for (const update of result.updates) {
    const message = update.message ?? update.edited_message;
    const threadId = message?.message_thread_id;
    const chatId = message?.chat?.id;
    if (!message || threadId === undefined || chatId === undefined) continue;
    if (String(chatId) !== chat.chatId) continue;

    const title = message.forum_topic_created?.title;
    if (title || !topics.has(threadId)) {
      topics.set(threadId, title || `Topic ${threadId}`);
    }
  }

  return [...topics.entries()].map(([id, title]) => ({ id, title }));
}
