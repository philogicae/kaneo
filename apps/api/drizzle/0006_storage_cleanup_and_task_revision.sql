ALTER TABLE `task` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Monotonic write counter standing in for Postgres' `xmin`. The WHEN clause
-- stops the trigger's own update from re-firing, so the counter advances
-- exactly once per statement that writes the row.
CREATE TRIGGER `task_revision` AFTER UPDATE ON `task` WHEN new.`revision` = old.`revision`
  BEGIN
    UPDATE `task` SET `revision` = old.`revision` + 1 WHERE `id` = new.`id`;
  END;
--> statement-breakpoint
-- Capture storage keys for every cascade, including workspace deletion. The
-- outbox has no owner FK, so its rows survive the deleting transaction. SQLite
-- fires these triggers for ON DELETE CASCADE rows too, which is what makes the
-- workspace-deletion path safe.
CREATE TRIGGER `asset_storage_cleanup` BEFORE DELETE ON `asset`
  BEGIN
    INSERT OR IGNORE INTO `storage_cleanup` (`object_key`) VALUES (OLD.`object_key`);
  END;
--> statement-breakpoint
CREATE TRIGGER `project_storage_cleanup` BEFORE DELETE ON `project`
  BEGIN
    INSERT OR IGNORE INTO `storage_cleanup` (`object_key`)
      SELECT OLD.`background_object_key` WHERE OLD.`background_object_key` IS NOT NULL;
  END;
--> statement-breakpoint
CREATE INDEX `external_link_deferred_issue_idx` ON `external_link` (`id`)
  WHERE "external_link"."resource_type" = 'issue' AND "external_link"."metadata" LIKE '%"deferredIssueEdit":%';
