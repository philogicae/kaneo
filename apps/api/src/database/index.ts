import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type Client, createClient } from "@libsql/client";
import { config } from "dotenv-mono";
import { drizzle } from "drizzle-orm/libsql";
import {
  accessTeamMemberTableRelations,
  accessTeamProjectTableRelations,
  accessTeamTableRelations,
  accessTeamWorkspaceTableRelations,
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
  invitationProjectGrantTableRelations,
  invitationTableRelations,
  invitationTeamTableRelations,
  invitationWorkspaceGrantTableRelations,
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
  userProjectAccessTableRelations,
  userTableRelations,
  userWorkspaceAccessTableRelations,
  verificationTableRelations,
  workflowRuleTableRelations,
  workspaceRoleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
} from "./relations";
import { resolveDatabaseConfig } from "./resolve-database-config";
import { serialiseClientWrites } from "./write-queue";
import {
  accessTeamMemberTable,
  accessTeamProjectTable,
  accessTeamTable,
  accessTeamWorkspaceTable,
  accountTable,
  activityTable,
  apikeyTable,
  appointmentReminderSentTable,
  appointmentTable,
  assetTable,
  billingEventTable,
  billingReminderSentTable,
  calendarFeedTable,
  columnTable,
  commentTable,
  customFieldDefinitionTable,
  customFieldValueTable,
  dataMigrationTable,
  deviceCodeTable,
  externalLinkTable,
  githubImportTable,
  githubIntegrationTable,
  integrationTable,
  invitationProjectGrantTable,
  invitationTable,
  invitationTeamTable,
  invitationWorkspaceGrantTable,
  jobLeaseTable,
  labelTable,
  mcpOauthStateTable,
  milestoneTable,
  notificationTable,
  projectTable,
  sessionTable,
  storageCleanupTable,
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
  userProjectAccessTable,
  userTable,
  userWorkspaceAccessTable,
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
  accessTeamTable,
  accessTeamMemberTable,
  accessTeamWorkspaceTable,
  accessTeamProjectTable,
  userWorkspaceAccessTable,
  userProjectAccessTable,
  invitationTeamTable,
  invitationWorkspaceGrantTable,
  invitationProjectGrantTable,
  accountTable,
  appointmentTable,
  appointmentReminderSentTable,
  assetTable,
  activityTable,
  apikeyTable,
  billingReminderSentTable,
  billingEventTable,
  workspaceBillingTable,
  calendarFeedTable,
  columnTable,
  commentTable,
  dataMigrationTable,
  deviceCodeTable,
  externalLinkTable,
  githubImportTable,
  githubIntegrationTable,
  integrationTable,
  invitationTable,
  jobLeaseTable,
  labelTable,
  mcpOauthStateTable,
  milestoneTable,
  notificationTable,
  projectTable,
  sessionTable,
  storageCleanupTable,
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
  accessTeamTableRelations,
  accessTeamMemberTableRelations,
  accessTeamWorkspaceTableRelations,
  accessTeamProjectTableRelations,
  userWorkspaceAccessTableRelations,
  userProjectAccessTableRelations,
  invitationTeamTableRelations,
  invitationWorkspaceGrantTableRelations,
  invitationProjectGrantTableRelations,
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

    client = serialiseClientWrites(createClient({ url: config.url }));
  }

  return client;
}

/**
 * Applies the connection PRAGMAs. SQLite runs in WAL mode so readers never
 * block the single writer and `foreign_keys` restores the constraint
 * enforcement Postgres gave us. Idempotent: safe to call on every startup.
 *
 * There is no `busy_timeout` here: libSQL's busy handler does not retry, so a
 * timeout would only delay the SQLITE_BUSY. Writes are serialised in-process
 * instead; see database/write-queue.ts.
 */
export async function applyDatabasePragmas(): Promise<void> {
  if (pragmasApplied) {
    return;
  }

  const database = getDatabaseClient();
  await database.execute("PRAGMA journal_mode = WAL");
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
