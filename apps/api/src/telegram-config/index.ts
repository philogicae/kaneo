import { deletedSchema } from "../integrations/schema";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import {
  createTelegramBot,
  createTelegramChat,
  createTelegramRules,
  deleteTelegramBot,
  deleteTelegramChat,
  deleteTelegramRule,
  getUserTelegramConfig,
  listTelegramTopics,
  updateTelegramBot,
  updateTelegramChat,
  updateTelegramRule,
  verifyTelegram,
} from "./controllers/telegram-config-controller";
import {
  telegramBotSchema,
  telegramChatSchema,
  telegramConfigSchema,
  telegramRuleSchema,
  telegramTopicsResponseSchema,
  telegramVerifyResultSchema,
} from "./response";
import {
  botIdParam,
  createTelegramBotBody,
  createTelegramChatBody,
  createTelegramRulesBody,
  telegramChatIdParam,
  telegramRuleIdParam,
  updateTelegramBotBody,
  updateTelegramChatBody,
  updateTelegramRuleBody,
  verifyTelegramBody,
} from "./schema";

// Bots belong to the account; ownership is checked in the controllers. Rules
// additionally require workspace:manage_settings on their target workspace
// (also controller-side, since one request can carry several workspaces).
const getTelegramConfigRoute = createRoute({
  method: "get",
  operationId: "getTelegramConfig",
  path: "/",
  tags: ["Telegram"],
  summary: "Get the unified Telegram notification config",
  description:
    "The account's bots, their chats, and per-chat routing rules. Unified rules supersede the per-project Telegram integration for matching projects.",
  responses: {
    200: jsonResponse(
      "The account's Telegram config tree",
      telegramConfigSchema,
    ),
  },
});

const createBotRoute = createRoute({
  method: "post",
  operationId: "createTelegramConfigBot",
  path: "/bot",
  tags: ["Telegram"],
  summary: "Add a Telegram bot",
  description:
    "Register a bot token in the account. The token is checked for shape only, not against Telegram; use the verify endpoint for a live check.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createTelegramBotBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored bot", telegramBotSchema),
    400: errorResponse(
      "Invalid bot token, or the token is already configured in the account",
    ),
  },
});

const updateBotRoute = createRoute({
  method: "patch",
  operationId: "updateTelegramConfigBot",
  path: "/bot/{botId}",
  tags: ["Telegram"],
  summary: "Update a Telegram bot",
  description:
    "Rename the bot or rotate its token. Omitted fields keep their current value.",
  request: {
    params: botIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTelegramBotBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated bot", telegramBotSchema),
    400: errorResponse("Invalid bot token"),
    404: errorResponse("Telegram bot not found"),
  },
});

const deleteBotRoute = createRoute({
  method: "delete",
  operationId: "deleteTelegramConfigBot",
  path: "/bot/{botId}",
  tags: ["Telegram"],
  summary: "Remove a Telegram bot",
  description: "Removes the bot, its chats, and all their rules.",
  request: { params: botIdParam },
  responses: {
    200: jsonResponse("The bot was removed", deletedSchema),
    404: errorResponse("Telegram bot not found"),
  },
});

const createChatRoute = createRoute({
  method: "post",
  operationId: "createTelegramConfigChat",
  path: "/bot/{botId}/chat",
  tags: ["Telegram"],
  summary: "Add a chat to a bot",
  description:
    "Register a chat, group, or channel the bot can post to. Several chats can be attached to one bot.",
  request: {
    params: botIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createTelegramChatBody } },
    },
  },
  responses: {
    200: jsonResponse("The stored chat", telegramChatSchema),
    400: errorResponse("Invalid chat id, or the chat already exists"),
    404: errorResponse("Telegram bot not found"),
  },
});

const updateChatRoute = createRoute({
  method: "patch",
  operationId: "updateTelegramConfigChat",
  path: "/telegram-chat/{telegramChatId}",
  tags: ["Telegram"],
  summary: "Update a chat",
  description:
    "Change the chat id or its label. Omitted fields keep their current value.",
  request: {
    params: telegramChatIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTelegramChatBody } },
    },
  },
  responses: {
    200: jsonResponse("The chat was updated", deletedSchema),
    400: errorResponse("Invalid chat id"),
    404: errorResponse("Telegram chat not found"),
  },
});

const deleteChatRoute = createRoute({
  method: "delete",
  operationId: "deleteTelegramConfigChat",
  path: "/telegram-chat/{telegramChatId}",
  tags: ["Telegram"],
  summary: "Remove a chat",
  description: "Removes the chat and all its rules.",
  request: { params: telegramChatIdParam },
  responses: {
    200: jsonResponse("The chat was removed", deletedSchema),
    404: errorResponse("Telegram chat not found"),
  },
});

const listTopicsRoute = createRoute({
  method: "post",
  operationId: "listTelegramConfigTopics",
  path: "/telegram-chat/{telegramChatId}/topics",
  tags: ["Telegram"],
  summary: "List forum topics detected through the bot's recent updates",
  description:
    "The Bot API cannot list topics directly; this reads getUpdates and returns the topics seen in recent messages for this chat. Poll it while the rule dialog is open and send a message inside a topic to make it appear.",
  request: { params: telegramChatIdParam },
  responses: {
    200: jsonResponse("Detected topics", telegramTopicsResponseSchema),
    400: errorResponse(
      "Telegram rejected the request (e.g. a webhook is set on the bot, which forbids getUpdates)",
    ),
    404: errorResponse("Telegram chat not found"),
  },
});

const createRulesRoute = createRoute({
  method: "post",
  operationId: "createTelegramConfigRules",
  path: "/telegram-chat/{telegramChatId}/rules",
  tags: ["Telegram"],
  summary: "Add routing rules to a chat",
  description:
    "One scope per selected workspace; each scope covers the whole workspace (null projectIds) or the listed projects. Requires workspace:manage_settings on every target workspace. The Bot API cannot list forum topics, so the topic id is entered manually.",
  request: {
    params: telegramChatIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: createTelegramRulesBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The created rules (existing duplicates are skipped)",
      z.array(telegramRuleSchema),
    ),
    400: errorResponse(
      "Unknown project, project outside a target workspace, or missing scopes",
    ),
    403: errorResponse(
      "Missing workspace:manage_settings on a target workspace",
    ),
    404: errorResponse("Telegram chat not found"),
  },
});

const updateRuleRoute = createRoute({
  method: "patch",
  operationId: "updateTelegramConfigRule",
  path: "/telegram-rule/{telegramRuleId}",
  tags: ["Telegram"],
  summary: "Update a routing rule",
  description:
    "Change the rule's project scope (rewrites the workspace's rules on this chat), topic, or active state. Requires workspace:manage_settings on the target workspace.",
  request: {
    params: telegramRuleIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateTelegramRuleBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated rules", z.array(telegramRuleSchema)),
    400: errorResponse(
      "Unknown project, project outside the target workspace, or invalid thread id",
    ),
    403: errorResponse(
      "Missing workspace:manage_settings on the target workspace",
    ),
    404: errorResponse("Telegram rule not found"),
  },
});

const deleteRuleRoute = createRoute({
  method: "delete",
  operationId: "deleteTelegramConfigRule",
  path: "/telegram-rule/{telegramRuleId}",
  tags: ["Telegram"],
  summary: "Remove a routing rule",
  description: "Requires workspace:manage_settings on the target workspace.",
  request: { params: telegramRuleIdParam },
  responses: {
    200: jsonResponse("The rule was removed", deletedSchema),
    403: errorResponse(
      "Missing workspace:manage_settings on the target workspace",
    ),
    404: errorResponse("Telegram rule not found"),
  },
});

const verifyRoute = createRoute({
  method: "post",
  operationId: "verifyTelegramConfig",
  path: "/verify",
  tags: ["Telegram"],
  summary: "Verify a bot token or chat against Telegram",
  description:
    "Calls the Telegram Bot API (getMe / getChat) with the given or stored token. getChat also reports isForum, which tells whether a topic id is needed. Note the Bot API cannot list forum topics.",
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: verifyTelegramBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Verification result; bot and chat are null when not requested",
      telegramVerifyResultSchema,
    ),
    400: errorResponse(
      "Nothing to verify, or Telegram rejected the token/chat",
    ),
    404: errorResponse("Stored bot or chat not found"),
  },
});

const telegramConfigRouter = apiRouter<
  BaseVariables & {
    botId: string;
    telegramChatId: string;
    telegramRuleId: string;
  }
>()
  .openapi(getTelegramConfigRoute, async (c) => {
    const config = await getUserTelegramConfig(c.get("userId"));
    return c.json(config, 200);
  })
  .openapi(createBotRoute, async (c) => {
    const body = c.req.valid("json");
    const bot = await createTelegramBot(c.get("userId"), body);
    return c.json(bot, 200);
  })
  .openapi(updateBotRoute, async (c) => {
    const { botId } = c.req.valid("param");
    const body = c.req.valid("json");
    const bot = await updateTelegramBot(c.get("userId"), botId, body);
    return c.json(bot, 200);
  })
  .openapi(deleteBotRoute, async (c) => {
    const { botId } = c.req.valid("param");
    await deleteTelegramBot(c.get("userId"), botId);
    return c.json({ success: true }, 200);
  })
  .openapi(createChatRoute, async (c) => {
    const { botId } = c.req.valid("param");
    const body = c.req.valid("json");
    const chat = await createTelegramChat(c.get("userId"), botId, body);
    return c.json(chat, 200);
  })
  .openapi(updateChatRoute, async (c) => {
    const { telegramChatId } = c.req.valid("param");
    const body = c.req.valid("json");
    await updateTelegramChat(c.get("userId"), telegramChatId, body);
    return c.json({ success: true }, 200);
  })
  .openapi(deleteChatRoute, async (c) => {
    const { telegramChatId } = c.req.valid("param");
    await deleteTelegramChat(c.get("userId"), telegramChatId);
    return c.json({ success: true }, 200);
  })
  .openapi(listTopicsRoute, async (c) => {
    const { telegramChatId } = c.req.valid("param");
    const topics = await listTelegramTopics(c.get("userId"), telegramChatId);
    return c.json({ topics }, 200);
  })
  .openapi(createRulesRoute, async (c) => {
    const { telegramChatId } = c.req.valid("param");
    const body = c.req.valid("json");
    const rules = await createTelegramRules(
      c,
      c.get("userId"),
      telegramChatId,
      body,
    );
    return c.json(rules, 200);
  })
  .openapi(updateRuleRoute, async (c) => {
    const { telegramRuleId } = c.req.valid("param");
    const body = c.req.valid("json");
    const rules = await updateTelegramRule(
      c,
      c.get("userId"),
      telegramRuleId,
      body,
    );
    return c.json(rules, 200);
  })
  .openapi(deleteRuleRoute, async (c) => {
    const { telegramRuleId } = c.req.valid("param");
    await deleteTelegramRule(c, c.get("userId"), telegramRuleId);
    return c.json({ success: true }, 200);
  })
  .openapi(verifyRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await verifyTelegram(c, c.get("userId"), body);
    return c.json(result, 200);
  });

export default telegramConfigRouter;
