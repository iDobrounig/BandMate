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
`const [beatFlash, setBeatFlash] = useState(false)` / `const [beatAccent, setBeatAccent] =
useState(false)`, übergibt `onMetronomeFlash={onMetronomeFlash}` an die jeweils aktive
Content-Komponente und rendert zusätzlich eine klickdurchlässige (`pointer-events-none`)
Overlay-Ebene — **nicht** als eigenes `fixed`-Geschwisterelement des Kopfzeilen-Containers,
sondern als `absolute inset-0` Kind *innerhalb* des Inhalts-Wrappers (`<div className="relative
min-h-0 flex-1">`, der Kopfzeile und Inhalt trennt):

```
<div className="relative min-h-0 flex-1">
  {/* StageSong / StageSection / StageBreak / StageMinimal */}
  <div
    className="pointer-events-none absolute inset-0 z-10 bg-accent transition-opacity duration-75 motion-reduce:hidden"
    style={{ opacity: beatFlash ? (beatAccent ? 0.45 : 0.22) : 0 }}
  />
</div>
```

Ein früherer Entwurf sah stattdessen ein `fixed inset-0 z-40`-Overlay als direktes Kind des
äußeren `fixed inset-0 z-50`-Containers vor (Geschwister der Kopfzeile). Das funktioniert so
nicht: Innerhalb dieses Stacking-Contexts ist die Kopfzeile ein *unpositioniertes* Element
(kein `position: relative/absolute/fixed`), ein positioniertes `z-40`-Geschwister würde also
unabhängig vom z-Index-Wert **über** ihr gemalt und sie verdecken. Die tatsächliche Lösung
umgeht das strukturell: `absolute inset-0` innerhalb des Inhalts-Wrappers kann die Kopfzeile
gar nicht erreichen, weil sie außerhalb dieses Wrappers liegt — kein `z-40` nötig, `z-10`
reicht (nur relativ zum eigenen Inhalts-Wrapper, dessen Song-/Lyrics-Inhalt darunterliegt).

Bewusste Entscheidung (nach Live-Demo bestätigt): Der Blitz überzieht damit auch die
Werkzeugleiste/Bedienelemente *innerhalb* des Inhalts (Metronom-Buttons, Transponieren, Capo
etc. im Footer von `StageSong`, sowie das Metronom in `StageMinimal`), da diese im selben
Inhalts-Wrapper wie Noten/Lyrics liegen — das ist gewollt, nicht der zuvor beschriebene Bug:
Buttons bleiben dank `pointer-events-none` auf dem Overlay voll klickbar, und der Blitz
verstärkt den Beat genau dort, wo ohnehin gerade hingeschaut/getippt wird. Nur die Kopfzeile
(Navigation, Vollbild, Beenden) bleibt ausgenommen.

Der betonte erste Schlag blitzt sichtbar heller als die Schläge 2–4 (spiegelt den bereits
vorhandenen Audio-Akzent). Für Nutzer mit `prefers-reduced-motion: reduce` bleibt das Overlay
per `motion-reduce:hidden` komplett unsichtbar (Metronom-Audio/-Bedienelemente sind davon
nicht betroffen).

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
