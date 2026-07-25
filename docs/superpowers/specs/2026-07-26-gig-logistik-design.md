# Gig-Logistik — Design

Stand: 26.07.2026 · Welle 2, Häppchen 1 · Betrifft: Termine-Subsystem
Grundlage: [FEATURES.md](../../../FEATURES.md) „Welle 2 — Gig-Logistik"

## Ziel & Kontext

Ein Gig hat heute nur Titel/Datum/Ort/Notizen. Alles Weitere — wann Load-in ist, wer
der Ansprechpartner vor Ort ist, was die Gage bringt, wie die Anfahrt läuft — landet in
WhatsApp, im Moment des größten Nutzens. Dieses Häppchen ergänzt Gigs um die typischen
Logistik-Angaben, sichtbar in der App und im abonnierten Kalender.

Anlass: ein konkret anstehender Gig. Der Feldsatz ist an diesem realen Fall abgestimmt.

Nicht Teil dieses Häppchens: Jahresgage-/Reporting-Auswertungen (der `real`-Typ von `fee`
hält die Tür dafür offen, mehr nicht), mehrere Ansprechpartner, Datei-Anhänge am Termin.

## Entscheidungen (abgestimmt)

1. **Speichermodell: flache Spalten auf `events`** (nicht eigene Tabelle, nicht JSON).
   Passt zum Projektmuster, keine Joins, eine additive Migration. Max. 1 Logistik-Satz
   pro Event → 1:1-Tabelle wäre Overkill (YAGNI).
2. **Zeiten-Modell: `startTime` = Load-in bei Gigs.** Kein viertes Zeitfeld. Load-in ist
   der Anker für Kalender-`DTSTART` und die „2 h vorher"-Erinnerung — die Band wird
   rechtzeitig zum Hinfahren erinnert. Soundcheck und Auftritt kommen als zwei zusätzliche
   Gig-Zeiten dazu.
3. **Gage sichtbar für alle Mitglieder.** Passt zum „alle dürfen alles"-Prinzip, kein
   Sonderfall im Rendering/Query.
4. **Gage als Zahl (`real`), plus separates Textfeld `feeExtras`** („Verpflegung & Extras")
   für Nicht-Geld-Leistungen (Essen, Getränke, Übernachtung …).
5. **Nur bei Gigs.** Alle Logistik-Felder erscheinen ausschließlich, wenn `kind === "gig"`.
   Proben bleiben unverändert.

## 1. Datenmodell (Migration)

Acht neue **nullable** Spalten auf `events` (Load-in = bestehendes `startTime`, keine
neue Spalte):

| Spalte | Drizzle-Typ | Label (UI) | Zweck |
|---|---|---|---|
| `soundcheckTime` | `text` `HH:MM` | Soundcheck | Uhrzeit Soundcheck |
| `stageTime` | `text` `HH:MM` | Auftritt | Auftrittszeit |
| `contactName` | `text` | Ansprechpartner | Kontakt vor Ort |
| `contactPhone` | `text` | Telefon | am Handy via `tel:` antippbar |
| `fee` | `real` | Gage (€) | Zahl, summierbar |
| `feeExtras` | `text` | Verpflegung & Extras | Essen/Getränke/Sonstiges |
| `travelNotes` | `text` | Anfahrt & Parken | Freitext |
| `backlineNotes` | `text` | Backline & Technik | Freitext |

- Alle Spalten additiv und nullable → Bestandstermine bleiben unberührt, keine
  Daten-Migration nötig.
- Schema-Änderung in `lib/db/schema.ts`, Migration per `npm run db:generate` → `drizzle/`.
- **Vor der Migration `./scripts/backup.sh` laufen lassen** (AGENTS-Regel: laufender
  Dev-Server migriert `data/` sofort beim Schema-Edit).
- `fee` als `real`: Float ist für Geld theoretisch unsauber (Rundung), bei Bandgagen
  unkritisch und die einfachste Lösung für „später summieren".

## 2. Formular (`components/event-forms.tsx`, `EventForm`)

Der Form ist geteilt für Anlegen (Sidebar `/termine`) und Bearbeiten (Sidebar
`/termine/[id]`) und hat bereits `kind`-State (rehearsal/gig).

**Änderungen am bestehenden Teil:**
- Das „Uhrzeit (optional)"-Label wird **dynamisch**: bei `kind === "gig"` → „Load-in",
  sonst „Uhrzeit (optional)". Ein Feld (`startTime`), kontextabhängig beschriftet.
- **Konsistenz mitnehmen (F1):** allen `<label>` in diesem Form `htmlFor`/`id` geben.
  Neue Felder von Anfang an korrekt.

**Neuer Block — nur gerendert wenn `kind === "gig"`** (umrandete Box wie die
„Wöchentlich wiederholen"-Box), Überschrift „Gig-Logistik":

```
┌─ Gig-Logistik ──────────────  (nur bei Gig)
│  Soundcheck   |  Auftritt        (2× type=time)
│  Ansprechpartner | Telefon       (text | type=tel)
│  Gage (€)     |  Verpflegung & Extras  (type=number step=0.01 inputMode=decimal | text)
│  Anfahrt & Parken                (textarea)
│  Backline & Technik              (textarea)
└──────────────────────────────
```

- **Bedingtes Rendern (unmount), kein bloßes Verstecken.** Schaltet man Gig→Probe, sind
  die Felder nicht im FormData → Server liest sie als `null` → Logistik wird geleert.
  Kein Geister-Datensatz.

## 3. Server-Action (`lib/actions/events.ts`)

- `readEventFields(formData)` um die neuen Feld-Werte erweitern (Load-in nutzt das
  bestehende `startTime`; also 8 neue Spalten-Werte). Da das Ergebnis per `.set(fields)` sowohl in `createEvent`
  (Insert) als auch `updateEvent` (Update) fließt, wirken die Felder automatisch in beiden
  Pfaden — inklusive des Leerens auf `null` bei Nicht-Gigs.
- **`fee` parsen:** leerer String → `null`; sonst `Number()`, bei `NaN` → `null`
  (kein harter Fehler, damit ein Tippfehler nicht das ganze Formular blockiert).
- Zeiten (`soundcheckTime`, `stageTime`) wie `startTime`: getrimmt, leer → `null`.
- Textfelder getrimmt, leer → `null`.

## 4. Detailanzeige (`app/(app)/termine/[id]/page.tsx`)

- **Neue „Gig-Logistik"-Karte als erste Karte der Hauptspalte** (vor „Bist du dabei?"),
  nur wenn `kind === "gig"` **und** mindestens ein Logistik-Feld gefüllt ist (sonst keine
  leere Karte).
- Innerhalb nur befüllte Zeilen rendern:
  - **Ablauf:** Load-in / Soundcheck / Auftritt als Zeit-Zeile (nur gesetzte Zeiten).
  - **Kontakt:** Ansprechpartner · Telefon — Telefon als `<a href="tel:…">` (Nummer von
    Leerzeichen/Bindestrichen bereinigt für den href, Anzeige unverändert).
  - **Gage:** `formatFee(fee)` · `feeExtras` in einer Zeile, getrennt durch `·`.
  - **Anfahrt & Parken**, **Backline & Technik:** Freitext mit `whitespace-pre-wrap`.
- **Header-Zeile oben** wird bei Gigs eindeutig: statt unbeschriftetem „· 15:00 Uhr" →
  „· Load-in 15:00".
- **Keine Emoji** — reine Text-Labels (Richtung „Emoji raus", M6).

**Neue Hilfe `formatFee(value: number | null): string`** in `lib/format.ts`:
deutsche Notation, z.B. `400 €` bzw. `1.250 €`. `null` → leer.

## 5. Benachrichtigung bei Änderung (`lib/event-notify.ts`)

`describeEventChanges` prüft heute Datum/`startTime`/Ort. Erweitern:

- `EventNotifyFields` um `soundcheckTime` und `stageTime` (beide `string | null`) ergänzen.
- Zwei neue „alt → neu"-Zeilen: „Soundcheck: …" und „Auftritt: …". Da Proben diese Felder
  nie setzen (beide `null`), entsteht dort natürlich keine Zeile — kein `kind`-Sonderfall
  nötig für die Soundcheck/Auftritt-Zeilen.
- **`kind` an die Funktion durchreichen**, damit die `startTime`-Zeile bei Gigs „Load-in"
  statt „Uhrzeit" heißt.
- **Bewusst NICHT benachrichtigt:** Gage, Verpflegung, Ansprechpartner, Anfahrt, Backline.
  Das ist die „Kosmetik"-Kategorie — genau die Änderungen, wegen derer Leute
  Benachrichtigungen abdrehen.

Keine neue UI: die „Band benachrichtigen"-Checkbox und das `sendMail`-Gate existieren
bereits. Reine Funktion, testbar ohne DB wie bisher.

## 6. Kalender-Feed (`lib/calendar.ts`, `buildIcs`)

- **`DESCRIPTION` bei Gigs** um einen kompakten Logistik-Block **voranstellen** (nur
  befüllte Zeilen), vor den bestehenden Notizen und dem „Zu-/Absagen"-Link:
  ```
  Load-in 15:00 · Soundcheck 16:30 · Auftritt 20:00
  Kontakt: Max Huber, 0664 1234567
  Gage: 400 € · warmes Essen
  Anfahrt: Parkplatz hinterm Zelt
  Backline: Drumkit steht

  <Notizen>
  Zu-/Absagen: <url>
  ```
  Zeilenfaltung (RFC 5545) ist bereits vorhanden → lange Zeilen unkritisch.
- **`DTEND` bei Gigs korrigieren:** heute `startTime + 3 h`. Da `startTime` jetzt Load-in
  ist, endet der Kalenderblock sonst vor dem Auftritt. Neu: bei Gigs mit gesetzter
  `stageTime` → `DTEND = stageTime + 2 h`; sonst wie bisher (`startTime + 3 h` für Gigs,
  `+ 2 h` für Proben). `DTSTART` bleibt `startTime` (= Load-in).
- `VALARM` unverändert: „2 h vorher" bezieht sich damit korrekt aufs Losfahren (Load-in).

## Tests

Im Stil des bestehenden Vitest-Rahmens, per Mutationsprobe abgesichert:

- `describeEventChanges`: erkennt geänderte Soundcheck-/Auftrittszeit; Gage/Kontakt/Anfahrt/
  Backline lösen **nichts** aus; `startTime`-Zeile heißt bei Gigs „Load-in".
- `buildIcs`: Logistik-Block steht in der `DESCRIPTION` eines Gigs; `DTEND` = `stageTime + 2 h`
  wenn gesetzt; Proben unverändert (kein Block, altes `DTEND`).
- `formatFee`: `400 → "400 €"`, `1250 → "1.250 €"`, `null → ""`.

## Verifikation (manuell)

`npx tsc --noEmit` + `npm run build`, dann Browser-Durchlauf: Gig anlegen mit Logistik →
Detailseite prüfen (Karte, tel:-Link) → bearbeiten, Auftrittszeit ändern, Mail gegen Mailpit
→ Kalender-Feed abrufen und `DESCRIPTION`/`DTEND` prüfen → Gig→Probe umschalten, Logistik
verschwindet.

## Betroffene Dateien

- `lib/db/schema.ts` (Spalten), `drizzle/` (neue Migration)
- `components/event-forms.tsx` (Gig-Block, dynamisches Label, `htmlFor`)
- `lib/actions/events.ts` (`readEventFields`)
- `app/(app)/termine/[id]/page.tsx` (Logistik-Karte, Header-Label)
- `lib/format.ts` (`formatFee`)
- `lib/event-notify.ts` (Soundcheck/Auftritt, `kind`-Label)
- `lib/calendar.ts` (`DESCRIPTION`-Block, `DTEND`)
- Tests unter `tests/`
