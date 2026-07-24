import { formatDateTime } from "@/lib/format";
import type { ReminderStatus } from "@/lib/notifications";
import { IconCalendar } from "@/components/icons";

/**
 * Statuszeile für Admins: verrät einen stillen Ausfall der Termin-Erinnerungen
 * (Cron nicht eingerichtet, Server aus, Script kaputt). Deshalb immer sichtbar —
 * eine Zeile, die nur bei Problemen auftaucht, würde man beim Fehlen nicht
 * vermissen. Entwurf E3.
 */
export function ReminderStatusLine({ status }: { status: ReminderStatus }) {
  const { lastRunAt, sentCount, errorCount, stale } = status;

  const text = !lastRunAt
    ? "Noch kein Erinnerungs-Lauf verzeichnet — Cron-Job eingerichtet?"
    : `Letzter Erinnerungs-Lauf: ${formatDateTime(lastRunAt)} · ` +
      `${sentCount} Mail${sentCount === 1 ? "" : "s"}` +
      (errorCount > 0 ? ` · ${errorCount} Fehler` : " · keine Fehler");

  return (
    <div
      className={`card flex items-center gap-3 p-3 text-sm ${
        stale
          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
          : "text-mute"
      }`}
    >
      <IconCalendar className={`size-4 shrink-0 ${stale ? "text-amber-400" : "text-faint"}`} />
      <span className="min-w-0 flex-1">{text}</span>
      {stale && (
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-amber-300">
          prüfen
        </span>
      )}
    </div>
  );
}
