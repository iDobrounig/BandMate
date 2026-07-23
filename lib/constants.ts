import type {
  SongStatus,
  PracticeState,
  EventKind,
  AttendanceStatus,
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
