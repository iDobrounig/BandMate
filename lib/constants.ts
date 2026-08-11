import type {
  SongStatus,
  PracticeState,
  EventKind,
  AttendanceStatus,
  NotificationKind,
  NotificationMode,
} from "@/lib/db/schema";

export const SONG_STATUS: Record<
  SongStatus,
  { label: string; badge: string; dot: string }
> = {
  suggestion: {
    label: "Vorschlag",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dot: "bg-sky-400",
  },
  rehearsing: {
    label: "In Probe",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  repertoire: {
    label: "Repertoire",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  archived: {
    label: "Archiv",
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    dot: "bg-zinc-500",
  },
};

export const STATUS_ORDER: SongStatus[] = [
  "suggestion",
  "rehearsing",
  "repertoire",
  "archived",
];

export const PRACTICE_STATUS: Record<
  PracticeState,
  { label: string; short: string; color: string }
> = {
  not_started: {
    label: "Noch nicht angeschaut",
    short: "offen",
    color: "bg-zinc-500",
  },
  practicing: { label: "Übe noch", short: "übt", color: "bg-amber-400" },
  ready: { label: "Kann ich", short: "sitzt", color: "bg-emerald-400" },
};

export const EVENT_KIND: Record<
  EventKind,
  { label: string; badge: string; bar: string }
> = {
  rehearsal: {
    label: "Probe",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    bar: "bg-sky-400",
  },
  gig: {
    label: "Gig",
    badge: "bg-accent/15 text-accent-hi border-accent/40",
    bar: "bg-accent",
  },
};

export const ATTENDANCE_STATUS: Record<
  AttendanceStatus,
  { label: string; symbol: string; color: string; btnActive: string }
> = {
  yes: {
    label: "Zusagen",
    symbol: "✓",
    color: "text-emerald-400",
    btnActive: "border-emerald-500/60 bg-emerald-500/15 text-emerald-300",
  },
  maybe: {
    label: "Vielleicht",
    symbol: "?",
    color: "text-amber-400",
    btnActive: "border-amber-500/60 bg-amber-500/15 text-amber-300",
  },
  no: {
    label: "Absagen",
    symbol: "✗",
    color: "text-red-400",
    btnActive: "border-red-500/60 bg-red-500/15 text-red-300",
  },
};

export const INSTRUMENT_SUGGESTIONS = [
  "Gesang",
  "Gitarre",
  "E-Gitarre",
  "Akustikgitarre",
  "Bass",
  "Schlagzeug",
  "Keys",
  "Klavier",
  "Saxophon",
  "Trompete",
  "Posaune",
  "Percussion",
  "Geige",
  "Alle",
];

/**
 * Benachrichtigungen: welche Ereignisse gibt es, und was ist der Standard?
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * `default` gilt, solange in `notification_settings` keine Zeile steht — es
 * werden nur Abweichungen gespeichert. Ein später ergänzter Ereignistyp
 * bekommt dadurch automatisch einen sinnvollen Wert, ohne Nachmigration.
 */
export const NOTIFY_KINDS: Record<
  NotificationKind,
  { label: string; hint: string; default: NotificationMode; modes: NotificationMode[] }
> = {
  suggestion: {
    label: "Neue Songvorschläge",
    hint: "Wenn jemand einen Song zur Abstimmung stellt",
    default: "sofort",
    modes: ["sofort", "gesammelt", "nie"],
  },
  comment: {
    label: "Kommentare im Bandchat",
    hint: "Wenn jemand etwas zu einem Song schreibt",
    default: "sofort",
    modes: ["sofort", "gesammelt", "nie"],
  },
  event_new: {
    label: "Neue Termine",
    hint: "Wenn eine Probe oder ein Gig angelegt wird",
    default: "sofort",
    modes: ["sofort", "gesammelt", "nie"],
  },
  event_changed: {
    label: "Geänderte Termine",
    hint: "Wenn sich Datum, Uhrzeit oder Ort ändern",
    default: "sofort",
    modes: ["sofort", "gesammelt", "nie"],
  },
  reminder: {
    label: "Termin-Erinnerungen",
    // Eine Erinnerung im Wochen-Digest wäre sinnlos — deshalb kein "gesammelt".
    hint: "Zwei Tage vorher, wenn du noch nicht zugesagt hast, und am Vortag",
    default: "sofort",
    modes: ["sofort", "nie"],
  },
};

export const NOTIFY_KIND_ORDER: NotificationKind[] = [
  "reminder",
  "event_new",
  "event_changed",
  "suggestion",
  "comment",
];

export const NOTIFY_MODES: Record<NotificationMode, { label: string; hint: string }> = {
  sofort: { label: "Sofort", hint: "eigene Mail, sobald es passiert" },
  gesammelt: { label: "Gesammelt", hint: "nur im Wochen-Digest am Sonntag" },
  nie: { label: "Nie", hint: "gar keine Mail" },
};

/**
 * Aufbewahrung im Papierkorb. Muss KÜRZER bleiben als `RETENTION_DAYS` in
 * `scripts/backup.sh` (35) — sonst liegt eine endgültig gelöschte Datei in
 * keinem Backup mehr, weil die Läufe aus ihrer Lebenszeit längst rotiert sind.
 * Siehe docs/specs/2026-07-23-papierkorb-design.md.
 */
export const TRASH_RETENTION_DAYS = 30;

export const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
export const SHEET_MAX_BYTES = 20 * 1024 * 1024;

export const AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
]);

export const SHEET_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/**
 * Browser-Audio-Aufnahme (MediaRecorder): Ziel-Bitrate fürs ffmpeg-Transcoding
 * nach OGG/Opus. Bewusst niedrig, damit auch mehrstündige Proben-Mitschnitte
 * unter dem Server-Action-Limit (next.config.ts, 60 MB) bleiben.
 */
export const RECORDING_BITRATE_KBPS = 48;

/** Sicherheits-Auto-Stopp, falls das Stoppen der Aufnahme vergessen wird. */
export const RECORDING_MAX_MS = 3 * 60 * 60 * 1000;
