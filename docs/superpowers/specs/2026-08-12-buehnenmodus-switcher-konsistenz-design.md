# Bühnenmodus: Voll/Notenpult-Umschalter an Druckansicht-Optik angleichen — Design

Stand: 12.08.2026 · Konsistenz-Nachbesserung.

## Problem

Die Setliste hat jetzt zwei Umschalter im gleichen Pillen-Look: `PrintViewSwitcher`
(Druckansicht, „Vollständig · Kompakt") und den Voll/Notenpult-Umschalter im Bühnenmodus.
Letzterer sieht anders aus — eckigerer Rahmen (`rounded-md`), aktiver Zustand nur transparent
eingefärbt (`bg-accent/20 text-accent-hi`) statt der vollen Amber-Füllung, die die
Druckansicht nutzt. Wirkt inkonsistent, obwohl beide dieselbe Aufgabe lösen (zwischen zwei
Ansichten derselben Setliste umschalten).

## Ziel

Optik des Bühnenmodus-Umschalters an `PrintViewSwitcher` angleichen (volle Pillen-Form,
aktiver Tab voll amber gefüllt mit dunklem Text). Die im Bühnenmodus nötige größere
Touch-Fläche (≥44px, Icon+Text-Kombination) bleibt unverändert bestehen — nur Form und
Aktiv-/Inaktiv-Darstellung ändern sich.

## Entscheidungen

Referenz (`components/setlist-forms.tsx`, `PrintViewSwitcher`):

```tsx
<div className="inline-flex rounded-full border border-line bg-raise p-0.5 text-sm">
  <Link className={active ? "rounded-full bg-accent px-3 py-1 font-semibold text-[#1a1508]"
                           : "rounded-full px-3 py-1 text-mute transition hover:text-ink"}>
```

In `components/stage/stage-view.tsx` wird der Dichte-Umschalter-Block entsprechend
angepasst:

- Äußerer Container: `rounded-md` → `rounded-full`, zusätzlich `bg-raise` (wie die
  Druckansicht — bisher transparent).
- Beide Buttons bekommen zusätzlich die Utility-Klasse `rounded-full` (überschreibt
  `.btn-stage`s `rounded-lg`, da Tailwind-v4-Utilities die `components`-Layer-Klasse
  `.btn-stage` in der Cascade schlagen — bereits genutztes Muster aus der vorherigen
  Nachbesserung mit `px-2 sm:px-4`).
- Aktiver Zustand: `bg-accent/20 text-accent-hi` → `bg-accent font-semibold text-[#1a1508]`
  (volle Füllung wie in der Druckansicht — das SVG-Icon färbt sich über `currentColor`
  automatisch mit ein).
- Inaktiver Zustand: `text-mute` → `bg-transparent text-mute hover:text-ink` (das
  `bg-transparent` überschreibt `.btn`s Standard-`bg-raise`, damit inaktive Tabs wie in der
  Druckansicht flach/transparent bleiben, nicht als eigene Box hervortreten).

Icon-Größe (`size-5`), `px-2 sm:px-4`-Padding, `aria-label`, Klick-Handler (`changeDensity`)
und die Text-Sichtbarkeit (`hidden sm:inline`) bleiben unverändert — reine Farb-/Formfrage.

## Kein DB-Eingriff

Rein clientseitige CSS-/Klassen-Änderung. Keine Migration, `data/` unangetastet.

## Verifikation

Browser-Durchlauf: Bühnenmodus-Umschalter (Kopfzeile) neben Druckansicht-Umschalter
(`/setlisten/[id]/druck`) vergleichen — beide sollten optisch als dieselbe Komponentenfamilie
erkennbar sein (Pillenform, volle Amber-Füllung bei aktivem Tab). Touch-Target bleibt ≥44px
(unverändert aus vorheriger Nachbesserung). Abschluss `npx tsc --noEmit` + `npm run build`.
