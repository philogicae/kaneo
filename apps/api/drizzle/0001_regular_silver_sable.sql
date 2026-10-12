CREATE TABLE `appointment` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`position` integer DEFAULT 0,
	`number` integer DEFAULT 1,
	`assignee_id` text,
	`title` text NOT NULL,
	`description` text,
	`priority` text DEFAULT 'medium' NOT NULL,
	`start_date` integer,
	`due_date` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `appointment_projectId_idx` ON `appointment` (`project_id`);--> statement-breakpoint
CREATE INDEX `appointment_startDate_idx` ON `appointment` (`start_date`);--> statement-breakpoint
CREATE INDEX `appointment_assigneeId_idx` ON `appointment` (`assignee_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_project_number_unique` ON `appointment` (`project_id`,`number`);