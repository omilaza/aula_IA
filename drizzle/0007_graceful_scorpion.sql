CREATE TABLE `course_satisfaction_survey_sync` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idempotency_key` text NOT NULL,
	`reference_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` text,
	`last_error` text DEFAULT '' NOT NULL,
	`synced_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_satisfaction_survey_sync_idempotency_unique` ON `course_satisfaction_survey_sync` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `course_satisfaction_survey_sync_status_idx` ON `course_satisfaction_survey_sync` (`status`);