CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_success_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
DROP INDEX `notification_log_einmalig`;--> statement-breakpoint
ALTER TABLE `notification_log` ADD `channel` text DEFAULT 'mail' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `notification_log_einmalig` ON `notification_log` (`kind`,`ref_type`,`ref_id`,`user_id`,`channel`);--> statement-breakpoint
ALTER TABLE `users` ADD `notify_channel` text DEFAULT 'beides' NOT NULL;