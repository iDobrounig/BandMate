# Dashboard: Nächste Probe & nächster Gig — Design

Stand: 10.08.2026 · Ergänzung zum Dashboard (Welle 1, „Was für dich ansteht")

## Ziel

Auf Wunsch: eine Übersicht, was bei der nächsten Probe und dem nächsten Gig geplant
ist — unabhängig vom eigenen Übe-Status. Der bestehende Todo-Block
(`lib/todo.ts`, `ungeuebteAgenda`) zeigt bewusst nur, was *ich persönlich* noch nicht
kann, und verschwindet ganz, wenn nichts offen ist. Diese neue Karte ist reine
Information, kein Todo, und bleibt deshalb bewusst getrennt.

## Entscheidung (abgestimmt)

- Eigene, immer sichtbare Karte in der Dashboard-Seitenspalte (zwischen „Setlisten"
  und „Nächste Termine"), kein Teil des Todo-Blocks.
- Zeigt **beide** getrennt: den zeitlich nächsten Termin vom Typ „Probe" **und** den
  zeitlich nächsten Termin vom Typ „Gig" (nicht nur den nächsten Termin insgesamt).
- Je Zeile: Titel, Datum/Uhrzeit, dann die Songs — zuerst die Probe-Agenda
  (`event_songs`), falls leer die verknüpfte Setliste (Name + Songzahl), falls beides
  leer „Noch nichts geplant".
- Reine Lesefunktion, kein Schema-Eingriff.

## Umsetzung

- `lib/queries.ts`: neue Funktion `fetchUpcomingPrograms()` — sucht für „rehearsal"
  und „gig" je den zeitlich nächsten aktiven Termin (`date >= heute`), lädt dessen
  Agenda-Songs (`event_songs` ⋈ `songs`) und, falls `setlistId` gesetzt, die
  verknüpfte Setliste samt Songzahl. Analog zum bestehenden `naechster`-Muster in
  `lib/todo.ts`, aber ohne die dortige Beschränkung auf „hat Agenda".
- `components/next-programs.tsx` *(neu)*: `NextProgramsCard` rendert die beiden
  Zeilen als `.card`-Links zum jeweiligen Termin (analog zur „Nächste Termine"-Karte),
  rendert nichts, wenn weder Probe noch Gig ansteht.
- `app/(app)/page.tsx`: Karte in der Seitenspalte einhängen, Query parallel zu den
  bestehenden per `Promise.all` laden.

## Tests

- `fetchUpcomingPrograms`: eigene Fixture-Ergänzung (Muster wie
  `tests/song-usage.test.ts`) — Probe mit Agenda, Gig mit Setliste ohne Agenda, Fall
  ganz ohne anstehende Termine je Art.

## Verifikation (manuell)

Dashboard öffnen, Karte prüft: nächste Probe mit Agenda-Songs, nächster Gig mit
verknüpfter Setliste, Karte verschwindet ganz, wenn keine Termine dieser Art anstehen.
