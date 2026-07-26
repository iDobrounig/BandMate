import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, setlists } from "@/lib/db/schema";
import { eventAktiv, setlistAktiv } from "@/lib/db/filters";
import { EventForm } from "@/components/event-forms";

export const metadata = { title: "Termin bearbeiten" };

export default async function TerminBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const eventId = Number(id);

  const [event, setlistOptions] = await Promise.all([
    db.query.events.findFirst({
      where: and(eq(events.id, eventId), eventAktiv),
    }),
    db
      .select({ id: setlists.id, name: setlists.name })
      .from(setlists)
      .where(setlistAktiv)
      .orderBy(asc(setlists.name)),
  ]);
  if (!event) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href={`/termine/${event.id}`}
        className="text-sm text-mute hover:text-ink"
      >
        ← Zurück zum Termin
      </Link>
      <h1 className="headline mt-3 text-3xl">„{event.title}" bearbeiten</h1>
      {event.seriesId && (
        <p className="mt-1 text-sm text-faint">
          Änderungen betreffen nur diesen einzelnen Termin, nicht die Serie.
        </p>
      )}
      <div className="card mt-8 p-6">
        <EventForm event={event} setlistOptions={setlistOptions} />
      </div>
    </div>
  );
}
