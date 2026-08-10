"use client";

import { useMemo, useTransition } from "react";
import { transposeLyrics, transposeKey, capoShapeLyrics, capoShapeKey } from "@/lib/chords";
import { saveTransposedLyrics } from "@/lib/actions/songs";
import { useCapoOffset } from "@/lib/hooks/use-capo-offset";
import { CapoSelect } from "@/components/capo-control";

export function TransposableLyrics({
  songId,
  lyrics,
  songKey,
  capo,
}: {
  songId: number;
  lyrics: string;
  songKey: string | null;
  capo?: number | null;
}) {
  const { offset, capoFret, capoMode, bumpSemitone, setCapo, reset } = useCapoOffset();
  const [pending, startTransition] = useTransition();

  const shown = useMemo(
    () => (capoMode ? capoShapeLyrics(lyrics, capoFret) : transposeLyrics(lyrics, offset)),
    [lyrics, offset, capoMode, capoFret]
  );
  const shownKey = useMemo(() => {
    if (!songKey) return songKey;
    if (capoMode) return capoShapeKey(songKey, capoFret);
    if (offset !== 0) return transposeKey(songKey, offset);
    return songKey;
  }, [songKey, offset, capoMode, capoFret]);

  const save = () => {
    if (
      !confirm(
        `Lyrics dauerhaft um ${offset > 0 ? "+" : ""}${offset} Halbtöne transponieren?` +
          (shownKey && shownKey !== songKey
            ? ` Die Tonart wird zu „${shownKey}".`
            : "")
      )
    )
      return;
    startTransition(async () => {
      await saveTransposedLyrics(songId, shown, shownKey);
      reset();
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="label mb-0">Transponieren</span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => bumpSemitone(-1)}
        >
          − ½
        </button>
        <span
          className={`mono-display w-10 text-center text-sm font-bold ${
            offset !== 0 ? "text-accent-hi" : "text-faint"
          }`}
        >
          {offset > 0 ? `+${offset}` : offset}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => bumpSemitone(1)}
        >
          + ½
        </button>

        <CapoSelect capoFret={capoFret} onChange={setCapo} />
        {capo != null && capo > 0 && !capoMode && (
          <button type="button" className="btn btn-sm" onClick={() => setCapo(capo)}>
            Griffe (Capo {capo})
          </button>
        )}

        {capoMode ? (
          <>
            <span className="mono-display text-sm text-accent-hi">
              Griffe bei Capo {capoFret}
            </span>
            <button type="button" className="btn btn-sm" onClick={reset}>
              Klingend anzeigen
            </button>
          </>
        ) : (
          offset !== 0 && (
            <>
              {shownKey && (
                <span className="mono-display text-sm text-mute">→ {shownKey}</span>
              )}
              <button type="button" className="btn btn-sm" onClick={reset}>
                ↺ Original
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={pending}
                onClick={save}
              >
                {pending ? "Speichert …" : "Transponierung speichern"}
              </button>
            </>
          )
        )}
      </div>
      <pre className="card mono-display overflow-x-auto p-4 sm:p-5 text-xs sm:text-sm leading-relaxed whitespace-pre">
        {shown}
      </pre>
    </div>
  );
}
