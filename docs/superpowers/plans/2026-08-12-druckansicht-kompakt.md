# Kompakte Druckansicht für Setlisten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zweite, kompaktere Druckansicht für Setlisten (`/setlisten/[id]/druck-kompakt`), zwischen der man auf der Druckseite selbst umschalten kann, damit mehr Songs auf eine Seite passen.

**Architektur:** Die bestehende Datenbeschaffung aus `druck/page.tsx` wird nach `lib/queries.ts` als `getSetlistPrintData()` extrahiert und von beiden Druckseiten geteilt genutzt. Die neue kompakte Seite ist eine eigene Route mit reduzierten Spalten. Ein neuer `PrintViewSwitcher` in der Toolbar beider Seiten verlinkt zur jeweils anderen Ansicht.

**Tech Stack:** Next.js App Router (Server Components), Drizzle ORM, Tailwind v4, Vitest (für `lib/queries.ts`).

## Global Constraints

- UI-Sprache Deutsch, URLs deutsch (`/setlisten/[id]/druck-kompakt`) — aus AGENTS.md.
- Commits: deutsch, ein Feature-Block pro Commit — aus AGENTS.md.
- Kein DB-Eingriff, keine Migration — aus der Spec.
- Setlisten-Detailseite bleibt unverändert, **kein** zweiter Druck-Button dort — aus der Spec.
- Reine Logik (`getSetlistPrintData`) bekommt Vitest-Tests in `tests/queries.test.ts`, wie
  die anderen Funktionen in `lib/queries.ts`; Seiten/UI werden per Browser-Durchlauf verifiziert
  (kein Component-Test-Setup im Projekt — `vitest.config.ts` läuft mit `environment: "node"`).
- Abschluss jeder Aufgabe: `npx tsc --noEmit`.

---

### Task 1: `getSetlistPrintData()` extrahieren und in der Vollansicht nutzen

**Files:**
- Modify: `lib/queries.ts` (neue Funktion + Typen ergänzen)
- Modify: `app/(app)/setlisten/[id]/druck/page.tsx` (Datenbeschaffung ersetzen)
- Test: `tests/queries.test.ts`

**Interfaces:**
- Produces: `getSetlistPrintData(setlistId: number): Promise<SetlistPrintData | null>` und die
  Typen `SetlistPrintItem`, `SetlistPrintData` (beide aus `lib/queries.ts` exportiert). `null`,
  wenn die Setlist unbekannt oder gelöscht ist.
  ```ts
  export type SetlistPrintItem = {
    id: number;
    kind: "song" | "section" | "break";
    label: string | null;
    breakSeconds: number | null;
    note: string | null;
    title: string | null;
    artist: string | null;
    songKey: string | null;
    capo: number | null;
    tempoBpm: number | null;
    durationSeconds: number | null;
  };

  export type SetlistPrintData = {
    setlist: Setlist;
    items: SetlistPrintItem[];
    structure: SetlistStructure;
    cmp: { diffSeconds: number; over: boolean } | null;
    sectionSummaries: Map<number, { songCount: number; seconds: number }>;
  };
  ```

- [ ] **Step 1: Failing Test schreiben**

Öffne `tests/queries.test.ts`. Ergänze den Import um `getSetlistPrintData` und füge am Ende
der Datei (nach dem `describe("fetchEvents", ...)`-Block) einen neuen Block hinzu. Die
Test-Setlist wird bewusst **nicht** über die geteilte `f`-Fixture angelegt (die zählt in
anderen Tests exakt 2 Songs für `f.setlists.setliste` — das darf nicht verändert werden),
sondern direkt im Test:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  fetchSongList,
  fetchSongDetail,
  fetchSetlists,
  fetchEvents,
  getSetlistPrintData,
} from "@/lib/queries";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs } from "@/lib/db/schema";
import { anlegen, isoTag } from "./helpers/fixtures";
```

```ts
describe("getSetlistPrintData", () => {
  it("liefert null für eine unbekannte Setliste", async () => {
    expect(await getSetlistPrintData(999_999)).toBeNull();
  });

  it("fasst Sets, Pausen und Zielzeit-Abgleich zusammen", async () => {
    const [sl] = await db
      .insert(setlists)
      .values({ name: "Testabend", targetSeconds: 500 })
      .returning();

    const [songA] = await db
      .insert(songs)
      .values({
        title: "Opener",
        artist: "Testband",
        status: "repertoire",
        songKey: "G",
        capo: 2,
        tempoBpm: 100,
        durationSeconds: 200,
      })
      .returning();
    const [songB] = await db
      .insert(songs)
      .values({ title: "Rausschmeißer", status: "repertoire", songKey: "D", durationSeconds: 220 })
      .returning();

    await db.insert(setlistItems).values([
      { setlistId: sl.id, kind: "section", label: "Set 1", position: 1 },
      { setlistId: sl.id, kind: "song", songId: songA.id, position: 2, note: "Intro leise" },
      { setlistId: sl.id, kind: "break", breakSeconds: 600, label: "Umbau", position: 3 },
      { setlistId: sl.id, kind: "section", label: "Set 2", position: 4 },
      { setlistId: sl.id, kind: "song", songId: songB.id, position: 5 },
    ]);

    const data = await getSetlistPrintData(sl.id);
    expect(data).not.toBeNull();
    expect(data!.setlist.name).toBe("Testabend");
    expect(data!.items.map((i) => i.kind)).toEqual(["section", "song", "break", "section", "song"]);
    expect(data!.structure.musicSeconds).toBe(420);
    expect(data!.structure.breakSeconds).toBe(600);
    expect(data!.structure.totalSeconds).toBe(1020);
    expect(data!.cmp).toEqual({ diffSeconds: 520, over: true });

    const set1 = data!.items.find((i) => i.label === "Set 1")!;
    const set2 = data!.items.find((i) => i.label === "Set 2")!;
    expect(data!.sectionSummaries.get(set1.id)).toEqual({ songCount: 1, seconds: 200 });
    expect(data!.sectionSummaries.get(set2.id)).toEqual({ songCount: 1, seconds: 220 });
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run tests/queries.test.ts`
Expected: FAIL — `getSetlistPrintData` ist kein Export von `@/lib/queries`.

- [ ] **Step 3: `getSetlistPrintData()` in `lib/queries.ts` implementieren**

`setlistItems`, `Setlist`, `asc`, `songAktiv`/`setlistAktiv` sind in `lib/queries.ts` bereits
importiert. Ergänze nur den neuen Import für die Zusammenfassungs-Logik, direkt unter dem
bestehenden Import-Block:

```ts
import { summarizeSetlist, compareTarget, type SetlistStructure } from "@/lib/setlist-structure";
```

Füge direkt nach `fetchSetlists()` (nach der schließenden `}` von dessen Funktionskörper) ein:

```ts
export type SetlistPrintItem = {
  id: number;
  kind: "song" | "section" | "break";
  label: string | null;
  breakSeconds: number | null;
  note: string | null;
  title: string | null;
  artist: string | null;
  songKey: string | null;
  capo: number | null;
  tempoBpm: number | null;
  durationSeconds: number | null;
};

export type SetlistPrintData = {
  setlist: Setlist;
  items: SetlistPrintItem[];
  structure: SetlistStructure;
  cmp: { diffSeconds: number; over: boolean } | null;
  sectionSummaries: Map<number, { songCount: number; seconds: number }>;
};

/** Daten für beide Druckansichten (voll & kompakt) einer Setliste. null, wenn unbekannt/gelöscht. */
export async function getSetlistPrintData(setlistId: number): Promise<SetlistPrintData | null> {
  const setlist = await db.query.setlists.findFirst({
    where: and(eq(setlists.id, setlistId), setlistAktiv),
  });
  if (!setlist) return null;

  const items = await db
    .select({
      id: setlistItems.id,
      kind: setlistItems.kind,
      label: setlistItems.label,
      breakSeconds: setlistItems.breakSeconds,
      note: setlistItems.note,
      title: songs.title,
      artist: songs.artist,
      songKey: songs.songKey,
      capo: songs.capo,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
    })
    .from(setlistItems)
    .leftJoin(songs, eq(setlistItems.songId, songs.id))
    .where(and(eq(setlistItems.setlistId, setlistId), songAktiv))
    .orderBy(asc(setlistItems.position));

  const structure = summarizeSetlist(
    items.map((i) => ({
      kind: i.kind,
      label: i.label,
      durationSeconds: i.durationSeconds,
      breakSeconds: i.breakSeconds,
    }))
  );
  const cmp = compareTarget(structure.totalSeconds, setlist.targetSeconds);

  const sectionSummaries = new Map<number, { songCount: number; seconds: number }>();
  {
    let songCount = 0;
    let seconds = 0;
    let curId: number | null = null;
    const flush = () => {
      if (curId != null) sectionSummaries.set(curId, { songCount, seconds });
    };
    for (const it of items) {
      if (it.kind === "section") {
        flush();
        curId = it.id;
        songCount = 0;
        seconds = 0;
      } else if (it.kind === "song") {
        songCount += 1;
        seconds += it.durationSeconds ?? 0;
      }
    }
    flush();
  }

  return { setlist, items, structure, cmp, sectionSummaries };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `npx vitest run tests/queries.test.ts`
Expected: PASS (alle Tests der Datei, inkl. der neuen `getSetlistPrintData`-Tests)

- [ ] **Step 5: `druck/page.tsx` auf die geteilte Funktion umstellen**

Ersetze den kompletten Dateiinhalt von `app/(app)/setlisten/[id]/druck/page.tsx` durch:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSetlistPrintData } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/format";
import { PrintButton } from "@/components/setlist-forms";

export const metadata = { title: "Druckansicht" };

export default async function SetlistDruckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const setlistId = Number(id);

  const data = await getSetlistPrintData(setlistId);
  if (!data) notFound();
  const { setlist, items, structure, cmp, sectionSummaries } = data;

  return (
    <div>
      <div className="print-hidden mb-6 flex items-center justify-between gap-4">
        <Link href={`/setlisten/${setlistId}`} className="text-sm text-mute hover:text-ink">
          ← Zurück zur Setliste
        </Link>
        <PrintButton />
      </div>

      {/* Weißes „Blatt" — am Bildschirm Vorschau, beim Druck die Seite selbst */}
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-10 text-neutral-900 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-neutral-900 pb-4">
          <h1 className="text-3xl font-bold tracking-tight">{setlist.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {setlist.eventDate ? formatDate(setlist.eventDate) : ""}
            {setlist.notes ? ` · ${setlist.notes}` : ""}
          </p>
        </header>

        <table className="mt-6 w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-300 text-xs uppercase tracking-wider text-neutral-500">
              <th className="w-8 py-2 pr-2">#</th>
              <th className="py-2 pr-4">Song</th>
              <th className="w-20 py-2 pr-4">Tonart</th>
              <th className="w-16 py-2 pr-4">Capo</th>
              <th className="w-24 py-2 pr-4">Tempo</th>
              <th className="w-16 py-2">Dauer</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let n = 0;
              return items.map((item) => {
                if (item.kind === "section") {
                  n = 0;
                  const sum = sectionSummaries.get(item.id);
                  return (
                    <tr key={item.id} className="border-b-2 border-neutral-300">
                      <td colSpan={6} className="pt-5 pb-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-bold uppercase tracking-wide">
                            {item.label ?? "Set"}
                          </span>
                          {sum && (
                            <span className="font-mono text-xs text-neutral-500">
                              {sum.songCount} Songs · {formatDuration(sum.seconds)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (item.kind === "break") {
                  const m = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
                  return (
                    <tr key={item.id}>
                      <td
                        colSpan={6}
                        className="py-2 text-center text-xs italic text-neutral-500"
                      >
                        — Pause ({m} min){item.label ? `: ${item.label}` : ""} —
                      </td>
                    </tr>
                  );
                }
                n += 1;
                return (
                  <tr key={item.id} className="border-b border-neutral-200">
                    <td className="py-2.5 pr-2 font-mono text-sm text-neutral-400">{n}</td>
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold leading-tight">{item.title}</p>
                      <p className="text-xs text-neutral-500">
                        {item.artist ?? ""}
                        {item.note ? (
                          <span className="font-semibold text-neutral-700">
                            {item.artist ? " — " : ""}
                            {item.note}
                          </span>
                        ) : null}
                      </p>
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-sm">{item.songKey ?? "–"}</td>
                    <td className="py-2.5 pr-4 font-mono text-sm">{item.capo ?? "–"}</td>
                    <td className="py-2.5 pr-4 font-mono text-sm">
                      {item.tempoBpm ? `${item.tempoBpm} BPM` : "–"}
                    </td>
                    <td className="py-2.5 font-mono text-sm">
                      {formatDuration(item.durationSeconds)}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          <tfoot className="border-t-2 border-neutral-900">
            <tr>
              <td colSpan={4} />
              <td className="py-2 pr-4 text-right text-sm font-semibold">Musik</td>
              <td className="py-2 font-mono text-sm">
                {formatDuration(structure.musicSeconds)}
              </td>
            </tr>
            {structure.breakSeconds > 0 && (
              <>
                <tr>
                  <td colSpan={4} />
                  <td className="py-1 pr-4 text-right text-sm font-semibold">Pausen</td>
                  <td className="py-1 font-mono text-sm">
                    {formatDuration(structure.breakSeconds)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} />
                  <td className="py-1 pr-4 text-right text-sm font-bold">Gesamt</td>
                  <td className="py-1 font-mono text-sm font-bold">
                    {formatDuration(structure.totalSeconds)}
                  </td>
                </tr>
              </>
            )}
            {cmp && (
              <tr>
                <td colSpan={4} />
                <td className="py-1 pr-4 text-right text-sm font-semibold">
                  Ziel {formatDuration(setlist.targetSeconds!)}
                </td>
                <td className="py-1 font-mono text-sm">
                  {formatDuration(cmp.diffSeconds)} {cmp.over ? "über" : "unter"}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

Das ist eine reine Refaktorierung — Ausgabe bleibt identisch zu vorher.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 7: Browser-Check der unveränderten Vollansicht**

Dev-Server `bandmate-dev` starten (falls nicht schon aktiv), `/setlisten/<id>/druck` für eine
bestehende Setliste mit mindestens einem Set, einer Pause und einer Zielzeit öffnen. Prüfen:
Tabelle, Set-Summen, Fußzeile (Musik/Pausen/Gesamt/Ziel) sehen exakt wie vor der Änderung aus.

- [ ] **Step 8: Commit**

```bash
git add lib/queries.ts tests/queries.test.ts "app/(app)/setlisten/[id]/druck/page.tsx"
git commit -m "refactor: Setlisten-Druckdaten in getSetlistPrintData() extrahieren"
```

---

### Task 2: Kompakte Druckansicht (`/druck-kompakt`)

**Files:**
- Create: `app/(app)/setlisten/[id]/druck-kompakt/page.tsx`

**Interfaces:**
- Consumes: `getSetlistPrintData(setlistId: number): Promise<SetlistPrintData | null>` aus
  `lib/queries.ts` (Task 1). `PrintButton` aus `components/setlist-forms.tsx`.

- [ ] **Step 1: Seite anlegen**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSetlistPrintData } from "@/lib/queries";
import { formatDate, formatDuration } from "@/lib/format";
import { PrintButton } from "@/components/setlist-forms";

export const metadata = { title: "Druckansicht (kompakt)" };

export default async function SetlistDruckKompaktPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const setlistId = Number(id);

  const data = await getSetlistPrintData(setlistId);
  if (!data) notFound();
  const { setlist, items, structure, cmp, sectionSummaries } = data;

  return (
    <div>
      <div className="print-hidden mb-6 flex items-center justify-between gap-4">
        <Link href={`/setlisten/${setlistId}`} className="text-sm text-mute hover:text-ink">
          ← Zurück zur Setliste
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-3xl rounded-xl bg-white p-10 text-neutral-900 shadow-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-neutral-900 pb-3">
          <h1 className="text-2xl font-bold tracking-tight">{setlist.name}</h1>
          <p className="mt-1 text-xs text-neutral-500">
            {setlist.eventDate ? formatDate(setlist.eventDate) : ""}
            {setlist.notes ? ` · ${setlist.notes}` : ""}
          </p>
        </header>

        <table className="mt-4 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-300 uppercase tracking-wider text-neutral-500">
              <th className="w-6 py-1 pr-2">#</th>
              <th className="py-1 pr-4">Song</th>
              <th className="w-16 py-1 pr-4">Tonart</th>
              <th className="w-20 py-1">Tempo</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let n = 0;
              return items.map((item) => {
                if (item.kind === "section") {
                  n = 0;
                  const sum = sectionSummaries.get(item.id);
                  return (
                    <tr key={item.id} className="border-b-2 border-neutral-300">
                      <td colSpan={4} className="pt-3 pb-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide">
                            {item.label ?? "Set"}
                          </span>
                          {sum && (
                            <span className="font-mono text-[10px] text-neutral-500">
                              {sum.songCount} Songs · {formatDuration(sum.seconds)}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }
                if (item.kind === "break") {
                  const m = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
                  return (
                    <tr key={item.id}>
                      <td colSpan={4} className="py-1 text-center italic text-neutral-500">
                        — Pause ({m} min){item.label ? `: ${item.label}` : ""} —
                      </td>
                    </tr>
                  );
                }
                n += 1;
                return (
                  <tr key={item.id} className="border-b border-neutral-200">
                    <td className="py-1 pr-2 font-mono text-neutral-400">{n}</td>
                    <td className="py-1 pr-4">
                      <span className="font-semibold">{item.title}</span>
                      {item.note ? (
                        <span className="text-neutral-500"> — {item.note}</span>
                      ) : null}
                    </td>
                    <td className="py-1 pr-4 font-mono">{item.songKey ?? "–"}</td>
                    <td className="py-1 font-mono">
                      {item.tempoBpm ? `${item.tempoBpm} BPM` : "–"}
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
          <tfoot className="border-t-2 border-neutral-900">
            <tr>
              <td colSpan={2} />
              <td className="py-1 pr-4 text-right font-semibold">Musik</td>
              <td className="py-1 font-mono">{formatDuration(structure.musicSeconds)}</td>
            </tr>
            {structure.breakSeconds > 0 && (
              <>
                <tr>
                  <td colSpan={2} />
                  <td className="py-1 pr-4 text-right font-semibold">Pausen</td>
                  <td className="py-1 font-mono">{formatDuration(structure.breakSeconds)}</td>
                </tr>
                <tr>
                  <td colSpan={2} />
                  <td className="py-1 pr-4 text-right font-bold">Gesamt</td>
                  <td className="py-1 font-mono font-bold">
                    {formatDuration(structure.totalSeconds)}
                  </td>
                </tr>
              </>
            )}
            {cmp && (
              <tr>
                <td colSpan={2} />
                <td className="py-1 pr-4 text-right font-semibold">
                  Ziel {formatDuration(setlist.targetSeconds!)}
                </td>
                <td className="py-1 font-mono">
                  {formatDuration(cmp.diffSeconds)} {cmp.over ? "über" : "unter"}
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 3: Browser-Check**

`/setlisten/<id>/druck-kompakt` direkt aufrufen (noch nicht verlinkt — Task 3 verlinkt sie).
Prüfen an einer Setliste mit ≥1 Set-Überschrift, ≥1 Pause und Zielzeit: nur die Spalten #,
Song (Titel + Notiz), Tonart, Tempo sind sichtbar — kein Interpret, kein Capo, keine Dauer pro
Song. Set-Summen und Fußzeile (Musik/Pausen/Gesamt/Ziel) stimmen mit der Vollansicht überein.
Zeilen wirken sichtbar enger/kompakter als in `/druck`. Druckvorschau des Browsers öffnen und
Seitenumbruch/Lesbarkeit kontrollieren.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/setlisten/[id]/druck-kompakt/page.tsx"
git commit -m "feat: kompakte Druckansicht für Setlisten"
```

---

### Task 3: Umschalter zwischen Vollständig und Kompakt

**Files:**
- Modify: `components/setlist-forms.tsx` (neue Komponente `PrintViewSwitcher`)
- Modify: `app/(app)/setlisten/[id]/druck/page.tsx` (Switcher einbauen)
- Modify: `app/(app)/setlisten/[id]/druck-kompakt/page.tsx` (Switcher einbauen)

**Interfaces:**
- Consumes: nichts Neues aus vorherigen Tasks außer den bestehenden Seiten.
- Produces: `PrintViewSwitcher({ setlistId, active }: { setlistId: number; active: "voll" | "kompakt" })`
  — exportierte Client-Komponente aus `components/setlist-forms.tsx`, rendert zwei Links zu
  `/setlisten/${setlistId}/druck` bzw. `/setlisten/${setlistId}/druck-kompakt`.

- [ ] **Step 1: `PrintViewSwitcher` in `components/setlist-forms.tsx` ergänzen**

Füge oben bei den Imports `Link` hinzu (noch nicht importiert in dieser Datei):

```tsx
import Link from "next/link";
```

Füge nach `PrintButton()` (am Dateiende) ein:

```tsx
export function PrintViewSwitcher({
  setlistId,
  active,
}: {
  setlistId: number;
  active: "voll" | "kompakt";
}) {
  const tabs = [
    { key: "voll" as const, label: "Vollständig", href: `/setlisten/${setlistId}/druck` },
    { key: "kompakt" as const, label: "Kompakt", href: `/setlisten/${setlistId}/druck-kompakt` },
  ];
  return (
    <div className="inline-flex rounded-full border border-line bg-raise p-0.5 text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? "rounded-full bg-accent px-3 py-1 font-semibold text-[#1a1508]"
              : "rounded-full px-3 py-1 text-mute transition hover:text-ink"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: In der Vollansicht einbauen**

In `app/(app)/setlisten/[id]/druck/page.tsx`: Import von `PrintButton` erweitern zu

```tsx
import { PrintButton, PrintViewSwitcher } from "@/components/setlist-forms";
```

und die Toolbar-`<div>` ersetzen:

```tsx
      <div className="print-hidden mb-6 flex items-center justify-between gap-4">
        <Link href={`/setlisten/${setlistId}`} className="text-sm text-mute hover:text-ink">
          ← Zurück zur Setliste
        </Link>
        <div className="flex items-center gap-3">
          <PrintViewSwitcher setlistId={setlistId} active="voll" />
          <PrintButton />
        </div>
      </div>
```

- [ ] **Step 3: In der Kompaktansicht einbauen**

In `app/(app)/setlisten/[id]/druck-kompakt/page.tsx`: gleicher Import-Wechsel wie Step 2, und
Toolbar ersetzen:

```tsx
      <div className="print-hidden mb-6 flex items-center justify-between gap-4">
        <Link href={`/setlisten/${setlistId}`} className="text-sm text-mute hover:text-ink">
          ← Zurück zur Setliste
        </Link>
        <div className="flex items-center gap-3">
          <PrintViewSwitcher setlistId={setlistId} active="kompakt" />
          <PrintButton />
        </div>
      </div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: keine Fehler

- [ ] **Step 5: Production-Build**

Run: `npm run build`
Expected: Build erfolgreich, beide Routen (`druck`, `druck-kompakt`) werden gelistet

- [ ] **Step 6: Voller Browser-Durchlauf**

Dev-Server `bandmate-dev`, Setliste mit mehreren Sets, ≥1 Pause, Zielzeit und ≥15 Songs (zur
Not testweise Songs anlegen/duplizieren — echte Daten in `data/` dabei nicht löschen/verändern):

1. Setlisten-Detailseite: nur **ein** „Druckansicht"-Button vorhanden (führt zu `/druck`).
2. `/druck` öffnen: Umschalter zeigt „Vollständig" aktiv, „Kompakt" daneben.
3. Auf „Kompakt" klicken → navigiert zu `/druck-kompakt`, Umschalter zeigt jetzt „Kompakt"
   aktiv.
4. Auf „Vollständig" klicken → zurück zu `/druck`.
5. In beiden Ansichten „Drucken / PDF" klicken → Browser-Druckdialog zeigt in beiden Fällen
   nur das weiße Blatt (Toolbar inkl. Umschalter ist ausgeblendet, `print-hidden` greift
   weiterhin), Seitenumbruch bei der kompakten Ansicht lässt sichtbar mehr Songs auf Seite 1.

- [ ] **Step 7: Commit**

```bash
git add components/setlist-forms.tsx "app/(app)/setlisten/[id]/druck/page.tsx" "app/(app)/setlisten/[id]/druck-kompakt/page.tsx"
git commit -m "feat: Umschalter zwischen voller und kompakter Druckansicht"
```
