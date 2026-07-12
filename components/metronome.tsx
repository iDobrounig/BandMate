"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Web-Audio-Metronom mit Lookahead-Scheduler und Tap-Tempo.
 * Akzent auf der 1 bei 4/4.
 */
export function Metronome({ initialBpm }: { initialBpm: number | null }) {
  const [open, setOpen] = useState(false);
  const [bpm, setBpm] = useState(initialBpm ?? 120);
  const [running, setRunning] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

  const taps = useRef<number[]>([]);

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRunning(false);
  };

  const scheduleClick = (time: number, accent: boolean) => {
    const ctx = ctxRef.current!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1568 : 1047; // G6 / C6
    gain.gain.setValueAtTime(accent ? 0.5 : 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.06);
  };

  const start = async () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") await ctx.resume();
    beatRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.06;
    timerRef.current = setInterval(() => {
      // 100 ms Lookahead
      while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
        const accent = beatRef.current % 4 === 0;
        scheduleClick(nextNoteTimeRef.current, accent);
        const delay = Math.max(
          0,
          (nextNoteTimeRef.current - ctx.currentTime) * 1000
        );
        setTimeout(() => {
          setBeatFlash(true);
          setTimeout(() => setBeatFlash(false), 80);
        }, delay);
        nextNoteTimeRef.current += 60 / bpmRef.current;
        beatRef.current += 1;
      }
    }, 25);
    setRunning(true);
  };

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

  useEffect(() => stop, []);

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
    <div className="card inline-flex flex-wrap items-center gap-3 p-3">
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
