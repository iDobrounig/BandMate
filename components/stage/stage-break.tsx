"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown } from "@/lib/stage";

/**
 * Countdown-Steuerung einer Pause. Startet erst auf Tipp (die Pause beginnt
 * selten in der Sekunde, in der man herblättert) und zählt über null hinaus ins
 * Plus, weil Pausen praktisch immer überziehen. Wiederverwendet von der vollen
 * Pausen-Seite und der Notenpult-Ansicht.
 */
export function BreakTimer({
  breakSeconds,
  compact = false,
}: {
  breakSeconds: number | null;
  compact?: boolean;
}) {
  const planned = breakSeconds ?? 0;
  const [remaining, setRemaining] = useState<number | null>(null); // null = nicht gestartet
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemaining(planned);
    timerRef.current = setInterval(() => {
      setRemaining((r) => (r == null ? r : r - 1));
    }, 1000);
  };

  const running = remaining != null;
  const over = running && remaining! < 0;
  const countSize = compact ? "text-5xl sm:text-6xl" : "text-7xl sm:text-9xl";
  const plannedSize = compact ? "text-4xl sm:text-5xl" : "text-6xl sm:text-7xl";

  if (!running) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className={`mono-display text-mute ${plannedSize}`}>
          {planned > 0 ? `${Math.round(planned / 60)} min` : "—"}
        </p>
        <button type="button" className="btn btn-primary text-lg" onClick={startTimer}>
          ▶ Pause starten
        </button>
      </div>
    );
  }

  return (
    <p
      className={`mono-display font-bold tabular-nums ${countSize} ${
        over ? "text-red-400" : "text-ink"
      }`}
    >
      {formatCountdown(remaining!)}
    </p>
  );
}

/**
 * Volle Pausen-Seite: Countdown plus „Weiter mit …" (nennt den nächsten Song).
 */
export function StageBreak({
  breakSeconds,
  label,
  nextSong,
}: {
  breakSeconds: number | null;
  label: string | null;
  nextSong: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="text-sm uppercase tracking-widest text-faint">Pause</span>
      {label && <p className="text-xl text-mute">{label}</p>}

      <BreakTimer breakSeconds={breakSeconds} />

      {nextSong && (
        <p className="mt-4 text-lg text-mute">
          Weiter mit: <span className="font-semibold text-ink">{nextSong}</span>
        </p>
      )}
    </div>
  );
}
