import { and, asc, desc, eq, gte, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  songs,
  votes,
  comments,
  attachments,
  practiceStatus,
  users,
  events,
  eventSongs,
  setlists,
  setlistItems,
  bandMembers,
  equipment,
  equipmentContributions,
  equipmentAttachments,
  type Song,
  type Setlist,
  type BandEvent,
  type AttendanceStatus,
  type EventKind,
  type Equipment,
  type EquipmentAttachment,
} from "@/lib/db/schema";
import {
  songAktiv,
  setlistAktiv,
  eventAktiv,
  anhangAktiv,
  equipmentAktiv,
  equipmentAttachmentAktiv,
} from "@/lib/db/filters";
import { attendancePercentage } from "@/lib/attendance";
import { summarizeSetlist, compareTarget, type SetlistStructure } from "@/lib/setlist-structure";

export type BandMemberRow = {
  id: number;
  name: string;
  email: string;
  instrument: string | null;
  active: boolean;
};

/**
 * Mitglieder einer Band (aus `band_members`). Standardmäßig nur aktive; mit
 * `includeUserIds` kommen benannte inaktive/ausgetretene Mitglieder dazu (etwa
 * für Formulare, in denen ihre bestehende Beteiligung erhalten bleiben muss).
 */
export async function fetchBandMembers(
  bandId: number,
  opts: { includeUserIds?: number[] } = {}
): Promise<BandMemberRow[]> {
  const extra = opts.includeUserIds?.length
    ? or(eq(bandMembers.active, true), inArray(users.id, opts.includeUserIds))
    : eq(bandMembers.active, true);
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      instrument: bandMembers.instrument,
      active: bandMembers.active,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), extra))
    .orderBy(asc(users.name));
}

export type BandMemberAdminRow = {
  id: number;
  name: string;
  email: string;
  role: (typeof bandMembers.$inferSelect)["role"];
  instrument: string | null;
  active: boolean;
  digestEnabled: boolean;
};

/** Mitgliederliste für die Band-Admin-Verwaltung (mit Rolle + Digest-Schalter). */
export async function fetchBandMembersAdmin(bandId: number): Promise<BandMemberAdminRow[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: bandMembers.role,
      instrument: bandMembers.instrument,
      active: bandMembers.active,
      digestEnabled: users.digestEnabled,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(eq(bandMembers.bandId, bandId))
    .orderBy(asc(users.name));
}

/**
 * Ein einzelnes Mitglied für die Bearbeiten-Seite — `bandId`-gescoped, damit
 * kein Fremd-Nutzer über eine geratene ID editierbar ist. `null`, wenn die
 * Person nicht (mehr) zu dieser Band gehört.
 */
export async function fetchBandMemberAdmin(
  bandId: number,
  userId: number
): Promise<BandMemberAdminRow | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: bandMembers.role,
      instrument: bandMembers.instrument,
      active: bandMembers.active,
      digestEnabled: users.digestEnabled,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(users.id, userId)))
    .limit(1);
  return row ?? null;
}

export type SongListItem = Song & {
  upvotes: number;
  downvotes: number;
  myVote: number;
  commentCount: number;
  audioCount: number;
  sheetCount: number;
  readyCount: number;
  suggestedByName: string | null;
  lastEventAt: string | null;
};

/** Songliste mit allen Zählern (Votes, Kommentare, Dateien, Übe-Status). */
export async function fetchSongList(
  currentUserId: number,
  bandId: number
): Promise<SongListItem[]> {
  const today = new Date().toISOString().slice(0, 10);
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
      readyCount: sql<number>`(select count(*) from practice_status p join users u on u.id = p.user_id where p.song_id = songs.id and p.status = 'ready' and u.active = 1)`,
      // Repertoire-Gedächtnis: letzter (vergangener) Proben- ODER Gig-Termin mit
      // diesem Song in der Agenda. Für die Sortierung „am längsten nicht
      // gespielt" — Details/Aufschlüsselung nach Proben/Gigs liefert fetchSongUsage.
      lastEventAt: sql<string | null>`(select max(e.date) from event_songs es join events e on e.id = es.event_id where es.song_id = songs.id and e.deleted_at is null and e.date <= ${today})`,
    })
    .from(songs)
    .leftJoin(users, eq(songs.suggestedById, users.id))
    .where(and(songAktiv, eq(songs.bandId, bandId)))
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
    lastEventAt: r.lastEventAt,
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
export async function fetchServableAttachment(attachmentId: number, bandIds: number[]) {
  if (bandIds.length === 0) return null;
  const [row] = await db
    .select({ attachment: attachments })
    .from(attachments)
    .innerJoin(songs, eq(attachments.songId, songs.id))
    .where(
      and(eq(attachments.id, attachmentId), anhangAktiv, songAktiv, inArray(songs.bandId, bandIds))
    )
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

export type SongUsage = {
  lastRehearsedAt: string | null;
  lastPlayedAt: string | null;
  setlists: { id: number; name: string; eventDate: string | null }[];
  agenda: { id: number; title: string; date: string; kind: EventKind }[];
};

/**
 * Repertoire-Gedächtnis + Rückverweise für die Songseite: wo kommt der Song vor,
 * wann zuletzt geprobt/gespielt. Beides aus denselben zwei Verknüpfungstabellen,
 * daher eine gemeinsame Funktion statt zwei getrennter Abfragen.
 */
export async function fetchSongUsage(songId: number): Promise<SongUsage> {
  const today = new Date().toISOString().slice(0, 10);
  const [agenda, setlistRows] = await Promise.all([
    db
      .select({ id: events.id, title: events.title, date: events.date, kind: events.kind })
      .from(eventSongs)
      .innerJoin(events, eq(eventSongs.eventId, events.id))
      .where(and(eq(eventSongs.songId, songId), eventAktiv))
      .orderBy(desc(events.date)),
    db
      .select({ id: setlists.id, name: setlists.name, eventDate: setlists.eventDate })
      .from(setlistItems)
      .innerJoin(setlists, eq(setlistItems.setlistId, setlists.id))
      .where(and(eq(setlistItems.songId, songId), setlistAktiv))
      .orderBy(desc(setlists.eventDate)),
  ]);

  const past = agenda.filter((a) => a.date <= today);
  const lastRehearsedAt =
    past.filter((a) => a.kind === "rehearsal").map((a) => a.date).sort().at(-1) ?? null;
  const lastPlayedAt =
    past.filter((a) => a.kind === "gig").map((a) => a.date).sort().at(-1) ?? null;

  return { lastRehearsedAt, lastPlayedAt, setlists: setlistRows, agenda };
}

export type SetlistListItem = Setlist & {
  songCount: number;
  totalSeconds: number;
};

/** Setlisten-Übersicht mit Anzahl Songs und Gesamtdauer. */
export async function fetchSetlists(bandId: number): Promise<SetlistListItem[]> {
  const rows = await db
    .select({
      setlist: setlists,
      songCount: sql<number>`(select count(*) from setlist_items i join songs s on s.id = i.song_id where i.setlist_id = setlists.id and s.deleted_at is null)`,
      totalSeconds: sql<number>`coalesce((select sum(s.duration_seconds) from setlist_items i join songs s on s.id = i.song_id where i.setlist_id = setlists.id and s.deleted_at is null), 0)`,
    })
    .from(setlists)
    .where(and(setlistAktiv, eq(setlists.bandId, bandId)))
    .orderBy(desc(setlists.createdAt));

  return rows.map((r) => ({
    ...r.setlist,
    songCount: r.songCount,
    totalSeconds: r.totalSeconds,
  }));
}

export type SetlistPrintItem = {
  id: number;
  kind: "song" | "section" | "break";
  label: string | null;
  breakSeconds: number | null;
  note: string | null;
  title: string | null;
  artist: string | null;
  songKey: string | null;
  capo: number | null;
  tempoBpm: number | null;
  durationSeconds: number | null;
};

export type SetlistPrintData = {
  setlist: Setlist;
  items: SetlistPrintItem[];
  structure: SetlistStructure;
  cmp: { diffSeconds: number; over: boolean } | null;
  sectionSummaries: Map<number, { songCount: number; seconds: number }>;
};

/** Daten für beide Druckansichten (voll & kompakt) einer Setliste. null, wenn unbekannt/gelöscht. */
export async function getSetlistPrintData(
  setlistId: number,
  bandId: number
): Promise<SetlistPrintData | null> {
  const setlist = await db.query.setlists.findFirst({
    where: and(eq(setlists.id, setlistId), setlistAktiv, eq(setlists.bandId, bandId)),
  });
  if (!setlist) return null;

  const items = await db
    .select({
      id: setlistItems.id,
      kind: setlistItems.kind,
      label: setlistItems.label,
      breakSeconds: setlistItems.breakSeconds,
      note: setlistItems.note,
      title: songs.title,
      artist: songs.artist,
      songKey: songs.songKey,
      capo: songs.capo,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
    })
    .from(setlistItems)
    .leftJoin(songs, eq(setlistItems.songId, songs.id))
    .where(and(eq(setlistItems.setlistId, setlistId), songAktiv))
    .orderBy(asc(setlistItems.position));

  const structure = summarizeSetlist(
    items.map((i) => ({
      kind: i.kind,
      label: i.label,
      durationSeconds: i.durationSeconds,
      breakSeconds: i.breakSeconds,
    }))
  );
  const cmp = compareTarget(structure.totalSeconds, setlist.targetSeconds);

  const sectionSummaries = new Map<number, { songCount: number; seconds: number }>();
  {
    let songCount = 0;
    let seconds = 0;
    let curId: number | null = null;
    const flush = () => {
      if (curId != null) sectionSummaries.set(curId, { songCount, seconds });
    };
    for (const it of items) {
      if (it.kind === "section") {
        flush();
        curId = it.id;
        songCount = 0;
        seconds = 0;
      } else if (it.kind === "song") {
        songCount += 1;
        seconds += it.durationSeconds ?? 0;
      }
    }
    flush();
  }

  return { setlist, items, structure, cmp, sectionSummaries };
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
  bandId: number,
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
        eq(events.bandId, bandId),
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

export type AttendanceStats = {
  userId: number;
  name: string;
  instrument: string | null;
  yes: number;
  no: number;
  maybe: number;
  percentage: number | null;
};

/**
 * Anwesenheits-Statistik je aktivem Mitglied, nur vergangene Proben (keine
 * Gigs, siehe FEATURES.md). Quote über `attendancePercentage`.
 */
export async function fetchAttendanceStats(bandId: number): Promise<AttendanceStats[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      instrument: bandMembers.instrument,
      yes: sql<number>`(select count(*) from event_attendance a join events e on e.id = a.event_id where a.user_id = users.id and a.status = 'yes' and e.kind = 'rehearsal' and e.deleted_at is null and e.band_id = ${bandId} and e.date <= ${today})`,
      no: sql<number>`(select count(*) from event_attendance a join events e on e.id = a.event_id where a.user_id = users.id and a.status = 'no' and e.kind = 'rehearsal' and e.deleted_at is null and e.band_id = ${bandId} and e.date <= ${today})`,
      maybe: sql<number>`(select count(*) from event_attendance a join events e on e.id = a.event_id where a.user_id = users.id and a.status = 'maybe' and e.kind = 'rehearsal' and e.deleted_at is null and e.band_id = ${bandId} and e.date <= ${today})`,
    })
    .from(bandMembers)
    .innerJoin(users, eq(bandMembers.userId, users.id))
    .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.active, true)))
    .orderBy(asc(users.name));

  return rows.map((r) => ({
    ...r,
    percentage: attendancePercentage(r.yes, r.no),
  }));
}

/** Aktive Termine einer Serie, für die Zusammenfassung auf der Serien-Bearbeiten-Seite. */
export async function fetchSeriesInstances(
  seriesId: string,
  bandId: number
): Promise<{ id: number; date: string }[]> {
  return db
    .select({ id: events.id, date: events.date })
    .from(events)
    .where(and(eq(events.seriesId, seriesId), eq(events.bandId, bandId), eventAktiv))
    .orderBy(asc(events.date));
}

export type ProgramEntry = {
  event: { id: number; title: string; date: string; startTime: string | null };
  agendaSongs: { id: number; title: string }[];
  setlist: { id: number; name: string; songCount: number } | null;
};

/**
 * Für die Dashboard-Karte „Nächste Probe & Gig": je Terminart der zeitlich
 * nächste aktive Termin mit seiner Agenda bzw. verknüpften Setliste. Reine
 * Information, unabhängig vom eigenen Übe-Status (anders als `fetchTodo`s
 * `ungeuebteAgenda`).
 */
export async function fetchUpcomingPrograms(bandId: number): Promise<{
  probe: ProgramEntry | null;
  gig: ProgramEntry | null;
}> {
  const today = new Date().toISOString().slice(0, 10);

  const naechster = async (kind: EventKind): Promise<ProgramEntry | null> => {
    const [event] = await db
      .select({
        id: events.id,
        title: events.title,
        date: events.date,
        startTime: events.startTime,
        setlistId: events.setlistId,
      })
      .from(events)
      .where(and(eventAktiv, eq(events.bandId, bandId), eq(events.kind, kind), gte(events.date, today)))
      .orderBy(asc(events.date), asc(events.startTime))
      .limit(1);
    if (!event) return null;

    const [agendaSongs, setlistRows] = await Promise.all([
      db
        .select({ id: songs.id, title: songs.title })
        .from(eventSongs)
        .innerJoin(songs, eq(eventSongs.songId, songs.id))
        .where(and(eq(eventSongs.eventId, event.id), songAktiv))
        .orderBy(asc(eventSongs.position)),
      event.setlistId
        ? db
            .select({
              id: setlists.id,
              name: setlists.name,
              songCount: sql<number>`(select count(*) from setlist_items i join songs s on s.id = i.song_id where i.setlist_id = setlists.id and s.deleted_at is null)`,
            })
            .from(setlists)
            .where(and(eq(setlists.id, event.setlistId), setlistAktiv))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return {
      event: { id: event.id, title: event.title, date: event.date, startTime: event.startTime },
      agendaSongs,
      setlist: setlistRows[0] ?? null,
    };
  };

  const [probe, gig] = await Promise.all([naechster("rehearsal"), naechster("gig")]);
  return { probe, gig };
}

/** Alles für die Song-Detailseite. */
export async function fetchSongDetail(songId: number, bandId: number) {
  const song = await db.query.songs.findFirst({
    where: and(eq(songs.id, songId), songAktiv, eq(songs.bandId, bandId)),
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
        .select({ id: users.id, name: users.name, instrument: bandMembers.instrument })
        .from(bandMembers)
        .innerJoin(users, eq(bandMembers.userId, users.id))
        .where(and(eq(bandMembers.bandId, bandId), eq(bandMembers.active, true)))
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

export type EquipmentListItem = Equipment & {
  contributionTotal: number;
  photoCount: number;
  invoiceCount: number;
};

/** Equipment-Liste mit Beteiligungssumme und Datei-Zählern. */
export async function fetchEquipmentList(bandId: number): Promise<EquipmentListItem[]> {
  const rows = await db
    .select({
      item: equipment,
      contributionTotal: sql<number>`coalesce((select sum(c.amount) from equipment_contributions c where c.equipment_id = equipment.id), 0)`,
      photoCount: sql<number>`(select count(*) from equipment_attachments a where a.equipment_id = equipment.id and a.kind = 'foto' and a.deleted_at is null)`,
      invoiceCount: sql<number>`(select count(*) from equipment_attachments a where a.equipment_id = equipment.id and a.kind = 'rechnung' and a.deleted_at is null)`,
    })
    .from(equipment)
    .where(and(equipmentAktiv, eq(equipment.bandId, bandId)))
    .orderBy(desc(equipment.createdAt));

  return rows.map((r) => ({
    ...r.item,
    contributionTotal: r.contributionTotal,
    photoCount: r.photoCount,
    invoiceCount: r.invoiceCount,
  }));
}

export type EquipmentDetail = {
  equipment: Equipment;
  contributions: { userId: number; amount: number; note: string | null; userName: string }[];
  attachments: EquipmentAttachment[];
  createdByName: string | null;
};

/** Equipment-Detail: Stammdaten, Beteiligungen mit Namen, aktive Anhänge. */
export async function fetchEquipmentDetail(
  equipmentId: number,
  bandId: number
): Promise<EquipmentDetail | null> {
  const item = await db.query.equipment.findFirst({
    where: and(eq(equipment.id, equipmentId), equipmentAktiv, eq(equipment.bandId, bandId)),
  });
  if (!item) return null;

  const [contributions, attachmentRows, createdBy] = await Promise.all([
    db
      .select({
        userId: equipmentContributions.userId,
        amount: equipmentContributions.amount,
        note: equipmentContributions.note,
        userName: users.name,
      })
      .from(equipmentContributions)
      .innerJoin(users, eq(equipmentContributions.userId, users.id))
      .where(eq(equipmentContributions.equipmentId, equipmentId))
      .orderBy(users.name),
    db.query.equipmentAttachments.findMany({
      where: (a, { eq, and, isNull }) => and(eq(a.equipmentId, equipmentId), isNull(a.deletedAt)),
      orderBy: (a, { asc }) => [asc(a.kind), asc(a.createdAt)],
    }),
    item.createdById
      ? db.query.users.findFirst({ where: eq(users.id, item.createdById), columns: { name: true } })
      : Promise.resolve(undefined),
  ]);

  return {
    equipment: item,
    contributions,
    attachments: attachmentRows,
    createdByName: createdBy?.name ?? null,
  };
}

export type UserContribution = {
  equipmentId: number;
  equipmentName: string;
  amount: number;
  note: string | null;
};

/** Equipment-Beteiligungen eines Users in der aktiven Band, für die Profilseite. */
export async function fetchUserContributions(
  userId: number,
  bandId: number
): Promise<UserContribution[]> {
  return db
    .select({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      amount: equipmentContributions.amount,
      note: equipmentContributions.note,
    })
    .from(equipmentContributions)
    .innerJoin(equipment, eq(equipmentContributions.equipmentId, equipment.id))
    .where(
      and(
        eq(equipmentContributions.userId, userId),
        eq(equipment.bandId, bandId),
        equipmentAktiv
      )
    )
    .orderBy(desc(equipment.createdAt));
}

/**
 * Equipment-Anhang für `/api/equipment-files/[id]` — oder `null`, wenn er nicht
 * (mehr) herausgegeben werden darf. Analog `fetchServableAttachment`: prüft
 * sowohl den Anhang als auch das zugehörige Gerät auf Papierkorb-Status.
 */
export async function fetchServableEquipmentAttachment(
  attachmentId: number,
  bandIds: number[]
): Promise<EquipmentAttachment | null> {
  if (bandIds.length === 0) return null;
  const [row] = await db
    .select({ attachment: equipmentAttachments })
    .from(equipmentAttachments)
    .innerJoin(equipment, eq(equipmentAttachments.equipmentId, equipment.id))
    .where(
      and(
        eq(equipmentAttachments.id, attachmentId),
        equipmentAttachmentAktiv,
        equipmentAktiv,
        inArray(equipment.bandId, bandIds)
      )
    )
    .limit(1);
  return row?.attachment ?? null;
}
