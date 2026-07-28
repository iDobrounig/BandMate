import type { StagePage } from "./types";
import { StageMetronome } from "./stage-metronome";
import { BreakTimer } from "./stage-break";
import { upcomingItems, describeUpcoming } from "@/lib/stage";

/**
 * „Notenpult"-Ansicht für Mitglieder mit physischen Noten: kein Lyrics/PDF,
 * sondern der aktuelle Ablaufpunkt groß plus die nächsten zwei Elemente als
 * Vorschau. Alternative Render-Schicht über demselben `StageView`-Index.
 */
export function StageMinimal({
  pages,
  index,
}: {
  pages: StagePage[];
  index: number;
}) {
  const current = pages[index];
  const upcoming = upcomingItems(pages, index, 2);

  return (
    <div className="flex h-full flex-col">
      {/* JETZT */}
      <div className="stage-px flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
        <span className="text-xs uppercase tracking-widest text-faint">
          {current.kind === "break" ? "Pause" : current.kind === "section" ? "Set" : "Jetzt"}
        </span>

        {current.kind === "song" && (
          <>
            <h1 className="headline text-4xl leading-tight sm:text-6xl">{current.title}</h1>
            {current.artist && <p className="text-xl text-mute">{current.artist}</p>}
            <p className="mono-display flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg text-mute">
              {current.songKey && (
                <span>
                  Tonart <span className="text-ink">{current.songKey}</span>
                </span>
              )}
              {current.capo != null && <span>Capo {current.capo}</span>}
              {current.tempoBpm && <span>{current.tempoBpm} BPM</span>}
            </p>
            {current.note && <p className="text-lg text-accent-hi">» {current.note}</p>}
            <div className="mt-2">
              <StageMetronome initialBpm={current.tempoBpm} />
            </div>
          </>
        )}

        {current.kind === "section" && (
          <h1 className="headline text-5xl sm:text-7xl">{current.label ?? "Set"}</h1>
        )}

        {current.kind === "break" && (
          <>
            {current.label && <p className="text-xl text-mute">{current.label}</p>}
            <BreakTimer breakSeconds={current.breakSeconds} compact />
          </>
        )}
      </div>

      {/* ALS NÄCHSTES */}
      <div className="stage-px stage-pb shrink-0 border-t border-line pt-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-faint">Als nächstes</p>
        {upcoming.length > 0 ? (
          <ul className="space-y-1">
            {upcoming.map((item) => (
              <li key={item.id} className="text-lg text-mute">
                {describeUpcoming(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-lg text-faint">— Ende —</p>
        )}
      </div>
    </div>
  );
}
