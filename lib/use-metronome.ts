"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Web-Audio-Metronom als Hook: Lookahead-Scheduler mit Akzent auf der 1 (4/4).
 * `bpm` wird über eine Ref gelesen, damit ein laufender Scheduler
 * Tempoänderungen sofort übernimmt, ohne neu zu starten.
 *
 * Gemeinsame Quelle für das Metronom-Widget (`components/metronome.tsx`) und
 * den Bühnenmodus (`components/stage/…`).
 */
export function useMetronome(bpm: number) {
  const [running, setRunning] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);
  const [beatAccent, setBeatAccent] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef(0);
  const beatRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;

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
          setBeatAccent(accent);
          setTimeout(() => setBeatFlash(false), 80);
        }, delay);
        nextNoteTimeRef.current += 60 / bpmRef.current;
        beatRef.current += 1;
      }
    }, 25);
    setRunning(true);
  };

  // Beim Unmount den Scheduler sauber abräumen.
  useEffect(() => stop, []);

  return { running, beatFlash, beatAccent, start, stop };
}
