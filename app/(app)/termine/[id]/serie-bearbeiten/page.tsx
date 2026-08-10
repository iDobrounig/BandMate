import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { eventAktiv } from "@/lib/db/filters";
import { fetchSeriesInstances } from "@/lib/queries";
import { EventSeriesForm } from "@/components/event-forms";

export const metadata = { title: "Serie bearbeiten" };

export default async function SerieBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const eventId = Number(id);

  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId), eventAktiv),
  });
  if (!event || !event.seriesId) notFound();

  const instances = await fetchSeriesInstances(event.seriesId);
  const today = new Date().toISOString().slice(0, 10);
  const futureCount = instances.filter((i) => i.date >= today).length;
  const pastCount = instances.length - futureCount;

  return (
    <div className="max-w-2xl">
      <Link
        href={`/termine/${event.id}`}
        className="text-sm text-mute hover:text-ink"
      >
        ← Zurück zum Termin
      </Link>
      <h1 className="headline mt-3 text-3xl">Serie „{event.title}" bearbeiten</h1>
      <p className="mt-1 text-sm text-faint">
        Betrifft {futureCount} kommende{" "}
        {futureCount === 1 ? "Termin" : "Termine"} der Serie.
        {pastCount > 0 &&
          ` ${pastCount} bereits vergangene ${pastCount === 1 ? "Termin bleibt" : "Termine bleiben"} unverändert.`}
      </p>
      <div className="card mt-8 p-6">
        <EventSeriesForm event={event} futureCount={futureCount} />
      </div>
    </div>
  );
}
