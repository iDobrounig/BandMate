ALTER TABLE `attachments` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `attachments` ADD `deleted_by_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `events` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `deleted_by_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `setlists` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `setlists` ADD `deleted_by_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `songs` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `songs` ADD `deleted_by_id` integer REFERENCES users(id);