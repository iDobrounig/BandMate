# Bühnenmodus: größere Touch-Targets + Bildschirm-Blitz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle Bedienelemente im Bühnenmodus auf touch-taugliche Größe bringen und den
Metronom-Beat zusätzlich als kurzen, vollflächigen Farb-Blitz über dem Inhaltsbereich sichtbar
machen.

**Architektur:** Neue CSS-Klasse `.btn-stage` (größeres Touch-Target) ersetzt `btn-sm` in
allen Bühnenmodus-Komponenten. Der Metronom-Beat (inkl. Akzent-Info) wird per Callback-Prop
von `StageMetronome` nach oben bis `StageView` durchgereicht, die eine zusätzliche,
klickdurchlässige Overlay-Ebene über den Inhaltsbereich (nicht die Kopfzeile) legt.

**Tech Stack:** Next.js App Router (Client Components), Tailwind v4, reine CSS/React-Änderung.

## Global Constraints

- `.btn-stage` gilt **nur** innerhalb des Bühnenmodus (`components/stage/*`) — der Rest der
  App bleibt bei `.btn`/`.btn-sm`.
- Der Bildschirm-Blitz überdeckt **nur den Inhaltsbereich**, nicht die Kopfzeile — die bleibt
  im Blitz-Moment klar lesbar/bedienbar (Entscheidung vom 12.08.2026, siehe Konversation).
- Der betonte erste Schlag (Beat 1 von 4) blitzt sichtbar heller als die Schläge 2–4.
- Kein DB-Eingriff, keine Migration.
- Kein Test-Framework für diese rein clientseitige UI-Änderung — Verifikation per
  `npx tsc --noEmit`, `npm run build` und Browser-Durchlauf auf Smartphone-Breite.

---

### Task 1: `.btn-stage`-Klasse + größere Metronom-Buttons

**Files:**
- Modify: `app/globals.css`
- Modify: `components/stage/stage-metronome.tsx`

**Interfaces:**
- Produces: CSS-Klasse `.btn-stage` (kombiniert mit `.btn`, wie `.btn-sm` das heute schon
  tut), verwendbar als `className="btn btn-stage"`.

- [ ] **Step 1: `.btn-stage` in `app/globals.css` ergänzen**

Füge in `app/globals.css` direkt nach dem bestehenden `.btn-sm`-Block (nach dessen
schließender `}`, vor dem Kommentar zu `.btn-danger`) ein:

```css
  /* Touch-taugliche Variante für den Bühnenmodus (Smartphone am Notenständer) —
     mindestens 44×44px Zielfläche, größere Schrift/Icons als .btn-sm. */
  .btn-stage {
    @apply min-h-11 min-w-11 px-4 py-2.5 text-base rounded-lg;
  }
```

- [ ] **Step 2: `stage-metronome.tsx` auf `.btn-stage` umstellen**

Ersetze den kompletten Dateiinhalt von `components/stage/stage-metronome.tsx` durch:

```tsx
"use client";

import { useState } from "react";
import { useMetronome } from "@/lib/use-metronome";

/** Kompaktes Metronom für die Bühne — auf die Song-BPM vorbelegt. */
export function StageMetronome({ initialBpm }: { initialBpm: number | null }) {
  const [bpm, setBpm] = useState(initialBpm ?? 120);
  const { running, beatFlash, start, stop } = useMetronome(bpm);

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
```

(Einzige Änderungen gegenüber vorher: `gap-1` → `flex-wrap items-center gap-1.5` am
Container, und jedes `btn btn-sm` → `btn btn-stage`. Logik unverändert.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 4: Browser-Check**

Dev-Server `bandmate-dev`, Browser-Viewport auf Smartphone-Breite (z.B. 390px) stellen.
Bühnenmodus einer Setliste mit mindestens einem Song mit hinterlegtem Tempo öffnen (Voll-
oder Notenpult-Ansicht, `StageMetronome` ist in beiden sichtbar). Play/Stop, −5/−1/+1/+5 und
(nach Tempo-Änderung) Reset antippen — alle Buttons sollen spürbar größer als vorher sein und
sich einfach treffen lassen, kein Umbruch-Chaos bei schmalem Viewport.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/stage/stage-metronome.tsx
git commit -m "feat: größere Touch-Targets für Metronom im Bühnenmodus"
```

---

### Task 2: Größere Buttons in der Werkzeugleiste (`StageSong`)

**Files:**
- Modify: `components/stage/stage-song.tsx`

**Interfaces:**
- Consumes: CSS-Klasse `.btn-stage` aus Task 1.

- [ ] **Step 1: `stage-song.tsx` auf `.btn-stage` umstellen**

Ersetze den kompletten Dateiinhalt von `components/stage/stage-song.tsx` durch:

```tsx
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
                  className={`btn btn-stage ${active ? "border-accent bg-accent/20 text-accent-hi" : ""}`}
                  onClick={() => onViewChange({ kind: "instrument", instrument: raw })}
                >
                  {label}
                </button>
              );
            })}
            <button
              type="button"
              className={`btn btn-stage ${!showSheet ? "border-accent bg-accent/20 text-accent-hi" : ""}`}
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
            className="btn btn-stage ml-auto"
            onClick={() => setShowTools((v) => !v)}
          >
            {showTools ? "▾ Werkzeuge" : "▸ Werkzeuge"}
          </button>
        </div>

        {showTools && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="label mb-0 text-xs">Schrift</span>
              <button type="button" className="btn btn-stage" onClick={() => onFontChange(-0.1)}>
                A−
              </button>
              <button type="button" className="btn btn-stage" onClick={() => onFontChange(0.1)}>
                A+
              </button>
            </div>
            {showLyrics && (
              <div className="flex items-center gap-1">
                <span className="label mb-0 text-xs">Transponieren</span>
                <button
                  type="button"
                  className="btn btn-stage"
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
                  className="btn btn-stage"
                  onClick={() => bumpSemitone(1)}
                >
                  + ½
                </button>
                <CapoSelect capoFret={capoFret} onChange={setCapo} />
                {offset !== 0 && (
                  <button type="button" className="btn btn-stage" onClick={reset}>
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
```

Änderungen gegenüber vorher: jedes `btn btn-sm` → `btn btn-stage`; `<CapoSelect compact
capoFret={capoFret} onChange={setCapo} />` → `<CapoSelect capoFret={capoFret}
onChange={setCapo} />` (ohne `compact`, dadurch größeres `.input`-Padding). Logik/Props
unverändert — die `onMetronomeFlash`-Prop kommt erst in Task 4 dazu.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Browser-Check**

Bühnenmodus, Voll-Ansicht, einen Song mit Lyrics/Akkorden UND mit hinterlegten Noten für
mindestens ein Instrument öffnen (damit der Instrument/Lyrics-Umschalter sichtbar ist).
„▸ Werkzeuge" antippen, Schriftgröße A−/A+, Transponieren −½/+½, Capo-Auswahl und Reset (↺)
prüfen — alle Buttons größer, die Capo-Auswahl (Dropdown) sichtbar etwas größer als vorher.
Kein Umbruch-Chaos bei 390px Breite.

- [ ] **Step 4: Commit**

```bash
git add components/stage/stage-song.tsx
git commit -m "feat: größere Touch-Targets in der Bühnenmodus-Werkzeugleiste"
```

---

### Task 3: Größere Buttons in der Bühnenmodus-Kopfzeile (`StageView`)

**Files:**
- Modify: `components/stage/stage-view.tsx`

**Interfaces:**
- Consumes: CSS-Klasse `.btn-stage` aus Task 1.

- [ ] **Step 1: Kopfzeile in `stage-view.tsx` auf `.btn-stage` umstellen**

In `components/stage/stage-view.tsx`, ersetze den Kopfzeilen-Block (beginnt bei
`{/* Kopfzeile */}`, endet vor `{/* Inhalt */}`) durch:

```tsx
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
```

(Nur `btn btn-sm` → `btn btn-stage` und `size-4` → `size-5` bei den beiden Icons. Restliche
Logik/Handler unverändert.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Browser-Check**

Bühnenmodus öffnen, Kopfzeile bei 390px Breite prüfen: Zurück/Weiter, Voll/Notenpult-
Umschalter, Vollbild, Beenden — alle spürbar größer, Icons erkennbar größer, kein
Überlaufen/Abschneiden der Kopfzeile bei schmalem Viewport (`setlistName` darf weiter per
`hidden sm:block` auf Schmalbildschirmen verschwinden wie bisher).

- [ ] **Step 4: Commit**

```bash
git add components/stage/stage-view.tsx
git commit -m "feat: größere Touch-Targets in der Bühnenmodus-Kopfzeile"
```

---

### Task 4: Vollflächiger Bildschirm-Blitz beim Metronom-Beat

**Files:**
- Modify: `lib/use-metronome.ts`
- Modify: `components/stage/stage-metronome.tsx`
- Modify: `components/stage/stage-song.tsx`
- Modify: `components/stage/stage-minimal.tsx`
- Modify: `components/stage/stage-view.tsx`

**Interfaces:**
- Produces: `useMetronome(bpm)` liefert zusätzlich `beatAccent: boolean` (true, wenn der
  aktuelle/letzte Flash der betonte erste Schlag von 4 war).
- Produces: `StageMetronome` bekommt neue optionale Prop
  `onFlash?: (flash: boolean, accent: boolean) => void`.
- Produces: `StageSong` und `StageMinimal` bekommen je eine neue optionale Prop
  `onMetronomeFlash?: (flash: boolean, accent: boolean) => void`, 1:1 an `StageMetronome`
  durchgereicht.

- [ ] **Step 1: `beatAccent` in `lib/use-metronome.ts` ergänzen**

In `lib/use-metronome.ts`, füge nach der Zeile `const [beatFlash, setBeatFlash] =
useState(false);` eine neue Zeile hinzu:

```ts
  const [beatAccent, setBeatAccent] = useState(false);
```

Im `scheduleClick`-Aufrufblock innerhalb von `start` (das `setTimeout(() => { setBeatFlash(true); ...`),
ergänze `setBeatAccent(accent)`:

```ts
        setTimeout(() => {
          setBeatFlash(true);
          setBeatAccent(accent);
          setTimeout(() => setBeatFlash(false), 80);
        }, delay);
```

Und in der `return`-Zeile am Ende der Funktion, gib `beatAccent` mit zurück:

```ts
  return { running, beatFlash, beatAccent, start, stop };
```

- [ ] **Step 2: `onFlash`-Prop in `stage-metronome.tsx` ergänzen**

Ersetze den kompletten Dateiinhalt von `components/stage/stage-metronome.tsx` durch:

```tsx
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
```

- [ ] **Step 3: `onMetronomeFlash` durch `stage-song.tsx` durchreichen**

In `components/stage/stage-song.tsx`: Props-Typ von `StageSong` um `onMetronomeFlash`
erweitern und an `StageMetronome` weitergeben.

Ändere die Funktionssignatur von:

```tsx
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
```

zu:

```tsx
export function StageSong({
  page,
  view,
  onViewChange,
  fontScale,
  onFontChange,
  onMetronomeFlash,
}: {
  page: StagePage;
  view: ViewSel;
  onViewChange: (v: ViewSel) => void;
  fontScale: number;
  onFontChange: (delta: number) => void;
  onMetronomeFlash?: (flash: boolean, accent: boolean) => void;
}) {
```

Und ändere die `StageMetronome`-Nutzung von `<StageMetronome initialBpm={page.tempoBpm} />`
zu `<StageMetronome initialBpm={page.tempoBpm} onFlash={onMetronomeFlash} />`.

- [ ] **Step 4: `onMetronomeFlash` durch `stage-minimal.tsx` durchreichen**

Ersetze den kompletten Dateiinhalt von `components/stage/stage-minimal.tsx` durch:

```tsx
import type { StagePage } from "./types";
import { StageMetronome } from "./stage-metronome";
import { BreakTimer } from "./stage-break";
import { upcomingItems, describeUpcoming } from "@/lib/stage";

/**
 * „Notenpult"-Ansicht für Mitglieder mit physischen Noten: kein Lyrics/PDF,
 * sondern der aktuelle Ablaufpunkt groß plus die nächsten zwei Elemente als
 * Vorschau. Alternative Render-Schicht über demselben `StageView`-Index.
 */
export function StageMinimal({
  pages,
  index,
  onMetronomeFlash,
}: {
  pages: StagePage[];
  index: number;
  onMetronomeFlash?: (flash: boolean, accent: boolean) => void;
}) {
  const current = pages[index];
  const upcoming = upcomingItems(pages, index, 2);

  return (
    <div className="flex h-full flex-col">
      {/* JETZT */}
      <div className="stage-px flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
        <span className="text-xs uppercase tracking-widest text-faint">
          {current.kind === "break" ? "Pause" : current.kind === "section" ? "Set" : "Jetzt"}
        </span>

        {current.kind === "song" && (
          <>
            <h1 className="headline text-4xl leading-tight sm:text-6xl">{current.title}</h1>
            {current.artist && <p className="text-xl text-mute">{current.artist}</p>}
            <p className="mono-display flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg text-mute">
              {current.songKey && (
                <span>
                  Tonart <span className="text-ink">{current.songKey}</span>
                </span>
              )}
              {current.capo != null && <span>Capo {current.capo}</span>}
              {current.tempoBpm && <span>{current.tempoBpm} BPM</span>}
            </p>
            {current.note && <p className="text-lg text-accent-hi">» {current.note}</p>}
            <div className="mt-2">
              <StageMetronome initialBpm={current.tempoBpm} onFlash={onMetronomeFlash} />
            </div>
          </>
        )}

        {current.kind === "section" && (
          <h1 className="headline text-5xl sm:text-7xl">{current.label ?? "Set"}</h1>
        )}

        {current.kind === "break" && (
          <>
            {current.label && <p className="text-xl text-mute">{current.label}</p>}
            <BreakTimer breakSeconds={current.breakSeconds} compact />
          </>
        )}
      </div>

      {/* ALS NÄCHSTES */}
      <div className="stage-px stage-pb shrink-0 border-t border-line pt-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-faint">Als nächstes</p>
        {upcoming.length > 0 ? (
          <ul className="space-y-1">
            {upcoming.map((item) => (
              <li key={item.id} className="text-lg text-mute">
                {describeUpcoming(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-lg text-faint">— Ende —</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Overlay + State in `stage-view.tsx` ergänzen**

In `components/stage/stage-view.tsx`:

Ergänze `useCallback` bleibt bereits importiert (schon in der bestehenden Import-Zeile
`import { useCallback, useEffect, useRef, useState } from "react";`).

Füge nach der Zeile `const [density, setDensity] = useState<Density>("full");` zwei neue
Zeilen ein:

```tsx
  const [beatFlash, setBeatFlash] = useState(false);
  const [beatAccent, setBeatAccent] = useState(false);
  const onMetronomeFlash = useCallback((flash: boolean, accent: boolean) => {
    setBeatFlash(flash);
    setBeatAccent(accent);
  }, []);
```

Ersetze den „Inhalt"-Block:

```tsx
      {/* Inhalt */}
      <div className="min-h-0 flex-1">
        {density === "minimal" ? (
          <StageMinimal key={page.id} pages={pages} index={index} />
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
      </div>
```

durch:

```tsx
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
```

(Der Inhalts-Container bekommt `relative` und trägt am Ende eine zusätzliche, `absolute
inset-0` positionierte, klickdurchlässige Blitz-Ebene — bleibt dadurch auf den Inhaltsbereich
begrenzt und lässt die Kopfzeile unberührt.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 7: Production-Build**

Run: `npm run build`
Expected: Build erfolgreich

- [ ] **Step 8: Browser-Check**

Dev-Server, Bühnenmodus einer Setliste mit einem Song mit hinterlegtem Tempo:

1. **Voll-Ansicht:** Metronom starten (▶) — der Inhaltsbereich (Noten/Lyrics) blitzt im
   Songtempo gelblich auf, die Kopfzeile bleibt unberührt/klar lesbar. Der erste Schlag von 4
   ist sichtbar heller als die folgenden drei.
2. **Notenpult-Ansicht:** dasselbe — Blitz im „JETZT"-Bereich, Kopfzeile unberührt.
3. **Song wechseln während der Metronom läuft** (Pfeiltaste/Wischen): kein hängen bleibender
   Blitz auf der neuen Seite — Metronom der neuen Seite startet frisch (wie bisher, unverändert
   durch `key={page.id}`).
4. Metronom stoppen (■) — Blitz hört sofort auf.

- [ ] **Step 9: Commit**

```bash
git add lib/use-metronome.ts components/stage/stage-metronome.tsx components/stage/stage-song.tsx components/stage/stage-minimal.tsx components/stage/stage-view.tsx
git commit -m "feat: vollflächiger Bildschirm-Blitz beim Metronom-Beat im Bühnenmodus"
```
