CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`institution` text NOT NULL,
	`role` text NOT NULL,
	`session` text DEFAULT 'S1' NOT NULL,
	`consent` integer DEFAULT false NOT NULL,
	`confirmation_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_session_email_unique` ON `attendance` (`session`,`email`);--> statement-breakpoint
CREATE TABLE `diagnostics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`phase` text DEFAULT 'pre' NOT NULL,
	`answers_json` text NOT NULL,
	`likert_average_x100` integer NOT NULL,
	`knowledge_score` integer NOT NULL,
	`confirmation_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diagnostics_phase_email_unique` ON `diagnostics` (`phase`,`email`);--> statement-breakpoint
CREATE TABLE `exit_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`session` text DEFAULT 'S1' NOT NULL,
	`learning` text NOT NULL,
	`application` text NOT NULL,
	`remaining_question` text DEFAULT '' NOT NULL,
	`confidence` integer NOT NULL,
	`evidence_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exit_session_email_unique` ON `exit_tickets` (`session`,`email`);--> statement-breakpoint
CREATE TABLE `icebreaker_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category` text NOT NULL,
	`task` text NOT NULL,
	`session` text DEFAULT 'S1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lab_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`session` text DEFAULT 'S1' NOT NULL,
	`route` text NOT NULL,
	`case_key` text NOT NULL,
	`context_json` text NOT NULL,
	`prompt_v1` text NOT NULL,
	`prompt_v2` text NOT NULL,
	`response_v1` text DEFAULT '' NOT NULL,
	`response_v2` text DEFAULT '' NOT NULL,
	`review` text NOT NULL,
	`checklist_json` text NOT NULL,
	`evidence_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lab_session_email_unique` ON `lab_evidence` (`session`,`email`);