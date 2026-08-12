"use client";

import { useEffect, useState } from "react";
import { useMetronome } from "@/lib/use-metronome";

/** Kompaktes Metronom für die Bühne — auf die Song-BPM vorbelegt. */
export function StageMetronome({
  initialBpm,
  onFlash,
}: {
  initialBpm: number | null;
  onFlash?: (flash: boolean, accent: boolean) => void;
}) {
  const [bpm, setBpm] = useState(initialBpm ?? 120);
  const { running, beatFlash, beatAccent, start, stop } = useMetronome(bpm);

  // Beat-Zustand nach oben melden (für den Bildschirm-Blitz in StageView).
  useEffect(() => {
    onFlash?.(beatFlash, beatAccent);
  }, [beatFlash, beatAccent, onFlash]);

  // Beim Verlassen des Songs (Remount über key={page.id}) sicherstellen, dass ein
  // gerade laufender Blitz nicht "hängen bleibt".
  useEffect(() => {
    return () => onFlash?.(false, false);
  }, [onFlash]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={running ? stop : start}
        className={`btn btn-stage ${running ? "border-accent bg-accent/20 text-accent-hi" : "btn-primary"}`}
      >
        {running ? "■" : "▶"}
      </button>
      <button type="button" className="btn btn-stage" onClick={() => setBpm((b) => Math.max(20, b - 5))}>
        −5
      </button>
      <button type="button" className="btn btn-stage" onClick={() => setBpm((b) => Math.max(20, b - 1))}>
        −1
      </button>
      <span
        className={`mono-display w-16 text-center text-lg font-bold ${
          beatFlash ? "text-accent-hi" : "text-ink"
        }`}
      >
        {bpm}
        <span className="ml-0.5 text-xs text-mute">BPM</span>
      </span>
      <button type="button" className="btn btn-stage" onClick={() => setBpm((b) => Math.min(300, b + 1))}>
        +1
      </button>
      <button type="button" className="btn btn-stage" onClick={() => setBpm((b) => Math.min(300, b + 5))}>
        +5
      </button>
      {initialBpm != null && bpm !== initialBpm && (
        <button type="button" className="btn btn-stage" onClick={() => setBpm(initialBpm)} title="Song-Tempo">
          ↺
        </button>
      )}
    </div>
  );
}
