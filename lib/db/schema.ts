import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  instrument: text("instrument"),
  notifyByEmail: integer("notify_by_email", { mode: "boolean" })
    .notNull()
    .default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  // Unverschlüsselt gespeichert — kein Hashing-Präzedenzfall im Projekt,
  // geringer Wert als Angriffsziel bei einer Handvoll interner Nutzer.
  resetToken: text("reset_token"),
  resetTokenExpiresAt: integer("reset_token_expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const songs = sqliteTable("songs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  artist: text("artist"),
  status: text("status", {
    enum: ["suggestion", "rehearsing", "repertoire", "archived"],
  })
    .notNull()
    .default("suggestion"),
  tempoBpm: integer("tempo_bpm"),
  songKey: text("song_key"),
  capo: integer("capo"),
  durationSeconds: integer("duration_seconds"),
  lyricsChords: text("lyrics_chords"),
  notes: text("notes"),
  suggestedById: integer("suggested_by_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const songLinks = sqliteTable("song_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  kind: text("kind", { enum: ["youtube", "spotify", "other"] })
    .notNull()
    .default("other"),
});

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["audio", "sheet"] }).notNull(),
  instrument: text("instrument"),
  storedName: text("stored_name").notNull(),
  originalName: text("original_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const votes = sqliteTable(
  "votes",
  {
    songId: integer("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    value: integer("value").notNull(), // +1 oder -1
  },
  (t) => [primaryKey({ columns: [t.songId, t.userId] })]
);

export const practiceStatus = sqliteTable(
  "practice_status",
  {
    songId: integer("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["not_started", "practicing", "ready"] })
      .notNull()
      .default("not_started"),
  },
  (t) => [primaryKey({ columns: [t.songId, t.userId] })]
);

export const setlists = sqliteTable("setlists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  eventDate: text("event_date"), // ISO-Datum YYYY-MM-DD
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const setlistItems = sqliteTable("setlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  note: text("note"),
});

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["rehearsal", "gig"] })
    .notNull()
    .default("rehearsal"),
  date: text("date").notNull(), // ISO-Datum YYYY-MM-DD
  startTime: text("start_time"), // HH:MM
  location: text("location"),
  notes: text("notes"),
  setlistId: integer("setlist_id").references(() => setlists.id, {
    onDelete: "set null",
  }),
  seriesId: text("series_id"), // gemeinsame ID für wöchentliche Serien
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const eventAttendance = sqliteTable(
  "event_attendance",
  {
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ["yes", "no", "maybe"] }).notNull(),
    comment: text("comment"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })]
);

export const eventSongs = sqliteTable("event_songs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  songId: integer("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
});

export type User = typeof users.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type SongLink = typeof songLinks.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Setlist = typeof setlists.$inferSelect;
export type SetlistItem = typeof setlistItems.$inferSelect;

export type SongStatus = Song["status"];
export type PracticeState = (typeof practiceStatus.$inferSelect)["status"];
export type BandEvent = typeof events.$inferSelect;
export type EventKind = BandEvent["kind"];
export type AttendanceStatus = (typeof eventAttendance.$inferSelect)["status"];
