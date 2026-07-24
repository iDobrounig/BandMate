import { formatDate } from "@/lib/format";

/**
 * Welche Termin-Felder sind eine Benachrichtigung wert?
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * Nur Datum, Uhrzeit, Ort — was Planung und Anwesenheit betrifft. Titel,
 * Notizen oder die Setlisten-Verknüpfung lösen bewusst nichts aus: das wäre
 * Kosmetik und der häufigste Grund, warum jemand Benachrichtigungen abdreht.
 *
 * Reine Funktion (kein "use server"), damit sie ohne DB testbar ist.
 */

export type EventNotifyFields = {
  date: string;
  startTime: string | null;
  location: string | null;
};

/**
 * Beschreibt die relevanten Änderungen als „alt → neu"-Zeilen. Leeres Array =
 * nichts Benachrichtigungswürdiges geändert (dann geht keine Mail raus, auch
 * wenn die Checkbox gesetzt war).
 */
export function describeEventChanges(
  alt: EventNotifyFields,
  neu: EventNotifyFields
): string[] {
  const zeilen: string[] = [];
  const zeige = (v: string | null) => (v && v.trim() ? v : "—");

  if (alt.date !== neu.date) {
    zeilen.push(`Datum: ${formatDate(alt.date)} → ${formatDate(neu.date)}`);
  }
  if ((alt.startTime ?? "") !== (neu.startTime ?? "")) {
    zeilen.push(
      `Uhrzeit: ${alt.startTime ? `${alt.startTime} Uhr` : "—"} → ${
        neu.startTime ? `${neu.startTime} Uhr` : "—"
      }`
    );
  }
  if ((alt.location ?? "") !== (neu.location ?? "")) {
    zeilen.push(`Ort: ${zeige(alt.location)} → ${zeige(neu.location)}`);
  }
  return zeilen;
}
