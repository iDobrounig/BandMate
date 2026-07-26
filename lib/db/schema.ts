import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  unique,
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
  digestEnabled: integer("digest_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  /** Für „neu seit deinem letzten Besuch"; höchstens stündlich fortgeschrieben. */
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
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
  // Papierkorb: NULL = aktiv. Siehe docs/specs/2026-07-23-papierkorb-design.md
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedById: integer("deleted_by_id").references(() => users.id),
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
  // Papierkorb: NULL = aktiv. Siehe docs/specs/2026-07-23-papierkorb-design.md
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedById: integer("deleted_by_id").references(() => users.id),
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
  targetSeconds: integer("target_seconds"), // Zielzeit / gebuchte Spielzeit
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  // Papierkorb: NULL = aktiv. Siehe docs/specs/2026-07-23-papierkorb-design.md
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedById: integer("deleted_by_id").references(() => users.id),
});

export const setlistItems = sqliteTable("setlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  // Bei kind "section"/"break" ist songId null.
  songId: integer("song_id").references(() => songs.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["song", "section", "break"] })
    .notNull()
    .default("song"),
  label: text("label"), // Set-Name (section) bzw. Pausentext (break)
  breakSeconds: integer("break_seconds"), // Pausendauer (break)
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
  // Gig-Logistik (nur bei kind === "gig" befüllt). startTime dient bei Gigs
  // als Load-in — daher hier kein eigenes Load-in-Feld.
  soundcheckTime: text("soundcheck_time"), // HH:MM
  stageTime: text("stage_time"), // HH:MM Auftrittszeit
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  fee: real("fee"), // Gage in Euro, summierbar
  feeExtras: text("fee_extras"), // Verpflegung & Extras (Freitext)
  travelNotes: text("travel_notes"), // Anfahrt & Parken
  backlineNotes: text("backline_notes"), // Backline & Technik
  setlistId: integer("setlist_id").references(() => setlists.id, {
    onDelete: "set null",
  }),
  seriesId: text("series_id"), // gemeinsame ID für wöchentliche Serien
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  // Papierkorb: NULL = aktiv. Siehe docs/specs/2026-07-23-papierkorb-design.md
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedById: integer("deleted_by_id").references(() => users.id),
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

/**
 * Wer will worüber wie benachrichtigt werden?
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * Es werden nur ABWEICHUNGEN vom Standard gespeichert — fehlt eine Zeile, gilt
 * der Default aus NOTIFY_KINDS. Dadurch bekommt ein später ergänzter
 * Ereignistyp automatisch einen sinnvollen Wert, ohne Nachmigration.
 *
 * `channel` ist heute immer "mail". Die Spalte steht trotzdem schon hier, damit
 * Web Push später ohne zweite Schema-Migration dazukommt.
 */
export const notificationSettings = sqliteTable(
  "notification_settings",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", {
      enum: ["suggestion", "comment", "event_new", "event_changed", "reminder"],
    }).notNull(),
    channel: text("channel", { enum: ["mail"] }).notNull().default("mail"),
    mode: text("mode", { enum: ["sofort", "gesammelt", "nie"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind, t.channel] })]
);

/**
 * Was ist rausgegangen? Trägt zwei Aufgaben: Der eindeutige Index verhindert,
 * dass ein doppelter Cron-Lauf dieselbe Mail zweimal verschickt, und die
 * Fehlerspalte speist die Statuszeile auf dem Dashboard.
 */
export const notificationLog = sqliteTable(
  "notification_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull(),
    /** Worauf bezieht sich der Versand — z.B. "event" + Termin-ID. */
    refType: text("ref_type").notNull(),
    refId: integer("ref_id").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    status: text("status", { enum: ["ok", "fehler"] }).notNull(),
    error: text("error"),
  },
  (t) => [
    unique("notification_log_einmalig").on(t.kind, t.refType, t.refId, t.userId),
  ]
);

/**
 * Was hat der Cron getan? Auch „gelaufen, nichts zu tun" ist eine Information —
 * die fehlt im Log, ist aber genau die, die einen vergessenen Cron verrät.
 */
export const notificationRuns = sqliteTable("notification_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  art: text("art", { enum: ["reminders", "digest"] }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  sentCount: integer("sent_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  note: text("note"),
});

export type User = typeof users.$inferSelect;
export type NotificationKind =
  (typeof notificationSettings.$inferSelect)["kind"];
export type NotificationMode =
  (typeof notificationSettings.$inferSelect)["mode"];
export type NotificationRun = typeof notificationRuns.$inferSelect;
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
