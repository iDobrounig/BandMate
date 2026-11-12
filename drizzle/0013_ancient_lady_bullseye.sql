ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `attachments_song_id_idx` ON `attachments` (`song_id`);--> statement-breakpoint
CREATE INDEX `band_members_user_id_idx` ON `band_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `comments_song_id_idx` ON `comments` (`song_id`);--> statement-breakpoint
CREATE INDEX `equipment_band_id_idx` ON `equipment` (`band_id`);--> statement-breakpoint
CREATE INDEX `equipment_attachments_equipment_id_idx` ON `equipment_attachments` (`equipment_id`);--> statement-breakpoint
CREATE INDEX `event_songs_event_id_idx` ON `event_songs` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_songs_song_id_idx` ON `event_songs` (`song_id`);--> statement-breakpoint
CREATE INDEX `events_band_id_date_idx` ON `events` (`band_id`,`date`);--> statement-breakpoint
CREATE INDEX `events_setlist_id_idx` ON `events` (`setlist_id`);--> statement-breakpoint
CREATE INDEX `events_series_id_idx` ON `events` (`series_id`);--> statement-breakpoint
CREATE INDEX `invites_band_id_idx` ON `invites` (`band_id`);--> statement-breakpoint
CREATE INDEX `setlist_items_setlist_id_idx` ON `setlist_items` (`setlist_id`);--> statement-breakpoint
CREATE INDEX `setlist_items_song_id_idx` ON `setlist_items` (`song_id`);--> statement-breakpoint
CREATE INDEX `setlists_band_id_idx` ON `setlists` (`band_id`);--> statement-breakpoint
CREATE INDEX `song_links_song_id_idx` ON `song_links` (`song_id`);--> statement-breakpoint
CREATE INDEX `songs_band_id_idx` ON `songs` (`band_id`);