CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`ref_type` text NOT NULL,
	`ref_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`sent_at` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_log_einmalig` ON `notification_log` (`kind`,`ref_type`,`ref_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `notification_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`art` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`sent_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `notification_settings` (
	`user_id` integer NOT NULL,
	`kind` text NOT NULL,
	`channel` text DEFAULT 'mail' NOT NULL,
	`mode` text NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `channel`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `digest_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `last_seen_at` integer;--> statement-breakpoint
/*
 Handgeschrieben, nicht von drizzle-kit erzeugt: Übernimmt den bisherigen
 notify_by_email-Schalter in die neue Matrix.

 Gespeichert werden nur ABWEICHUNGEN vom Standard (siehe NOTIFY_KINDS). Der
 Standard ist "sofort" — wer notify_by_email = 1 hatte, braucht also keine
 Zeilen. Nur die Abschalter bekommen für jeden Ereignistyp ein "nie", damit sie
 nach der Migration exakt so wenig Post bekommen wie vorher.

 Muss VOR Migration 0006 laufen, die notify_by_email entfernt.
*/
INSERT INTO notification_settings (user_id, kind, channel, mode)
SELECT u.id, k.kind, 'mail', 'nie'
FROM users u
CROSS JOIN (
  SELECT 'suggestion' AS kind
  UNION ALL SELECT 'comment'
  UNION ALL SELECT 'event_new'
  UNION ALL SELECT 'event_changed'
  UNION ALL SELECT 'reminder'
) k
WHERE u.notify_by_email = 0;
