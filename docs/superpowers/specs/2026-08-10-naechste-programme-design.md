# Dashboard: Nächste Probe & nächster Gig — Design

Stand: 10.08.2026 · Ergänzung zum Dashboard (Welle 1, „Was für dich ansteht")

## Ziel

Auf Wunsch: eine Übersicht, was bei der nächsten Probe und dem nächsten Gig geplant
ist — unabhängig vom eigenen Übe-Status. Der bestehende Todo-Block
(`lib/todo.ts`, `ungeuebteAgenda`) zeigt bewusst nur, was *ich persönlich* noch nicht
kann, und verschwindet ganz, wenn nichts offen ist. Diese neue Karte ist reine
Information, kein Todo, und bleibt deshalb bewusst getrennt.

## Entscheidung (abgestimmt)

- Zeigt **beide** getrennt: den zeitlich nächsten Termin vom Typ „Probe" **und** den
  zeitlich nächsten Termin vom Typ „Gig" (nicht nur den nächsten Termin insgesamt).
- Je Zeile: Titel, Datum/Uhrzeit, dann die Songs — zuerst die Probe-Agenda
  (`event_songs`), falls leer die verknüpfte Setliste (Name + Songzahl), falls beides
  leer „noch nichts geplant".
- Reine Lesefunktion, kein Schema-Eingriff.

### Revidiert am 11.08.2026: Platzierung im Todo-Block statt eigener Karte

Ursprünglich als eigene, immer sichtbare Karte in der Dashboard-Seitenspalte geplant
(zwischen „Setlisten" und „Nächste Termine") — auf Mobilgeräten (Hauptnutzung von
BandMate) steht die Seitenspalte aber erst UNTER der gesamten Hauptspalte, die Karte
ging dort unter. Stattdessen: die beiden Zeilen stehen jetzt ganz oben im Block „Was
für dich ansteht" (`components/todo-block.tsx`), der direkt unter dem Dashboard-Kopf
sitzt. Bewusste Nebenwirkung: der Block verschwindet dadurch praktisch nie mehr ganz
(fast immer gibt es eine nächste Probe) — abgestimmt und in Kauf genommen, weil
Sichtbarkeit hier wichtiger ist als das ursprüngliche „nur wenn was offen ist".
Die separate Seitenspalten-Karte (`components/next-programs.tsx`) wurde entfernt, um
Dopplung zu vermeiden. `ungeuebteAgenda` aus `lib/todo.ts` bleibt zusätzlich bestehen
(zeigt die persönliche Teilmenge „das kannst du noch nicht" — andere Information als
die vollständige Agenda-/Setlisten-Anzeige hier).

## Umsetzung

- `lib/queries.ts`: `fetchUpcomingPrograms()` — sucht für „rehearsal" und „gig" je den
  zeitlich nächsten aktiven Termin (`date >= heute`), lädt dessen Agenda-Songs
  (`event_songs` ⋈ `songs`) und, falls `setlistId` gesetzt, die verknüpfte Setliste
  samt Songzahl. Analog zum bestehenden `naechster`-Muster in `lib/todo.ts`, aber ohne
  die dortige Beschränkung auf „hat Agenda". Unverändert seit der ursprünglichen
  Umsetzung — nur die Darstellung wurde revidiert.
- `components/todo-block.tsx`: `TodoBlock` bekommt eine neue Prop `programs`, rendert
  bei vorhandener Probe/vorhandenem Gig je eine zusätzliche `<li>` ganz oben in der
  Liste (Format wie die bestehende `ungeuebteAgenda`-Zeile), Songs/Setliste über die
  lokale Hilfsfunktion `programSongsLabel`.
- `app/(app)/page.tsx`: Anzeigebedingung von `todo.gesamt > 0` auf
  `todo.gesamt > 0 || programs.probe || programs.gig` erweitert, `programs` an
  `TodoBlock` durchgereicht. Sidebar-Karte entfernt.

## Tests

- `fetchUpcomingPrograms`: eigene Fixture-Ergänzung (Muster wie
  `tests/song-usage.test.ts`) — Probe mit Agenda, Gig mit Setliste ohne Agenda, Fall
  ganz ohne anstehende Termine je Art.

## Verifikation (manuell)

Dashboard öffnen (mobil + Desktop): die beiden Zeilen stehen ganz oben in „Was für
dich ansteht", noch vor den übrigen Todo-Punkten; Agenda-Songs bzw. Setliste werden
korrekt angezeigt; Zeile fehlt, wenn keine Probe/kein Gig ansteht.
