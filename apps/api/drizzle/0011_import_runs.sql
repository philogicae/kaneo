CREATE TABLE `import_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text,
	`source` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`include_comments` integer DEFAULT true NOT NULL,
	`message` text,
	`projects` text NOT NULL,
	`error` text,
	`heartbeat_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_run_workspace_created_idx` ON `import_run` (`workspace_id`,`created_at`);
