# Welle 3, restliche vier Punkte — Design

Stand: 10.08.2026 · Welle 3 · Betrifft: Termine-, Mitglieder-, Songs-Subsystem
Grundlage: [FEATURES.md](../../../FEATURES.md) „Welle 3 — Gedächtnis & Komfort"

## Ziel & Kontext

Vier weitere, voneinander unabhängige Punkte aus Welle 3, in einem Zug umgesetzt.
Bewusst **nicht** dabei: Browser-Audio-Aufnahme (eigener Umfang, externe
ffmpeg-Abhängigkeit — bleibt offen).

1. **Termine-Suche** — ersetzt den Roadmap-Punkt „Globale Suche"
2. **Anwesenheits-Statistik** — wer war wie oft bei Proben da
3. **Serien-Termine gesammelt bearbeiten** — Uhrzeit/Ort/Notiz für eine ganze Serie
4. **Capo-Rechner** in der Lyrics-Ansicht

Kein Schema-Eingriff nötig. Alle vier Punkte sind rein additiv.

## Entscheidungen (abgestimmt)

1. **Globale Suche wird nicht gebaut.** Bei 50–300 Songs, einer flachen 5-Punkte-Nav
   und einem Dashboard, das die aktuellen Dinge schon vorne zeigt, bringt eine echte
   seitenübergreifende Suche wenig Mehrwert gegenüber dem Aufwand (neue Overlay-UI,
   eigene Cross-Entity-Query, Dopplung zu den bestehenden Einzelseiten-Suchen). Songs
   und Setlisten haben bereits eine einfache Titelsuche, nur Termine nicht — das ist
   die eigentliche Lücke. Stattdessen: Termine bekommt dieselbe Such-Parität.
2. **Anwesenheits-Statistik**: neuer Abschnitt auf `/mitglieder`, für **alle** Rollen
   sichtbar (nicht nur Admin) — passt zum Trend, Bandinfos offen zu zeigen
   (Mitgliederverzeichnis wurde in der vorigen Häppchen-Runde ebenfalls geöffnet).
   Alphabetisch nach Name sortiert, keine Leaderboard-Optik.
3. **Anwesenheits-Quote** = Zusagen / (Zusagen + Absagen). „Vielleicht" und offene
   Rückmeldungen fließen nicht in den Nenner ein — sie sind kein Signal in eine
   Richtung. Nur vergangene Proben zählen (keine Gigs, wie im Roadmap-Titel benannt).
4. **Serien-Termine bearbeiten**: nur Uhrzeit, Ort, Notiz — nicht Titel/Datum (Datum
   ist der Witz an der Serie). Nur **künftige** Termine der Serie werden verändert,
   vergangene bleiben unangetastet (anders als „ganze Serie löschen", das bewusst
   keine Datumsgrenze kennt). Eigene Seite statt Modal/Inline-Formular, konsistent
   mit der bestehenden `/…/[id]/bearbeiten`-Konvention.
5. **Capo-Rechner**: nur der Rechner jetzt, keine Fretboard-Diagramme. Als eigene,
   schmale Chord-Utility-Schicht gebaut, damit eine spätere Diagramm-Ergänzung rein
   additiv ist statt eines Umbaus. Opt-in per Button (kein automatisches Umschalten
   beim Laden, auch wenn `song.capo` gesetzt ist) — bestehende Songseiten ändern ihr
   Standardverhalten nicht. Speichern-Button wird im Capo-Modus ausgeblendet, damit
   nie gegriffene (nicht klingende) Akkorde versehentlich als neue Song-Wahrheit
   abgespeichert werden.
6. **Look & Feel: nichts Neues erfinden**, wie schon in der vorigen Häppchen-Runde.
   Ausnahmen, die neu sind, weil es dafür noch kein Muster gab: die erste
   Nicht-Druck-`<table>` der App (Anwesenheits-Statistik) und der erste zwischen zwei
   Komponenten geteilte Hook (`useCapoOffset`, geteilt zwischen `TransposableLyrics`
   und `StageSong`, die bisher keinen Code teilen).

## 1. Termine-Suche (ersetzt „Globale Suche")

### `app/(app)/termine/page.tsx`

- `searchParams` bekommt `q?: string` dazu.
- Nach dem bestehenden `Promise.all`-Fetch (`fetchEvents`) `upcoming`/`past`
  clientseitig filtern (Titel + Ort, `.toLowerCase().includes()`) — analog zu
  `app/(app)/songs/page.tsx` und `app/(app)/setlisten/page.tsx`. Kein Eingriff in
  `fetchEvents` selbst, da diese Query auch vom Dashboard ohne `q` genutzt wird.
- Such-`<input className="input" type="search" name="q">` in einem eigenen
  `<form method="get">` zwischen Kopfzeile und Terminliste, Markup/Klassen wie bei
  Songs/Setlisten.
- Kleine Hilfsfunktion `buildQuery({ vergangene, q })`, die die beiden
  „Vergangene Termine anzeigen →" / „← Vergangene ausblenden"-Links berechnet (heute
  hardcodiert `/termine?vergangene=1` bzw. `/termine`), damit eine laufende Suche
  beim Umschalten erhalten bleibt.
- Leerer-Treffer-Text „Nichts gefunden." wenn `q` gesetzt ist und die Liste leer
  bleibt.

## 2. Anwesenheits-Statistik

### `lib/attendance.ts` (neu)

```ts
/** Zusagen-Quote: Zusagen / (Zusagen+Absagen). "Vielleicht" und offene
 *  Rückmeldungen fließen bewusst nicht ein. null, wenn noch nie mit ja/nein
 *  geantwortet wurde. */
export function attendancePercentage(yes: number, no: number): number | null
```

### `lib/queries.ts`

```ts
export type AttendanceStats = {
  userId: number; name: string; instrument: string | null;
  yes: number; no: number; maybe: number; percentage: number | null;
};

export async function fetchAttendanceStats(): Promise<AttendanceStats[]>
```

- Aktive Mitglieder (`eq(users.active, true)`, wie im nicht-Admin-Zweig von
  `mitglieder/page.tsx` heute schon gefiltert), `asc(users.name)`.
- Drei korrelierte Count-Subqueries gegen `event_attendance` ⋈ `events`
  (`kind = 'rehearsal'`, `deleted_at is null`, `date <= :heute`). `:heute`
  JS-berechnet (`new Date().toISOString().slice(0, 10)`), nicht SQLite `date('now')`
  — AGENTS.md-Zeitzone-Stolperfalle. Spalten in Subqueries qualifiziert
  (`events.id` statt unqualifiziert).

### UI — `app/(app)/mitglieder/page.tsx`

- `fetchAttendanceStats()` einmal vor der Rollen-Verzweigung laden.
- Neue, nicht exportierte Funktion `AttendanceStatsCard({ stats })` rendert eine
  `.card` mit `<table>` (Mitglied, ✓, ✗, ?, Quote). Farben aus
  `ATTENDANCE_STATUS[...].color` (`lib/constants.ts`), Zahlen in `.mono-display`.
- Mitglieder ohne Proben-Historie: „–" in der Quote-Spalte statt Ausblenden —
  konsistent mit der „Karte immer zeigen"-Haltung aus dem Repertoire-Gedächtnis
  (Abwesenheit ist selbst die Information).
- In **beiden** Zweigen gerendert: nicht-Admin nach der Mitgliederliste, Admin nach
  den `MemberRow`s und vor „SMTP-Verbindung testen".

## 3. Serien-Termine gesammelt bearbeiten

### `lib/queries.ts`

```ts
export async function fetchSeriesInstances(
  seriesId: string
): Promise<{ id: number; date: string }[]>
```

Aktive Events der Serie, nach Datum sortiert — dient der Zusammenfassung auf der
neuen Seite und ist als reine Query testbar.

### `lib/actions/events.ts`

```ts
export async function updateEventSeries(
  prev: FormState, formData: FormData
): Promise<FormState>
```

- `requireUser()` (kein Admin-Gate, wie der Rest der Datei).
- Liest `eventId`, `startTime`, `location`, `notes` (getrimmt, leer → `null`, wie
  `readEventFields`).
- Ausgangs-Event laden; Fehler, wenn nicht gefunden oder `!event.seriesId`.
- `today` JS-berechnet.
- ```ts
  await db.update(events).set({ startTime, location, notes })
    .where(and(eq(events.seriesId, event.seriesId), gte(events.date, today), eventAktiv));
  ```
  Analog zum bestehenden `deleteEvent(scope: "series")`-Muster, aber zusätzlich mit
  Datums- und Aktiv-Filter (Löschen kennt bewusst keine Datumsgrenze, dieser
  Bulk-Edit bewusst schon).
- Benachrichtigung: `describeEventChanges(alt, neu, event.kind)` aus
  `lib/event-notify.ts` wiederverwenden (`alt`/`neu` mit gleichem `date`, damit nie
  eine Datumszeile erscheint; Notizen lösen bewusst nichts aus). Bei Änderungen und
  angehakter Checkbox **eine** gesammelte `notifyBand()`-Mail (nicht eine pro
  Instanz), Text macht klar, dass es eine Serienänderung ist.
- `revalidatePath("/", "layout")`, `redirect(/termine/${eventId})`.

### Neue Seite — `app/(app)/termine/[id]/serie-bearbeiten/page.tsx`

Eigene Seite statt Modal/Inline, passend zur etablierten
„eigene Seite statt Modal"-Konvention. `requireUser()`, Event laden, `notFound()`
wenn kein `seriesId`, `fetchSeriesInstances` für die Zusammenfassung (Split
künftig/vergangen per JS-`today`), rendert `EventSeriesForm` in einer `.card`.

### `components/event-forms.tsx` — `EventSeriesForm`

`useActionState(updateEventSeries, initial)`, nur drei Felder (Uhrzeit, Ort, Notiz,
vorbefüllt aus dem Ausgangs-Event), `.label`/`.input`-Klassen wie `EventForm`,
`sendMail`-Checkbox (vorausgewählt, Label „Band bei Änderung von Uhrzeit/Ort
benachrichtigen"), `SubmitButton`/`FormMsg` wiederverwendet. Buttontext
„Alle {futureCount} kommenden Termine speichern".

### `app/(app)/termine/[id]/page.tsx`

Link „Serie bearbeiten" (mit `IconRepeat`) neben `DeleteEventButtons`, nur wenn
`event.seriesId`.

## 4. Capo-Rechner in der Lyrics-Ansicht

### Capo-Mathematik

Capo an Bund N hebt den Klang um N Halbtöne → die zu greifenden Formen sind die
klingenden Akkorde um N **herunter** transponiert. Vorhandene
`transposeLyrics`/`transposeKey` aus `lib/chords.ts` akzeptieren bereits negative
Offsets korrekt — kein neuer Transpositions-Code, nur benannte Wrapper:

```ts
export function capoShapeLyrics(text: string, capoFret: number): string {
  return transposeLyrics(text, -capoFret);
}
export function capoShapeKey(key: string, capoFret: number): string | null {
  return transposeKey(key, -capoFret);
}
```

### `lib/hooks/use-capo-offset.ts` (neu)

Gemeinsamer Hook für `TransposableLyrics` und `StageSong` (die heute keinen Code
teilen). Vereinigt Halbton-Offset und Capo-Modus in einem State (`offset`,
`capoFret = offset <= 0 ? -offset : 0`, `capoMode`-Flag). Manuelles ±Halbton-Nudging
verlässt den Capo-Modus.

### `components/capo-control.tsx` (neu)

`<CapoSelect capoFret onChange compact?>` — `<select className="input">` mit
Bünden 0–7, in beide Werkzeugleisten eingehängt. Die übrigen ±Halbton-Buttons
bleiben jeweils bestehendes, bewusst unterschiedliches Markup.

### `components/transpose.tsx` (`TransposableLyrics`)

- Neue Prop `capo: number | null` (aus `song.capo`).
- Lokalen `useState(0)` durch `useCapoOffset()` ersetzen.
- `<CapoSelect>` in der Werkzeugleiste, zusätzlich ein Button „Griffe (Capo N)"
  (nur wenn `capo != null && capo > 0`) für den Opt-in-Sprung auf den gespeicherten
  Wert.
- **Speichern-Schutz**: solange `capoMode === true`, wird der „Transponierung
  speichern"-Button (und die „→ shownKey"-Zeile) durch eine „Griffe (Capo N)"-
  Anzeige + „Klingend anzeigen"-Reset ersetzt.

### `components/stage/stage-song.tsx` (`StageSong`)

Gleiche Umstellung auf `useCapoOffset(page.capo)`, `<CapoSelect compact>` im
„Werkzeuge"-Panel. Kein Speichern-Button vorhanden — kein Schutzmechanismus nötig,
reine UI-Konsistenz-Ergänzung. Vorhandene Capo-Anzeige im Kopf bleibt unverändert.

### Erweiterungspunkt (dokumentiert, nicht gebaut)

Eine künftige „Im Song verwendete Akkorde"-Liste (Basis für spätere
Fretboard-Diagramme) würde eine neue `getUniqueChords(lyricsChords, german?):
string[]` in `lib/chords.ts` nutzen (Chord-Zeilen über `isChordLine`/`parseChord`
parsen, nach erstem Vorkommen dedupliziert). Wird in diesem Batch bewusst **nicht**
gebaut (toter Code ohne Abnehmer) — die eigentliche Anforderung „Capo-Logik nicht
im UI verstreuen" ist bereits durch `capoShapeLyrics`/`capoShapeKey` erfüllt.

## Tests

- `lib/attendance.ts`: `attendancePercentage` rein getestet (0/0→null, 3/1→75,
  1/3→33, 0 Nein+N Ja→100).
- `fetchAttendanceStats`: eigene `beforeAll`-Fixture (Muster wie
  `tests/song-usage.test.ts`) — nur künftige RSVPs→0/0/0/null, vergangene Probe mit
  Ja+Nein→korrekte Quote, vergangener Gig zählt nicht, „Vielleicht" beeinflusst
  Quote nicht.
- `fetchSeriesInstances`: eigene Fixture mit Events über/unter heute, prüft den
  Vergangen/Künftig-Split. Kein Test für `updateEventSeries` selbst (Server-Actions
  werden im Projekt unüblich unit-getestet — manuelle Verifikation).
- `capoShapeLyrics`/`capoShapeKey`: einzelner Akkord, Mehrfach-Akkord-Zeile,
  Unterlauf-Fall (z.B. Capo 5 bei „C"), Capo 0 → unverändert, deutsche Notation.

## Verifikation (manuell)

`npx tsc --noEmit` + `npm run build`, dann Browser-Durchlauf:

1. `/termine?q=probe` filtert Titel/Ort case-insensitive; Suche bleibt beim
   Umschalten „Vergangene Termine" erhalten; leere Treffer zeigen „Nichts gefunden."
2. `/mitglieder` als Nicht-Admin und als Admin öffnen — Karte erscheint in beiden
   Ansichten; Mitglied ohne Proben-Historie zeigt „–" statt Fehler/0%.
3. Serie mit 5+ Terminen anlegen, „Serie bearbeiten" von einem künftigen Termin
   öffnen, Uhrzeit/Ort ändern, Mail-Checkbox an → alle künftigen Instanzen
   geändert, vergangene unangetastet, genau eine Mail verschickt; Direktaufruf der
   Seite für einen Nicht-Serien-Termin → `notFound()`.
4. Song mit gesetztem Capo öffnen → „Griffe (Capo N)"-Button erscheint, schaltet
   um, Speichern-Button verschwindet im Capo-Modus, Reset stellt Speichern wieder
   her; gleiche Bedienung im Bühnenmodus-Werkzeugpanel prüfen (dort kein
   Speichern-Button); Song ohne Capo zeigt Capo-Select trotzdem (Default 0).

## Betroffene Dateien

- `app/(app)/termine/page.tsx` (Suche)
- `lib/attendance.ts` *(neu)*, `lib/queries.ts` (`fetchAttendanceStats`,
  `fetchSeriesInstances`)
- `app/(app)/mitglieder/page.tsx` (Statistik-Karte)
- `lib/actions/events.ts` (`updateEventSeries`)
- `components/event-forms.tsx` (`EventSeriesForm`)
- `app/(app)/termine/[id]/serie-bearbeiten/page.tsx` *(neu)*
- `app/(app)/termine/[id]/page.tsx` (Link)
- `lib/chords.ts` (`capoShapeLyrics`, `capoShapeKey`)
- `lib/hooks/use-capo-offset.ts` *(neu)*, `components/capo-control.tsx` *(neu)*
- `components/transpose.tsx`, `components/stage/stage-song.tsx`
- `app/(app)/songs/[id]/page.tsx` (Capo-Prop)
- Tests unter `tests/`
- `FEATURES.md`
