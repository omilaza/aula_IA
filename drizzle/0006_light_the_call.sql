CREATE TABLE `course_satisfaction_survey_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`idempotency_key` text NOT NULL,
	`is_anonymous` integer DEFAULT true NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`general_rating` integer NOT NULL,
	`content_rating` integer NOT NULL,
	`instructor_rating` integer NOT NULL,
	`platform_rating` integer NOT NULL,
	`activities_rating` integer,
	`materials_rating` integer,
	`materials_not_used` integer DEFAULT false NOT NULL,
	`recommendation_application` text DEFAULT '' NOT NULL,
	`liked_most` text DEFAULT '' NOT NULL,
	`improvements` text DEFAULT '' NOT NULL,
	`additional_comments` text DEFAULT '' NOT NULL,
	`reference_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_satisfaction_survey_idempotency_unique` ON `course_satisfaction_survey_responses` (`idempotency_key`);