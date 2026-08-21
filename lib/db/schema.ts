import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  unique,
} from "drizzle-orm/sqlite-core";

/**
 * Mandantenfähigkeit (Welle 4): `users` ist die globale Identität (Login, Mail,
 * Passwort). Die Bandzugehörigkeit inkl. Rolle und Instrument liegt in
 * `band_members`. Ein Super-Admin (isSuperAdmin) verwaltet Bands/User und ist
 * selbst NIE Bandmitglied. Entwurf: docs/superpowers/specs/2026-08-09-mandantenfaehigkeit-design.md
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // DEPRECATED seit Welle 4 — Rolle und Instrument leben jetzt pro Band in
  // `band_members`. Bleiben vorerst als Quelle für den einmaligen Backfill
  // stehen (siehe ensureTenancyBackfill in lib/db/index.ts); Drop später als
  // eigene Cleanup-Migration, wenn alle Installationen migriert sind.
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  instrument: text("instrument"),
  /** Verwaltet Bands und User global, ohne Zugriff auf Bandinhalte. */
  isSuperAdmin: integer("is_super_admin", { mode: "boolean" })
    .notNull()
    .default(false),
  digestEnabled: integer("digest_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  /** Für „neu seit deinem letzten Besuch"; höchstens stündlich fortgeschrieben. */
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  // Globaler Konto-Schalter (nur Super-Admin). Die bandlokale Mitgliedschaft
  // schaltet stattdessen band_members.active.
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  // Unverschlüsselt gespeichert — kein Hashing-Präzedenzfall im Projekt,
  // geringer Wert als Angriffsziel bei einer Handvoll interner Nutzer.
  resetToken: text("reset_token"),
  resetTokenExpiresAt: integer("reset_token_expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Eine Band = ein Mandant. Bandinhalte hängen über `bandId` hieran. */
export const bands = sqliteTable("bands", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  // Geheimer, pro Band eigener Token für den ICS-Feed (/api/kalender/[token]).
  // Zufällig bei Anlage, regenerierbar — löst den früher globalen Feed ab.
  calendarToken: text("calendar_token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Mitgliedschaft eines Users in einer Band, mit bandlokaler Rolle und
 * Instrument. `active = false` = aus der Band entfernt (Konto bleibt global
 * bestehen). Ein User kann in mehreren Bands mit je eigener Rolle sein.
 */
export const bandMembers = sqliteTable(
  "band_members",
  {
    bandId: integer("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["band_admin", "member"] })
      .notNull()
      .default("member"),
    instrument: text("instrument"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.bandId, t.userId] })]
);

/**
 * Einladungslink in eine Band (einmal verwendbar, zeitlich begrenzt) —
 * Verallgemeinerung des Passwort-Reset-Tokens. Deckt beide Fälle ab: bekannter
 * User tritt bei, oder neuer User legt über den Link Name + Passwort an.
 */
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bandId: integer("band_id")
    .notNull()
    .references(() => bands.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  role: text("role", { enum: ["band_admin", "member"] })
    .notNull()
    .default("member"),
  invitedById: integer("invited_by_id").references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const songs = sqliteTable("songs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Mandant. Nullable im DB-Schema (SQLite kann NOT NULL nicht nachrüsten), aber
  // von der App immer gesetzt; der Backfill füllt Altbestände. Siehe schema-Kopf.
  bandId: integer("band_id").references(() => bands.id),
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

export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bandId: integer("band_id").references(() => bands.id),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["amp", "mic", "cable_accessory", "pa_speaker", "light", "other"],
  })
    .notNull()
    .default("other"),
  status: text("status", {
    enum: ["in_use", "lent_out", "broken", "retired"],
  })
    .notNull()
    .default("in_use"),
  acquisitionDate: text("acquisition_date"), // ISO-Datum YYYY-MM-DD, wie events.date
  acquisitionCost: real("acquisition_cost"), // Euro
  // Anteil, den die Bandkasse direkt getragen hat (statt über eine Beteiligung
  // eines Mitglieds) — deckt sowohl teil- als auch komplett aus der Kassa
  // finanzierte Anschaffungen ab, ohne dass "offen" fälschlich > 0 bleibt.
  treasuryAmount: real("treasury_amount"), // Euro
  location: text("location"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
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

export const equipmentContributions = sqliteTable(
  "equipment_contributions",
  {
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amount: real("amount").notNull(), // Euro
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.equipmentId, t.userId] })]
);

export const equipmentAttachments = sqliteTable("equipment_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  equipmentId: integer("equipment_id")
    .notNull()
    .references(() => equipment.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["foto", "rechnung"] }).notNull(),
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
  source: text("source", { enum: ["upload", "recording"] })
    .notNull()
    .default("upload"),
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
  bandId: integer("band_id").references(() => bands.id),
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
  bandId: integer("band_id").references(() => bands.id),
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
export type Band = typeof bands.$inferSelect;
export type BandMember = typeof bandMembers.$inferSelect;
export type BandRole = BandMember["role"];
export type Invite = typeof invites.$inferSelect;
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
export type Equipment = typeof equipment.$inferSelect;
export type EquipmentCategory = Equipment["category"];
export type EquipmentStatus = Equipment["status"];
export type EquipmentContribution = typeof equipmentContributions.$inferSelect;
export type EquipmentAttachment = typeof equipmentAttachments.$inferSelect;
