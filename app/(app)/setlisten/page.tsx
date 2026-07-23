import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchSetlists } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/format";
import { SetlistForm } from "@/components/setlist-forms";

export const metadata = { title: "Setlisten" };

export default async function SetlistenPage() {
  await requireUser();

  const lists = await fetchSetlists();

  return (
    <div>
      <h1 className="headline text-3xl">Setlisten</h1>
      <p className="mt-1 text-sm text-mute">
        Programme für Gigs und Proben — zusammengestellt aus dem Repertoire.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-3">
          {lists.length === 0 && (
            <div className="card p-10 text-center text-mute">
              Noch keine Setlisten. Leg rechts die erste an!
            </div>
          )}
          {lists.map((setlist) => (
            <Link
              key={setlist.id}
              href={`/setlisten/${setlist.id}`}
              className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{setlist.name}</p>
                <p className="text-sm text-mute">
                  {setlist.eventDate ? formatDate(setlist.eventDate) : "ohne Datum"}
                </p>
              </div>
              <div className="mono-display shrink-0 text-right text-sm text-mute">
                <p>
                  {setlist.songCount} {setlist.songCount === 1 ? "Song" : "Songs"}
                </p>
                <p className="text-xs text-faint">
                  {formatDuration(setlist.totalSeconds)}
                </p>
              </div>
            </Link>
          ))}
        </div>

        <section className="min-w-0 card h-fit p-5">
          <h2 className="headline mb-4 text-lg">Neue Setliste</h2>
          <SetlistForm />
        </section>
      </div>
    </div>
  );
}
