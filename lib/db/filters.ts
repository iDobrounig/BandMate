import { isNull } from "drizzle-orm";
import { songs, setlists, events, attachments } from "@/lib/db/schema";

/**
 * Papierkorb-Filter: alles mit `deletedAt IS NULL` gilt als aktiv.
 * Entwurf: docs/specs/2026-07-23-papierkorb-design.md
 *
 * Bewusst je ein fertiges Prädikat pro Tabelle statt einer generischen
 * Hilfsfunktion — so bleibt an der Aufrufstelle sichtbar, WELCHE Tabelle
 * gefiltert wird, und Drizzle behält die Spaltentypen.
 *
 * In den handgeschriebenen Zähl-Subqueries (`lib/queries.ts`) steht der Filter
 * direkt als `<alias>.deleted_at is null` im SQL. Dort geht es nicht anders:
 * Drizzle rendert `${table.column}` in `sql`-Subqueries unqualifiziert, was zu
 * mehrdeutigen Spaltenbezügen führt (AGENTS.md, „Stolperfallen").
 */
export const songAktiv = isNull(songs.deletedAt);
export const setlistAktiv = isNull(setlists.deletedAt);
export const eventAktiv = isNull(events.deletedAt);
export const anhangAktiv = isNull(attachments.deletedAt);
