import { and, desc, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { songs, setlists, events, attachments, users } from "@/lib/db/schema";
import { deleteStoredFile } from "@/lib/files";
import { TRASH_RETENTION_DAYS } from "@/lib/constants";

/**
 * Papierkorb — Abfragen und endgültiges Aufräumen.
 * Entwurf: docs/specs/2026-07-23-papierkorb-design.md
 *
 * Die Server-Actions (wiederherstellen, endgültig löschen) liegen in
 * lib/actions/trash.ts; hier steht nur die Logik ohne "use server", damit sie
 * auch aus dem Cron-Script (scripts/purge-trash.ts) nutzbar ist.
 */

export type TrashKind = "song" | "setlist" | "event" | "attachment";

export const TRASH_LABEL: Record<TrashKind, string> = {
  song: "Song",
  setlist: "Setliste",
  event: "Termin",
  attachment: "Datei",
};

export type TrashEntry = {
  kind: TrashKind;
  /** Bei Terminserien der erste Termin der Gruppe. */
  id: number;
  label: string;
  sublabel: string | null;
  deletedAt: Date;
  deletedByName: string | null;
  /** > 1 nur bei gesammelt gelöschten Terminserien. */
  count: number;
  /** Tage bis zum endgültigen Löschen, nie negativ. */
  restTage: number;
};

const KINDS: TrashKind[] = ["song", "setlist", "event", "attachment"];

/**
 * Zerlegt den `?undo=song:42`-Parameter. Liefert null bei allem, was nicht
 * passt — der Wert kommt aus der URL und ist damit frei manipulierbar.
 */
export function parseUndo(
  value: string | undefined
): { kind: TrashKind; id: number } | null {
  if (!value) return null;
  const [kindRaw, idRaw] = value.split(":");
  const id = Number(idRaw);
  if (!KINDS.includes(kindRaw as TrashKind) || !Number.isInteger(id) || id <= 0) {
    return null;
  }
  return { kind: kindRaw as TrashKind, id };
}

export function ablaufDatum(): Date {
  return new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

function restTage(deletedAt: Date): number {
  const vergangen = (Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - vergangen));
}

/** Alle Einträge im Papierkorb, neueste zuerst. */
export async function fetchTrash(): Promise<TrashEntry[]> {
  const [songRows, setlistRows, eventRows, attachmentRows] = await Promise.all([
    db
      .select({ id: songs.id, title: songs.title, artist: songs.artist, deletedAt: songs.deletedAt, byName: users.name })
      .from(songs)
      .leftJoin(users, eq(songs.deletedById, users.id))
      .where(isNotNull(songs.deletedAt)),
    db
      .select({ id: setlists.id, name: setlists.name, eventDate: setlists.eventDate, deletedAt: setlists.deletedAt, byName: users.name })
      .from(setlists)
      .leftJoin(users, eq(setlists.deletedById, users.id))
      .where(isNotNull(setlists.deletedAt)),
    db
      .select({ id: events.id, title: events.title, date: events.date, seriesId: events.seriesId, deletedAt: events.deletedAt, byName: users.name })
      .from(events)
      .leftJoin(users, eq(events.deletedById, users.id))
      .where(isNotNull(events.deletedAt))
      .orderBy(events.date),
    db
      .select({ id: attachments.id, name: attachments.originalName, songTitle: songs.title, deletedAt: attachments.deletedAt, byName: users.name })
      .from(attachments)
      .innerJoin(songs, eq(attachments.songId, songs.id))
      .leftJoin(users, eq(attachments.deletedById, users.id))
      .where(isNotNull(attachments.deletedAt)),
  ]);

  const eintraege: TrashEntry[] = [];

  for (const r of songRows) {
    eintraege.push({
      kind: "song", id: r.id, label: r.title, sublabel: r.artist,
      deletedAt: r.deletedAt!, deletedByName: r.byName, count: 1, restTage: restTage(r.deletedAt!),
    });
  }

  for (const r of setlistRows) {
    eintraege.push({
      kind: "setlist", id: r.id, label: r.name, sublabel: r.eventDate,
      deletedAt: r.deletedAt!, deletedByName: r.byName, count: 1, restTage: restTage(r.deletedAt!),
    });
  }

  // Eine gesammelt gelöschte Serie erscheint als EIN Eintrag. Gruppenschlüssel
  // ist (seriesId, deletedAt): ein einzeln gelöschter Termin einer Serie hat
  // einen anderen Zeitstempel und bleibt dadurch für sich stehen.
  const serien = new Map<string, typeof eventRows>();
  for (const r of eventRows) {
    const key = r.seriesId ? `${r.seriesId}|${r.deletedAt!.getTime()}` : `einzeln|${r.id}`;
    serien.set(key, [...(serien.get(key) ?? []), r]);
  }
  for (const gruppe of serien.values()) {
    const erster = gruppe[0];
    eintraege.push({
      kind: "event",
      id: erster.id,
      label: gruppe.length > 1 ? `Serie: ${erster.title}` : erster.title,
      sublabel:
        gruppe.length > 1
          ? `${gruppe.length} Termine, ${erster.date} bis ${gruppe[gruppe.length - 1].date}`
          : erster.date,
      deletedAt: erster.deletedAt!,
      deletedByName: erster.byName,
      count: gruppe.length,
      restTage: restTage(erster.deletedAt!),
    });
  }

  for (const r of attachmentRows) {
    eintraege.push({
      kind: "attachment", id: r.id, label: r.name, sublabel: `zu „${r.songTitle}"`,
      deletedAt: r.deletedAt!, deletedByName: r.byName, count: 1, restTage: restTage(r.deletedAt!),
    });
  }

  return eintraege.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/** Bezeichnung eines gelöschten Objekts — für das „Rückgängig"-Band. */
export async function fetchTrashLabel(kind: TrashKind, id: number): Promise<string | null> {
  if (kind === "song") {
    const r = await db.query.songs.findFirst({ where: eq(songs.id, id), columns: { title: true, deletedAt: true } });
    return r?.deletedAt ? r.title : null;
  }
  if (kind === "setlist") {
    const r = await db.query.setlists.findFirst({ where: eq(setlists.id, id), columns: { name: true, deletedAt: true } });
    return r?.deletedAt ? r.name : null;
  }
  if (kind === "event") {
    const r = await db.query.events.findFirst({ where: eq(events.id, id), columns: { title: true, deletedAt: true } });
    return r?.deletedAt ? r.title : null;
  }
  const r = await db.query.attachments.findFirst({ where: eq(attachments.id, id), columns: { originalName: true, deletedAt: true } });
  return r?.deletedAt ? r.originalName : null;
}

/**
 * Termine, die zusammen mit diesem gelöscht wurden — also die ganze Serie,
 * wenn sie gesammelt weggeworfen wurde, sonst nur dieser eine.
 */
async function serienGeschwister(eventId: number): Promise<number[]> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event?.deletedAt) return [];
  if (!event.seriesId) return [event.id];
  const gruppe = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.seriesId, event.seriesId), eq(events.deletedAt, event.deletedAt)));
  return gruppe.map((g) => g.id);
}

/** Holt einen Eintrag aus dem Papierkorb zurück. Liefert die Anzahl betroffener Zeilen. */
export async function restore(kind: TrashKind, id: number): Promise<number> {
  const zurueck = { deletedAt: null, deletedById: null };

  if (kind === "song") {
    const r = await db.update(songs).set(zurueck).where(and(eq(songs.id, id), isNotNull(songs.deletedAt))).returning({ id: songs.id });
    return r.length;
  }
  if (kind === "setlist") {
    const r = await db.update(setlists).set(zurueck).where(and(eq(setlists.id, id), isNotNull(setlists.deletedAt))).returning({ id: setlists.id });
    return r.length;
  }
  if (kind === "event") {
    const ids = await serienGeschwister(id);
    let n = 0;
    for (const eventId of ids) {
      const r = await db.update(events).set(zurueck).where(eq(events.id, eventId)).returning({ id: events.id });
      n += r.length;
    }
    return n;
  }
  const r = await db.update(attachments).set(zurueck).where(and(eq(attachments.id, id), isNotNull(attachments.deletedAt))).returning({ id: attachments.id });
  return r.length;
}

/**
 * Löscht einen Eintrag endgültig — Datenbankzeile UND Dateien auf der Platte.
 * Reihenfolge zählt: erst die Dateipfade einsammeln, dann löschen. Nach dem
 * DELETE auf `songs` sind die Anhang-Zeilen per Cascade weg und die Pfade
 * nicht mehr ermittelbar.
 */
export async function purge(kind: TrashKind, id: number): Promise<number> {
  if (kind === "song") {
    const song = await db.query.songs.findFirst({ where: and(eq(songs.id, id), isNotNull(songs.deletedAt)) });
    if (!song) return 0;
    const dateien = await db.query.attachments.findMany({ where: eq(attachments.songId, id) });
    for (const datei of dateien) deleteStoredFile(id, datei.storedName);
    await db.delete(songs).where(eq(songs.id, id));
    return 1;
  }
  if (kind === "setlist") {
    const r = await db.delete(setlists).where(and(eq(setlists.id, id), isNotNull(setlists.deletedAt))).returning({ id: setlists.id });
    return r.length;
  }
  if (kind === "event") {
    const ids = await serienGeschwister(id);
    let n = 0;
    for (const eventId of ids) {
      const r = await db.delete(events).where(eq(events.id, eventId)).returning({ id: events.id });
      n += r.length;
    }
    return n;
  }
  const anhang = await db.query.attachments.findFirst({ where: and(eq(attachments.id, id), isNotNull(attachments.deletedAt)) });
  if (!anhang) return 0;
  deleteStoredFile(anhang.songId, anhang.storedName);
  await db.delete(attachments).where(eq(attachments.id, id));
  return 1;
}

export type PurgeReport = Record<TrashKind, number>;

/**
 * Räumt alles endgültig weg, was länger als TRASH_RETENTION_DAYS im Papierkorb
 * liegt. Wird vom Cron-Script aufgerufen und zusätzlich beim Öffnen von
 * /papierkorb, damit der Bestand auch ohne eingerichteten Cron nicht wächst.
 */
export async function purgeExpired(): Promise<PurgeReport> {
  const grenze = ablaufDatum();
  const bericht: PurgeReport = { song: 0, setlist: 0, event: 0, attachment: 0 };

  // Anhänge zuerst: sonst nimmt ein purge des Songs sie per Cascade mit, bevor
  // sie einzeln gezählt werden könnten.
  const alteAnhaenge = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(isNotNull(attachments.deletedAt), lt(attachments.deletedAt, grenze)));
  for (const a of alteAnhaenge) bericht.attachment += await purge("attachment", a.id);

  const alteSongs = await db
    .select({ id: songs.id })
    .from(songs)
    .where(and(isNotNull(songs.deletedAt), lt(songs.deletedAt, grenze)));
  for (const s of alteSongs) bericht.song += await purge("song", s.id);

  const alteSetlisten = await db
    .select({ id: setlists.id })
    .from(setlists)
    .where(and(isNotNull(setlists.deletedAt), lt(setlists.deletedAt, grenze)));
  for (const s of alteSetlisten) bericht.setlist += await purge("setlist", s.id);

  const alteTermine = await db
    .select({ id: events.id })
    .from(events)
    .where(and(isNotNull(events.deletedAt), lt(events.deletedAt, grenze)))
    .orderBy(desc(events.id));
  for (const e of alteTermine) {
    // Serien werden gesammelt gelöscht — der zweite Aufruf trifft dann ins Leere.
    const noch = await db.query.events.findFirst({ where: eq(events.id, e.id) });
    if (noch) bericht.event += await purge("event", e.id);
  }

  return bericht;
}
