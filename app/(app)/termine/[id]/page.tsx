import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { requireBandContext } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  songs,
  setlists,
} from "@/lib/db/schema";
import { fetchBandMembers } from "@/lib/queries";
import { songAktiv, setlistAktiv, eventAktiv } from "@/lib/db/filters";
import { EVENT_KIND, ATTENDANCE_STATUS } from "@/lib/constants";
import { formatDate, formatFee } from "@/lib/format";
import { DeleteEventButtons } from "@/components/event-forms";
import { AttendanceButtons } from "@/components/attendance";
import { EventAgenda } from "@/components/event-agenda";
import { IconEdit, IconRepeat } from "@/components/icons";

export default async function TerminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, bandId } = await requireBandContext();
  const { id } = await params;
  const eventId = Number(id);

  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eq(events.bandId, bandId), eventAktiv),
  });
  if (!event) notFound();

  const [attendance, allUsers, setlist, agendaItems, agendaOptions] =
    await Promise.all([
      db
        .select({
          userId: eventAttendance.userId,
          status: eventAttendance.status,
          comment: eventAttendance.comment,
        })
        .from(eventAttendance)
        .where(eq(eventAttendance.eventId, eventId)),
      fetchBandMembers(bandId),
      event.setlistId
        ? db.query.setlists.findFirst({
            where: and(eq(setlists.id, event.setlistId), eq(setlists.bandId, bandId), setlistAktiv),
          })
        : Promise.resolve(undefined),
      db
        .select({
          id: eventSongs.id,
          songId: eventSongs.songId,
          title: songs.title,
          artist: songs.artist,
          songKey: songs.songKey,
          tempoBpm: songs.tempoBpm,
          readyCount: sql<number>`(select count(*) from practice_status p join users u on u.id = p.user_id where p.song_id = songs.id and p.status = 'ready' and u.active = 1)`,
        })
        .from(eventSongs)
        .innerJoin(songs, eq(eventSongs.songId, songs.id))
        .where(and(eq(eventSongs.eventId, eventId), songAktiv))
        .orderBy(asc(eventSongs.position)),
      db
        .select({ id: songs.id, title: songs.title, artist: songs.artist })
        .from(songs)
        .where(and(ne(songs.status, "archived"), eq(songs.bandId, bandId), songAktiv))
        .orderBy(asc(songs.title)),
    ]);

  const mine = attendance.find((a) => a.userId === user.id);
  const kindMeta = EVENT_KIND[event.kind];
  const hasLogistik =
    event.kind === "gig" &&
    Boolean(
      event.soundcheckTime ||
        event.stageTime ||
        event.contactName ||
        event.contactPhone ||
        event.fee != null ||
        event.feeExtras ||
        event.travelNotes ||
        event.backlineNotes
    );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/termine" className="text-sm text-mute hover:text-ink">
          ← Alle Termine
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline text-4xl">{event.title}</h1>
              <span className={`badge ${kindMeta.badge}`}>{kindMeta.label}</span>
              {event.seriesId && (
                <span className="badge border-line text-faint">
                  <IconRepeat className="size-3" /> Teil einer Serie
                </span>
              )}
            </div>
            <p className="mono-display mt-2 text-mute">
              {formatDate(event.date)}
              {event.startTime
                ? event.kind === "gig"
                  ? ` · Load-in ${event.startTime}`
                  : ` · ${event.startTime} Uhr`
                : ""}
              {event.location ? ` · ${event.location}` : ""}
            </p>
            {event.notes && (
              <p className="mt-2 text-sm whitespace-pre-wrap text-mute">{event.notes}</p>
            )}
            {setlist && (
              <p className="mt-2 text-sm">
                Setliste:{" "}
                <Link
                  href={`/setlisten/${setlist.id}`}
                  className="text-accent-hi hover:underline"
                >
                  {setlist.name}
                </Link>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/termine/${event.id}/bearbeiten`} className="btn">
              <IconEdit className="size-4" /> Bearbeiten
            </Link>
            {event.seriesId && (
              <Link href={`/termine/${event.id}/serie-bearbeiten`} className="btn">
                <IconRepeat className="size-4" /> Serie bearbeiten
              </Link>
            )}
            <DeleteEventButtons eventId={event.id} isSeries={Boolean(event.seriesId)} />
          </div>
        </div>
      </div>

      {hasLogistik && (
        <section className="card p-5">
          <h2 className="headline mb-3 text-lg">Gig-Logistik</h2>
          <dl className="space-y-2 text-sm">
            {(event.startTime || event.soundcheckTime || event.stageTime) && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-mute">Ablauf</dt>
                <dd className="mono-display">
                  {[
                    event.startTime ? `Load-in ${event.startTime}` : null,
                    event.soundcheckTime ? `Soundcheck ${event.soundcheckTime}` : null,
                    event.stageTime ? `Auftritt ${event.stageTime}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {(event.contactName || event.contactPhone) && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-mute">Kontakt</dt>
                <dd>
                  {event.contactName}
                  {event.contactName && event.contactPhone ? " · " : ""}
                  {event.contactPhone && (
                    <a
                      href={`tel:${event.contactPhone.replace(/[^\d+]/g, "")}`}
                      className="text-accent-hi hover:underline"
                    >
                      {event.contactPhone}
                    </a>
                  )}
                </dd>
              </div>
            )}
            {(event.fee != null || event.feeExtras) && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-mute">Gage</dt>
                <dd>
                  {[formatFee(event.fee), event.feeExtras].filter(Boolean).join(" · ")}
                </dd>
              </div>
            )}
            {event.travelNotes && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-mute">Anfahrt</dt>
                <dd className="whitespace-pre-wrap">{event.travelNotes}</dd>
              </div>
            )}
            {event.backlineNotes && (
              <div className="flex gap-3">
                <dt className="w-28 shrink-0 text-mute">Backline</dt>
                <dd className="whitespace-pre-wrap">{event.backlineNotes}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section className="card p-5">
        <h2 className="headline mb-3 text-lg">Bist du dabei?</h2>
        <AttendanceButtons
          eventId={event.id}
          mine={mine?.status ?? null}
          myComment={mine?.comment}
          withComment
        />
        <h3 className="label mt-5">Rückmeldungen</h3>
        <ul className="space-y-1.5">
          {allUsers.map((member) => {
            const a = attendance.find((x) => x.userId === member.id);
            const meta = a ? ATTENDANCE_STATUS[a.status] : null;
            return (
              <li key={member.id} className="flex items-baseline gap-2 text-sm">
                <span
                  className={`mono-display w-4 shrink-0 text-center font-bold ${
                    meta ? meta.color : "text-faint"
                  }`}
                >
                  {meta ? meta.symbol : "·"}
                </span>
                <span className="min-w-0 truncate">
                  {member.name}
                  {member.instrument && (
                    <span className="text-faint"> · {member.instrument}</span>
                  )}
                </span>
                {a?.comment && (
                  <span className="ml-auto shrink-0 text-xs text-mute">
                    „{a.comment}"
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="headline mb-3 text-lg">
          {event.kind === "gig" ? "Programm-Fokus" : "Probe-Agenda"}
        </h2>
        <EventAgenda
          eventId={event.id}
          items={agendaItems}
          songOptions={agendaOptions}
          memberCount={allUsers.length}
        />
      </section>
    </div>
  );
}
