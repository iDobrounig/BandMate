"use client";

import { useMemo, useState, useTransition } from "react";
import { transposeLyrics, transposeKey } from "@/lib/chords";
import { saveTransposedLyrics } from "@/lib/actions/songs";

export function TransposableLyrics({
  songId,
  lyrics,
  songKey,
}: {
  songId: number;
  lyrics: string;
  songKey: string | null;
}) {
  const [offset, setOffset] = useState(0);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => transposeLyrics(lyrics, offset), [lyrics, offset]);
  const shownKey = useMemo(
    () => (songKey && offset !== 0 ? transposeKey(songKey, offset) : songKey),
    [songKey, offset]
  );

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
      setOffset(0);
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="label mb-0">Transponieren</span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setOffset((o) => Math.max(-11, o - 1))}
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
          onClick={() => setOffset((o) => Math.min(11, o + 1))}
        >
          + ½
        </button>
        {offset !== 0 && (
          <>
            {shownKey && (
              <span className="mono-display text-sm text-mute">→ {shownKey}</span>
            )}
            <button type="button" className="btn btn-sm" onClick={() => setOffset(0)}>
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
        )}
      </div>
      <pre className="card mono-display overflow-x-auto p-5 text-sm leading-relaxed whitespace-pre-wrap">
        {shown}
      </pre>
    </div>
  );
}
