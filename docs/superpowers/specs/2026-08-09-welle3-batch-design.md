# Welle 3, vier Häppchen — Design

Stand: 09.08.2026 · Welle 3 · Betrifft: Songs-, Mitglieder-Subsystem
Grundlage: [FEATURES.md](../../../FEATURES.md) „Welle 3 — Gedächtnis & Komfort"

## Ziel & Kontext

Vier kleine, voneinander unabhängige Punkte aus Welle 3, in einem Zug umgesetzt, weil
zwei davon dieselben Daten anzapfen:

1. **Repertoire-Gedächtnis** — „zuletzt geprobt", „zuletzt gespielt", „x× auf Setlisten"
2. **Mitgliederverzeichnis für alle** — heute Admin-only
3. **Dubletten-Warnung** beim Songvorschlag
4. **Rückverweise auf der Songseite** — welche Setlisten/Agenden den Song enthalten

Kein Schema-Eingriff nötig — `event_songs` und `setlist_items` liegen bereits vor und
werden nur ausgelesen. Alle vier Punkte sind rein additiv (keine bestehende Anzeige
oder Route wird umgebaut, nur ergänzt).

## Entscheidungen (abgestimmt)

1. **Repertoire-Gedächtnis und Rückverweise teilen sich eine Query** (`fetchSongUsage`),
   weil beide dieselben zwei Join-Tabellen lesen — eine Karte auf der Songseite statt
   zwei getrennter Datenabfragen.
2. **Sortier-Kennzahl „am längsten nicht gespielt" zählt Proben *und* Gigs zusammen**
   (nicht nur Gigs) — ein Song, der nur in der Probe war, aber nie live gespielt wurde,
   soll trotzdem nicht ewig oben in „ungespielt" hängen bleiben.
3. **Mitgliederverzeichnis: nur E-Mail als Kontakt**, kein neues Telefonfeld — das Schema
   hat heute keins, und die Band nutzt ohnehin WhatsApp/Telefon außerhalb der App dafür.
4. **Verzeichnis zeigt nur aktive Mitglieder.** Deaktivierte bleiben Admin-Sache.
5. **Dubletten-Warnung bremst bewusst**: Checkbox „Trotzdem anlegen" muss angehakt sein,
   bevor der Submit-Button aktiv wird — reine Clientseiten-Gate, kein zweiter
   Server-Roundtrip. Bei einem internen Bandtool ist das kein Sicherheits-, sondern ein
   Aufmerksamkeits-Mechanismus.
6. **Look & Feel: nichts Neues erfinden.** Alle vier Punkte nutzen ausschließlich
   bestehende Bausteine — `.card`, `.btn`/`.btn-sm`, `.label`, `.badge`, `.mono-display`,
   die Amber-Warnbox aus `notify-matrix.tsx` (`border-amber-500/30 bg-amber-500/10
   text-amber-300`), Icons aus `components/icons.tsx` (kein neues Icon nötig).

## 1. Repertoire-Gedächtnis + 4. Rückverweise (gemeinsam)

### Query — `lib/queries.ts`

Neue Funktion, analog zu `fetchSongReferences` (die für den Löschdialog bleibt
unverändert bestehen, andere Rückgabeform):

```ts
export type SongUsage = {
  lastRehearsedAt: string | null; // ISO-Datum, kind=rehearsal, nur vergangene Termine
  lastPlayedAt: string | null;    // ISO-Datum, kind=gig, nur vergangene Termine
  setlists: { id: number; name: string; eventDate: string | null }[];
  agenda: { id: number; title: string; date: string; kind: EventKind }[];
};

export async function fetchSongUsage(songId: number): Promise<SongUsage>
```

- `agenda`: `event_songs` ⋈ `events` (mit `eventAktiv`), sortiert nach Datum absteigend.
- `setlists`: `setlist_items` ⋈ `setlists` (mit `setlistAktiv`), sortiert nach
  `eventDate` absteigend.
- `lastRehearsedAt`/`lastPlayedAt` werden aus `agenda` abgeleitet (kein zweiter Query):
  jeweils das größte `date <= heute` je `kind`.
- Zwei parallele Selects (`Promise.all`), kein N+1 — wird nur auf der Songseite pro
  Aufruf einmal gebraucht.

### Songliste — `fetchSongList` (Sortierung)

Neue Subquery-Spalte `lastEventAt` (Proben + Gigs zusammen, wie unter Punkt 2
entschieden):

```sql
(select max(e.date) from event_songs es join events e on e.id = es.event_id
 where es.song_id = songs.id and e.deleted_at is null and e.date <= :heute)
```

`:heute` als JS-Parameter (`new Date().toISOString().slice(0, 10)`), nicht SQLite
`date('now')` — Muster aus `fetchEvents` übernommen, damit die App-Zeitzone
(`TZ` in `ecosystem.config.js`) greift statt der SQLite-Prozess-Zeitzone.

`SongListItem` bekommt `lastEventAt: string | null`.

### UI — Songliste (`app/(app)/songs/page.tsx`)

Neue Option im Sortier-`<select>`: `<option value="ungespielt">Am längsten nicht
gespielt</option>`. Sortierlogik: aufsteigend nach `lastEventAt`, `null` (noch nie)
sortiert als ältestes Datum ganz nach oben.

### UI — Songseite (`app/(app)/songs/[id]/page.tsx`)

Neue Karte in der Seitenspalte, unterhalb „Noten" (Reihenfolge: Übe-Status → Noten →
Repertoire), Überschrift „Wo kommt der Song vor?":

```
┌─ Wo kommt der Song vor? ──────────
│  Zuletzt geprobt    12.03.2026 / „noch nie"
│  Zuletzt gespielt   20.04.2026 / „noch nie"
│  ─────────────────────────────
│  Auf 3 Setlisten
│    • Sommerfest 2026        22.08.2026   →
│    • Vereinsfest            —            →
│  In 5 Proben-/Gig-Agenden
│    • Probe 14.07.2026                    →
│    • Auftritt Dorffest 20.04.2026        →
└────────────────────────────────────
```

- `.card p-5`, `.label` für die Datums-Zeilen (wie „Band-Übersicht" im Übe-Status-Block),
  `.mono-display` für die Datumswerte.
  Leerfälle: „Noch auf keiner Setliste." / „Noch in keiner Agenda." (Stil wie „Noch keine
  Noten hochgeladen.").
- Setlisten-Zeile linkt zu `/setlisten/[id]`, Agenda-Zeile zu `/termine/[id]`.
- Datumsformat über bestehendes `formatDate()` aus `lib/format.ts`.
- Keine neue Karte, wenn Song weder in einer Agenda noch auf einer Setliste war **und**
  nie geprobt/gespielt wurde? — Nein: Karte immer zeigen (auch mit lauter „noch nie"/
  „keine"), damit die Abwesenheit selbst die Information ist („dieser Song hat noch nie
  stattgefunden").

## 2. Mitgliederverzeichnis für alle

### Route — `app/(app)/mitglieder/page.tsx`

- `requireAdmin()` → `requireUser()`.
- Verzweigung direkt am Anfang:
  - **Nicht-Admin:** eigener, schlanker Rückgabepfad. Query: aktive Mitglieder
    (`eq(users.active, true)`), Felder `id`, `name`, `instrument`, `email`, sortiert nach
    Name. Rendering inline im Server-Component (keine Interaktivität nötig, daher kein
    Import aus dem `"use client"`-File `member-admin.tsx`):
    ```
    <h1>Mitglieder</h1>
    <p class="text-mute">…</p>
    <section class="mt-8 space-y-3">
      {members.map(m => (
        <div class="card p-4">
          <p class="font-semibold">{m.name}</p>
          <p class="text-sm text-mute">
            {m.instrument && `${m.instrument} · `}
            <a class="text-accent-hi hover:underline" href={`mailto:${m.email}`}>{m.email}</a>
          </p>
        </div>
      ))}
    </section>
    ```
    Gleiche Kartenoptik wie `MemberRow`, nur ohne die Action-Buttons.
  - **Admin:** bestehender Codepfad unverändert (volle Verwaltung, `MemberRow`,
    `NewMemberForm`, SMTP-Test).

### Navigation — `components/nav-links.tsx`

`isAdmin`-Bedingung vor dem „Mitglieder"-Eintrag entfernen — Link für alle Rollen.

## 3. Dubletten-Warnung

### Server-Action — `lib/actions/songs.ts`

```ts
export async function checkDuplicateTitle(
  title: string
): Promise<{ id: number; title: string; artist: string | null; status: SongStatus }[]>
```

- `await requireUser()` (wie alle anderen Actions in der Datei).
- Normalisierung: `norm = title.trim().toLowerCase()`; bei `norm.length < 2` → `[]`
  (kein Rauschen bei einem einzelnen Buchstaben).
- Lädt alle aktiven Songs (`songAktiv`, Felder `id, title, artist, status`) — bei
  Bandgröße (Größenordnung 50–300 Songs) unproblematisch, kein `LIKE`-Escaping nötig.
- Treffer: `norm(existing.title)` enthält `norm` **oder** `norm` enthält
  `norm(existing.title)` (deckt sowohl „Wonderwall" → „Wonderwall (Unplugged)" als auch
  Tippfehler-Kürzungen ab).
- Rückgabe: höchstens 5 Treffer, exakte Übereinstimmung zuerst.

### Formular — `components/song-form.tsx`

Nur im Anlege-Zweig (`!isEdit`):

- `title`-Input wird kontrolliert (`value`/`onChange`) statt `defaultValue`, damit ein
  `useEffect` mit 400 ms Debounce bei Änderung `checkDuplicateTitle` aufrufen kann.
- State: `duplicates` (Ergebnisliste), `confirmed` (Checkbox-Status). Bei jeder neuen
  Eingabe wird `confirmed` zurückgesetzt.
- Treffer-Anzeige direkt unter dem Titel-Feld, Amber-Warnbox (Stil wie
  `notify-matrix.tsx` Zeile 78):
  ```
  Gibt's schon:
  • Wonderwall – Oasis (Repertoire) →
  • Wonderwall Unplugged – Oasis (Archiv) →
  [ ] Trotzdem anlegen
  ```
  Links öffnen mit `target="_blank"` (Formulareingabe bleibt erhalten), Status als
  `.badge`-Kürzel aus `SONG_STATUS[status].label`.
- Submit-Button: `disabled={duplicates.length > 0 && !confirmed}`.

### `components/form.tsx` — `SubmitButton`

Neuer optionaler Prop `disabled?: boolean` (Default `false`), kombiniert mit `pending`:
`disabled={pending || disabled}`. Bestehende Aufrufer ohne den Prop verhalten sich
unverändert.

## Tests

Kein DB-Zugriff für die reine Matching-Logik nötig — wird als reine Funktion
`matchesDuplicateTitle(existingTitle, input)` extrahiert (statt Inline-Logik in der
Server-Action) und mit ein paar Fällen abgedeckt: exakte Übereinstimmung,
Groß-/Kleinschreibung, Zusatz in Klammern, zu kurze Eingabe, kein Treffer.

`fetchSongUsage`/`lastEventAt`-Sortierung werden über den bestehenden
Fixture-Datensatz in `tests/setup.ts` mitgeprüft (Proben- und Gig-Termin mit
zugeordnetem Song, Setlisten-Zuordnung).

## Verifikation (manuell)

`npx tsc --noEmit` + `npm run build`, dann Browser-Durchlauf:
- Songseite eines Repertoire-Songs mit Historie öffnen → Karte prüfen, Links zu
  Setliste/Termin folgen.
- Songliste nach „Am längsten nicht gespielt" sortieren.
- Als normales Mitglied `/mitglieder` öffnen (Nav-Link sichtbar, read-only Liste, keine
  Verwaltungs-Buttons); als Admin weiterhin volle Funktionalität.
- Song mit existierendem Titel vorschlagen → Warnbox erscheint, Submit erst nach
  Checkbox aktiv; abweichenden Titel eingeben → Warnbox verschwindet, Submit sofort aktiv.

## Betroffene Dateien

- `lib/queries.ts` (`fetchSongUsage`, `fetchSongList`-Erweiterung)
- `app/(app)/songs/[id]/page.tsx` (neue Karte)
- `app/(app)/songs/page.tsx` (Sortier-Option)
- `app/(app)/mitglieder/page.tsx` (Rollen-Verzweigung)
- `components/nav-links.tsx` (Link für alle)
- `lib/actions/songs.ts` (`checkDuplicateTitle`)
- `lib/matching.ts` *(neu)* — reine Funktion `matchesDuplicateTitle`
- `components/song-form.tsx` (Debounce, Warnbox, Checkbox)
- `components/form.tsx` (`SubmitButton`-Prop)
- Tests unter `tests/`
