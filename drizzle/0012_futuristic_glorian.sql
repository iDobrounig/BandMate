CREATE TABLE `band_members` (
	`band_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`instrument` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`band_id`, `user_id`),
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `bands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`calendar_token` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bands_calendar_token_unique` ON `bands` (`calendar_token`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`band_id` integer NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`invited_by_id` integer,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`band_id`) REFERENCES `bands`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
ALTER TABLE `equipment` ADD `band_id` integer REFERENCES bands(id);--> statement-breakpoint
ALTER TABLE `events` ADD `band_id` integer REFERENCES bands(id);--> statement-breakpoint
ALTER TABLE `setlists` ADD `band_id` integer REFERENCES bands(id);--> statement-breakpoint
ALTER TABLE `songs` ADD `band_id` integer REFERENCES bands(id);--> statement-breakpoint
ALTER TABLE `users` ADD `is_super_admin` integer DEFAULT false NOT NULL;