CREATE TABLE `workspace_member_access` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`project_access` text DEFAULT 'all' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_member_access_workspace_user_unique` ON `workspace_member_access` (`workspace_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `workspace_member_access_userId_idx` ON `workspace_member_access` (`user_id`);
--> statement-breakpoint
CREATE TABLE `workspace_member_project` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workspace_id`,`project_id`) REFERENCES `project`(`workspace_id`,`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_member_project_workspace_user_project_unique` ON `workspace_member_project` (`workspace_id`,`user_id`,`project_id`);
--> statement-breakpoint
CREATE INDEX `workspace_member_project_projectId_idx` ON `workspace_member_project` (`project_id`);
--> statement-breakpoint
ALTER TABLE `invitation` ADD `project_access` text DEFAULT 'all' NOT NULL;
--> statement-breakpoint
ALTER TABLE `invitation` ADD `project_ids` text DEFAULT '[]' NOT NULL;
