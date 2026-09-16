import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { config } from "dotenv-mono";
import { drizzle } from "drizzle-orm/libsql";
import {
  accountTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  assetTableRelations,
  columnTableRelations,
  commentTableRelations,
  customFieldDefinitionTableRelations,
  customFieldValueTableRelations,
  externalLinkTableRelations,
  githubIntegrationTableRelations,
  integrationTableRelations,
  invitationTableRelations,
  labelTableRelations,
  notificationTableRelations,
  projectTableRelations,
  sessionTableRelations,
  taskRelationTableRelations,
  taskReminderSentTableRelations,
  taskTableRelations,
  teamMemberTableRelations,
  teamTableRelations,
  telegramBotTableRelations,
  telegramChatTableRelations,
  telegramRuleTableRelations,
  timeEntryTableRelations,
  userNotificationPreferenceTableRelations,
  userNotificationWorkspaceProjectTableRelations,
  userNotificationWorkspaceRuleTableRelations,
  userTableRelations,
  verificationTableRelations,
  workflowRuleTableRelations,
  workspaceRoleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
} from "./relations";
import { resolveDatabaseConfig } from "./resolve-database-config";
import {
  accountTable,
  activityTable,
  apikeyTable,
  appointmentReminderSentTable,
  appointmentTable,
  assetTable,
  billingEventTable,
  billingReminderSentTable,
  columnTable,
  commentTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  deviceCodeTable,
  externalLinkTable,
  githubIntegrationTable,
  integrationTable,
  invitationTable,
  jobLeaseTable,
  labelTable,
  mcpOauthStateTable,
  notificationTable,
  projectTable,
  sessionTable,
  taskRelationTable,
  taskReminderSentTable,
  taskTable,
  teamMemberTable,
  teamTable,
  telegramBotTable,
  telegramChatTable,
  telegramRuleTable,
  timeEntryTable,
  trialGrantTable,
  userAvatarTable,
  userNotificationPreferenceTable,
  userNotificationWorkspaceProjectTable,
  userNotificationWorkspaceRuleTable,
  userTable,
  verificationTable,
  workflowRuleTable,
  workspaceBillingTable,
  workspaceInviteLinkTable,
  workspaceRoleTable,
  workspaceTable,
  workspaceUserTable,
} from "./schema";

config();

export const schema = {
  accountTable,
  appointmentTable,
  appointmentReminderSentTable,
  assetTable,
  activityTable,
  apikeyTable,
  billingReminderSentTable,
  billingEventTable,
  workspaceBillingTable,
  columnTable,
  commentTable,
  deviceCodeTable,
  externalLinkTable,
  githubIntegrationTable,
  integrationTable,
  invitationTable,
  jobLeaseTable,
  labelTable,
  mcpOauthStateTable,
  notificationTable,
  projectTable,
  sessionTable,
  taskRelationTable,
  taskReminderSentTable,
  taskTable,
  teamMemberTable,
  teamTable,
  telegramBotTable,
  telegramChatTable,
  telegramRuleTable,
  timeEntryTable,
  trialGrantTable,
  userTable,
  userAvatarTable,
  userNotificationPreferenceTable,
  userNotificationWorkspaceProjectTable,
  userNotificationWorkspaceRuleTable,
  verificationTable,
  workflowRuleTable,
  workspaceRoleTable,
  workspaceTable,
  workspaceUserTable,
  workspaceInviteLinkTable,
  accountTableRelations,
  assetTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  columnTableRelations,
  commentTableRelations,
  externalLinkTableRelations,
  githubIntegrationTableRelations,
  integrationTableRelations,
  invitationTableRelations,
  labelTableRelations,
  notificationTableRelations,
  projectTableRelations,
  sessionTableRelations,
  taskRelationTableRelations,
  taskReminderSentTableRelations,
  taskTableRelations,
  teamMemberTableRelations,
  teamTableRelations,
  telegramBotTableRelations,
  telegramChatTableRelations,
  telegramRuleTableRelations,
  timeEntryTableRelations,
  userTableRelations,
  userNotificationPreferenceTableRelations,
  userNotificationWorkspaceProjectTableRelations,
  userNotificationWorkspaceRuleTableRelations,
  verificationTableRelations,
  workflowRuleTableRelations,
  workspaceRoleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
  customFieldDefinitionTable,
  customFieldValueTable,
  customFieldDefinitionTableRelations,
  customFieldValueTableRelations,
};

type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

let client: Client | undefined;
let dbInstance: DatabaseInstance | undefined;
let pragmasApplied = false;

export function getDatabaseClient(): Client {
  if (!client) {
    const config = resolveDatabaseConfig();

    if (!config.isMemory) {
      mkdirSync(dirname(config.path), { recursive: true });
    }

    client = createClient({ url: config.url });
  }

  return client;
}

/**
 * Applies the connection PRAGMAs. SQLite runs in WAL mode so readers never
 * block the single writer, `busy_timeout` absorbs short writer contention and
 * `foreign_keys` restores the constraint enforcement Postgres gave us.
 * Idempotent: safe to call on every startup.
 */
export async function applyDatabasePragmas(): Promise<void> {
  if (pragmasApplied) {
    return;
  }

  const database = getDatabaseClient();
  await database.execute("PRAGMA journal_mode = WAL");
  await database.execute("PRAGMA busy_timeout = 5000");
  await database.execute("PRAGMA synchronous = NORMAL");
  await database.execute("PRAGMA foreign_keys = ON");
  pragmasApplied = true;
}

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = drizzle(getDatabaseClient(), {
      schema,
    });
  }

  return dbInstance;
}

const db = new Proxy({} as DatabaseInstance, {
  get(_target, property, receiver) {
    const value = Reflect.get(getDatabase(), property, receiver);

    if (typeof value === "function") {
      return value.bind(getDatabase());
    }

    return value;
  },
});

export default db;
