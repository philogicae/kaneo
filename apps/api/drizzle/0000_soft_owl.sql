CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`user_id` text,
	`content` text,
	`event_data` text,
	`external_user_name` text,
	`external_user_avatar` text,
	`external_source` text,
	`external_url` text,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_task_id_idx` ON `activity` (`task_id`);--> statement-breakpoint
CREATE INDEX `activity_userId_idx` ON `activity` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activity_task_external_source_external_url_unique` ON `activity` (`task_id`,`external_source`,`external_url`);--> statement-breakpoint
CREATE TABLE `apikey` (
	`id` text PRIMARY KEY NOT NULL,
	`config_id` text DEFAULT 'default' NOT NULL,
	`name` text,
	`start` text,
	`reference_id` text NOT NULL,
	`prefix` text,
	`key` text NOT NULL,
	`user_id` text,
	`refill_interval` integer,
	`refill_amount` integer,
	`last_refill_at` integer,
	`enabled` integer DEFAULT true,
	`rate_limit_enabled` integer DEFAULT true,
	`rate_limit_time_window` integer DEFAULT 86400000,
	`rate_limit_max` integer DEFAULT 10,
	`request_count` integer DEFAULT 0,
	`remaining` integer,
	`last_request` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`permissions` text,
	`metadata` text,
	FOREIGN KEY (`reference_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `apikey_configId_idx` ON `apikey` (`config_id`);--> statement-breakpoint
CREATE INDEX `apikey_key_idx` ON `apikey` (`key`);--> statement-breakpoint
CREATE INDEX `apikey_referenceId_idx` ON `apikey` (`reference_id`);--> statement-breakpoint
CREATE INDEX `apikey_userId_idx` ON `apikey` (`user_id`);--> statement-breakpoint
CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text,
	`activity_id` text,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`kind` text DEFAULT 'image' NOT NULL,
	`surface` text DEFAULT 'description' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`activity_id`) REFERENCES `activity`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_object_key_unique` ON `asset` (`object_key`);--> statement-breakpoint
CREATE INDEX `asset_workspaceId_idx` ON `asset` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `asset_projectId_idx` ON `asset` (`project_id`);--> statement-breakpoint
CREATE INDEX `asset_taskId_idx` ON `asset` (`task_id`);--> statement-breakpoint
CREATE INDEX `asset_activityId_idx` ON `asset` (`activity_id`);--> statement-breakpoint
CREATE INDEX `asset_createdBy_idx` ON `asset` (`created_by`);--> statement-breakpoint
CREATE TABLE `billing_event` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`processed_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `billing_reminder_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`trial_ends_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `billing_reminder_sent_workspaceId_idx` ON `billing_reminder_sent` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `billing_reminder_sent_userId_idx` ON `billing_reminder_sent` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `billing_reminder_sent_user_type_unique` ON `billing_reminder_sent` (`user_id`,`reminder_type`);--> statement-breakpoint
CREATE TABLE `column` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`icon` text,
	`color` text,
	`is_final` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `column_projectId_idx` ON `column` (`project_id`);--> statement-breakpoint
CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comment_task_idx` ON `comment` (`task_id`);--> statement-breakpoint
CREATE INDEX `comment_user_idx` ON `comment` (`user_id`);--> statement-breakpoint
CREATE TABLE `custom_field_definition` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`default_value` text,
	`options` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_field_def_projectId_idx` ON `custom_field_definition` (`project_id`);--> statement-breakpoint
CREATE TABLE `custom_field_value` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`field_id` text NOT NULL,
	`value` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`field_id`) REFERENCES `custom_field_definition`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_field_value_taskId_idx` ON `custom_field_value` (`task_id`);--> statement-breakpoint
CREATE INDEX `custom_field_value_fieldId_idx` ON `custom_field_value` (`field_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `custom_field_value_task_field_unique` ON `custom_field_value` (`task_id`,`field_id`);--> statement-breakpoint
CREATE TABLE `device_code` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code` text NOT NULL,
	`user_code` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL,
	`last_polled_at` integer,
	`polling_interval` integer,
	`client_id` text,
	`scope` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_code_device_code_uidx` ON `device_code` (`device_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_code_user_code_uidx` ON `device_code` (`user_code`);--> statement-breakpoint
CREATE INDEX `device_code_user_id_idx` ON `device_code` (`user_id`);--> statement-breakpoint
CREATE TABLE `external_link` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`metadata` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`integration_id`) REFERENCES `integration`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `external_link_taskId_idx` ON `external_link` (`task_id`);--> statement-breakpoint
CREATE INDEX `external_link_integrationId_idx` ON `external_link` (`integration_id`);--> statement-breakpoint
CREATE INDEX `external_link_externalId_idx` ON `external_link` (`external_id`);--> statement-breakpoint
CREATE INDEX `external_link_resourceType_idx` ON `external_link` (`resource_type`);--> statement-breakpoint
CREATE TABLE `github_integration` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`repository_owner` text NOT NULL,
	`repository_name` text NOT NULL,
	`installation_id` integer,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `github_integration_project_id_unique` ON `github_integration` (`project_id`);--> statement-breakpoint
CREATE TABLE `integration` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `integration_projectId_idx` ON `integration` (`project_id`);--> statement-breakpoint
CREATE INDEX `integration_type_idx` ON `integration` (`type`);--> statement-breakpoint
CREATE UNIQUE INDEX `integration_project_type_unique` ON `integration` (`project_id`,`type`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`team_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_workspaceId_idx` ON `invitation` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE INDEX `invitation_inviterId_idx` ON `invitation` (`inviter_id`);--> statement-breakpoint
CREATE TABLE `job_lease` (
	`name` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `label` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`task_id` text,
	`workspace_id` text,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `label_task_id_idx` ON `label` (`task_id`);--> statement-breakpoint
CREATE INDEX `label_workspace_id_idx` ON `label` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `label_workspace_name_unique` ON `label` (`workspace_id`,`name`) WHERE "label"."task_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `label_task_name_unique` ON `label` (`task_id`,`name`);--> statement-breakpoint
CREATE TABLE `mcp_oauth_state` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_oauth_state_kind_key_uidx` ON `mcp_oauth_state` (`kind`,`key`);--> statement-breakpoint
CREATE INDEX `mcp_oauth_state_expiresAt_idx` ON `mcp_oauth_state` (`expires_at`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`content` text,
	`type` text DEFAULT 'info' NOT NULL,
	`event_data` text,
	`is_read` integer DEFAULT false,
	`resource_id` text,
	`resource_type` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_userId_idx` ON `notification` (`user_id`);--> statement-breakpoint
CREATE TABLE `project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text DEFAULT 'Layout',
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`is_public` integer DEFAULT false,
	`archived_at` integer,
	`last_task_number` integer DEFAULT 0 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_workspaceId_position_idx` ON `project` (`workspace_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `project_workspace_id_id_unique` ON `project` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	`active_team_id` text,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `task_relation` (
	`id` text PRIMARY KEY NOT NULL,
	`source_task_id` text NOT NULL,
	`target_task_id` text NOT NULL,
	`relation_type` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`source_task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`target_task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_relation_source_idx` ON `task_relation` (`source_task_id`);--> statement-breakpoint
CREATE INDEX `task_relation_target_idx` ON `task_relation` (`target_task_id`);--> statement-breakpoint
CREATE TABLE `task_reminder_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_reminder_sent_taskId_idx` ON `task_reminder_sent` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_reminder_sent_task_type_unique` ON `task_reminder_sent` (`task_id`,`reminder_type`);--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`position` integer DEFAULT 0,
	`number` integer DEFAULT 1,
	`assignee_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'to-do' NOT NULL,
	`column_id` text,
	`priority` text DEFAULT 'low' NOT NULL,
	`start_date` integer,
	`due_date` integer,
	`reminder_offsets` text,
	`recurrence` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null,
	FOREIGN KEY (`column_id`) REFERENCES `column`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `task_projectId_idx` ON `task` (`project_id`);--> statement-breakpoint
CREATE INDEX `task_dueDate_idx` ON `task` (`due_date`);--> statement-breakpoint
CREATE INDEX `task_assigneeId_idx` ON `task` (`assignee_id`);--> statement-breakpoint
CREATE INDEX `task_columnId_idx` ON `task` (`column_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_project_number_unique` ON `task` (`project_id`,`number`);--> statement-breakpoint
CREATE TABLE `team_member` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `teamMember_teamId_idx` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `teamMember_userId_idx` ON `team_member` (`user_id`);--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`workspace_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_workspaceId_idx` ON `team` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `telegram_bot` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bot_token` text NOT NULL,
	`name` text,
	`events` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telegram_bot_userId_idx` ON `telegram_bot` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_bot_user_token_unique` ON `telegram_bot` (`user_id`,`bot_token`);--> statement-breakpoint
CREATE TABLE `telegram_chat` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`label` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `telegram_bot`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telegram_chat_botId_idx` ON `telegram_chat` (`bot_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_chat_bot_chat_unique` ON `telegram_chat` (`bot_id`,`chat_id`);--> statement-breakpoint
CREATE TABLE `telegram_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`thread_id` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `telegram_chat`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `telegram_rule_chatId_idx` ON `telegram_rule` (`chat_id`);--> statement-breakpoint
CREATE INDEX `telegram_rule_workspaceId_idx` ON `telegram_rule` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `telegram_rule_projectId_idx` ON `telegram_rule` (`project_id`);--> statement-breakpoint
CREATE TABLE `time_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`user_id` text,
	`description` text,
	`start_time` integer NOT NULL,
	`end_time` integer,
	`duration` integer DEFAULT 0,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_entry_taskId_idx` ON `time_entry` (`task_id`);--> statement-breakpoint
CREATE INDEX `time_entry_userId_idx` ON `time_entry` (`user_id`);--> statement-breakpoint
CREATE TABLE `trial_grant` (
	`email_hash` text PRIMARY KEY NOT NULL,
	`trial_ends_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_avatar` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`data` blob NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_avatar_user_id_unique` ON `user_avatar` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_avatar_userId_idx` ON `user_avatar` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_notification_preference` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`ntfy_enabled` integer DEFAULT false NOT NULL,
	`ntfy_server_url` text,
	`ntfy_topic` text,
	`ntfy_token` text,
	`gotify_enabled` integer DEFAULT false NOT NULL,
	`gotify_server_url` text,
	`gotify_token` text,
	`webhook_enabled` integer DEFAULT false NOT NULL,
	`webhook_url` text,
	`webhook_secret` text,
	`task_assignment_enabled` integer DEFAULT true NOT NULL,
	`task_comment_enabled` integer DEFAULT true NOT NULL,
	`task_status_change_enabled` integer DEFAULT true NOT NULL,
	`due_date_reminder_enabled` integer DEFAULT true NOT NULL,
	`due_date_reminder_lead_time_minutes` integer DEFAULT 1440 NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_notification_preference_user_id_unique` ON `user_notification_preference` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_notification_workspace_project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`workspace_rule_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`,`workspace_rule_id`) REFERENCES `user_notification_workspace_rule`(`workspace_id`,`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`,`project_id`) REFERENCES `project`(`workspace_id`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_notification_workspace_project_ruleId_idx` ON `user_notification_workspace_project` (`workspace_rule_id`);--> statement-breakpoint
CREATE INDEX `user_notification_workspace_project_projectId_idx` ON `user_notification_workspace_project` (`project_id`);--> statement-breakpoint
CREATE INDEX `user_notification_workspace_project_workspaceId_projectId_idx` ON `user_notification_workspace_project` (`workspace_id`,`project_id`);--> statement-breakpoint
CREATE INDEX `unwp_workspaceId_workspaceRuleId_idx` ON `user_notification_workspace_project` (`workspace_id`,`workspace_rule_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_notification_workspace_project_rule_project_unique` ON `user_notification_workspace_project` (`workspace_rule_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `user_notification_workspace_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`email_enabled` integer DEFAULT false NOT NULL,
	`ntfy_enabled` integer DEFAULT false NOT NULL,
	`gotify_enabled` integer DEFAULT false NOT NULL,
	`webhook_enabled` integer DEFAULT false NOT NULL,
	`project_mode` text DEFAULT 'all' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_notification_workspace_rule_userId_idx` ON `user_notification_workspace_rule` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_notification_workspace_rule_workspaceId_idx` ON `user_notification_workspace_rule` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_notification_workspace_rule_user_workspace_unique` ON `user_notification_workspace_rule` (`user_id`,`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_notification_workspace_rule_workspace_id_id_unique` ON `user_notification_workspace_rule` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`locale` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`is_anonymous` integer DEFAULT false,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `workflow_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`integration_type` text NOT NULL,
	`event_type` text NOT NULL,
	`column_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`column_id`) REFERENCES `column`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workflow_rule_projectId_idx` ON `workflow_rule` (`project_id`);--> statement-breakpoint
CREATE INDEX `workflow_rule_columnId_idx` ON `workflow_rule` (`column_id`);--> statement-breakpoint
CREATE TABLE `workspace_billing` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`founding_free` integer DEFAULT false NOT NULL,
	`trial_ends_at` integer,
	`creem_customer_id` text,
	`creem_subscription_id` text,
	`creem_product_id` text,
	`plan` text,
	`billing_interval` text,
	`status` text,
	`seats` integer DEFAULT 1 NOT NULL,
	`current_period_end` integer,
	`canceled_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_billing_workspace_id_unique` ON `workspace_billing` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_billing_creem_subscription_id_unique` ON `workspace_billing` (`creem_subscription_id`);--> statement-breakpoint
CREATE INDEX `workspace_billing_workspaceId_idx` ON `workspace_billing` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspace_invite_link` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`token` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`expires_at` integer,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invite_link_token_unique` ON `workspace_invite_link` (`token`);--> statement-breakpoint
CREATE INDEX `workspaceInviteLink_workspaceId_idx` ON `workspace_invite_link` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspaceInviteLink_token_idx` ON `workspace_invite_link` (`token`);--> statement-breakpoint
CREATE TABLE `workspace_role` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`role` text NOT NULL,
	`permission` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_role_workspaceId_idx` ON `workspace_role` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_role_role_idx` ON `workspace_role` (`role`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`metadata` text,
	`description` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_slug_unique` ON `workspace` (`slug`);--> statement-breakpoint
CREATE TABLE `workspace_member` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_member_workspaceId_idx` ON `workspace_member` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_member_userId_idx` ON `workspace_member` (`user_id`);