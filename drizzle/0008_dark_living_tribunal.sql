PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_setlist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`setlist_id` integer NOT NULL,
	`song_id` integer,
	`kind` text DEFAULT 'song' NOT NULL,
	`label` text,
	`break_seconds` integer,
	`position` integer NOT NULL,
	`note` text,
	FOREIGN KEY (`setlist_id`) REFERENCES `setlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_setlist_items`("id", "setlist_id", "song_id", "position", "note") SELECT "id", "setlist_id", "song_id", "position", "note" FROM `setlist_items`;--> statement-breakpoint
DROP TABLE `setlist_items`;--> statement-breakpoint
ALTER TABLE `__new_setlist_items` RENAME TO `setlist_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `setlists` ADD `target_seconds` integer;