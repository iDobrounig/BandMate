"use client";

import { useRef, useState } from "react";
import { useMetronome } from "@/lib/use-metronome";

/**
 * Web-Audio-Metronom mit Tap-Tempo. Der Scheduler steckt im Hook
 * `useMetronome`; hier bleibt nur die BPM-/Tap-Bedienung.
 */
export function Metronome({ initialBpm }: { initialBpm: number | null }) {
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = useState(initialBpm ?? 120);
  const { running, beatFlash, start, stop } = useMetronome(bpm);

  const taps = useRef<number[]>([]);

  const tap = () => {
    const now = performance.now();
    taps.current = taps.current.filter((t) => now - t < 3000);
    taps.current.push(now);
    if (taps.current.length >= 2) {
      const intervals = taps.current
        .slice(1)
        .map((t, i) => t - taps.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const next = Math.round(60000 / avg);
      if (next >= 20 && next <= 300) setBpm(next);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        ◔ Metronom
        {initialBpm ? (
          <span className="mono-display text-xs text-mute">{initialBpm} BPM</span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-2 p-3 w-full sm:w-auto sm:inline-flex">
      <button
        type="button"
        onClick={running ? stop : start}
        className={`btn ${running ? "border-accent bg-accent/20 text-accent-hi" : "btn-primary"}`}
      >
        {running ? "■ Stopp" : "▶ Start"}
      </button>
      <div className="flex items-center gap-1">
        <button type="button" className="btn btn-sm" onClick={() => setBpm((b) => Math.max(20, b - 5))}>
          −5
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setBpm((b) => Math.max(20, b - 1))}>
          −1
        </button>
        <span
          className={`mono-display mx-1 w-24 text-center text-2xl font-bold transition ${
            beatFlash ? "text-accent-hi" : "text-ink"
          }`}
        >
          {bpm}
          <span className="ml-1 text-xs text-mute">BPM</span>
        </span>
        <button type="button" className="btn btn-sm" onClick={() => setBpm((b) => Math.min(300, b + 1))}>
          +1
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setBpm((b) => Math.min(300, b + 5))}>
          +5
        </button>
      </div>
      <button type="button" className="btn" onClick={tap} title="Im Takt tippen">
        Tap
      </button>
      {initialBpm && bpm !== initialBpm && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setBpm(initialBpm)}
          title="Zurück zum Song-Tempo"
        >
          ↺ {initialBpm}
        </button>
      )}
      <button
        type="button"
        className="text-sm text-faint hover:text-ink cursor-pointer"
        onClick={() => {
          stop();
          setOpen(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
