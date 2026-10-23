CREATE TABLE `workspace_chunks` (
	`owner_id` text NOT NULL,
	`snapshot_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`document` text NOT NULL,
	PRIMARY KEY(`owner_id`, `snapshot_id`, `chunk_index`)
);
