export type TelegramConfigRule = {
  id: string;
  chatId: string;
  workspaceId: string;
  workspaceName: string | null;
  projectId: string | null;
  projectName: string | null;
  threadId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TelegramConfigChat = {
  id: string;
  botId: string;
  chatId: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  rules: TelegramConfigRule[];
};

export type TelegramBotEvents = {
  taskCreated: boolean;
  taskStatusChanged: boolean;
  taskPriorityChanged: boolean;
  taskTitleChanged: boolean;
  taskDescriptionChanged: boolean;
  taskCommentCreated: boolean;
};

export type TelegramConfigBot = {
  id: string;
  userId: string;
  name: string | null;
  botTokenConfigured: boolean;
  maskedBotToken: string;
  events: TelegramBotEvents;
  createdAt: string;
  updatedAt: string;
  chats: TelegramConfigChat[];
};

export type TelegramTopic = {
  id: number;
  title: string;
};

export type TelegramConfig = {
  bots: TelegramConfigBot[];
};

export type TelegramRuleScope = {
  workspaceId: string;
  // null = every project of the workspace.
  projectIds: string[] | null;
};

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
