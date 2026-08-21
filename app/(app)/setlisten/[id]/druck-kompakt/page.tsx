import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBandContext } from "@/lib/auth";
import { getSetlistPrintData } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/format";
import { PrintButton, PrintViewSwitcher } from "@/components/setlist-forms";

export const metadata = { title: "Druckansicht (kompakt)" };

export default async function SetlistDruckKompaktPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { bandId } = await requireBandContext();
  const { id } = await params;
  const setlistId = Number(id);

  const data = await getSetlistPrintData(setlistId, bandId);
  if (!data) notFound();
  const { setlist, items, structure, cmp, sectionSummaries } = data;

  return (
    <div>
      <div className="print-hidden mb-6 flex items-center justify-between gap-4">
        <Link href={`/setlisten/${setlistId}`} className="text-sm text-mute hover:text-ink">
          ← Zurück zur Setliste
        </Link>
        <div className="flex items-center gap-3">
          <PrintViewSwitcher setlistId={setlistId} active="kompakt" />
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-3xl rounded-xl bg-white p-10 text-neutral-900 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-neutral-900 pb-3">
          <h1 className="text-2xl font-bold tracking-tight">{setlist.name}</h1>
          <p className="mt-1 text-xs text-neutral-500">
            {setlist.eventDate ? formatDate(setlist.eventDate) : ""}
            {setlist.notes ? ` · ${setlist.notes}` : ""}
          </p>
        </header>

        <table className="mt-4 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-300 uppercase tracking-wider text-neutral-500">
              <th className="w-6 py-1 pr-2">#</th>
              <th className="py-1 pr-4">Song</th>
              <th className="w-16 py-1 pr-4">Tonart</th>
              <th className="w-20 py-1">Tempo</th>
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
                      <td colSpan={4} className="pt-3 pb-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {item.label ?? "Set"}
                          </span>
                          {sum && (
                            <span className="font-mono text-[10px] text-neutral-500">
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
                      <td colSpan={4} className="py-1 text-center italic text-neutral-500">
                        — Pause ({m} min){item.label ? `: ${item.label}` : ""} —
                      </td>
                    </tr>
                  );
                }
                n += 1;
                return (
                  <tr key={item.id} className="border-b border-neutral-200">
                    <td className="py-1 pr-2 font-mono text-neutral-400">{n}</td>
                    <td className="py-1 pr-4">
                      <span className="font-semibold">{item.title}</span>
                      {item.note ? (
                        <span className="text-neutral-500"> — {item.note}</span>
                      ) : null}
                    </td>
                    <td className="py-1 pr-4 font-mono">{item.songKey ?? "–"}</td>
                    <td className="py-1 font-mono">
                      {item.tempoBpm ? `${item.tempoBpm} BPM` : "–"}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          <tfoot className="border-t-2 border-neutral-900">
            <tr>
              <td colSpan={2} />
              <td className="py-1 pr-4 text-right font-semibold">Musik</td>
              <td className="py-1 font-mono">{formatDuration(structure.musicSeconds)}</td>
            </tr>
            {structure.breakSeconds > 0 && (
              <>
                <tr>
                  <td colSpan={2} />
                  <td className="py-1 pr-4 text-right font-semibold">Pausen</td>
                  <td className="py-1 font-mono">{formatDuration(structure.breakSeconds)}</td>
                </tr>
                <tr>
                  <td colSpan={2} />
                  <td className="py-1 pr-4 text-right font-bold">Gesamt</td>
                  <td className="py-1 font-mono font-bold">
                    {formatDuration(structure.totalSeconds)}
                  </td>
                </tr>
              </>
            )}
            {cmp && (
              <tr>
                <td colSpan={2} />
                <td className="py-1 pr-4 text-right font-semibold">
                  Ziel {formatDuration(setlist.targetSeconds!)}
                </td>
                <td className="py-1 font-mono">
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
