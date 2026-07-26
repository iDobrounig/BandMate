import { asc } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists } from "@/lib/db/schema";
import { setlistAktiv } from "@/lib/db/filters";
import { EventForm } from "@/components/event-forms";

export const metadata = { title: "Neuer Termin" };

export default async function NeuerTerminPage() {
  await requireUser();

  const setlistOptions = await db
    .select({ id: setlists.id, name: setlists.name })
    .from(setlists)
    .where(setlistAktiv)
    .orderBy(asc(setlists.name));

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Neuer Termin</h1>
      <p className="mt-1 text-sm text-mute">
        Probe oder Gig — nur Titel und Datum sind Pflicht.
      </p>
      <div className="card mt-8 p-6">
        <EventForm setlistOptions={setlistOptions} />
      </div>
    </div>
  );
}
