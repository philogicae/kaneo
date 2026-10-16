CREATE INDEX `task_project_scheduled_id_idx` ON `task` (`project_id`,`id`) WHERE `start_date` is not null or `due_date` is not null;
