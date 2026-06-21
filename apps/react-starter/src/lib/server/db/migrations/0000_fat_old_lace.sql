CREATE TABLE `api_usage` (
	`day` text PRIMARY KEY NOT NULL,
	`calls` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eod_cache` (
	`symbol` text NOT NULL,
	`range_key` text NOT NULL,
	`bars` text NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`symbol`, `range_key`)
);
--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`symbol` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
