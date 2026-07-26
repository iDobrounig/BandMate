# Sets & Pausen in Setlisten — Design

Stand: 26.07.2026 · Welle 2, Häppchen 2 · Betrifft: Setlisten-Subsystem
Grundlage: [FEATURES.md](../../../FEATURES.md) „Welle 2 — Sets & Pausen in Setlisten"

## Ziel & Kontext

Eine Setliste ist heute eine flache, geordnete Song-Liste. Für echte Gigs fehlt Struktur:
Set 1 / Pause / Set 2 mit Zwischensummen und ein Abgleich gegen die gebuchte Spielzeit
(„90 min gebucht, 78 min programmiert"). Pausen werden heute als Freitext im Notiz-Feld
*gefaked* (Platzhalter „Notiz (z.B. Pause danach)") — dieses Häppchen ersetzt das durch
echte Struktur-Elemente.

Nicht Teil dieses Häppchens: Chord-Sheet-Druck (eigenes Häppchen), Umbau der Song-Auswahl.

## Entscheidungen (abgestimmt)

1. **Benannte Sets + Pausen**, nicht nur Auto-Trenner. Drei Element-Typen in einer
   geordneten Liste: Song, Set-Überschrift (frei benannt), Pause.
2. **Pause = Dauer (Minuten) + optionales Label.** Die Dauer zählt in die Gesamtzeit.
3. **Zielzeit-Abgleich = Musik + Pausen vs. Zielzeit.** Anzeige: Musik, Pausen, Gesamt,
   Differenz. Zielzeit ist ein optionales Feld an der Setliste.
4. **Ein Element-Typ-Feld** in `setlist_items` (nicht getrennte Tabellen, nicht JSON) —
   nur so funktioniert das bestehende Drag&Drop einheitlich über alle Typen.
5. **Song-Nummern starten je Set neu** (1, 2, 3 …) — im Editor und im Druck.

## 1. Datenmodell (Migration)

`setlist_items` erhält:

| Spalte | Typ | Zweck |
|---|---|---|
| `kind` | text `"song" \| "section" \| "break"`, Default `"song"` | Element-Typ |
| `label` | text (nullable) | Set-Name (section) bzw. optionaler Pausentext (break) |
| `breakSeconds` | integer (nullable) | Pausendauer (nur break) |

`songId` wird von **NOT NULL auf nullable** geändert (nur `song`-Zeilen haben eine ID).
`note`, `position`, die `onDelete: cascade`-FK bleiben.

`setlists` erhält:

| Spalte | Typ | Zweck |
|---|---|---|
| `targetSeconds` | integer (nullable) | Zielzeit / gebuchte Spielzeit |

**Migrations-Risiko & Vorgehen:** `songId` nullable zu machen ist in SQLite kein
`ADD COLUMN` — drizzle-kit baut `setlist_items` neu (Tabelle anlegen → Daten kopieren →
alte droppen → umbenennen). Deshalb:
- **`./scripts/backup.sh --label pre-sets-pausen` zwingend vor der Schema-Änderung.**
- Migration nach `npm run db:generate` **einzeln lesen**: prüfen, dass sie Daten kopiert,
  die FK und `position`/`note` erhält und keinen Datenverlust enthält.
- Gegen eine **Kopie der echten DB** durchspielen, bevor sie auf `data/band.db` läuft
  (Dev-Server dabei gestoppt, da Schema-Edit sonst sofort migriert).
- `targetSeconds` und die drei `setlist_items`-Spalten sind additiv; nur die
  `songId`-Nullability erzwingt den Rebuild.

## 2. Reine Logik: `lib/setlist-structure.ts`

Zwischensummen und Zielzeit-Abgleich als **reine, testbare Funktion** (kein „use server",
kein DB) — analog zu `lib/event-notify.ts`.

```ts
export type StructureItem = {
  kind: "song" | "section" | "break";
  label: string | null;
  durationSeconds: number | null; // Song-Dauer
  breakSeconds: number | null; // Pausendauer
};

export type SetSummary = { label: string | null; songCount: number; seconds: number };

export type SetlistStructure = {
  sets: SetSummary[];
  musicSeconds: number;
  breakSeconds: number;
  totalSeconds: number; // musicSeconds + breakSeconds
};

export function summarizeSetlist(items: StructureItem[]): SetlistStructure;

/** Differenz zur Zielzeit; null ohne Zielzeit. over=true wenn programmiert > Ziel. */
export function compareTarget(
  totalSeconds: number,
  targetSeconds: number | null
): { diffSeconds: number; over: boolean } | null;
```

Regeln von `summarizeSetlist`:
- Ein „Set" ist ein Segment, das von einer `section`-Zeile begonnen wird. Songs vor der
  ersten Überschrift bilden ein Segment mit `label: null`.
- `section` schließt das laufende Segment ab und startet ein neues mit ihrem `label`.
- `song` erhöht `songCount` und addiert `durationSeconds ?? 0` (Musik).
- `break` addiert `breakSeconds ?? 0` zu `breakSeconds` (splittet KEIN Set).
- Ein führendes leeres Segment (label null, 0 Songs) wird verworfen; ein benanntes,
  leeres Set bleibt (Überschrift ohne Songs ist gültig).
- `totalSeconds = musicSeconds + breakSeconds`.

## 3. Editor (`components/setlist-editor.tsx`)

Drei Hinzufügen-Aktionen; neue Elemente landen am Ende und werden per Drag an den Platz
gezogen (unverändertes DnD über die Item-IDs):

```
[ Song hinzufügen ▾ ] [+ Hinzufügen]   [+ Set-Überschrift]   [+ Pause]
```

Zeilentypen (alle drag-bar über die gemeinsame `id`):
- **Song**: wie heute (Griff, Nummer, Titel/Meta, Notiz, ✕). Nummer **je Set neu ab 1**.
- **Set-Überschrift**: abgesetzte Zeile (Akzent-Band), Name inline editierbar (`onBlur` →
  `updateSetlistItemLabel`), rechts die Zwischensumme des Sets (`n Songs · m:ss`).
- **Pause**: abgesetzte Zeile mit Dauer-Eingabe (Minuten, `onBlur` →
  `updateSetlistBreakSeconds`) + optionalem Label (`onBlur` → `updateSetlistItemLabel`).

Fuß: `Musik m:ss · Pausen m:ss · Gesamt m:ss`, darunter der Zielzeit-Abgleich aus
`compareTarget` mit Differenz und Ampel (grün innerhalb Ziel, rot wenn drüber). Ohne
Zielzeit nur die Summen.

Der Song-Notiz-Platzhalter „Notiz (z.B. Pause danach)" wird zu „Notiz (z.B. Solo
verlängern)", weil Pausen jetzt echte Elemente sind.

Der `EditorItem`-Typ wird um `kind`, `label`, `breakSeconds` erweitert; Song-Felder werden
nullable (bei section/break leer).

## 4. Queries (Detailseite, Editor-Daten, Druck)

Die drei Ladestellen joinen heute `innerJoin(songs)` — das würde Zeilen ohne `songId`
(Überschriften/Pausen) verschlucken. Umstellen auf **`leftJoin(songs)`** und `kind`,
`label`, `breakSeconds` mitselektieren; Song-Felder werden nullable.

- `app/(app)/setlisten/[id]/page.tsx`
- `app/(app)/setlisten/[id]/druck/page.tsx`

Der `songAktiv`-Filter (`songs.deleted_at is null`) bleibt im WHERE: er ist für
null-gejointe Struktur-Zeilen wahr (durchgelassen) und für soft-gelöschte Songs falsch
(versteckt) — genau richtig.

**Setlisten-Liste bleibt unverändert:** ihre `songCount`/`totalSeconds`-Subqueries joinen
auf `songs`, wodurch Überschriften/Pausen automatisch herausfallen (Anzeige = Songs &
Musikdauer wie bisher).

## 5. Actions (`lib/actions/setlists.ts`)

Neu bzw. angepasst:
- `addSetlistSection(setlistId)` — fügt ein `section`-Item am Ende ein (Default-Label
  „Neues Set", `position = max+1`).
- `addSetlistBreak(setlistId)` — fügt ein `break`-Item am Ende ein (Default
  `breakSeconds = 15*60`, Label null).
- `updateSetlistItemLabel(itemId, label)` — setzt `label` (Set-Name / Pausentext).
- `updateSetlistBreakSeconds(itemId, seconds)` — setzt `breakSeconds` (aus Minuten-Eingabe).
- `updateSetlist` / `createSetlist` lesen zusätzlich `targetSeconds` (aus Minuten-Feld).

Bestehend nutzbar: `removeSetlistItem` (per Item-ID, für alle Typen), `reorderSetlist`
(arbeitet über Item-IDs), `updateSetlistItemNote` (nur Songs).

`addSongToSetlist` setzt `kind: "song"` explizit (Default deckt es zwar ab, aber explizit
ist klarer).

## 6. Druckansicht (`app/(app)/setlisten/[id]/druck/page.tsx`)

Bleibt **eine** Tabelle (fließt über Seiten), mit Struktur-Zeilen:
- **Set-Überschrift**: volle Breite überspannende Zeile (`colSpan`), „SET 1 · Warmup"
  links, Zwischensumme rechts.
- **Pause**: volle Breite überspannende Zeile, „— Pause (20 min): Umbau Bühne —" **ohne
  Emoji** (Blatt-Klarheit).
- **Song-Nummern je Set neu ab 1.**
- Fuß: statt nur „Gesamtdauer" jetzt **Musik / Pausen / Gesamt** + Zielzeit-Abgleich
  (`Ziel 90:00 → 26:10 unter`).

## 7. Zielzeit-Feld (`components/setlist-forms.tsx`)

`SetlistForm` bekommt ein Feld **„Zielzeit (Minuten, optional)"** (`type=number`,
`inputMode=numeric`). Eingabe in Minuten → gespeichert als `targetSeconds` (Minuten × 60),
angezeigt via `formatDuration` (`90:00`). Leeres Feld → `null`.

## Tests

Vitest, per Mutationsprobe abgesichert:
- `summarizeSetlist`: leere Liste; nur Songs (ein Segment, label null); benannte Sets mit
  Zwischensummen; Pausen zählen in `breakSeconds`, nicht in ein Set; führendes leeres
  Segment wird verworfen; benanntes leeres Set bleibt; `totalSeconds = Musik + Pausen`;
  Songs ohne Dauer zählen 0.
- `compareTarget`: null ohne Zielzeit; `over=false` und Differenz wenn unter Ziel;
  `over=true` wenn drüber; exakt gleich → Differenz 0, `over=false`.

## Verifikation (manuell)

`npm test` + `npx tsc --noEmit` + `npm run build`. Browser-Durchlauf: Setliste öffnen →
Set-Überschrift + Pause hinzufügen → per Drag anordnen → Namen/Dauer editieren →
Zwischensummen und Fuß prüfen → Zielzeit im Bearbeiten-Formular setzen → Abgleich prüfen →
Druckansicht öffnen (Sets/Pausen/Fuß) → Song aus dem Set entfernen, Zwischensumme
aktualisiert sich.

## Betroffene Dateien

- `lib/db/schema.ts` (Spalten + songId nullable), `drizzle/` (Rebuild-Migration)
- `lib/setlist-structure.ts` (neu, reine Logik)
- `components/setlist-editor.tsx` (drei Typen, Zwischensummen, Fuß)
- `components/setlist-forms.tsx` (Zielzeit-Feld)
- `lib/actions/setlists.ts` (neue/erweiterte Actions)
- `app/(app)/setlisten/[id]/page.tsx` (leftJoin, kind/label/breakSeconds)
- `app/(app)/setlisten/[id]/druck/page.tsx` (leftJoin, Struktur-Zeilen, Fuß)
- `tests/setlist-structure.test.ts` (neu)
