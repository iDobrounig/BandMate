# Bühnenmodus: Voll/Notenpult-Umschalter als Icons — Design

Stand: 12.08.2026 · Kleine Nachbesserung nach der Touch-Target/Blitz-Anpassung.

## Problem

Die Kopfzeile im Bühnenmodus läuft bei Smartphone-Breite (375px) über und muss horizontal
gescrollt werden, um „Vollbild"/„Beenden" zu erreichen (`overflow-x-auto` als Sicherheitsnetz
aus der vorherigen Nachbesserung). Größter Platzfresser ist der Text „Voll"/„Notenpult" im
Dichte-Umschalter.

## Ziel

„Voll"/„Notenpult" auf schmalen Bildschirmen als reine Icons darstellen, damit die Kopfzeile
ohne Scrollen passt und „Beenden" direkt sichtbar ist. Auf breiteren Bildschirmen (Tablet/
Desktop) bleibt die Textbeschriftung erhalten.

## Entscheidungen

### Neue Icons

Zwei neue Icons in `components/icons.tsx`, im bestehenden Feather-Strich-Stil (`Svg`-Wrapper,
24×24 Viewbox, `currentColor`, `strokeWidth={2}`):

- **`IconLayoutFull`** — ein abgerundetes Rechteck (eine durchgehende Fläche = Voll-Ansicht
  mit Lyrics/Noten/PDF).
- **`IconLayoutSplit`** — abgerundetes Rechteck mit horizontaler Trennlinie (zwei Bereiche =
  Notenpult-Ansicht, die tatsächlich aus „JETZT" + „ALS NÄCHSTES" besteht,
  `components/stage/stage-minimal.tsx`).

```tsx
export function IconLayoutFull({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </Svg>
  );
}

export function IconLayoutSplit({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </Svg>
  );
}
```

### Buttons in der Kopfzeile

In `components/stage/stage-view.tsx` bekommen die beiden Dichte-Buttons je ein Icon plus
Text, der wie beim bestehenden „Beenden"-Button per `hidden sm:inline` erst ab Tablet-Breite
sichtbar wird. `aria-label` bleibt unabhängig von der Bildschirmgröße gesetzt (Konsistenz mit
„Beenden", das ebenfalls Icon+Text UND `aria-label` gleichzeitig trägt).

```tsx
<button
  type="button"
  className={`btn btn-stage border-0 ${density === "full" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
  onClick={() => changeDensity("full")}
  aria-label="Vollständig"
>
  <IconLayoutFull className="size-5" />
  <span className="hidden sm:inline">Voll</span>
</button>
<button
  type="button"
  className={`btn btn-stage border-0 ${density === "minimal" ? "bg-accent/20 text-accent-hi" : "text-mute"}`}
  onClick={() => changeDensity("minimal")}
  aria-label="Notenpult"
>
  <IconLayoutSplit className="size-5" />
  <span className="hidden sm:inline">Notenpult</span>
</button>
```

`overflow-x-auto` auf dem Kopfzeilen-Container bleibt als Sicherheitsnetz bestehen (für noch
schmalere Geräte oder künftige Ergänzungen) — wird durch diese Änderung nicht entfernt.

## Kein DB-Eingriff

Rein clientseitige UI-Änderung. Keine Migration, `data/` unangetastet.

## Verifikation

Browser-Durchlauf bei 375px Breite: Kopfzeile passt ohne Scrollen vollständig, „Beenden"
direkt sichtbar/tappbar. Dichte-Umschalter zeigt nur Icons, aktiver Zustand weiterhin optisch
erkennbar (Hintergrund/Textfarbe). Bei ≥640px (`sm`) erscheint zusätzlich der Text „Voll"/
„Notenpult". Abschluss `npx tsc --noEmit` + `npm run build`.
