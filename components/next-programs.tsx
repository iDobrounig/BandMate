import Link from "next/link";
import type { ProgramEntry } from "@/lib/queries";
import { EVENT_KIND } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { EventKind } from "@/lib/db/schema";

function ProgramRow({ kind, entry }: { kind: EventKind; entry: ProgramEntry }) {
  const kindMeta = EVENT_KIND[kind];
  const { event, agendaSongs, setlist } = entry;

  let songsLabel: string;
  if (agendaSongs.length > 0) {
    const shown = agendaSongs.slice(0, 4).map((s) => s.title);
    songsLabel =
      shown.join(", ") + (agendaSongs.length > 4 ? ` +${agendaSongs.length - 4}` : "");
  } else if (setlist) {
    songsLabel = `Setliste: ${setlist.name} (${setlist.songCount} ${
      setlist.songCount === 1 ? "Song" : "Songs"
    })`;
  } else {
    songsLabel = "Noch nichts geplant";
  }

  return (
    <Link
      href={`/termine/${event.id}`}
      className="card block p-4 transition hover:border-accent/40"
    >
      <div className="flex items-center gap-2">
        <span
          className={`size-2 shrink-0 rounded-full ${kindMeta.bar}`}
          title={kindMeta.label}
        />
        <span className="min-w-0 flex-1 truncate font-semibold">{event.title}</span>
        <span className="mono-display shrink-0 text-xs text-mute">
          {formatDate(event.date)}
          {event.startTime ? ` · ${event.startTime}` : ""}
        </span>
      </div>
      <p className="mt-1.5 truncate text-xs text-mute">{songsLabel}</p>
    </Link>
  );
}

/**
 * Reine Info-Karte fürs Dashboard: was ist bei der nächsten Probe und dem
 * nächsten Gig geplant — unabhängig vom eigenen Übe-Status. Rendert nichts,
 * wenn keine der beiden Terminarten ansteht.
 */
export function NextProgramsCard({
  probe,
  gig,
}: {
  probe: ProgramEntry | null;
  gig: ProgramEntry | null;
}) {
  if (!probe && !gig) return null;
  return (
    <section>
      <h2 className="headline mb-3 text-lg">Nächste Probe &amp; Gig</h2>
      <div className="space-y-2">
        {probe && <ProgramRow kind="rehearsal" entry={probe} />}
        {gig && <ProgramRow kind="gig" entry={gig} />}
      </div>
    </section>
  );
}
