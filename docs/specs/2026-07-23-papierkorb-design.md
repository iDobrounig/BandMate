# Papierkorb (Soft Delete) — Entwurf

Stand: 23.07.2026 · Welle 0, Schritt C · Basis: v1.9.0 + Commits `ab4a23c`, `75740a4`
Anlass: [docs/review-2026-07.md](../review-2026-07.md), Abschnitt 2.5

## Problem

Jedes Mitglied kann heute jeden Song **samt allen Noten und Aufnahmen** unwiderruflich
löschen ([lib/actions/songs.ts:155](../../lib/actions/songs.ts)), ebenso jede Datei, jede
Setliste und ganze Terminserien. Es gibt keine Rückfrage-Ebene außer `confirm()`, kein Undo
und keinen Papierkorb. Der Schutz aus Schritt B (Backup) greift erst bei Platten- oder
Migrationsunfällen und ist für „ich hab danebengetippt" das falsche Werkzeug: dafür müsste
man den ganzen Datenbestand auf einen älteren Stand zurückdrehen und alles verlieren, was
seitdem passiert ist.

## Entscheidungen

Alle vier am 23.07.2026 mit Ingo abgestimmt.

### E1 — Verweise bleiben stehen, Queries filtern

Soft Delete schaltet `ON DELETE CASCADE` ab: bleibt die Song-Zeile stehen, räumt SQLite
`setlist_items`, `event_songs`, `votes` usw. nicht mehr weg. **Gewählt:** Diese Zeilen bleiben
unangetastet, sämtliche Joins filtern gelöschte Songs heraus.

*Warum:* Wiederherstellen ist dadurch trivial korrekt — der Song taucht an seiner alten
Position in der Setliste wieder auf, ohne dass Positionen serialisiert und rekonstruiert
werden müssen. Genau dort entstehen erfahrungsgemäß die Restore-Bugs. Preis: Eine Setliste
wird beim Löschen eines enthaltenen Songs stillschweigend kürzer. Das wird durch E5
abgefedert.

*Verworfen:* Verweise mitlöschen und im Papierkorb-Eintrag rekonstruieren (mehr Code, mehr
Fehlerfläche); Löschen blockieren solange referenziert (erzwingt Aufräumen vor dem Aufräumen).

### E2 — Umfang: `songs`, `setlists`, `events`, `attachments`

Kommentare bleiben Hartlöschung.

*Warum:* Die vier gewählten Objekte tragen den Verlustwert — vor allem `attachments`, also
die tatsächlichen Noten- und Audiodateien. Kommentare sind kurzlebig, der Verlust ist gering,
und ihr Löschpfad hat bereits eine eigene Berechtigungslogik
([interactions.ts:84](../../lib/actions/interactions.ts)). Sie herauszulassen spart etwa ein
Drittel des Query-Umbaus.

`song_links`, `setlist_items`, `event_songs`, `votes`, `practice_status`, `event_attendance`
bleiben ebenfalls Hartlöschung — das sind Verknüpfungen und Stimmen, keine Inhalte.

### E3 — Rechte

| Aktion | Wer |
|---|---|
| In den Papierkorb legen | alle (wie bisher) |
| Papierkorb ansehen | alle |
| Wiederherstellen | alle |
| Endgültig löschen | nur Admin |

*Warum:* Passt zum bestehenden „sonst dürfen alle alles" (README), setzt aber der einen
wirklich unumkehrbaren Aktion eine Hürde. Wer sich vertippt, kann sich selbst helfen — dieser
fehlende Reibungsverlust ist der Grund, warum ein Papierkorb überhaupt benutzt wird.

### E4 — Zwei Wege zurück

Papierkorb **und** sofortiges „Rückgängig" direkt nach dem Löschen.

*Warum:* Zwei verschiedene Fehlerfälle. Der Fehltipp fällt in derselben Sekunde auf — dafür
ist ein „Rückgängig" an Ort und Stelle unschlagbar, ein Papierkorb, den man nicht kennt,
hilft nicht. Dass etwas fehlt, merkt man dagegen oft erst Wochen später — dafür der
Papierkorb. Der zweite Weg ist billig, sobald die Restore-Action ohnehin existiert.

### E5 — Löschdialog zeigt die Folgen

Der `confirm()`-Text nennt künftig die Verweise:

> „Smooth Operator" in den Papierkorb? Kommt in 2 Setlisten und 1 Probe-Agenda vor.

Macht E1 für den Nutzer nachvollziehbar, statt eine Setliste unerklärt schrumpfen zu lassen.

## Schema

Auf `songs`, `setlists`, `events`, `attachments` je:

```ts
deletedAt: integer("deleted_at", { mode: "timestamp" }),          // NULL = aktiv
deletedById: integer("deleted_by_id").references(() => users.id),
```

`deletedById` ist nicht kosmetisch: die erste Frage im Papierkorb ist „wer war das", und ohne
die Spalte lässt sie sich nicht beantworten.

Eine Migration über `npm run db:generate`. Keine bestehenden Constraints betroffen — auf den
vier Tabellen gibt es außer den Primärschlüsseln keine Unique-Indizes.

## Lesepfad

Helper in `lib/db/filters.ts` — je ein Prädikat pro Tabelle statt eines Generics, damit
Drizzle die Spaltentypen behält:

```ts
export const songAktiv     = isNull(songs.deletedAt);
export const setlistAktiv  = isNull(setlists.deletedAt);
export const eventAktiv    = isNull(events.deletedAt);
export const anhangAktiv   = isNull(attachments.deletedAt);
```

Betroffen sind **26 lesende Zugriffe** (Seiten, `lib/queries.ts`, API-Routen). Bei den rohen
SQL-Subqueries muss einzeln nachgezogen werden, und zwar nur bei denen, deren Tabelle im
Umfang liegt:

| Subquery | Datei | Änderung |
|---|---|---|
| `audioCount`, `sheetCount` | [queries.ts:38-39](../../lib/queries.ts) | `and a.deleted_at is null` |
| `songCount` | [setlisten/page.tsx:17](../../app/(app)/setlisten/page.tsx) | zählt `setlist_items` **ohne Join auf `songs`** — Join ergänzen, sonst zählt ein gelöschter Song weiter mit |
| `totalSeconds` | [setlisten/page.tsx:18](../../app/(app)/setlisten/page.tsx) | joint bereits `songs`, nur Filter ergänzen |
| `upvotes`, `downvotes`, `readyCount`, `commentCount` | [queries.ts:34-40](../../lib/queries.ts) | unverändert — Tabellen nicht im Umfang |
| `yesCount`, `noCount`, `maybeCount` | [queries.ts:77-79](../../lib/queries.ts) | unverändert |
| `readyCount` | [termine/[id]/page.tsx:62](../../app/(app)/termine/[id]/page.tsx) | unverändert |

Zusätzlich [app/api/files/[id]/route.ts](../../app/api/files/[id]/route.ts): gelöschte
Anhänge liefern 404, auch über den Direktlink — sonst ist der Papierkorb per URL umgehbar.
Ebenso [app/api/kalender/[token]/route.ts](../../app/api/kalender/[token]/route.ts): gelöschte
Termine dürfen nicht im ICS-Feed stehen.

## Schreibpfad

Vier Actions von `db.delete(...)` auf `db.update(...).set({ deletedAt, deletedById })`:

- `deleteSong` — Dateien **nicht** mehr sofort von der Platte entfernen, erst beim Purge
- `deleteSetlist`
- `deleteEvent` — bei `scope: "series"` alle Termine der Serie mit **identischem**
  `deletedAt` markieren
- `deleteAttachment`

Dazu je eine `restore*`-Action und (Admin) `purge*`.

## Terminserien

Der Papierkorb gruppiert über `(seriesId, deletedAt)`. Da eine Serienlöschung allen Zeilen
denselben Zeitstempel gibt, entsteht daraus ein Eintrag „Serie: Bandprobe (12 Termine)" statt
zwölf Einzeleinträgen; Wiederherstellen bringt die ganze Serie zurück. Kein Zusatzfeld nötig.

## UI

### Undo-Band

Die Lösch-Actions leiten auf die Liste um mit `?undo=song:42`. Die Zielseite rendert ein Band:

> „Smooth Operator" wurde in den Papierkorb gelegt. **Rückgängig**

Kein Client-State-Framework, überlebt den Redirect, funktioniert ohne JavaScript-Zustand.
Beim Anhang-Löschen (kein Redirect) genügt lokaler Komponenten-State.

### `/papierkorb`

Für alle sichtbar, gruppiert nach Typ, je Eintrag: Name, Typ, gelöscht von wem und wann,
Restlaufzeit in Tagen. Aktionen „Wiederherstellen" (alle) und „Endgültig löschen" (Admin).

Verlinkt aus dem **Footer** — der ist auf jeder Seite vorhanden und kostet keinen Platz in
der Kopfzeile, die auf dem Handy mit drei Icons bereits voll ist. Ein Papierkorb ist genau
eine Footer-Utility.

## Aufräumen

`npm run trash:purge` (`scripts/purge-trash.js`, gleiches Muster wie `backup-db.js`: blankes
CommonJS, läuft ohne Build-Schritt) als täglicher Cron-Job neben dem Backup. Löscht Einträge
älter als `TRASH_RETENTION_DAYS` (30, in `lib/constants.ts`) endgültig — Datenbankzeile
**und erst dann** die Datei von der Platte.

Zusätzlich opportunistisch beim Öffnen von `/papierkorb`, damit der Bestand auch ohne
eingerichteten Cron nicht unbegrenzt wächst.

## Wechselwirkung mit dem Backup

Papierkorb-Frist **30 Tage**, Backup-Aufbewahrung **35 Tage** (`RETENTION_DAYS`, im Zuge
dieses Entwurfs von 14 angehoben).

Wäre die Backup-Aufbewahrung kürzer als die Papierkorb-Frist, läge eine endgültig gepurgte
Datei in **keinem** Backup mehr — die Läufe aus ihrer Lebenszeit wären längst rotiert. Die
35 Tage stellen sicher, dass zum Zeitpunkt des Purges noch mindestens ein Backup existiert,
das den Zustand vor der Löschung enthält. Dank der Hardlink-Deduplizierung kostet die
Verlängerung praktisch nichts.

**Diese Beziehung muss erhalten bleiben:** `RETENTION_DAYS > TRASH_RETENTION_DAYS`. Wer eine
der beiden Zahlen ändert, muss die andere mitdenken. Steht so im README.

## Nicht im Umfang

- Kommentare (bleiben Hartlöschung, siehe E2)
- Mitglieder (haben bereits „deaktivieren" statt löschen)
- Entfernen aus Setliste/Probe-Agenda (`setlist_items`, `event_songs`) — das ist keine
  Löschung von Inhalt, sondern eine Zuordnungsänderung. Bekommt in „Laufend — Konsistenz"
  lediglich eine Bestätigungsabfrage.
- Ein allgemeines Rechtemodell. Bleibt bei „alle dürfen alles", mit der einen Ausnahme aus E3.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| **Vergessener Filter** an einer der 26+11 Stellen → Gelöschtes taucht wieder auf oder Vorhandenes verschwindet | Vitest-Tests auf Query-Ebene **vor** dem Umbau (siehe unten). Das ist der Grund, warum der Test-Rahmen hier keine Kür mehr ist. |
| Platte läuft voll, weil Dateien 30 Tage länger liegen | Purge als Cron; Speicherplatz-Übersicht steht ohnehin auf der Roadmap |
| Nutzer hält den Papierkorb für ein Backup | Hilfe-Seite formuliert die 30-Tage-Frist explizit |
| Purge löscht, bevor ein Backup den Zustand hat | `RETENTION_DAYS > TRASH_RETENTION_DAYS`, siehe oben |

## Umsetzungsreihenfolge

1. **Vitest-Rahmen** — Test-DB in einem Temp-`DATA_DIR`, Fixtures, Tests gegen den
   *bestehenden* Zustand von `fetchSongList`, `fetchSongDetail`, `fetchEvents` und den
   Setlisten-Zählern. Diese Tests müssen **vor** dem Umbau grün sein, sonst prüfen sie nichts.
2. Migration + Schema-Spalten
3. `lib/db/filters.ts` + Umbau der 26 Lesestellen und der 3 betroffenen Subqueries,
   Tests laufen mit
4. Löschpfade auf Soft Delete, `restore*`- und `purge*`-Actions
5. `/papierkorb` + Footer-Link
6. Undo-Band + Löschdialog mit Verweisanzeige (E5)
7. `scripts/purge-trash.js` + Cron-Doku im README
8. Hilfe-Seite und FEATURES.md nachziehen

Schritt 1 ist die Absicherung für 2–4. Bei 37 Stellen, an denen ein vergessener Filter
falsche Daten produziert, ist Durchklicken keine Verifikation.
