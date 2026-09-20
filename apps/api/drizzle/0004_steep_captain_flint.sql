CREATE TABLE `milestone` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT 'sky' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestone_projectId_idx` ON `milestone` (`project_id`);--> statement-breakpoint
ALTER TABLE `task` ADD `milestone_id` text REFERENCES milestone(id);--> statement-breakpoint
CREATE INDEX `task_milestoneId_idx` ON `task` (`milestone_id`);