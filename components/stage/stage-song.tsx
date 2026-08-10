"use client";

import { useMemo, useState } from "react";
import type { StagePage, StageSheet } from "./types";
import { transposeLyrics, transposeKey, capoShapeLyrics, capoShapeKey } from "@/lib/chords";
import { useCapoOffset } from "@/lib/hooks/use-capo-offset";
import { CapoSelect } from "@/components/capo-control";
import { StageMetronome } from "./stage-metronome";

export type ViewSel = { kind: "lyrics" } | { kind: "instrument"; instrument: string };

const sheetLabel = (s: StageSheet) => s.instrument ?? "Noten";

export function StageSong({
  page,
  view,
  onViewChange,
  fontScale,
  onFontChange,
}: {
  page: StagePage;
  view: ViewSel;
  onViewChange: (v: ViewSel) => void;
  fontScale: number;
  onFontChange: (delta: number) => void;
}) {
  const { offset, capoFret, capoMode, bumpSemitone, setCapo, reset } = useCapoOffset();
  const [showTools, setShowTools] = useState(false);

  // Eindeutige Instrumente dieses Songs (erste Datei je Instrument gewinnt).
  const byLabel = useMemo(() => {
    const m = new Map<string, StageSheet>();
    for (const s of page.sheets) {
      const l = sheetLabel(s);
      if (!m.has(l)) m.set(l, s);
    }
    return m;
  }, [page.sheets]);

  const activeSheet =
    view.kind === "instrument"
      ? [...byLabel.values()].find(
          (s) => sheetLabel(s).toLowerCase() === view.instrument.toLowerCase()
        ) ?? null
      : null;

  const showSheet = !!activeSheet;
  const showLyrics = !showSheet && !!page.lyricsChords;

  const shownLyrics = useMemo(() => {
    if (!page.lyricsChords) return "";
    return capoMode
      ? capoShapeLyrics(page.lyricsChords, capoFret)
      : transposeLyrics(page.lyricsChords, offset);
  }, [page.lyricsChords, offset, capoMode, capoFret]);
  const shownKey = !page.songKey
    ? page.songKey
    : capoMode
      ? capoShapeKey(page.songKey, capoFret)
      : offset !== 0
        ? transposeKey(page.songKey, offset)
        : page.songKey;

  const hasSwitcher = byLabel.size > 0 || !!page.lyricsChords;

  return (
    <div className="flex h-full flex-col">
      {/* Kopf */}
      <div className="stage-px shrink-0 pt-3">
        <h1 className="headline text-2xl leading-tight sm:text-3xl">{page.title}</h1>
        <p className="mono-display mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-mute">
          {page.artist && <span>{page.artist}</span>}
          {shownKey && (
            <span>
              Tonart <span className="text-ink">{shownKey}</span>
            </span>
          )}
          {page.capo != null && <span>Capo {page.capo}</span>}
          {page.tempoBpm && <span>{page.tempoBpm} BPM</span>}
          {page.note && <span className="text-accent-hi">{page.note}</span>}
        </p>
      </div>

      {/* Inhalt */}
      <div className="mt-2 min-h-0 flex-1 overflow-auto">
        {showSheet ? (
          activeSheet!.mime === "application/pdf" ? (
            <object
              data={`/api/files/${activeSheet!.id}`}
              type="application/pdf"
              className="h-full w-full bg-white"
              aria-label={activeSheet!.originalName}
            >
              <p className="p-4 text-sm text-mute">
                Dein Browser zeigt PDFs nicht inline an.{" "}
                <a
                  href={`/api/files/${activeSheet!.id}`}
                  target="_blank"
                  rel="noopener"
                  className="text-accent-hi hover:underline"
                >
                  PDF in neuem Tab öffnen
                </a>
              </p>
            </object>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${activeSheet!.id}`}
              alt={activeSheet!.originalName}
              className="mx-auto h-full w-auto max-w-full bg-white object-contain"
            />
          )
        ) : showLyrics ? (
          <pre
            className="stage-px mono-display whitespace-pre leading-relaxed"
            style={{ fontSize: `${1.1 * fontScale}rem` }}
          >
            {shownLyrics}
          </pre>
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-mute">
            Keine Noten oder Akkorde für diesen Song hinterlegt.
          </div>
        )}
      </div>

      {/* Fußleiste: Ansicht-Umschalter, Metronom, Werkzeuge */}
      <div className="stage-px stage-pb shrink-0 space-y-2 border-t border-line pt-2">
        {hasSwitcher && (
          <div className="flex flex-wrap items-center gap-1.5">
            {[...byLabel.keys()].map((label) => {
              const active = showSheet && sheetLabel(activeSheet!) === label;
              const raw = byLabel.get(label)!.instrument ?? label;
              return (
                <button
                  key={label}
                  type="button"
                  className={`btn btn-sm ${active ? "border-accent bg-accent/20 text-accent-hi" : ""}`}
                  onClick={() => onViewChange({ kind: "instrument", instrument: raw })}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              className={`btn btn-sm ${!showSheet ? "border-accent bg-accent/20 text-accent-hi" : ""}`}
              onClick={() => onViewChange({ kind: "lyrics" })}
            >
              Lyrics/Akkorde
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <StageMetronome initialBpm={page.tempoBpm} />
          <button
            type="button"
            className="btn btn-sm ml-auto"
            onClick={() => setShowTools((v) => !v)}
          >
            {showTools ? "▾ Werkzeuge" : "▸ Werkzeuge"}
          </button>
        </div>

        {showTools && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="label mb-0 text-xs">Schrift</span>
              <button type="button" className="btn btn-sm" onClick={() => onFontChange(-0.1)}>
                A−
              </button>
              <button type="button" className="btn btn-sm" onClick={() => onFontChange(0.1)}>
                A+
              </button>
            </div>
            {showLyrics && (
              <div className="flex items-center gap-1">
                <span className="label mb-0 text-xs">Transponieren</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => bumpSemitone(-1)}
                >
                  − ½
                </button>
                <span
                  className={`mono-display w-8 text-center text-sm font-bold ${
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
                <CapoSelect compact capoFret={capoFret} onChange={setCapo} />
                {offset !== 0 && (
                  <button type="button" className="btn btn-sm" onClick={reset}>
                    ↺
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
