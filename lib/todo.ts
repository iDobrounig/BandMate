import { and, eq, gte, gt, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  songs,
  votes,
  practiceStatus,
  comments,
  users,
} from "@/lib/db/schema";

/**
 * „Was muss ich tun?" — die persönliche Aufgabenliste fürs Dashboard.
 * Entwurf: docs/specs/2026-07-23-benachrichtigungen-design.md
 *
 * Alle Daten liegen bereits in der DB; hier werden sie nur aus Sicht EINES
 * Mitglieds zusammengetragen. Reine Lesefunktion — das Fortschreiben von
 * lastSeenAt macht der Aufrufer (Dashboard), damit „neu seit letztem Besuch"
 * den vorigen Wert nutzen kann.
 */

export type TodoData = {
  offeneTermine: { id: number; title: string; date: string; startTime: string | null }[];
  offeneVorschlaege: { id: number; title: string; artist: string | null }[];
  ungeuebteAgenda: {
    eventId: number;
    eventTitle: string;
    date: string;
    songs: { id: number; title: string }[];
  }[];
  neueKommentare: number;
  gesamt: number;
};

const heute = () => new Date().toISOString().slice(0, 10);

function inTagen(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function fetchTodo(
  userId: number,
  lastSeenAt: Date | null
): Promise<TodoData> {
  const bis14 = inTagen(14);

  // --- Termine der nächsten 14 Tage OHNE eigene Rückmeldung ----------------
  const offeneTermine = await db
    .select({
      id: events.id,
      title: events.title,
      date: events.date,
      startTime: events.startTime,
    })
    .from(events)
    .where(
      and(
        isNull(events.deletedAt),
        gte(events.date, heute()),
        lte(events.date, bis14),
        sql`not exists (select 1 from event_attendance a where a.event_id = events.id and a.user_id = ${userId})`
      )
    )
    .orderBy(events.date, events.startTime);

  // --- Offene Vorschläge, für die ich noch nicht abgestimmt habe ------------
  const offeneVorschlaege = await db
    .select({ id: songs.id, title: songs.title, artist: songs.artist })
    .from(songs)
    .where(
      and(
        isNull(songs.deletedAt),
        eq(songs.status, "suggestion"),
        sql`not exists (select 1 from votes v where v.song_id = songs.id and v.user_id = ${userId})`
      )
    )
    .orderBy(songs.title);

  // --- Songs der nächsten Probe-Agenda, die ich noch nicht „kann" ----------
  // Nur die zeitlich nächste anstehende Probe/Gig mit Agenda.
  const [naechster] = await db
    .select({ id: events.id, title: events.title, date: events.date })
    .from(events)
    .where(
      and(
        isNull(events.deletedAt),
        gte(events.date, heute()),
        sql`exists (select 1 from event_songs es where es.event_id = events.id)`
      )
    )
    .orderBy(events.date, events.startTime)
    .limit(1);

  const ungeuebteAgenda: TodoData["ungeuebteAgenda"] = [];
  if (naechster) {
    const offen = await db
      .select({ id: songs.id, title: songs.title })
      .from(eventSongs)
      .innerJoin(songs, eq(eventSongs.songId, songs.id))
      .where(
        and(
          eq(eventSongs.eventId, naechster.id),
          isNull(songs.deletedAt),
          sql`not exists (select 1 from practice_status p where p.song_id = songs.id and p.user_id = ${userId} and p.status = 'ready')`
        )
      )
      .orderBy(eventSongs.position);
    if (offen.length > 0) {
      ungeuebteAgenda.push({
        eventId: naechster.id,
        eventTitle: naechster.title,
        date: naechster.date,
        songs: offen,
      });
    }
  }

  // --- Neue Kommentare seit dem letzten Besuch (von anderen) ---------------
  let neueKommentare = 0;
  if (lastSeenAt) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(comments)
      .innerJoin(songs, eq(comments.songId, songs.id))
      .where(
        and(
          isNull(songs.deletedAt),
          ne(comments.userId, userId),
          gt(comments.createdAt, lastSeenAt)
        )
      );
    neueKommentare = row?.n ?? 0;
  }

  const gesamt =
    offeneTermine.length +
    offeneVorschlaege.length +
    ungeuebteAgenda.reduce((s, a) => s + a.songs.length, 0) +
    neueKommentare;

  return {
    offeneTermine,
    offeneVorschlaege,
    ungeuebteAgenda,
    neueKommentare,
    gesamt,
  };
}

/**
 * Schreibt lastSeenAt auf jetzt fort — vom Dashboard NACH dem Lesen aufgerufen.
 * Gibt den vorigen Wert zurück, damit der Aufrufer „neu seit …" berechnen kann,
 * ohne selbst doppelt zu lesen.
 */
export async function touchLastSeen(userId: number): Promise<Date | null> {
  const vorher = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { lastSeenAt: true },
  });
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
  return vorher?.lastSeenAt ?? null;
}
