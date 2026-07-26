import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs } from "@/lib/db/schema";
import { songAktiv, setlistAktiv } from "@/lib/db/filters";
import { formatDate, formatDuration } from "@/lib/format";
import { summarizeSetlist, compareTarget } from "@/lib/setlist-structure";
import { PrintButton } from "@/components/setlist-forms";

export const metadata = { title: "Druckansicht" };

export default async function SetlistDruckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const setlistId = Number(id);

  const setlist = await db.query.setlists.findFirst({
    where: and(eq(setlists.id, setlistId), setlistAktiv),
  });
  if (!setlist) notFound();

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

  return (
    <div>
      <div className="print-hidden mb-6 flex items-center justify-between gap-4">
        <Link href={`/setlisten/${setlistId}`} className="text-sm text-mute hover:text-ink">
          ← Zurück zur Setliste
        </Link>
        <PrintButton />
      </div>

      {/* Weißes „Blatt" — am Bildschirm Vorschau, beim Druck die Seite selbst */}
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-10 text-neutral-900 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-neutral-900 pb-4">
          <h1 className="text-3xl font-bold tracking-tight">{setlist.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {setlist.eventDate ? formatDate(setlist.eventDate) : ""}
            {setlist.notes ? ` · ${setlist.notes}` : ""}
          </p>
        </header>

        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-300 text-xs uppercase tracking-wider text-neutral-500">
              <th className="w-8 py-2 pr-2">#</th>
              <th className="py-2 pr-4">Song</th>
              <th className="w-20 py-2 pr-4">Tonart</th>
              <th className="w-16 py-2 pr-4">Capo</th>
              <th className="w-24 py-2 pr-4">Tempo</th>
              <th className="w-16 py-2">Dauer</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let n = 0;
              return items.map((item) => {
                if (item.kind === "section") {
                  n = 0;
                  const sum = sectionSummaries.get(item.id);
                  return (
                    <tr key={item.id} className="border-b-2 border-neutral-300">
                      <td colSpan={6} className="pt-5 pb-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-bold uppercase tracking-wide">
                            {item.label ?? "Set"}
                          </span>
                          {sum && (
                            <span className="font-mono text-xs text-neutral-500">
                              {sum.songCount} Songs · {formatDuration(sum.seconds)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (item.kind === "break") {
                  const m = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
                  return (
                    <tr key={item.id}>
                      <td
                        colSpan={6}
                        className="py-2 text-center text-xs italic text-neutral-500"
                      >
                        — Pause ({m} min){item.label ? `: ${item.label}` : ""} —
                      </td>
                    </tr>
                  );
                }
                n += 1;
                return (
                  <tr key={item.id} className="border-b border-neutral-200">
                    <td className="py-2.5 pr-2 font-mono text-sm text-neutral-400">{n}</td>
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold leading-tight">{item.title}</p>
                      <p className="text-xs text-neutral-500">
                        {item.artist ?? ""}
                        {item.note ? (
                          <span className="font-semibold text-neutral-700">
                            {item.artist ? " — " : ""}
                            {item.note}
                          </span>
                        ) : null}
                      </p>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-sm">{item.songKey ?? "–"}</td>
                    <td className="py-2.5 pr-4 font-mono text-sm">{item.capo ?? "–"}</td>
                    <td className="py-2.5 pr-4 font-mono text-sm">
                      {item.tempoBpm ? `${item.tempoBpm} BPM` : "–"}
                    </td>
                    <td className="py-2.5 font-mono text-sm">
                      {formatDuration(item.durationSeconds)}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          <tfoot className="border-t-2 border-neutral-900">
            <tr>
              <td colSpan={4} />
              <td className="py-2 pr-4 text-right text-sm font-semibold">Musik</td>
              <td className="py-2 font-mono text-sm">
                {formatDuration(structure.musicSeconds)}
              </td>
            </tr>
            {structure.breakSeconds > 0 && (
              <>
                <tr>
                  <td colSpan={4} />
                  <td className="py-1 pr-4 text-right text-sm font-semibold">Pausen</td>
                  <td className="py-1 font-mono text-sm">
                    {formatDuration(structure.breakSeconds)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} />
                  <td className="py-1 pr-4 text-right text-sm font-bold">Gesamt</td>
                  <td className="py-1 font-mono text-sm font-bold">
                    {formatDuration(structure.totalSeconds)}
                  </td>
                </tr>
              </>
            )}
            {cmp && (
              <tr>
                <td colSpan={4} />
                <td className="py-1 pr-4 text-right text-sm font-semibold">
                  Ziel {formatDuration(setlist.targetSeconds!)}
                </td>
                <td className="py-1 font-mono text-sm">
                  {formatDuration(cmp.diffSeconds)} {cmp.over ? "über" : "unter"}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
