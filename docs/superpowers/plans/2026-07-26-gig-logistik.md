# Gig-Logistik Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gigs um Logistik-Angaben erweitern (Zeiten, Kontakt, Gage, Anfahrt, Backline), sichtbar in App, Änderungs-Mail und Kalender-Abo.

**Architecture:** Acht neue nullable Spalten direkt auf `events` (flaches Drizzle-Muster). Felder nur bei `kind === "gig"` sichtbar/befüllt. `startTime` dient bei Gigs als Load-in und bleibt Anker für Kalender & Erinnerung. Pure Logik (`describeEventChanges`, `buildIcs`, `formatFee`) per Vitest getestet; Formular/Detailseite per `tsc`/`build`/Browser verifiziert (Projekt-Norm: keine UI-Unit-Tests).

**Tech Stack:** Next.js App Router + TypeScript, Drizzle + better-sqlite3, Tailwind v4, Vitest.

## Global Constraints

- UI-Sprache Deutsch; Styling über Komponenten-Klassen aus `globals.css` (`.card .btn .input .label .badge`).
- Nach Mutationen `revalidatePath("/", "layout")` (bereits in den Actions vorhanden).
- Commits deutsch, ein Feature-Block pro Commit; Commit-Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Vor jeder Schema-Änderung `./scripts/backup.sh`** — laufender Dev-Server migriert `data/` sofort beim Editieren von `lib/db/schema.ts`. `data/` niemals löschen/überschreiben.
- Keine Emoji in neuer UI (reine Text-Labels).
- Gage `fee` als `real`; `feeExtras` als Text. Gage für alle sichtbar.
- Nur benachrichtigungswürdig bei Gig-Änderung: Datum, Load-in (`startTime`), Ort, Soundcheck, Auftritt. NICHT: Gage, Verpflegung, Kontakt, Anfahrt, Backline.

---

### Task 1: Schema-Spalten + Migration

**Files:**
- Modify: `lib/db/schema.ts:1-7` (Import `real`), `lib/db/schema.ts:161-182` (events-Tabelle)
- Create: neue Datei unter `drizzle/` (durch `db:generate` erzeugt)

**Interfaces:**
- Produces: `BandEvent` erhält `soundcheckTime`, `stageTime`, `contactName`, `contactPhone`, `travelNotes`, `backlineNotes`, `feeExtras` (alle `string | null`) und `fee` (`number | null`).

- [ ] **Step 1: Backup ziehen (Pflicht vor Schema-Edit)**

Run: `./scripts/backup.sh --label pre-gig-logistik`
Expected: Läuft durch, endet mit „integrity_check … ok" und einem neuen Lauf unter dem Backup-Ziel.

- [ ] **Step 2: `real` importieren**

In `lib/db/schema.ts` den Import erweitern:

```ts
import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  unique,
} from "drizzle-orm/sqlite-core";
```

- [ ] **Step 3: Spalten zur `events`-Tabelle hinzufügen**

In `lib/db/schema.ts`, in der `events`-Tabelle direkt nach der `notes`-Zeile (`notes: text("notes"),`) einfügen:

```ts
  // Gig-Logistik (nur bei kind === "gig" befüllt). startTime dient bei Gigs
  // als Load-in — daher hier kein eigenes Load-in-Feld.
  soundcheckTime: text("soundcheck_time"), // HH:MM
  stageTime: text("stage_time"), // HH:MM Auftrittszeit
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  fee: real("fee"), // Gage in Euro, summierbar
  feeExtras: text("fee_extras"), // Verpflegung & Extras (Freitext)
  travelNotes: text("travel_notes"), // Anfahrt & Parken
  backlineNotes: text("backline_notes"), // Backline & Technik
```

- [ ] **Step 4: Migration generieren**

Run: `npm run db:generate`
Expected: Neue `.sql`-Datei unter `drizzle/` mit acht `ALTER TABLE events ADD COLUMN …`. Keine `DROP`-Anweisungen.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: Kein Fehler (Exit 0).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts drizzle/
git commit -m "$(cat <<'EOF'
feat(termine): Schema-Spalten für Gig-Logistik

Acht nullable Spalten auf events: soundcheck_time, stage_time,
contact_name, contact_phone, fee (real), fee_extras, travel_notes,
backline_notes. Load-in nutzt bestehendes start_time.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `formatFee`-Hilfe

**Files:**
- Modify: `lib/format.ts` (Funktion anhängen)
- Test: `tests/format.test.ts` (neu)

**Interfaces:**
- Produces: `formatFee(value: number | null | undefined): string`

- [ ] **Step 1: Failing test schreiben**

Create `tests/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatFee } from "@/lib/format";

describe("formatFee", () => {
  it("formatiert ganze Beträge mit Euro-Zeichen", () => {
    expect(formatFee(400)).toBe("400 €");
  });
  it("nutzt den Tausenderpunkt (de-AT)", () => {
    expect(formatFee(1250)).toBe("1.250 €");
  });
  it("gibt bei null/undefined einen leeren String zurück", () => {
    expect(formatFee(null)).toBe("");
    expect(formatFee(undefined)).toBe("");
  });
  it("behandelt 0 als gültigen Betrag", () => {
    expect(formatFee(0)).toBe("0 €");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- tests/format.test.ts`
Expected: FAIL — „formatFee is not a function" / Importfehler.

- [ ] **Step 3: Implementieren**

In `lib/format.ts` anhängen:

```ts
/** Gage in Euro, deutsche Notation: 400 → "400 €", 1250 → "1.250 €". */
export function formatFee(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value.toLocaleString("de-AT", { maximumFractionDigits: 2 })} €`;
}
```

- [ ] **Step 4: Test grün**

Run: `npm test -- tests/format.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts tests/format.test.ts
git commit -m "$(cat <<'EOF'
feat(format): formatFee für Gage-Anzeige

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `describeEventChanges` um Gig-Zeiten erweitern

**Files:**
- Modify: `lib/event-notify.ts` (Typ + Funktion)
- Test: `tests/event-notify.test.ts` (Tests anhängen)

**Interfaces:**
- Consumes: `EventKind` aus `@/lib/db/schema`.
- Produces: `EventNotifyFields` mit optionalen `soundcheckTime?`, `stageTime?`; `describeEventChanges(alt, neu, kind?: EventKind)` — 3. Parameter optional, Default `"rehearsal"`.

- [ ] **Step 1: Failing tests anhängen**

In `tests/event-notify.test.ts` innerhalb des `describe`-Blocks ergänzen:

```ts
  it("nennt die Zeitzeile bei einem Gig „Load-in“", () => {
    const z = describeEventChanges(basis, { ...basis, startTime: "15:00" }, "gig");
    expect(z).toEqual(["Load-in: 19:30 Uhr → 15:00 Uhr"]);
  });

  it("erkennt eine geänderte Soundcheck-Zeit (nur bei Gig gefüllt)", () => {
    const z = describeEventChanges(basis, { ...basis, soundcheckTime: "16:30" }, "gig");
    expect(z).toEqual(["Soundcheck: — → 16:30 Uhr"]);
  });

  it("erkennt eine geänderte Auftrittszeit", () => {
    const z = describeEventChanges(basis, { ...basis, stageTime: "20:00" }, "gig");
    expect(z).toEqual(["Auftritt: — → 20:00 Uhr"]);
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- tests/event-notify.test.ts`
Expected: FAIL — die drei neuen Tests schlagen fehl (Label „Uhrzeit" statt „Load-in", Soundcheck/Auftritt fehlen).

- [ ] **Step 3: Typ + Funktion erweitern**

In `lib/event-notify.ts`: Import am Kopf ergänzen und Typ/Funktion ersetzen:

```ts
import { formatDate } from "@/lib/format";
import type { EventKind } from "@/lib/db/schema";

export type EventNotifyFields = {
  date: string;
  startTime: string | null;
  location: string | null;
  soundcheckTime?: string | null;
  stageTime?: string | null;
};
```

Die Funktion `describeEventChanges` ersetzen durch:

```ts
export function describeEventChanges(
  alt: EventNotifyFields,
  neu: EventNotifyFields,
  kind: EventKind = "rehearsal"
): string[] {
  const zeilen: string[] = [];
  const zeige = (v: string | null | undefined) => (v && v.trim() ? v : "—");
  const zeit = (v: string | null | undefined) => (v ? `${v} Uhr` : "—");

  if (alt.date !== neu.date) {
    zeilen.push(`Datum: ${formatDate(alt.date)} → ${formatDate(neu.date)}`);
  }
  if ((alt.startTime ?? "") !== (neu.startTime ?? "")) {
    const label = kind === "gig" ? "Load-in" : "Uhrzeit";
    zeilen.push(`${label}: ${zeit(alt.startTime)} → ${zeit(neu.startTime)}`);
  }
  if ((alt.location ?? "") !== (neu.location ?? "")) {
    zeilen.push(`Ort: ${zeige(alt.location)} → ${zeige(neu.location)}`);
  }
  if ((alt.soundcheckTime ?? "") !== (neu.soundcheckTime ?? "")) {
    zeilen.push(`Soundcheck: ${zeit(alt.soundcheckTime)} → ${zeit(neu.soundcheckTime)}`);
  }
  if ((alt.stageTime ?? "") !== (neu.stageTime ?? "")) {
    zeilen.push(`Auftritt: ${zeit(alt.stageTime)} → ${zeit(neu.stageTime)}`);
  }
  return zeilen;
}
```

Auch den Doc-Kommentar oberhalb der Funktion um Soundcheck/Auftritt ergänzen (nicht nur „Datum, Uhrzeit, Ort").

- [ ] **Step 4: Test grün (inkl. Bestandstests)**

Run: `npm test -- tests/event-notify.test.ts`
Expected: PASS (alle, inkl. der bisherigen 8 — Default-`kind` hält „Uhrzeit: 19:30 Uhr → 20:00 Uhr" unverändert).

- [ ] **Step 5: Commit**

```bash
git add lib/event-notify.ts tests/event-notify.test.ts
git commit -m "$(cat <<'EOF'
feat(termine): Änderungs-Mail erkennt Soundcheck-/Auftrittszeit

Bei Gigs heißt die startTime-Zeile „Load-in". Gage/Kontakt/Anfahrt/
Backline lösen bewusst keine Benachrichtigung aus.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `buildIcs` — Logistik in DESCRIPTION + DTEND-Korrektur

**Files:**
- Modify: `lib/calendar.ts` (`buildIcs`)
- Test: `tests/calendar.test.ts` (Fixture + Tests)

**Interfaces:**
- Consumes: `formatFee` aus `@/lib/format`; `BandEvent` mit Logistik-Feldern (Task 1).

- [ ] **Step 1: Fixture um Logistik-Felder erweitern**

In `tests/calendar.test.ts` die `termin()`-Hilfe um die neuen Felder ergänzen (als `null`), innerhalb des Objektliterals vor `...over`:

```ts
    soundcheckTime: null,
    stageTime: null,
    contactName: null,
    contactPhone: null,
    fee: null,
    feeExtras: null,
    travelNotes: null,
    backlineNotes: null,
```

- [ ] **Step 2: Unescape-Hilfe + Failing tests anhängen**

In `tests/calendar.test.ts` nach der `entfalten`-Hilfe ergänzen:

```ts
/** Holt die entfaltete DESCRIPTION und macht ICS-Maskierung rückgängig. */
function beschreibung(ics: string): string | undefined {
  const z = entfalten(ics).find((l) => l.startsWith("DESCRIPTION:"));
  return z
    ?.slice("DESCRIPTION:".length)
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
```

Und einen neuen `describe`-Block anhängen:

```ts
describe("Gig-Logistik im Feed", () => {
  const gig = {
    kind: "gig" as const,
    title: "Stadtfest",
    date: "2026-08-06",
    startTime: "15:00",
    soundcheckTime: "16:30",
    stageTime: "20:00",
    contactName: "Max Huber",
    contactPhone: "0664 1234567",
    fee: 400,
    feeExtras: "warmes Essen",
    travelNotes: "Parkplatz hinterm Zelt",
    backlineNotes: "Drumkit steht",
  };

  it("stellt einem Gig einen Logistik-Block in die DESCRIPTION voran", () => {
    const desc = beschreibung(buildIcs([termin(gig)], "https://b.example.com"));
    expect(desc).toContain("Load-in 15:00 · Soundcheck 16:30 · Auftritt 20:00");
    expect(desc).toContain("Kontakt: Max Huber, 0664 1234567");
    expect(desc).toContain("Gage: 400 € · warmes Essen");
    expect(desc).toContain("Anfahrt: Parkplatz hinterm Zelt");
    expect(desc).toContain("Backline: Drumkit steht");
  });

  it("setzt DTEND bei einem Gig auf Auftrittszeit + 2 h", () => {
    const zeilen = entfalten(buildIcs([termin(gig)], ""));
    expect(zeilen).toContain("DTSTART:20260806T150000");
    expect(zeilen).toContain("DTEND:20260806T220000");
  });

  it("lässt Proben unverändert (kein Block, DTEND = startTime + 2 h)", () => {
    const desc = beschreibung(
      buildIcs([termin({ date: "2026-08-06", startTime: "19:30", notes: "Nur Notiz" })], "")
    );
    expect(desc).not.toContain("Load-in");
    const zeilen = entfalten(buildIcs([termin({ date: "2026-08-06", startTime: "19:30" })], ""));
    expect(zeilen).toContain("DTEND:20260806T213000");
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- tests/calendar.test.ts`
Expected: FAIL — kein Logistik-Block, DTEND noch 18:00.

- [ ] **Step 4: `buildIcs` anpassen**

In `lib/calendar.ts` den Import ergänzen:

```ts
import { formatFee } from "@/lib/format";
```

Den `if (event.startTime) { … } else { … }`-Block für DTSTART/DTEND ersetzen durch:

```ts
    if (event.startTime) {
      // Lokale Zeit ohne Zeitzone ("floating") — Kalender interpretiert lokal
      lines.push(`DTSTART:${icsDateTime(event.date, event.startTime)}`);
      // Proben 2h. Gigs: bis Auftritt + 2h (startTime ist Load-in), sonst +3h.
      const gig = event.kind === "gig";
      const endBase = gig && event.stageTime ? event.stageTime : event.startTime;
      const endHours = gig ? (event.stageTime ? 2 : 3) : 2;
      lines.push(`DTEND:${addHours(event.date, endBase, endHours)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${event.date.replaceAll("-", "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(event.date)}`);
    }
```

Den `descParts`-Block ersetzen durch (Logistik vorangestellt):

```ts
    const logistik: string[] = [];
    if (event.kind === "gig") {
      const zeiten = [
        event.startTime ? `Load-in ${event.startTime}` : null,
        event.soundcheckTime ? `Soundcheck ${event.soundcheckTime}` : null,
        event.stageTime ? `Auftritt ${event.stageTime}` : null,
      ].filter(Boolean);
      if (zeiten.length) logistik.push(zeiten.join(" · "));
      if (event.contactName || event.contactPhone)
        logistik.push(
          `Kontakt: ${[event.contactName, event.contactPhone].filter(Boolean).join(", ")}`
        );
      if (event.fee != null || event.feeExtras)
        logistik.push(
          `Gage: ${[formatFee(event.fee), event.feeExtras].filter(Boolean).join(" · ")}`
        );
      if (event.travelNotes) logistik.push(`Anfahrt: ${event.travelNotes}`);
      if (event.backlineNotes) logistik.push(`Backline: ${event.backlineNotes}`);
    }
    const descParts = [
      logistik.length ? logistik.join("\n") : "",
      event.notes ?? "",
      appUrl ? `Zu-/Absagen: ${appUrl}/termine/${event.id}` : "",
    ].filter(Boolean);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeIcs(descParts.join("\n\n"))}`);
    }
```

- [ ] **Step 5: Test grün (inkl. Bestandstests)**

Run: `npm test -- tests/calendar.test.ts`
Expected: PASS (alle, inkl. der bisherigen VALARM/Faltung/Grundgerüst-Tests).

- [ ] **Step 6: Commit**

```bash
git add lib/calendar.ts tests/calendar.test.ts
git commit -m "$(cat <<'EOF'
feat(termine): Gig-Logistik im ICS-Feed, DTEND bis Auftritt + 2h

DESCRIPTION bekommt bei Gigs einen kompakten Logistik-Block. DTEND
umspannt den Gig-Tag (startTime = Load-in) bis Auftrittszeit + 2h.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `readEventFields` + `updateEvent`-Verdrahtung

**Files:**
- Modify: `lib/actions/events.ts:22-40` (`readEventFields`), `lib/actions/events.ts:129-132` (Aufruf `describeEventChanges`)

**Interfaces:**
- Consumes: `describeEventChanges(alt, neu, kind)` (Task 3).
- Produces: `readEventFields` liefert zusätzlich `soundcheckTime`, `stageTime`, `contactName`, `contactPhone`, `fee`, `feeExtras`, `travelNotes`, `backlineNotes`; fließen via `.set(fields)` in Insert und Update.

- [ ] **Step 1: `readEventFields` erweitern**

In `lib/actions/events.ts` die Funktion ersetzen durch:

```ts
function readEventFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const kind = formData.get("kind") === "gig" ? ("gig" as const) : ("rehearsal" as const);
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const setlistIdRaw = String(formData.get("setlistId") ?? "").trim();
  const setlistId = setlistIdRaw ? Number(setlistIdRaw) : null;

  // Gig-Logistik. Fehlen die Felder (Probe-Termin, Block nicht gerendert),
  // liest FormData sie als leer → null; ein Umschalten Gig→Probe leert sie.
  const t = (key: string) => String(formData.get(key) ?? "").trim() || null;
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const feeNum = feeRaw ? Number(feeRaw) : NaN;

  return {
    title,
    kind,
    date,
    startTime: startTime || null,
    location: location || null,
    notes: notes || null,
    setlistId,
    soundcheckTime: t("soundcheckTime"),
    stageTime: t("stageTime"),
    contactName: t("contactName"),
    contactPhone: t("contactPhone"),
    // Tippfehler soll das Formular nicht blockieren → NaN wird zu null.
    fee: Number.isFinite(feeNum) ? feeNum : null,
    feeExtras: t("feeExtras"),
    travelNotes: t("travelNotes"),
    backlineNotes: t("backlineNotes"),
  };
}
```

- [ ] **Step 2: `kind` an `describeEventChanges` durchreichen**

In `lib/actions/events.ts`, in `updateEvent`, die Zeile
`const changes = describeEventChanges(alt, fields);` ersetzen durch:

```ts
    const changes = describeEventChanges(alt, fields, fields.kind);
```

Und den darüberstehenden Kommentar anpassen zu:

```ts
    // Nur benachrichtigen, wenn sich Datum/Load-in/Ort/Soundcheck/Auftritt geändert hat.
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Exit 0. (`.set(fields)` und `insert(...).values({...fields})` akzeptieren die neuen Spalten; `alt` als `BandEvent` erfüllt `EventNotifyFields`.)

- [ ] **Step 4: Bestehende Query-/Notify-Tests laufen lassen (keine Regression)**

Run: `npm test`
Expected: PASS (alle bisherigen + neuen Tests).

- [ ] **Step 5: Commit**

```bash
git add lib/actions/events.ts
git commit -m "$(cat <<'EOF'
feat(termine): Server-Action speichert Gig-Logistik-Felder

readEventFields liest die acht Felder; Änderungserkennung erhält kind
für die korrekte Load-in-Beschriftung.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Formular — Gig-Logistik-Block, dynamisches Label, `htmlFor`

**Files:**
- Modify: `components/event-forms.tsx` (`EventForm`)

**Interfaces:**
- Consumes: `BandEvent`-Felder als `defaultValue` (Task 1); Feldnamen werden von `readEventFields` gelesen (Task 5).

- [ ] **Step 1: „Uhrzeit"-Label dynamisch machen + `htmlFor`/`id` an bestehende Labels**

In `components/event-forms.tsx` die bestehenden Felder mit `id`/`htmlFor` verknüpfen. Beispielhaft Titel, Datum und das dynamische Zeit-Label:

```tsx
      <div>
        <label className="label" htmlFor="ev-title">Titel</label>
        <input
          id="ev-title"
          className="input"
          name="title"
          defaultValue={event?.title ?? ""}
          placeholder={kind === "gig" ? "z.B. Stadtfest Hauptbühne" : "z.B. Bandprobe"}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="ev-date">Datum</label>
          <input id="ev-date" className="input" name="date" type="date"
            defaultValue={event?.date ?? ""} required />
        </div>
        <div>
          <label className="label" htmlFor="ev-startTime">
            {kind === "gig" ? "Load-in (optional)" : "Uhrzeit (optional)"}
          </label>
          <input id="ev-startTime" className="input" name="startTime" type="time"
            defaultValue={event?.startTime ?? ""} />
        </div>
      </div>
```

Analog `htmlFor="ev-location"`/`id="ev-location"`, `htmlFor="ev-setlistId"`/`id="ev-setlistId"`, `htmlFor="ev-notes"`/`id="ev-notes"` an den bestehenden Feldern Ort/Setliste/Notizen ergänzen (Label + zugehöriges Input/Select/Textarea).

- [ ] **Step 2: Gig-Logistik-Block einfügen**

In `components/event-forms.tsx` direkt **nach** dem Notizen-`<div>` und **vor** dem `{!isEdit && ( … Wiederholen … )}`-Block einfügen:

```tsx
      {kind === "gig" && (
        <div className="space-y-4 rounded-lg border border-line-soft p-3">
          <p className="label !mb-0">Gig-Logistik</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-soundcheck">Soundcheck</label>
              <input id="ev-soundcheck" className="input" name="soundcheckTime"
                type="time" defaultValue={event?.soundcheckTime ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="ev-stage">Auftritt</label>
              <input id="ev-stage" className="input" name="stageTime"
                type="time" defaultValue={event?.stageTime ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-contactName">Ansprechpartner</label>
              <input id="ev-contactName" className="input" name="contactName"
                defaultValue={event?.contactName ?? ""} placeholder="z.B. Max Huber" />
            </div>
            <div>
              <label className="label" htmlFor="ev-contactPhone">Telefon</label>
              <input id="ev-contactPhone" className="input" name="contactPhone"
                type="tel" defaultValue={event?.contactPhone ?? ""}
                placeholder="z.B. 0664 1234567" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ev-fee">Gage (€)</label>
              <input id="ev-fee" className="input" name="fee" type="number"
                step="0.01" inputMode="decimal"
                defaultValue={event?.fee ?? ""} placeholder="z.B. 400" />
            </div>
            <div>
              <label className="label" htmlFor="ev-feeExtras">Verpflegung &amp; Extras</label>
              <input id="ev-feeExtras" className="input" name="feeExtras"
                defaultValue={event?.feeExtras ?? ""}
                placeholder="z.B. warmes Essen, 2 Kisten Bier" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="ev-travel">Anfahrt &amp; Parken</label>
            <textarea id="ev-travel" className="input min-h-16" name="travelNotes"
              defaultValue={event?.travelNotes ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="ev-backline">Backline &amp; Technik</label>
            <textarea id="ev-backline" className="input min-h-16" name="backlineNotes"
              defaultValue={event?.backlineNotes ?? ""} />
          </div>
        </div>
      )}
```

- [ ] **Step 3: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: Exit 0, Build ohne Fehler.

- [ ] **Step 4: Manuell verifizieren (Browser)**

Dev-Server über `.claude/launch.json` (`bandmate-dev`, Port 3000) starten, einloggen, `/termine` öffnen:
- „Gig" wählen → Logistik-Block erscheint, „Uhrzeit" heißt „Load-in".
- „Probe" wählen → Block verschwindet.
- Gig mit allen Feldern anlegen → landet auf Detailseite.
- Auf einem Label ins Feld klicken → Fokus springt ins Input (htmlFor greift).

Erwartete Proof: Screenshot des Gig-Formulars mit sichtbarem Logistik-Block.

- [ ] **Step 5: Commit**

```bash
git add components/event-forms.tsx
git commit -m "$(cat <<'EOF'
feat(termine): Gig-Logistik-Felder im Terminformular

Block nur bei Gig, Uhrzeit-Label wird zu Load-in. Alle Labels des
Formulars mit htmlFor/id (F1, mitgenommen).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Detailseite — Logistik-Karte + Header-Label

**Files:**
- Modify: `app/(app)/termine/[id]/page.tsx` (Import, Header-Zeile, neue Karte)

**Interfaces:**
- Consumes: `formatFee` (Task 2); `event`-Logistik-Felder (Task 1).

- [ ] **Step 1: `formatFee` importieren + Header-Zeile eindeutig machen**

In `app/(app)/termine/[id]/page.tsx` den Format-Import ergänzen:

```ts
import { formatDate, formatFee } from "@/lib/format";
```

Die Header-Zeitangabe ersetzen. Aus:

```tsx
          {event.startTime ? ` · ${event.startTime} Uhr` : ""}
```

wird:

```tsx
          {event.startTime
            ? event.kind === "gig"
              ? ` · Load-in ${event.startTime}`
              : ` · ${event.startTime} Uhr`
            : ""}
```

- [ ] **Step 2: Logistik-Karte als erste Karte der Hauptspalte einfügen**

In `app/(app)/termine/[id]/page.tsx`, als erstes Kind von
`<div className="min-w-0 space-y-8">` (direkt vor der „Bist du dabei?"-`<section>`), einfügen:

```tsx
          {event.kind === "gig" &&
            (event.soundcheckTime ||
              event.stageTime ||
              event.contactName ||
              event.contactPhone ||
              event.fee != null ||
              event.feeExtras ||
              event.travelNotes ||
              event.backlineNotes) && (
              <section className="card p-5">
                <h2 className="headline mb-3 text-lg">Gig-Logistik</h2>
                <dl className="space-y-2 text-sm">
                  {(event.startTime || event.soundcheckTime || event.stageTime) && (
                    <div className="flex gap-3">
                      <dt className="w-28 shrink-0 text-mute">Ablauf</dt>
                      <dd className="mono-display">
                        {[
                          event.startTime ? `Load-in ${event.startTime}` : null,
                          event.soundcheckTime ? `Soundcheck ${event.soundcheckTime}` : null,
                          event.stageTime ? `Auftritt ${event.stageTime}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </div>
                  )}
                  {(event.contactName || event.contactPhone) && (
                    <div className="flex gap-3">
                      <dt className="w-28 shrink-0 text-mute">Kontakt</dt>
                      <dd>
                        {event.contactName}
                        {event.contactName && event.contactPhone ? " · " : ""}
                        {event.contactPhone && (
                          <a
                            href={`tel:${event.contactPhone.replace(/[^\d+]/g, "")}`}
                            className="text-accent-hi hover:underline"
                          >
                            {event.contactPhone}
                          </a>
                        )}
                      </dd>
                    </div>
                  )}
                  {(event.fee != null || event.feeExtras) && (
                    <div className="flex gap-3">
                      <dt className="w-28 shrink-0 text-mute">Gage</dt>
                      <dd>
                        {[formatFee(event.fee), event.feeExtras]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </div>
                  )}
                  {event.travelNotes && (
                    <div className="flex gap-3">
                      <dt className="w-28 shrink-0 text-mute">Anfahrt</dt>
                      <dd className="whitespace-pre-wrap">{event.travelNotes}</dd>
                    </div>
                  )}
                  {event.backlineNotes && (
                    <div className="flex gap-3">
                      <dt className="w-28 shrink-0 text-mute">Backline</dt>
                      <dd className="whitespace-pre-wrap">{event.backlineNotes}</dd>
                    </div>
                  )}
                </dl>
              </section>
            )}
```

- [ ] **Step 3: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: Exit 0.

- [ ] **Step 4: Manuell verifizieren (Browser)**

Detailseite des in Task 6 angelegten Gigs öffnen:
- Logistik-Karte steht ganz oben in der Hauptspalte, nur befüllte Zeilen sichtbar.
- Telefonnummer ist ein `tel:`-Link (Bereinigung: `0664 1234567` → `href="tel:06641234567"`).
- Header zeigt „· Load-in 15:00".
- Eine reine Probe zeigt keine Logistik-Karte und „· 19:30 Uhr".

Erwartete Proof: Screenshot der Detailseite mit Logistik-Karte.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/termine/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(termine): Gig-Logistik-Karte auf der Detailseite

Karte zuoberst bei Gigs (nur befüllte Zeilen), Telefon als tel:-Link,
Header nennt Load-in.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: FEATURES.md abhaken + Gesamt-Verifikation

**Files:**
- Modify: `FEATURES.md` (Gig-Logistik-Eintrag)

- [ ] **Step 1: Gesamte Test-Suite + Build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: Alle Tests PASS, Exit 0.

- [ ] **Step 2: FEATURES.md aktualisieren**

In `FEATURES.md`, Abschnitt „Welle 2", den Punkt `- [ ] **Gig-Logistik**` auf `- [x]` setzen und den Beschreibungstext an das Umgesetzte anpassen (Load-in/Soundcheck/Auftritt, Kontakt mit tel:-Link, Gage als Zahl + Verpflegung, Anfahrt, Backline; Änderungs-Mail und ICS-Integration). Datum `erledigt 26.07.2026` ergänzen, im Stil der Welle-0/1-Einträge.

- [ ] **Step 3: Commit**

```bash
git add FEATURES.md
git commit -m "$(cat <<'EOF'
docs(welle-2): Gig-Logistik als umgesetzt markiert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Selbst-Review (nach dem Schreiben, gegen die Spec geprüft)

- **Spec-Abdeckung:** Schema (T1), Formular inkl. dynamisches Label + htmlFor (T6), Server-Action inkl. fee-NaN-Guard (T5), Detailanzeige inkl. tel:/formatFee/Header (T7), Änderungs-Mail Soundcheck/Auftritt + Load-in-Label (T3/T5), ICS DESCRIPTION + DTEND (T4), Tests describeEventChanges/buildIcs/formatFee (T2/T3/T4), FEATURES-Pflege (T8). Alle Spec-Abschnitte haben eine Task.
- **Platzhalter:** keine — jeder Code-Schritt zeigt vollständigen Code.
- **Typ-Konsistenz:** `formatFee(number|null|undefined)` einheitlich (T2/T4/T7); `describeEventChanges(alt, neu, kind?)` mit optionalem Default, Aufruf in T5 mit `fields.kind`; Feldnamen (`soundcheckTime`, `stageTime`, `contactName`, `contactPhone`, `fee`, `feeExtras`, `travelNotes`, `backlineNotes`) identisch in Schema/Form/Action/ICS/Detail.
