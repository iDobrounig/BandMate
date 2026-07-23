import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  songs,
  votes,
  comments,
  attachments,
  practiceStatus,
  users,
  events,
  setlists,
  type Song,
  type Setlist,
  type BandEvent,
  type AttendanceStatus,
} from "@/lib/db/schema";
import {
  songAktiv,
  setlistAktiv,
  eventAktiv,
  anhangAktiv,
} from "@/lib/db/filters";

export type SongListItem = Song & {
  upvotes: number;
  downvotes: number;
  myVote: number;
  commentCount: number;
  audioCount: number;
  sheetCount: number;
  readyCount: number;
  suggestedByName: string | null;
};

/** Songliste mit allen Zählern (Votes, Kommentare, Dateien, Übe-Status). */
export async function fetchSongList(currentUserId: number): Promise<SongListItem[]> {
  const rows = await db
    .select({
      song: songs,
      suggestedByName: users.name,
      upvotes: sql<number>`coalesce((select count(*) from votes v where v.song_id = songs.id and v.value > 0), 0)`,
      downvotes: sql<number>`coalesce((select count(*) from votes v where v.song_id = songs.id and v.value < 0), 0)`,
      myVote: sql<number>`coalesce((select v.value from votes v where v.song_id = songs.id and v.user_id = ${currentUserId}), 0)`,
      commentCount: sql<number>`(select count(*) from comments c where c.song_id = songs.id)`,
      audioCount: sql<number>`(select count(*) from attachments a where a.song_id = songs.id and a.kind = 'audio' and a.deleted_at is null)`,
      sheetCount: sql<number>`(select count(*) from attachments a where a.song_id = songs.id and a.kind = 'sheet' and a.deleted_at is null)`,
      readyCount: sql<number>`(select count(*) from practice_status p where p.song_id = songs.id and p.status = 'ready')`,
    })
    .from(songs)
    .leftJoin(users, eq(songs.suggestedById, users.id))
    .where(songAktiv)
    .orderBy(desc(songs.createdAt));

  return rows.map((r) => ({
    ...r.song,
    suggestedByName: r.suggestedByName,
    upvotes: r.upvotes,
    downvotes: r.downvotes,
    myVote: r.myVote,
    commentCount: r.commentCount,
    audioCount: r.audioCount,
    sheetCount: r.sheetCount,
    readyCount: r.readyCount,
  }));
}

/**
 * Anhang für die Auslieferung über `/api/files/[id]` — oder `null`, wenn er
 * nicht (mehr) herausgegeben werden darf.
 *
 * Zwei Bedingungen, nicht eine: Der Anhang selbst kann im Papierkorb liegen,
 * ODER der Song, zu dem er gehört. Beim Löschen eines Songs bleiben seine
 * Anhänge unmarkiert (Soft Delete kennt keinen Cascade) — ohne den Join wären
 * die Noten und Aufnahmen eines gelöschten Songs weiter per Direktlink
 * abrufbar und der Papierkorb per URL umgehbar.
 */
export async function fetchServableAttachment(attachmentId: number) {
  const [row] = await db
    .select({ attachment: attachments })
    .from(attachments)
    .innerJoin(songs, eq(attachments.songId, songs.id))
    .where(and(eq(attachments.id, attachmentId), anhangAktiv, songAktiv))
    .limit(1);
  return row?.attachment ?? null;
}

/**
 * Wo taucht der Song sonst noch auf? Für den Löschdialog (Entwurf E5): Weil
 * Verweise beim Soft Delete stehen bleiben und die Queries sie nur ausblenden,
 * schrumpft eine Setliste beim Löschen scheinbar grundlos. Der Dialog sagt
 * vorher, was passieren wird.
 */
export async function fetchSongReferences(songId: number) {
  const [zeile] = await db
    .select({
      setlistCount: sql<number>`(select count(*) from setlist_items i join setlists sl on sl.id = i.setlist_id where i.song_id = ${songId} and sl.deleted_at is null)`,
      agendaCount: sql<number>`(select count(*) from event_songs es join events e on e.id = es.event_id where es.song_id = ${songId} and e.deleted_at is null)`,
    })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1);
  return zeile ?? { setlistCount: 0, agendaCount: 0 };
}

export type SetlistListItem = Setlist & {
  songCount: number;
  totalSeconds: number;
};

/** Setlisten-Übersicht mit Anzahl Songs und Gesamtdauer. */
export async function fetchSetlists(): Promise<SetlistListItem[]> {
  const rows = await db
    .select({
      setlist: setlists,
      songCount: sql<number>`(select count(*) from setlist_items i join songs s on s.id = i.song_id where i.setlist_id = setlists.id and s.deleted_at is null)`,
      totalSeconds: sql<number>`coalesce((select sum(s.duration_seconds) from setlist_items i join songs s on s.id = i.song_id where i.setlist_id = setlists.id and s.deleted_at is null), 0)`,
    })
    .from(setlists)
    .where(setlistAktiv)
    .orderBy(desc(setlists.createdAt));

  return rows.map((r) => ({
    ...r.setlist,
    songCount: r.songCount,
    totalSeconds: r.totalSeconds,
  }));
}

export type EventListItem = BandEvent & {
  yesCount: number;
  noCount: number;
  maybeCount: number;
  myStatus: AttendanceStatus | null;
  setlistName: string | null;
};

/** Termine mit Zu-/Absage-Zählern und eigenem Status. */
export async function fetchEvents(
  currentUserId: number,
  opts: { past?: boolean; limit?: number } = {}
): Promise<EventListItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  let query = db
    .select({
      event: events,
      setlistName: setlists.name,
      yesCount: sql<number>`(select count(*) from event_attendance a where a.event_id = events.id and a.status = 'yes')`,
      noCount: sql<number>`(select count(*) from event_attendance a where a.event_id = events.id and a.status = 'no')`,
      maybeCount: sql<number>`(select count(*) from event_attendance a where a.event_id = events.id and a.status = 'maybe')`,
      myStatus: sql<AttendanceStatus | null>`(select a.status from event_attendance a where a.event_id = events.id and a.user_id = ${currentUserId})`,
    })
    .from(events)
    // Der Filter gehört in die JOIN-Bedingung, nicht ins WHERE: sonst würde ein
    // Termin mit gelöschter Setliste ganz aus der Liste fallen statt nur den
    // Namen zu verlieren.
    .leftJoin(setlists, and(eq(events.setlistId, setlists.id), setlistAktiv))
    .where(
      and(
        eventAktiv,
        opts.past ? lt(events.date, today) : gte(events.date, today)
      )
    )
    .orderBy(
      opts.past ? desc(events.date) : asc(events.date),
      asc(events.startTime)
    )
    .$dynamic();
  if (opts.limit) query = query.limit(opts.limit);

  const rows = await query;
  return rows.map((r) => ({
    ...r.event,
    setlistName: r.setlistName,
    yesCount: r.yesCount,
    noCount: r.noCount,
    maybeCount: r.maybeCount,
    myStatus: r.myStatus,
  }));
}

/** Alles für die Song-Detailseite. */
export async function fetchSongDetail(songId: number) {
  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, songId), songAktiv),
  });
  if (!song) return null;

  const [links, files, songComments, songVotes, practice, allUsers, suggestedBy] =
    await Promise.all([
      db.query.songLinks.findMany({
        where: (l, { eq }) => eq(l.songId, songId),
      }),
      db.query.attachments.findMany({
        where: (a, { eq, and, isNull }) =>
          and(eq(a.songId, songId), isNull(a.deletedAt)),
        orderBy: (a, { asc }) => [asc(a.kind), asc(a.instrument)],
      }),
      db
        .select({ comment: comments, userName: users.name })
        .from(comments)
        .innerJoin(users, eq(comments.userId, users.id))
        .where(eq(comments.songId, songId))
        .orderBy(comments.createdAt),
      db
        .select({ userId: votes.userId, value: votes.value, userName: users.name })
        .from(votes)
        .innerJoin(users, eq(votes.userId, users.id))
        .where(eq(votes.songId, songId)),
      db
        .select({
          userId: practiceStatus.userId,
          status: practiceStatus.status,
        })
        .from(practiceStatus)
        .where(eq(practiceStatus.songId, songId)),
      db
        .select({ id: users.id, name: users.name, instrument: users.instrument })
        .from(users)
        .where(eq(users.active, true))
        .orderBy(users.name),
      song.suggestedById
        ? db.query.users.findFirst({
            where: eq(users.id, song.suggestedById),
            columns: { name: true },
          })
        : Promise.resolve(undefined),
    ]);

  return {
    song,
    links,
    files,
    comments: songComments,
    votes: songVotes,
    practice,
    allUsers,
    suggestedByName: suggestedBy?.name ?? null,
  };
}
