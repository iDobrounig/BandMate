"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StagePage } from "./types";
import { nextSongTitle, type StageItem } from "@/lib/stage";
import { StageSong, type ViewSel } from "./stage-song";
import { StageBreak } from "./stage-break";
import { StageSection } from "./stage-section";
import { StageMinimal } from "./stage-minimal";
import { IconExpand, IconClose } from "@/components/icons";

const FONT_KEY = "stage-font-scale";
const DENSITY_KEY = "stage-density";
type Density = "full" | "minimal";

/**
 * Vollbild-Hülle des Bühnenmodus: blättert 1:1 durch die Setliste (Songs,
 * Set-Überschriften, Pausen), hält den Bildschirm an (Wake Lock) und rendert je
 * Element die passende Seite. Die Ansicht-Wahl (eigenes Instrument / anderes /
 * Lyrics) „klebt" über die Songs, wird pro Öffnen aber auf das Profil-Instrument
 * zurückgesetzt. Die Schriftgröße bleibt pro Gerät erhalten.
 */
export function StageView({
  setlistId,
  setlistName,
  pages,
  currentInstrument,
}: {
  setlistId: number;
  setlistName: string;
  pages: StagePage[];
  currentInstrument: string | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<ViewSel>(
    currentInstrument
      ? { kind: "instrument", instrument: currentInstrument }
      : { kind: "lyrics" }
  );
  const [fontScale, setFontScale] = useState(1);
  const [density, setDensity] = useState<Density>("full");
  const [beatFlash, setBeatFlash] = useState(false);
  const [beatAccent, setBeatAccent] = useState(false);
  const onMetronomeFlash = useCallback((flash: boolean, accent: boolean) => {
    setBeatFlash(flash);
    setBeatAccent(accent);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  // Schriftgröße & Dichte pro Gerät wiederherstellen.
  useEffect(() => {
    const saved = Number(localStorage.getItem(FONT_KEY));
    if (Number.isFinite(saved) && saved >= 0.6 && saved <= 2.4) setFontScale(saved);
    if (localStorage.getItem(DENSITY_KEY) === "minimal") setDensity("minimal");
  }, []);
  const changeDensity = (d: Density) => {
    localStorage.setItem(DENSITY_KEY, d);
    setDensity(d);
  };
  const changeFont = (delta: number) => {
    setFontScale((f) => {
      const next = Math.min(2.4, Math.max(0.6, Math.round((f + delta) * 100) / 100));
      localStorage.setItem(FONT_KEY, String(next));
      return next;
    });
  };

  const count = pages.length;
  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(count - 1, Math.max(0, i + delta))),
    [count]
  );

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push(`/setlisten/${setlistId}`);
  }, [router, setlistId]);

  // Wake Lock holen und bei Rückkehr in den Tab erneuern.
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      try {
        wakeRef.current = await navigator.wakeLock?.request("screen");
      } catch {
        /* nicht unterstützt / verweigert — kein Beinbruch */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, []);

  // Tastatur: blättern und beenden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exit]);

  // Wischen (nur horizontal, ab 60 px).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      go(dx < 0 ? 1 : -1);
    }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };

  const page = pages[index];
  const stageItems: StageItem[] = pages.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    title: p.title,
  }));

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-bg text-ink"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Kopfzeile */}
      <div className="stage-px stage-pt flex items-center gap-2 border-b border-line pb-2 text-sm">
        <button
          type="button"
          className="btn btn-stage shrink-0"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label="Zurück"
        >
          ‹
        </button>
        <span className="mono-display tabular-nums whitespace-nowrap shrink-0 text-mute">
          {index + 1} / {count}
        </span>
        <button
          type="button"
          className="btn btn-stage shrink-0"
          onClick={() => go(1)}
          disabled={index === count - 1}
          aria-label="Weiter"
        >
          ›
        </button>
        <span className="hidden truncate text-mute sm:block">{setlistName}</span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="flex items-center rounded-md border border-line p-0.5">
            <button
              type="button"
              className={`btn btn-stage border-0 ${density === "full" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("full")}
            >
              Voll
            </button>
            <button
              type="button"
              className={`btn btn-stage border-0 ${density === "minimal" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
              onClick={() => changeDensity("minimal")}
            >
              Notenpult
            </button>
          </div>
          <button
            type="button"
            className="btn btn-stage"
            onClick={toggleFullscreen}
            title="Vollbild"
          >
            <IconExpand className="size-5" />
          </button>
          <button
            type="button"
            className="btn btn-stage"
            onClick={exit}
            aria-label="Beenden"
          >
            <IconClose className="size-5" />
            <span className="hidden sm:inline">Beenden</span>
          </button>
        </div>
      </div>

      {/* Inhalt */}
      <div className="relative min-h-0 flex-1">
        {density === "minimal" ? (
          <StageMinimal
            key={page.id}
            pages={pages}
            index={index}
            onMetronomeFlash={onMetronomeFlash}
          />
        ) : (
          <>
            {page.kind === "song" && (
              <StageSong
                key={page.id}
                page={page}
                view={view}
                onViewChange={setView}
                fontScale={fontScale}
                onFontChange={changeFont}
                onMetronomeFlash={onMetronomeFlash}
              />
            )}
            {page.kind === "section" && <StageSection key={page.id} label={page.label} />}
            {page.kind === "break" && (
              <StageBreak
                key={page.id}
                breakSeconds={page.breakSeconds}
                label={page.label}
                nextSong={nextSongTitle(stageItems, index)}
              />
            )}
          </>
        )}
        <div
          className="pointer-events-none absolute inset-0 z-10 bg-accent transition-opacity duration-75"
          style={{ opacity: beatFlash ? (beatAccent ? 0.45 : 0.22) : 0 }}
        />
      </div>
    </div>
  );
}
