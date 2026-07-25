import { formatDate } from "@/lib/format";
import type { EventKind } from "@/lib/db/schema";

/**
 * Welche Termin-Felder sind eine Benachrichtigung wert?
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * Datum, Uhrzeit/Load-in, Ort — und bei Gigs zusätzlich Soundcheck- und
 * Auftrittszeit. Alles, was Planung und Anwesenheit betrifft. Titel, Notizen,
 * Setliste, Gage, Kontakt, Anfahrt, Backline lösen bewusst nichts aus: das
 * wäre Kosmetik und der häufigste Grund, warum jemand Benachrichtigungen
 * abdreht.
 *
 * Reine Funktion (kein "use server"), damit sie ohne DB testbar ist.
 */

export type EventNotifyFields = {
  date: string;
  startTime: string | null;
  location: string | null;
  soundcheckTime?: string | null;
  stageTime?: string | null;
};

/**
 * Beschreibt die relevanten Änderungen als „alt → neu"-Zeilen. Leeres Array =
 * nichts Benachrichtigungswürdiges geändert (dann geht keine Mail raus, auch
 * wenn die Checkbox gesetzt war). Bei Gigs heißt die startTime-Zeile „Load-in".
 */
export function describeEventChanges(
  alt: EventNotifyFields,
  neu: EventNotifyFields,
  kind: EventKind = "rehearsal"
): string[] {
  const zeilen: string[] = [];
  const zeige = (v: string | null | undefined) => (v && v.trim() ? v : "—");
  const zeit = (v: string | null | undefined) => (v ? `${v} Uhr` : "—");

  if (alt.date !== neu.date) {
    zeilen.push(`Datum: ${formatDate(alt.date)} → ${formatDate(neu.date)}`);
  }
  if ((alt.startTime ?? "") !== (neu.startTime ?? "")) {
    const label = kind === "gig" ? "Load-in" : "Uhrzeit";
    zeilen.push(`${label}: ${zeit(alt.startTime)} → ${zeit(neu.startTime)}`);
  }
  if ((alt.location ?? "") !== (neu.location ?? "")) {
    zeilen.push(`Ort: ${zeige(alt.location)} → ${zeige(neu.location)}`);
  }
  if ((alt.soundcheckTime ?? "") !== (neu.soundcheckTime ?? "")) {
    zeilen.push(`Soundcheck: ${zeit(alt.soundcheckTime)} → ${zeit(neu.soundcheckTime)}`);
  }
  if ((alt.stageTime ?? "") !== (neu.stageTime ?? "")) {
    zeilen.push(`Auftritt: ${zeit(alt.stageTime)} → ${zeit(neu.stageTime)}`);
  }
  return zeilen;
}
