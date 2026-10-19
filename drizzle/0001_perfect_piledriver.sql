CREATE TABLE `digital_skill_diagnostics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`session` text DEFAULT 'S2' NOT NULL,
	`route` text DEFAULT 'orientacion' NOT NULL,
	`activity` text DEFAULT 'diagnostico-digital' NOT NULL,
	`answers_json` text NOT NULL,
	`digital_score` integer NOT NULL,
	`identified_level` text NOT NULL,
	`recommended_route` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`response_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'completado' NOT NULL,
	`confirmation_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `digital_diagnostic_control_unique` ON `digital_skill_diagnostics` (`email`,`session`,`route`,`activity`);--> statement-breakpoint
CREATE TABLE `leveling_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`institution` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`session` text DEFAULT 'S2' NOT NULL,
	`route` text DEFAULT 'preparatoria' NOT NULL,
	`activity` text NOT NULL,
	`evidence_type` text NOT NULL,
	`response_json` text NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`response_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'completado' NOT NULL,
	`confirmation_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leveling_record_control_unique` ON `leveling_records` (`email`,`session`,`route`,`activity`);--> statement-breakpoint
CREATE TABLE `session_two_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`participant_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`session` text DEFAULT 'S2' NOT NULL,
	`route` text DEFAULT 'principal' NOT NULL,
	`activity` text DEFAULT 'evidencia-principal' NOT NULL,
	`product_title` text NOT NULL,
	`purpose` text NOT NULL,
	`pedagogical_context` text NOT NULL,
	`sources` text NOT NULL,
	`prompt` text NOT NULL,
	`ai_result` text NOT NULL,
	`teacher_review` text NOT NULL,
	`detected_risk` text NOT NULL,
	`adjustment` text NOT NULL,
	`checklist_json` text NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`response_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'recibida' NOT NULL,
	`confirmation_code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_two_evidence_control_unique` ON `session_two_evidence` (`email`,`session`,`route`,`activity`);