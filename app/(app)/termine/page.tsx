import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists } from "@/lib/db/schema";
import { fetchEvents } from "@/lib/queries";
import { EVENT_KIND, ATTENDANCE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { EventForm } from "@/components/event-forms";
import { CalendarSubscribe } from "@/components/calendar-subscribe";
import { calendarFeedPath } from "@/lib/calendar";

export const metadata = { title: "Termine" };

export default async function TerminePage({
  searchParams,
}: {
  searchParams: Promise<{ vergangene?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const showPast = params.vergangene === "1";

  const [upcoming, past, setlistOptions] = await Promise.all([
    fetchEvents(user.id),
    showPast ? fetchEvents(user.id, { past: true, limit: 20 }) : Promise.resolve([]),
    db
      .select({ id: setlists.id, name: setlists.name })
      .from(setlists)
      .orderBy(asc(setlists.name)),
  ]);

  return (
    <div>
      <h1 className="headline text-3xl">Termine</h1>
      <p className="mt-1 text-sm text-mute">
        Proben und Gigs — mit Zu- und Absagen der Band.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {upcoming.length === 0 && (
            <div className="card p-10 text-center text-mute">
              Keine anstehenden Termine. Leg rechts den nächsten an!
            </div>
          )}
          {upcoming.map((event) => {
            const kindMeta = EVENT_KIND[event.kind];
            return (
              <Link
                key={event.id}
                href={`/termine/${event.id}`}
                className="card relative flex gap-3 overflow-hidden p-4 pl-6 transition hover:border-accent/40 sm:items-center sm:gap-4"
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1.5 ${kindMeta.bar}`}
                />
                <div className="mono-display w-20 shrink-0 text-sm sm:w-24">
                  <p className="font-bold">{formatDate(event.date)}</p>
                  <p className="text-xs text-mute">
                    {event.startTime ? `${event.startTime} Uhr` : ""}
                  </p>
                </div>
                <div className="flex flex-1 flex-col gap-1 min-w-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      <span className="truncate">{event.title}</span>
                      <span className={`badge ${kindMeta.badge}`}>{kindMeta.label}</span>
                      {event.seriesId && (
                        <span className="badge border-line text-faint" title="Teil einer Serie">
                          ↻ Serie
                        </span>
                      )}
                    </p>
                    <p className="truncate text-sm text-mute">
                      {[event.location, event.setlistName ? `Setliste: ${event.setlistName}` : null]
                        .filter(Boolean)
                        .join(" · ") || " "}
                    </p>
                  </div>
                  <div className="mono-display shrink-0 flex items-center gap-3 text-xs sm:flex-col sm:items-end sm:gap-0.5 sm:text-right">
                    <p>
                      <span className="text-emerald-400">✓ {event.yesCount}</span>{" "}
                      <span className="text-amber-400">? {event.maybeCount}</span>{" "}
                      <span className="text-red-400">✗ {event.noCount}</span>
                    </p>
                    <p
                      className={
                        event.myStatus
                          ? ATTENDANCE_STATUS[event.myStatus].color
                          : "text-faint"
                      }
                    >
                      {event.myStatus
                        ? `Du: ${ATTENDANCE_STATUS[event.myStatus].symbol}`
                        : "Du: offen"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}

          <div className="pt-2">
            {showPast ? (
              <>
                <h2 className="headline mb-3 text-lg text-mute">Vergangene Termine</h2>
                <div className="space-y-2 opacity-60">
                  {past.map((event) => (
                    <Link
                      key={event.id}
                      href={`/termine/${event.id}`}
                      className="card flex items-center gap-4 p-3 text-sm transition hover:border-accent/40"
                    >
                      <span className="mono-display w-24 shrink-0">
                        {formatDate(event.date)}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{event.title}</span>
                      <span className={`badge ${EVENT_KIND[event.kind].badge}`}>
                        {EVENT_KIND[event.kind].label}
                      </span>
                    </Link>
                  ))}
                  {past.length === 0 && (
                    <p className="text-sm text-faint">Keine vergangenen Termine.</p>
                  )}
                </div>
              </>
            ) : (
              <Link href="/termine?vergangene=1" className="text-sm text-mute hover:text-ink">
                Vergangene Termine anzeigen →
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <section className="card h-fit p-5">
            <h2 className="headline mb-4 text-lg">Neuer Termin</h2>
            <EventForm setlistOptions={setlistOptions} />
          </section>
          <CalendarSubscribe
            feedPath={calendarFeedPath()}
            appUrl={process.env.APP_URL ?? null}
          />
        </div>
      </div>
    </div>
  );
}
