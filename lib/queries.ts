import { asc, desc, eq, gte, lt, sql } from "drizzle-orm";
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
  type BandEvent,
  type AttendanceStatus,
} from "@/lib/db/schema";

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
      audioCount: sql<number>`(select count(*) from attachments a where a.song_id = songs.id and a.kind = 'audio')`,
      sheetCount: sql<number>`(select count(*) from attachments a where a.song_id = songs.id and a.kind = 'sheet')`,
      readyCount: sql<number>`(select count(*) from practice_status p where p.song_id = songs.id and p.status = 'ready')`,
    })
    .from(songs)
    .leftJoin(users, eq(songs.suggestedById, users.id))
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
    .leftJoin(setlists, eq(events.setlistId, setlists.id))
    .where(opts.past ? lt(events.date, today) : gte(events.date, today))
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
  const song = await db.query.songs.findFirst({ where: eq(songs.id, songId) });
  if (!song) return null;

  const [links, files, songComments, songVotes, practice, allUsers, suggestedBy] =
    await Promise.all([
      db.query.songLinks.findMany({
        where: (l, { eq }) => eq(l.songId, songId),
      }),
      db.query.attachments.findMany({
        where: (a, { eq }) => eq(a.songId, songId),
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
