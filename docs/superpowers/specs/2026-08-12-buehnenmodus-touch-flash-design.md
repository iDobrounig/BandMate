# Bühnenmodus: größere Touch-Targets + Bildschirm-Blitz — Design

Stand: 12.08.2026 · Nachbesserung am Bühnenmodus (Welle 2), nach erstem Praxiseinsatz.

## Problem

Metronom- und Werkzeug-Buttons im Bühnenmodus (`components/stage/*`) nutzen durchgehend
`.btn-sm` — auf dem Smartphone, dem Hauptgerät am Notenständer, sind sie schwer präzise zu
treffen. Der Beat-Flash des Metronoms färbt nur die BPM-Ziffer um (`stage-metronome.tsx:26-30`)
— aus Armlänge/peripher beim Spielen kaum wahrnehmbar.

## Ziel

Alle Bedienelemente im Bühnenmodus auf touch-taugliche Größe (≥44×44px) bringen, und der
Metronom-Beat zusätzlich als kurzer, vollflächiger Bildschirm-Blitz sichtbar machen — nicht
nur als Text-Farbwechsel.

## Entscheidungen

### Größere Bedienelemente

Neue Klasse `.btn-stage` in `app/globals.css` (`@layer components`), analog zu `.btn`, aber
mit größerem Touch-Target (`min-h-11 min-w-11`), größerer Schrift (`text-base` statt
`text-xs`/`text-sm`) und mehr Padding (`px-4 py-2.5`). Gilt **nur** innerhalb des
Bühnenmodus — der Rest der App bleibt bei `.btn`/`.btn-sm`, da dort andere Platzverhältnisse
(Desktop-Listen, dichte Formulare) gelten.

Ersetzt `btn btn-sm` → `btn-stage` in:
- `stage-view.tsx`: Kopfzeile — Zurück/Weiter-Pfeile, Voll/Notenpult-Umschalter, Vollbild,
  Beenden (inkl. größerer Icons, `size-4` → `size-5`)
- `stage-song.tsx`: Instrument/Lyrics-Umschalter-Tabs, Werkzeuge-Toggle, Schriftgröße
  (A−/A+), Transponieren (−½/+½), Capo-Auswahl (`CapoSelect`, non-compact statt compact),
  Reset (↺)
- `stage-metronome.tsx`: Play/Stop, −5/−1/+1/+5, Reset (↺)

`stage-break.tsx`s „▶ Pause starten" nutzt bereits `.btn.btn-primary.text-lg` (ausreichend
groß) und bleibt unverändert.

### Vollflächiger Beat-Blitz

`useMetronome` (`lib/use-metronome.ts`) gibt zusätzlich zurück, ob der aktuelle Flash der
betonte erste Schlag ist (`beatAccent: boolean`, gesetzt zeitgleich mit `beatFlash`, aus dem
bereits vorhandenen `accent = beatRef.current % 4 === 0`).

`StageMetronome` bekommt eine neue optionale Prop `onFlash?: (flash: boolean, accent: boolean) => void`
und ruft sie in einem `useEffect` auf, wann immer sich `beatFlash`/`beatAccent` ändern —
inklusive eines Cleanup-Aufrufs `onFlash?.(false, false)` beim Unmount, damit ein Screen-Flash
nicht "hängen bleibt", wenn man mitten im Flash zum nächsten Song blättert (Komponente wird
dort per `key={page.id}` neu gemountet).

`onFlash` wird durchgereicht: `StageSong` und `StageMinimal` bekommen je eine neue optionale
Prop `onMetronomeFlash` und geben sie 1:1 an `StageMetronome` weiter. `StageView` hält
`const [flash, setFlash] = useState<{ on: boolean; accent: boolean }>(...)`, übergibt
`onMetronomeFlash={(on, accent) => setFlash({ on, accent })}` an die jeweils aktive
Content-Komponente und rendert zusätzlich eine klickdurchlässige (`pointer-events-none`)
Overlay-Ebene über den gesamten `fixed inset-0`-Container:

```
<div
  className="pointer-events-none fixed inset-0 z-40 bg-accent transition-opacity duration-75"
  style={{ opacity: flash.on ? (flash.accent ? 0.45 : 0.22) : 0 }}
/>
```

Der betonte erste Schlag blitzt sichtbar heller als die Schläge 2–4 (spiegelt den bereits
vorhandenen Audio-Akzent). `z-40` liegt unter der Kopfzeile/den Bedienelementen (die bleiben
klar lesbar), aber über dem Song-/Lyrics-Inhalt.

Der Text-Flash in `StageMetronome` selbst (`text-accent-hi` auf der BPM-Ziffer) bleibt
zusätzlich bestehen — er ist die Bestätigung direkt am Bedienelement, wenn man draufschaut.

## Kein DB-Eingriff

Rein clientseitige UI-/CSS-Änderung. Keine Migration, `data/` unangetastet.

## Verifikation

Browser-Durchlauf (Dev-Server `bandmate-dev`, Viewport auf Smartphone-Breite) im
Bühnenmodus einer Setliste mit Songs, Set-Überschrift und Pause: Touch-Targets aller
Bedienelemente in Voll- und Notenpult-Ansicht optisch prüfen (Kopfzeile, Metronom,
Werkzeugleiste inkl. Capo-Auswahl), Metronom starten und Bildschirm-Blitz in beiden Ansichten
beobachten (Akzent-Schlag heller als die übrigen drei), Blättern zum nächsten Song während
laufendem Metronom prüft, dass der Blitz nicht hängen bleibt. Abschluss `npx tsc --noEmit` +
`npm run build`.
