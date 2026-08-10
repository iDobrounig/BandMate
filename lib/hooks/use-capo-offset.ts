"use client";

import { useState } from "react";

/**
 * Vereinigt den Halbton-Offset (freies Transponieren) und den Capo-Modus
 * (Griffe statt klingender Akkorde zeigen) in einem State — beide sind
 * letztlich derselbe Offset, nur mit umgekehrtem Vorzeichen und Bedeutung.
 * Geteilt zwischen `TransposableLyrics` (Songseite) und `StageSong`
 * (Bühnenmodus), die sonst keinen Code teilen.
 */
export function useCapoOffset() {
  const [offset, setOffset] = useState(0);
  const [capoMode, setCapoMode] = useState(false);

  const capoFret = offset < 0 ? -offset : 0;

  const bumpSemitone = (delta: number) => {
    setCapoMode(false); // manuelles Halbton-Nudging verlässt den Capo-Rahmen
    setOffset((o) => Math.max(-11, Math.min(11, o + delta)));
  };

  const setCapo = (fret: number) => {
    setOffset(-fret);
    setCapoMode(fret > 0);
  };

  const reset = () => {
    setOffset(0);
    setCapoMode(false);
  };

  return { offset, capoFret, capoMode, bumpSemitone, setCapo, reset };
}
