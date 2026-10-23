CREATE TABLE `commands` (
	`owner_id` text NOT NULL,
	`command_key` text NOT NULL,
	`input_hash` text NOT NULL,
	`result` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `command_key`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`document` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_command` text
);
