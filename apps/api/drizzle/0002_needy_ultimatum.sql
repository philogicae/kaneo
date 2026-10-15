CREATE TABLE `appointment_reminder_sent` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`reminder_type` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `appointment_reminder_sent_appointmentId_idx` ON `appointment_reminder_sent` (`appointment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_reminder_sent_appointment_type_unique` ON `appointment_reminder_sent` (`appointment_id`,`reminder_type`);--> statement-breakpoint
ALTER TABLE `appointment` ADD `reminder_offsets` text;--> statement-breakpoint
ALTER TABLE `appointment` ADD `recurrence` text;