CREATE TABLE `calendar_feed` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`token` text NOT NULL,
	`label_ids` text NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_token_unique` ON `calendar_feed` (`token`);--> statement-breakpoint
CREATE INDEX `calendar_feed_project_id_idx` ON `calendar_feed` (`project_id`);--> statement-breakpoint
CREATE TABLE `data_migration` (
	`id` text PRIMARY KEY NOT NULL,
	`completed_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `github_import` (
	`integration_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`state` text NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`integration_id`) REFERENCES `integration`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `storage_cleanup` (
	`object_key` text PRIMARY KEY NOT NULL,
	`last_attempt_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_external_link` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`integration_id` text,
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
INSERT INTO `__new_external_link`("id", "task_id", "integration_id", "resource_type", "external_id", "url", "title", "metadata", "created_at", "updated_at") SELECT "id", "task_id", "integration_id", "resource_type", "external_id", "url", "title", "metadata", "created_at", "updated_at" FROM `external_link`;--> statement-breakpoint
DROP TABLE `external_link`;--> statement-breakpoint
ALTER TABLE `__new_external_link` RENAME TO `external_link`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `external_link_taskId_idx` ON `external_link` (`task_id`);--> statement-breakpoint
CREATE INDEX `external_link_integrationId_idx` ON `external_link` (`integration_id`);--> statement-breakpoint
CREATE INDEX `external_link_externalId_idx` ON `external_link` (`external_id`);--> statement-breakpoint
CREATE INDEX `external_link_resourceType_idx` ON `external_link` (`resource_type`);--> statement-breakpoint
ALTER TABLE `label` ADD `deletion_started_at` integer;--> statement-breakpoint
ALTER TABLE `project` ADD `background_object_key` text;--> statement-breakpoint
ALTER TABLE `project` ADD `background_mime_type` text;--> statement-breakpoint
ALTER TABLE `project` ADD `background_version` text;--> statement-breakpoint
CREATE INDEX `project_background_object_key_idx` ON `project` (`background_object_key`) WHERE "project"."background_object_key" is not null;