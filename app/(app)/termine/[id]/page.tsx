import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, ne, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  songs,
  setlists,
  users,
} from "@/lib/db/schema";
import { EVENT_KIND, ATTENDANCE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { EventForm, DeleteEventButtons } from "@/components/event-forms";
import { AttendanceButtons } from "@/components/attendance";
import { EventAgenda } from "@/components/event-agenda";

export default async function TerminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const eventId = Number(id);

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) notFound();

  const [attendance, allUsers, setlist, setlistOptions, agendaItems, agendaOptions] =
    await Promise.all([
    db
      .select({
        userId: eventAttendance.userId,
        status: eventAttendance.status,
        comment: eventAttendance.comment,
      })
      .from(eventAttendance)
      .where(eq(eventAttendance.eventId, eventId)),
    db
      .select({ id: users.id, name: users.name, instrument: users.instrument })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name)),
    event.setlistId
      ? db.query.setlists.findFirst({ where: eq(setlists.id, event.setlistId) })
      : Promise.resolve(undefined),
    db
      .select({ id: setlists.id, name: setlists.name })
      .from(setlists)
      .orderBy(asc(setlists.name)),
    db
      .select({
        id: eventSongs.id,
        songId: eventSongs.songId,
        title: songs.title,
        artist: songs.artist,
        songKey: songs.songKey,
        tempoBpm: songs.tempoBpm,
        readyCount: sql<number>`(select count(*) from practice_status p where p.song_id = songs.id and p.status = 'ready')`,
      })
      .from(eventSongs)
      .innerJoin(songs, eq(eventSongs.songId, songs.id))
      .where(eq(eventSongs.eventId, eventId))
      .orderBy(asc(eventSongs.position)),
    db
      .select({ id: songs.id, title: songs.title, artist: songs.artist })
      .from(songs)
      .where(ne(songs.status, "archived"))
      .orderBy(asc(songs.title)),
  ]);

  const mine = attendance.find((a) => a.userId === user.id);
  const kindMeta = EVENT_KIND[event.kind];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/termine" className="text-sm text-mute hover:text-ink">
          ← Alle Termine
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="headline text-4xl">{event.title}</h1>
          <span className={`badge ${kindMeta.badge}`}>{kindMeta.label}</span>
          {event.seriesId && (
            <span className="badge border-line text-faint">↻ Teil einer Serie</span>
          )}
        </div>
        <p className="mono-display mt-2 text-mute">
          {formatDate(event.date)}
          {event.startTime ? ` · ${event.startTime} Uhr` : ""}
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

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
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

          <DeleteEventButtons eventId={event.id} isSeries={Boolean(event.seriesId)} />
        </div>

        <section className="card h-fit p-5">
          <h2 className="headline mb-4 text-lg">Termin bearbeiten</h2>
          <EventForm event={event} setlistOptions={setlistOptions} />
          {event.seriesId && (
            <p className="mt-2 text-xs text-faint">
              Änderungen betreffen nur diesen einzelnen Termin, nicht die Serie.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
