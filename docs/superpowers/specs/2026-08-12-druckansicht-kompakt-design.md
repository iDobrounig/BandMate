# Kompakte Druckansicht für Setlisten — Design

Stand: 12.08.2026

## Problem

Die bestehende Druckansicht (`/setlisten/[id]/druck`) zeigt pro Song #, Titel, Interpret,
Tonart, Capo, Tempo und Dauer — vollständig, aber bei langen Setlisten (20+ Songs) passen
nicht alle Songs auf eine Seite. Für den Einsatz auf der Bühne (Spickzettel am Notenständer/
Mic-Stand) und für einen sparsameren Ausdruck fürs ganze Team fehlt eine platzsparendere
Variante.

## Ziel

Zweite Druckansicht mit reduzierten Spalten und engerem Layout, die deutlich mehr Songs pro
Seite unterbringt. Umschaltbar zur bestehenden Vollansicht direkt auf der Druckseite, ohne
zusätzlichen Einstiegspunkt auf der Setlisten-Detailseite.

## Entscheidungen

### Inhalt kompakte Ansicht

Spalten: `#`, Song (Titel + Notiz, **kein** Interpret), Tonart, Tempo. Capo, Interpret und
Dauer pro Song entfallen. Set-Kopfzeilen (mit Songanzahl · Dauer), Pausen-Zeilen und die
Fußzeile (Musik/Pausen/Gesamt/Ziel-Abgleich) bleiben wie in der Vollansicht — kosten nur
wenige Zeilen, liefern aber wichtigen Kontext. Kleinere Schrift und engere Zeilenabstände
(`text-xs`, `py-1` statt `py-2.5`).

### Navigation

Die Setlisten-Detailseite bleibt unverändert: ein „Drucken"-Link zu `/druck` (Vollansicht,
wie bisher — **kein** zweiter Button dort). Der Wechsel zwischen Ansichten passiert erst auf
der Druckseite selbst: In der `print-hidden`-Toolbar (zwischen „← Zurück zur Setliste" und
dem Drucken-Button) stehen zwei Pill-Links „Vollständig · Kompakt", aktive Ansicht optisch
hervorgehoben. Klick auf die inaktive Pill navigiert zur jeweils anderen Route; von dort wird
normal über den bestehenden Drucken-Button gedruckt/als PDF gespeichert.

## Architektur

### Route

Neue Seite `app/(app)/setlisten/[id]/druck-kompakt/page.tsx`, Server Component analog zu
`druck/page.tsx` (`requireUser()`, `notFound()` bei fehlender/gelöschter Setlist).

### Datenladung (geteilt)

Die aktuell inline in `druck/page.tsx` liegende Datenbeschaffung (Setlist laden, Items mit
Song-Join, `summarizeSetlist`, `compareTarget`, Section-Summaries) wird nach `lib/queries.ts`
als `getSetlistPrintData(setlistId)` extrahiert und liefert
`{ setlist, items, structure, cmp, sectionSummaries }`. Beide Seiten rufen diese Funktion auf
und unterscheiden sich nur im JSX/Layout.

### Komponenten

- `PrintButton` (bestehend, `components/setlist-forms.tsx`) unverändert auf beiden Seiten
  wiederverwendet.
- Neue kleine Komponente `PrintViewSwitcher` (`components/setlist-forms.tsx`) rendert die
  zwei Pill-Links, bekommt `setlistId` und `active: "voll" | "kompakt"` als Props.
- `druck-kompakt/page.tsx` übernimmt die Tabellenstruktur aus `druck/page.tsx`, reduziert um
  die Spalten Interpret/Capo/Dauer-pro-Song, mit kompakteren Tailwind-Klassen für Schrift und
  Zeilenabstand.

## Kein DB-Eingriff

Rein lesend. Keine Migration, `data/` unangetastet.

## Verifikation

Browser-Durchlauf (Dev-Server `bandmate-dev`) mit einer Setliste mit mehreren Sets, Pausen
und ≥15 Songs: beide Ansichten aufrufen, in beide Richtungen umschalten, Druckvorschau für
beide Layouts prüfen (Seitenumbruch, Lesbarkeit, Fußzeile/Ziel-Abgleich korrekt). Abschluss
`npx tsc --noEmit` + `npm run build`.
