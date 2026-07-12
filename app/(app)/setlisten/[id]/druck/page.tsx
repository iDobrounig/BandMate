import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs } from "@/lib/db/schema";
import { formatDate, formatDuration } from "@/lib/format";
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
    where: eq(setlists.id, setlistId),
  });
  if (!setlist) notFound();

  const items = await db
    .select({
      id: setlistItems.id,
      note: setlistItems.note,
      title: songs.title,
      artist: songs.artist,
      songKey: songs.songKey,
      capo: songs.capo,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
    })
    .from(setlistItems)
    .innerJoin(songs, eq(setlistItems.songId, songs.id))
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.position));

  const totalSeconds = items.reduce((s, i) => s + (i.durationSeconds ?? 0), 0);

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
            {items.map((item, index) => (
              <tr key={item.id} className="border-b border-neutral-200">
                <td className="py-2.5 pr-2 font-mono text-sm text-neutral-400">
                  {index + 1}
                </td>
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
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="py-3 pr-4 text-right text-sm font-semibold">
                Gesamtdauer
              </td>
              <td className="py-3 font-mono text-sm font-bold">
                {formatDuration(totalSeconds)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
