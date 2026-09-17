CREATE TABLE `access_team_member` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `access_team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `access_team_member_teamId_idx` ON `access_team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `access_team_member_userId_idx` ON `access_team_member` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `access_team_member_unique` ON `access_team_member` (`team_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `access_team_project` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `access_team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `access_team_project_teamId_idx` ON `access_team_project` (`team_id`);--> statement-breakpoint
CREATE INDEX `access_team_project_projectId_idx` ON `access_team_project` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `access_team_project_unique` ON `access_team_project` (`team_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `access_team` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_team_name_idx` ON `access_team` (`name`);--> statement-breakpoint
CREATE TABLE `access_team_workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`all_projects` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `access_team`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `access_team_workspace_teamId_idx` ON `access_team_workspace` (`team_id`);--> statement-breakpoint
CREATE INDEX `access_team_workspace_workspaceId_idx` ON `access_team_workspace` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `access_team_workspace_unique` ON `access_team_workspace` (`team_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `invitation_project_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`project_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_project_grant_invitationId_idx` ON `invitation_project_grant` (`invitation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_project_grant_unique` ON `invitation_project_grant` (`invitation_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `invitation_team` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `access_team`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_team_invitationId_idx` ON `invitation_team` (`invitation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_team_unique` ON `invitation_team` (`invitation_id`,`team_id`);--> statement-breakpoint
CREATE TABLE `invitation_workspace_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`invitation_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`all_projects` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitation`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_workspace_grant_invitationId_idx` ON `invitation_workspace_grant` (`invitation_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_workspace_grant_unique` ON `invitation_workspace_grant` (`invitation_id`,`workspace_id`);--> statement-breakpoint
CREATE TABLE `user_project_access` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text NOT NULL,
	`granted_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `user_project_access_userId_idx` ON `user_project_access` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_project_access_projectId_idx` ON `user_project_access` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_project_access_unique` ON `user_project_access` (`user_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `user_workspace_access` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`all_projects` integer DEFAULT false NOT NULL,
	`granted_by` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `user_workspace_access_userId_idx` ON `user_workspace_access` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_workspace_access_workspaceId_idx` ON `user_workspace_access` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_workspace_access_unique` ON `user_workspace_access` (`user_id`,`workspace_id`);--> statement-breakpoint
ALTER TABLE `workspace_member` ADD `access_scope` text DEFAULT 'full' NOT NULL;