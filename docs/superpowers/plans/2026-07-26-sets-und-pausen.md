# Sets & Pausen in Setlisten — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setlisten um benannte Sets, Pausen (Dauer + Label), Zwischensummen und einen Zielzeit-Abgleich erweitern.

**Architecture:** Ein `kind`-Feld in `setlist_items` (song/section/break) in einer geordneten Liste; `songId` wird nullable. Zwischensummen und Zielzeit-Abgleich über eine reine, getestete Funktion `lib/setlist-structure.ts`. Editor und Druck bilden die drei Typen ab.

**Tech Stack:** Next.js App Router + TypeScript, Drizzle + better-sqlite3, @dnd-kit, Tailwind v4, Vitest.

## Global Constraints

- UI-Sprache Deutsch; Styling über `.card .btn .input .label .badge` aus `globals.css`.
- Nach Mutationen `revalidatePath` (bestehendes Muster in den Actions).
- Commits deutsch, ein Feature-Block pro Commit; Trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Datensicherheit hat Vorrang:** `data/` nie löschen/überschreiben; die `songId`-Nullability erzwingt einen Tabellen-Rebuild — Backup + Verifikation gegen eine DB-Kopie sind Pflicht (Task 1).
- Keine Emoji in neuer Druck-Ausgabe (Blatt-Klarheit).

---

### Task 1: Schema + Migration (verifiziert, kein Datenverlust)

**Files:**
- Modify: `lib/db/schema.ts` (`setlistItems`, `setlists`)
- Modify: `app/(app)/setlisten/[id]/page.tsx` (Query leftJoin + Typ), `app/(app)/setlisten/[id]/druck/page.tsx` (Query leftJoin)
- Modify: `components/setlist-editor.tsx` (`EditorItem`-Typ + kind-Guard, damit es kompiliert)
- Create: neue Datei unter `drizzle/`

**Interfaces:**
- Produces: `SetlistItem` mit `kind`, `label`, `breakSeconds`, nullable `songId`; `Setlist` mit `targetSeconds`.

- [ ] **Step 1: Sicherstellen, dass kein Dev-Server läuft (sonst Auto-Migration der echten DB)**

Run: `pgrep -fl "next dev" || echo "kein next dev"`
Falls einer läuft: stoppen (Preview-Server über das Preview-Tool stoppen bzw. den Prozess beenden). Erst weiter, wenn nichts mehr läuft.

- [ ] **Step 2: Backup ziehen (Pflicht vor dem Rebuild)**

Run: `./scripts/backup.sh --label pre-sets-pausen`
Expected: „integrity=ok", neuer Lauf angelegt.

- [ ] **Step 3: Schema ändern**

In `lib/db/schema.ts`, `setlistItems` ersetzen durch:

```ts
export const setlistItems = sqliteTable("setlist_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  // Bei kind "section"/"break" ist songId null.
  songId: integer("song_id").references(() => songs.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["song", "section", "break"] })
    .notNull()
    .default("song"),
  label: text("label"), // Set-Name (section) bzw. Pausentext (break)
  breakSeconds: integer("break_seconds"), // Pausendauer (break)
  position: integer("position").notNull(),
  note: text("note"),
});
```

In `setlists` nach `notes` einfügen:

```ts
  targetSeconds: integer("target_seconds"), // Zielzeit / gebuchte Spielzeit
```

- [ ] **Step 4: Migration generieren**

Run: `npm run db:generate`
Expected: Neue Migration unter `drizzle/`.

- [ ] **Step 5: Migration Zeile für Zeile prüfen (kritisch)**

Run: `cat drizzle/0008_*.sql` (bzw. die eben erzeugte Datei)
Prüfen (alle müssen zutreffen):
- Für `setlist_items` ein Rebuild: `CREATE TABLE __new_setlist_items …`, dann
  `INSERT INTO __new_setlist_items(...) SELECT ... FROM setlist_items;` — die
  bestehenden Spalten `id, setlist_id, song_id, position, note` werden **kopiert**.
- `DROP TABLE setlist_items` steht **nach** dem INSERT, gefolgt von
  `ALTER TABLE __new_setlist_items RENAME TO setlist_items`.
- Die FK auf `setlists`/`songs` sind in der neuen Tabelle vorhanden.
- `setlists` und die drei neuen `setlist_items`-Spalten sind additiv (`ADD COLUMN`).
- Kein unerwartetes `DROP` ohne vorherige Kopie.
Wenn irgendetwas davon fehlt: **stoppen und melden**, nicht anwenden.

- [ ] **Step 6: Migration gegen eine Kopie der echten DB testen**

```bash
rm -rf /tmp/sltest && mkdir -p /tmp/sltest && cp data/band.db /tmp/sltest/band.db
node -e 'const d=require("better-sqlite3")("/tmp/sltest/band.db",{readonly:true});console.log("VORHER items",d.prepare("select count(*) c from setlist_items").get().c,"setlists",d.prepare("select count(*) c from setlists").get().c);'
DATA_DIR=/tmp/sltest npx tsx -e 'import("./lib/db/index.ts").then(()=>{console.log("migrated");process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})'
node -e 'const d=require("better-sqlite3")("/tmp/sltest/band.db",{readonly:true});console.log("NACHHER items",d.prepare("select count(*) c from setlist_items").get().c,"setlists",d.prepare("select count(*) c from setlists").get().c);console.log("integrity",d.prepare("PRAGMA integrity_check").get().integrity_check);console.log("cols",d.prepare("PRAGMA table_info(setlist_items)").all().map(c=>c.name).join(","));'
```
Expected: **items- und setlists-Zeilenzahl VORHER == NACHHER**, `integrity ok`, `cols`
enthält `kind,label,break_seconds` und weiterhin `song_id,position,note`. Bei Abweichung
der Zeilenzahlen: **stoppen und melden** — die echte DB wurde nicht angefasst.

- [ ] **Step 7: Query + Typen anpassen (damit tsc grün bleibt)**

In `app/(app)/setlisten/[id]/page.tsx` die Items-Query auf `leftJoin` + neue Felder:

```ts
  const rows = await db
    .select({
      id: setlistItems.id,
      kind: setlistItems.kind,
      songId: setlistItems.songId,
      label: setlistItems.label,
      breakSeconds: setlistItems.breakSeconds,
      note: setlistItems.note,
      title: songs.title,
      artist: songs.artist,
      songKey: songs.songKey,
      tempoBpm: songs.tempoBpm,
      durationSeconds: songs.durationSeconds,
    })
    .from(setlistItems)
    .leftJoin(songs, eq(setlistItems.songId, songs.id))
    .where(and(eq(setlistItems.setlistId, setlistId), songAktiv))
    .orderBy(asc(setlistItems.position));
```

In `components/setlist-editor.tsx` den `EditorItem`-Typ ersetzen:

```ts
export type EditorItem = {
  id: number;
  kind: "song" | "section" | "break";
  songId: number | null;
  label: string | null;
  breakSeconds: number | null;
  note: string | null;
  title: string | null;
  artist: string | null;
  songKey: string | null;
  tempoBpm: number | null;
  durationSeconds: number | null;
};
```

Damit `SortableRow` kompiliert, den Inhalt in einen `kind`-Guard fassen — vorerst
Struktur-Zeilen als schlichte Zeile (volle Ausgestaltung folgt in Task 4). Ersetze den
Rückgabe-`return`-Inhalt von `SortableRow` durch:

```tsx
  if (item.kind !== "song") {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`card flex items-center gap-3 p-3 ${isDragging ? "z-10 border-accent/60 shadow-lg" : ""}`}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none px-1 text-lg text-faint hover:text-ink active:cursor-grabbing shrink-0"
          title="Ziehen zum Umsortieren"
        >
          ⠿
        </button>
        <span className="flex-1 font-semibold">
          {item.kind === "section" ? item.label ?? "Set" : `Pause${item.breakSeconds ? ` · ${Math.round(item.breakSeconds / 60)} min` : ""}`}
        </span>
        <button type="button" className="link-danger px-2 text-lg shrink-0" onClick={() => onRemove(item.id)} title="Entfernen">
          ✕
        </button>
      </div>
    );
  }
```
(unmittelbar vor dem bestehenden `return (` der Song-Zeile). Song-Felder im bestehenden
Markup mit `item.title ?? ""` bzw. `?`-Guards absichern, wo TS `null` bemängelt
(`item.songId` im `href` wird nur im Song-Zweig erreicht — unkritisch).

In `app/(app)/setlisten/[id]/druck/page.tsx` die Query analog auf `leftJoin` + `kind`,
`label`, `breakSeconds` erweitern (Struktur-Zeilen rendert Task 5; hier zunächst nur
Song-Zeilen wie bisher, `items.filter(i => i.kind === "song")` in der `map`, damit nichts
kaputtgeht).

- [ ] **Step 8: Migration auf die echte DB anwenden + prüfen**

Run: `npm run build`  (lädt `lib/db` → `migrate()` läuft auf `data/band.db`)
Dann:
```bash
node -e 'const d=require("better-sqlite3")("data/band.db",{readonly:true});console.log("items",d.prepare("select count(*) c from setlist_items").get().c,"integrity",d.prepare("PRAGMA integrity_check").get().integrity_check,"cols",d.prepare("PRAGMA table_info(setlist_items)").all().map(c=>c.name).join(","));'
```
Expected: Build exit 0; `integrity ok`; `setlist_items`-Zeilenzahl unverändert gegenüber
dem Backup-Manifest; `cols` enthält `kind,label,break_seconds`.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: Exit 0.

- [ ] **Step 10: Commit**

```bash
git add lib/db/schema.ts drizzle/ "app/(app)/setlisten/[id]/page.tsx" "app/(app)/setlisten/[id]/druck/page.tsx" components/setlist-editor.tsx
git commit -m "$(cat <<'EOF'
feat(setlisten): Schema für Sets & Pausen (kind, label, Pausendauer, Zielzeit)

setlist_items bekommt kind/label/break_seconds, song_id wird nullable
(Tabellen-Rebuild, gegen DB-Kopie verifiziert: Zeilenzahlen identisch,
integrity ok). setlists bekommt target_seconds. Queries auf leftJoin.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `lib/setlist-structure.ts` (reine Logik, TDD)

**Files:**
- Create: `lib/setlist-structure.ts`, `tests/setlist-structure.test.ts`

**Interfaces:**
- Produces: `summarizeSetlist(items)`, `compareTarget(total, target)`, Typen `StructureItem`, `SetSummary`, `SetlistStructure`.

- [ ] **Step 1: Failing tests schreiben**

Create `tests/setlist-structure.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeSetlist, compareTarget } from "@/lib/setlist-structure";

const song = (durationSeconds: number | null) =>
  ({ kind: "song" as const, label: null, durationSeconds, breakSeconds: null });
const section = (label: string) =>
  ({ kind: "section" as const, label, durationSeconds: null, breakSeconds: null });
const pause = (breakSeconds: number) =>
  ({ kind: "break" as const, label: null, durationSeconds: null, breakSeconds });

describe("summarizeSetlist", () => {
  it("liefert für eine leere Liste Nullwerte", () => {
    expect(summarizeSetlist([])).toEqual({
      sets: [],
      musicSeconds: 0,
      breakSeconds: 0,
      totalSeconds: 0,
    });
  });

  it("gruppiert Songs ohne Überschrift in ein Segment mit label null", () => {
    const r = summarizeSetlist([song(60), song(120)]);
    expect(r.sets).toEqual([{ label: null, songCount: 2, seconds: 180 }]);
    expect(r.musicSeconds).toBe(180);
    expect(r.totalSeconds).toBe(180);
  });

  it("beginnt bei einer Überschrift ein neues, benanntes Set", () => {
    const r = summarizeSetlist([section("Warmup"), song(60), section("Hauptset"), song(90), song(30)]);
    expect(r.sets).toEqual([
      { label: "Warmup", songCount: 1, seconds: 60 },
      { label: "Hauptset", songCount: 2, seconds: 120 },
    ]);
  });

  it("zählt Pausen in breakSeconds, nicht in ein Set", () => {
    const r = summarizeSetlist([song(60), pause(1200), song(120)]);
    expect(r.sets).toEqual([{ label: null, songCount: 2, seconds: 180 }]);
    expect(r.breakSeconds).toBe(1200);
    expect(r.totalSeconds).toBe(1380);
  });

  it("verwirft ein führendes leeres Segment, behält ein benanntes leeres Set", () => {
    const r = summarizeSetlist([section("Leeres Set")]);
    expect(r.sets).toEqual([{ label: "Leeres Set", songCount: 0, seconds: 0 }]);
  });

  it("behandelt Songs ohne Dauer als 0", () => {
    const r = summarizeSetlist([song(null), song(60)]);
    expect(r.musicSeconds).toBe(60);
    expect(r.sets[0].songCount).toBe(2);
  });
});

describe("compareTarget", () => {
  it("gibt ohne Zielzeit null zurück", () => {
    expect(compareTarget(1000, null)).toBeNull();
  });
  it("meldet under, wenn programmiert unter Ziel liegt", () => {
    expect(compareTarget(4680, 5400)).toEqual({ diffSeconds: 720, over: false });
  });
  it("meldet over, wenn programmiert über Ziel liegt", () => {
    expect(compareTarget(5880, 5400)).toEqual({ diffSeconds: 480, over: true });
  });
  it("meldet bei exakter Übereinstimmung 0 und over=false", () => {
    expect(compareTarget(5400, 5400)).toEqual({ diffSeconds: 0, over: false });
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- tests/setlist-structure.test.ts`
Expected: FAIL (Modul/Funktionen fehlen).

- [ ] **Step 3: Implementieren**

Create `lib/setlist-structure.ts`:

```ts
export type StructureItem = {
  kind: "song" | "section" | "break";
  label: string | null;
  durationSeconds: number | null;
  breakSeconds: number | null;
};

export type SetSummary = { label: string | null; songCount: number; seconds: number };

export type SetlistStructure = {
  sets: SetSummary[];
  musicSeconds: number;
  breakSeconds: number;
  totalSeconds: number;
};

/**
 * Fasst eine geordnete Setlisten-Liste zu Sets (Segmente zwischen Überschriften),
 * Musik-, Pausen- und Gesamtzeit zusammen. Pausen splitten kein Set.
 */
export function summarizeSetlist(items: StructureItem[]): SetlistStructure {
  const sets: SetSummary[] = [];
  let cur: SetSummary = { label: null, songCount: 0, seconds: 0 };
  let musicSeconds = 0;
  let breakSeconds = 0;

  for (const item of items) {
    if (item.kind === "section") {
      sets.push(cur);
      cur = { label: item.label, songCount: 0, seconds: 0 };
    } else if (item.kind === "song") {
      cur.songCount += 1;
      cur.seconds += item.durationSeconds ?? 0;
      musicSeconds += item.durationSeconds ?? 0;
    } else if (item.kind === "break") {
      breakSeconds += item.breakSeconds ?? 0;
    }
  }
  sets.push(cur);

  // Führendes leeres Segment (ohne Namen, ohne Songs) verwerfen; benannte leere
  // Sets bleiben stehen.
  if (sets.length > 0 && sets[0].label === null && sets[0].songCount === 0) {
    sets.shift();
  }

  return { sets, musicSeconds, breakSeconds, totalSeconds: musicSeconds + breakSeconds };
}

/** Differenz zur Zielzeit; null ohne Zielzeit. over=true, wenn programmiert > Ziel. */
export function compareTarget(
  totalSeconds: number,
  targetSeconds: number | null
): { diffSeconds: number; over: boolean } | null {
  if (targetSeconds == null) return null;
  return {
    diffSeconds: Math.abs(targetSeconds - totalSeconds),
    over: totalSeconds > targetSeconds,
  };
}
```

- [ ] **Step 4: Test grün**

Run: `npm test -- tests/setlist-structure.test.ts`
Expected: PASS (10 Tests).

- [ ] **Step 5: Commit**

```bash
git add lib/setlist-structure.ts tests/setlist-structure.test.ts
git commit -m "$(cat <<'EOF'
feat(setlisten): summarizeSetlist + compareTarget (reine Logik)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Actions + Zielzeit-Feld

**Files:**
- Modify: `lib/actions/setlists.ts`, `components/setlist-forms.tsx`

**Interfaces:**
- Produces: `addSetlistSection`, `addSetlistBreak`, `updateSetlistItemLabel`, `updateSetlistBreakSeconds`; `createSetlist`/`updateSetlist` lesen `targetSeconds`.

- [ ] **Step 1: Actions ergänzen**

In `lib/actions/setlists.ts` importieren (falls nicht vorhanden): `setlistItems` ist schon importiert. Neue Actions anhängen und `addSongToSetlist` um `kind` ergänzen. Eine Positions-Hilfe (max+1) existiert im Muster von `addSongToSetlist` — analog nutzen:

```ts
async function nextPosition(setlistId: number): Promise<number> {
  const [row] = await db
    .select({ maxPos: max(setlistItems.position) })
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId));
  return (row?.maxPos ?? 0) + 1;
}

export async function addSetlistSection(setlistId: number) {
  await requireUser();
  await db.insert(setlistItems).values({
    setlistId,
    kind: "section",
    label: "Neues Set",
    position: await nextPosition(setlistId),
  });
  revalidatePath(`/setlisten/${setlistId}`);
}

export async function addSetlistBreak(setlistId: number) {
  await requireUser();
  await db.insert(setlistItems).values({
    setlistId,
    kind: "break",
    breakSeconds: 15 * 60,
    position: await nextPosition(setlistId),
  });
  revalidatePath(`/setlisten/${setlistId}`);
}

export async function updateSetlistItemLabel(itemId: number, label: string) {
  await requireUser();
  const item = await db.query.setlistItems.findFirst({
    where: eq(setlistItems.id, itemId),
  });
  if (!item) return;
  await db
    .update(setlistItems)
    .set({ label: label.trim() || null })
    .where(eq(setlistItems.id, itemId));
  revalidatePath(`/setlisten/${item.setlistId}`);
}

export async function updateSetlistBreakSeconds(itemId: number, seconds: number) {
  await requireUser();
  const item = await db.query.setlistItems.findFirst({
    where: eq(setlistItems.id, itemId),
  });
  if (!item) return;
  const safe = Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : 0;
  await db
    .update(setlistItems)
    .set({ breakSeconds: safe })
    .where(eq(setlistItems.id, itemId));
  revalidatePath(`/setlisten/${item.setlistId}`);
}
```

`addSongToSetlist` in derselben Datei: beim Insert `kind: "song"` explizit setzen. Die
vorhandene lokale Positions-Logik dort kann durch `nextPosition` ersetzt werden (DRY),
muss aber nicht.

- [ ] **Step 2: `targetSeconds` in create/update lesen**

In `createSetlist` und `updateSetlist` je nach vorhandenem Body ein Feld lesen. Beispiel
`createSetlist` (analog in `updateSetlist`, dort auf `set({...})`):

```ts
  const targetRaw = String(formData.get("targetMinutes") ?? "").trim();
  const targetMin = targetRaw ? Number(targetRaw) : NaN;
  const targetSeconds = Number.isFinite(targetMin) && targetMin > 0
    ? Math.round(targetMin) * 60
    : null;
```
und `targetSeconds` in die `.values({...})` bzw. `.set({...})` aufnehmen.

- [ ] **Step 3: Zielzeit-Feld ins `SetlistForm`**

In `components/setlist-forms.tsx`, in `SetlistForm`, nach dem Notizen-Feld einfügen (mit
`htmlFor`/`id`, Konsistenz):

```tsx
      <div>
        <label className="label" htmlFor="sl-target">Zielzeit (Minuten, optional)</label>
        <input
          id="sl-target"
          className="input"
          name="targetMinutes"
          type="number"
          inputMode="numeric"
          min="0"
          defaultValue={setlist?.targetSeconds ? Math.round(setlist.targetSeconds / 60) : ""}
          placeholder="z.B. 90"
        />
        <p className="mt-1 text-xs text-faint">Gebuchte Spielzeit für den Abgleich.</p>
      </div>
```

- [ ] **Step 4: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: Exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/setlists.ts components/setlist-forms.tsx
git commit -m "$(cat <<'EOF'
feat(setlisten): Actions für Sets/Pausen + Zielzeit-Feld

addSetlistSection/addSetlistBreak/updateSetlistItemLabel/
updateSetlistBreakSeconds; createSetlist/updateSetlist lesen targetMinutes.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Editor — drei Typen, Zwischensummen, Fuß

**Files:**
- Modify: `components/setlist-editor.tsx`

**Interfaces:**
- Consumes: `summarizeSetlist`, `compareTarget` (Task 2); `addSetlistSection`, `addSetlistBreak`, `updateSetlistItemLabel`, `updateSetlistBreakSeconds` (Task 3).
- Consumes: `targetSeconds` als Prop (aus der Detailseite, Task 5-Anpassung; hier als optionales Prop annehmen).

- [ ] **Step 1: Props + Imports erweitern**

In `components/setlist-editor.tsx`:
- Importiere `formatDuration` (vorhanden), zusätzlich `summarizeSetlist`, `compareTarget` aus `@/lib/setlist-structure` und die neuen Actions.
- `SetlistEditor`-Props um `targetSeconds?: number | null` erweitern.

- [ ] **Step 2: Struktur-Zeilen voll ausgestalten**

Die in Task 1 eingefügte schlichte Struktur-Zeile in `SortableRow` durch die editierbare
Variante ersetzen. Für `kind === "section"`: Name inline editierbar + rechts die
Zwischensumme (als Prop `summary?: { songCount: number; seconds: number }` an `SortableRow`
durchreichen). Für `kind === "break"`: Minuten-Eingabe + Label-Eingabe. Konkret die
`if (item.kind !== "song")`-Verzweigung ersetzen durch:

```tsx
  if (item.kind === "section") {
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 p-2 ${isDragging ? "z-10 shadow-lg" : ""}`}>
        <button type="button" {...attributes} {...listeners}
          className="cursor-grab touch-none px-1 text-faint hover:text-ink active:cursor-grabbing shrink-0" title="Ziehen">⠿</button>
        <input
          defaultValue={item.label ?? ""}
          onBlur={(e) => { const v = e.target.value; if (v !== (item.label ?? "")) void updateSetlistItemLabel(item.id, v); }}
          placeholder="Set-Name"
          className="input flex-1 border-none bg-transparent px-1 py-0.5 font-semibold text-accent-hi"
          aria-label="Set-Name"
        />
        {summary && (
          <span className="mono-display shrink-0 text-xs text-mute">
            {summary.songCount} {summary.songCount === 1 ? "Song" : "Songs"} · {formatDuration(summary.seconds)}
          </span>
        )}
        <button type="button" className="link-danger px-2 shrink-0" onClick={() => onRemove(item.id)} title="Set-Überschrift entfernen">✕</button>
      </div>
    );
  }
  if (item.kind === "break") {
    const minutes = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`flex items-center gap-2 rounded-lg border border-dashed border-line p-2 text-sm ${isDragging ? "z-10 shadow-lg" : ""}`}>
        <button type="button" {...attributes} {...listeners}
          className="cursor-grab touch-none px-1 text-faint hover:text-ink active:cursor-grabbing shrink-0" title="Ziehen">⠿</button>
        <span className="shrink-0 text-mute">Pause</span>
        <input type="number" min="0" defaultValue={minutes}
          onBlur={(e) => { const m = Number(e.target.value); if (m * 60 !== (item.breakSeconds ?? 0)) void updateSetlistBreakSeconds(item.id, (Number.isFinite(m) ? m : 0) * 60); }}
          className="input w-16 py-1 text-center text-xs" aria-label="Pausendauer (Minuten)" />
        <span className="shrink-0 text-faint">min</span>
        <input defaultValue={item.label ?? ""}
          onBlur={(e) => { const v = e.target.value; if (v !== (item.label ?? "")) void updateSetlistItemLabel(item.id, v); }}
          placeholder="Label (optional, z.B. Umbau)" className="input flex-1 py-1 text-xs" aria-label="Pausen-Label" />
        <button type="button" className="link-danger px-2 shrink-0" onClick={() => onRemove(item.id)} title="Pause entfernen">✕</button>
      </div>
    );
  }
```
`SortableRow`-Props um `summary?: { songCount: number; seconds: number }` erweitern. Im
Song-Zweig `item.title ?? ""` verwenden (title ist jetzt nullable).

- [ ] **Step 3: Per-Set-Nummerierung + Zwischensummen im Render**

In `SetlistEditor` vor dem `map` die Render-Infos berechnen (Song-Nummer je Set, Set-Summe
je section):

```tsx
  // Song-Nummer je Set (Reset bei jeder Überschrift) + Zwischensumme je section-Zeile.
  const structure = summarizeSetlist(
    items.map((i) => ({ kind: i.kind, label: i.label, durationSeconds: i.durationSeconds, breakSeconds: i.breakSeconds }))
  );
  const songNumbers = new Map<number, number>();
  const sectionSummaries = new Map<number, { songCount: number; seconds: number }>();
  {
    let n = 0;
    // Sets in Renderreihenfolge: summarizeSetlist verwirft ein führendes leeres
    // Segment, deshalb hier eigenständig zählen.
    let curSongCount = 0;
    let curSeconds = 0;
    let curSectionId: number | null = null;
    const flush = () => {
      if (curSectionId != null) sectionSummaries.set(curSectionId, { songCount: curSongCount, seconds: curSeconds });
    };
    for (const it of items) {
      if (it.kind === "section") {
        flush();
        curSectionId = it.id; curSongCount = 0; curSeconds = 0; n = 0;
      } else if (it.kind === "song") {
        n += 1; songNumbers.set(it.id, n);
        curSongCount += 1; curSeconds += it.durationSeconds ?? 0;
      }
    }
    flush();
  }
```
Die Song-Zeile nutzt `songNumbers.get(item.id) ?? index + 1` statt `index + 1`; der
`SortableRow`-Aufruf im `map` bekommt zusätzlich `summary={sectionSummaries.get(item.id)}`.

- [ ] **Step 4: Add-Buttons + Fuß**

Die Add-Zeile um zwei Buttons erweitern (neben „+ Hinzufügen"):

```tsx
        <button type="button" className="btn w-full sm:w-auto" onClick={() => startTransition(() => addSetlistSection(setlistId))}>+ Set-Überschrift</button>
        <button type="button" className="btn w-full sm:w-auto" onClick={() => startTransition(() => addSetlistBreak(setlistId))}>+ Pause</button>
```

Den Fuß ersetzen durch Musik/Pausen/Gesamt + Zielzeit-Abgleich:

```tsx
      {(() => {
        const cmp = compareTarget(structure.totalSeconds, targetSeconds ?? null);
        return (
          <div className="mono-display space-y-1 text-sm text-mute">
            <p>
              Musik {formatDuration(structure.musicSeconds)}
              {structure.breakSeconds > 0 && ` · Pausen ${formatDuration(structure.breakSeconds)}`}
              {structure.breakSeconds > 0 && ` · Gesamt ${formatDuration(structure.totalSeconds)}`}
            </p>
            {cmp && (
              <p className={cmp.over ? "text-red-400" : "text-emerald-400"}>
                Ziel {formatDuration(targetSeconds!)} → {formatDuration(cmp.diffSeconds)} {cmp.over ? "über" : "unter"}
              </p>
            )}
          </div>
        );
      })()}
```
Der Platzhalter des Song-Notizfelds wird von „Notiz (z.B. Pause danach)" zu
„Notiz (z.B. Solo verlängern)".

- [ ] **Step 5: `targetSeconds` von der Detailseite durchreichen**

In `app/(app)/setlisten/[id]/page.tsx` beim `<SetlistEditor …>` `targetSeconds={setlist.targetSeconds}` ergänzen.

- [ ] **Step 6: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: Exit 0.

- [ ] **Step 7: Manuell verifizieren (Browser)**

Dev-Server starten, Setliste öffnen: „+ Set-Überschrift" und „+ Pause" hinzufügen → per
Drag anordnen → Set-Name und Pausendauer editieren (Blur speichert) → Zwischensumme am Set
und Fuß (Musik/Pausen/Gesamt) stimmen → Song aus einem Set entfernen, Zwischensumme
aktualisiert sich. Screenshot als Proof.

- [ ] **Step 8: Commit**

```bash
git add components/setlist-editor.tsx "app/(app)/setlisten/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(setlisten): Editor mit Sets, Pausen, Zwischensummen und Zielzeit-Abgleich

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Druckansicht

**Files:**
- Modify: `app/(app)/setlisten/[id]/druck/page.tsx`

- [ ] **Step 1: Struktur-Zeilen + Fuß rendern**

Die Query liefert nach Task 1 bereits `kind`, `label`, `breakSeconds` (leftJoin). Den
`items.filter(...)`-Notbehelf aus Task 1 entfernen und in der `<tbody>`-`map` nach `kind`
verzweigen:
- `section`: `<tr>` mit `<td colSpan={6}>` — „SET n · Label" links, Zwischensumme rechts
  (kleine Flex-Zelle). Song-Zähler je Set zurücksetzen.
- `break`: `<tr>` mit `<td colSpan={6}>` — „— Pause (m min): Label —" (ohne Emoji).
- `song`: wie bisher, aber Nummer aus dem je-Set-Zähler.

Für Zwischensummen/Gesamt `summarizeSetlist` auf die geladenen Items anwenden (Mapping auf
`StructureItem` wie im Editor). Den `tfoot` ersetzen: statt nur „Gesamtdauer" die Zeilen
Musik / Pausen / Gesamt sowie — falls `setlist.targetSeconds` gesetzt — den
Zielzeit-Abgleich via `compareTarget`.

Konkrete `tbody`-Map (Kern):

```tsx
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
              <span className="text-sm font-bold uppercase tracking-wide">{item.label ?? "Set"}</span>
              {sum && <span className="font-mono text-xs text-neutral-500">{sum.songCount} Songs · {formatDuration(sum.seconds)}</span>}
            </div>
          </td>
        </tr>
      );
    }
    if (item.kind === "break") {
      const m = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
      return (
        <tr key={item.id}>
          <td colSpan={6} className="py-2 text-center text-xs italic text-neutral-500">
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
            {item.note ? <span className="font-semibold text-neutral-700">{item.artist ? " — " : ""}{item.note}</span> : null}
          </p>
        </td>
        <td className="py-2.5 pr-4 font-mono text-sm">{item.songKey ?? "–"}</td>
        <td className="py-2.5 pr-4 font-mono text-sm">{item.capo ?? "–"}</td>
        <td className="py-2.5 pr-4 font-mono text-sm">{item.tempoBpm ? `${item.tempoBpm} BPM` : "–"}</td>
        <td className="py-2.5 font-mono text-sm">{formatDuration(item.durationSeconds)}</td>
      </tr>
    );
  });
})()}
```
`sectionSummaries` analog zu Task 4 vor dem Return berechnen. `capo` ist bereits in der
Druck-Query enthalten; sie muss in Task 1 mit `leftJoin` ebenfalls `kind/label/breakSeconds`
selektieren (und `capo` behalten).

- [ ] **Step 2: Typecheck + Build**

Run: `npx tsc --noEmit && npm run build`
Expected: Exit 0.

- [ ] **Step 3: Manuell verifizieren (Browser)**

Druckansicht der Test-Setliste öffnen: Set-Überschriften mit Zwischensumme, Pausenzeilen,
je-Set-Nummern, Fuß mit Musik/Pausen/Gesamt + Zielzeit. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/setlisten/[id]/druck/page.tsx"
git commit -m "$(cat <<'EOF'
feat(setlisten): Druckansicht mit Sets, Pausen und Zielzeit-Fuß

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: FEATURES.md + Gesamt-Verifikation

**Files:**
- Modify: `FEATURES.md`

- [ ] **Step 1: Gesamte Suite + Build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: Neue Tests PASS, Exit 0. (Die vorbestehende, datumsabhängige
`reminders.test.ts` kann rot sein — separat verfolgt, nicht Teil dieses Häppchens.)

- [ ] **Step 2: FEATURES.md**

Den Punkt `- [ ] **Sets & Pausen in Setlisten**` in Welle 2 auf `- [x]` setzen, mit
Kurzbeschreibung (benannte Sets, Pausen mit Dauer, Zwischensummen, Zielzeit-Abgleich,
Druck) und Datum, im Stil der übrigen erledigten Einträge. Verweis auf die Spec.

- [ ] **Step 3: Commit**

```bash
git add FEATURES.md
git commit -m "$(cat <<'EOF'
docs(welle-2): Sets & Pausen als umgesetzt markiert

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Selbst-Review (gegen die Spec)

- **Spec-Abdeckung:** Schema+Migration inkl. Verifikation (T1), reine Logik summarize/compare
  (T2), Actions+Zielzeitfeld (T3), Editor mit drei Typen/Zwischensummen/Fuß (T4), Druck (T5),
  FEATURES+Verifikation (T6). Alle Spec-Abschnitte abgedeckt.
- **Datensicherheit:** T1 erzwingt Backup, Migrations-Review, Test gegen DB-Kopie mit
  Zeilenzahl-Vergleich, bevor die echte DB angefasst wird.
- **Platzhalter:** keine.
- **Typ-Konsistenz:** `StructureItem`/`SetSummary`/`SetlistStructure` einheitlich; `EditorItem`
  mit nullable Song-Feldern konsistent in Query (T1), Editor (T1/T4) und Actions;
  `targetSeconds` (DB, Sekunden) vs. `targetMinutes` (Formularfeld, Minuten) klar getrennt.
