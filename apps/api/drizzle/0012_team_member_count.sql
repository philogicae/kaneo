ALTER TABLE `team` ADD `member_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `team`
SET `member_count` = (
  SELECT count(*) FROM `team_member` WHERE `team_member`.`team_id` = `team`.`id`
);
--> statement-breakpoint
ALTER TABLE `team_member` ADD `membership_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `team_member_membership_key_unique` ON `team_member` (`membership_key`);
