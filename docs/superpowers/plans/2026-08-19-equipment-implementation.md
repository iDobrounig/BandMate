# Equipment-Bereich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neuer Bereich `/equipment` in BandMate: Liste + Detailansicht für gemeinsam angeschafftes Band-Equipment mit Anschaffungsdaten, Kostenbeteiligung einzelner Mitglieder (freier Betrag + Vermerk) und Foto-/Rechnungs-Upload.

**Architecture:** Neue Tabellen `equipment`, `equipment_contributions` (n:m Equipment↔User mit Betrag+Vermerk) und `equipment_attachments` (1:n, eigene Tabelle parallel zu `attachments` statt Umbau der bestehenden Songs-Attachments). CRUD über Server Actions nach dem Songs-Muster (`useActionState`, `FormState`), Datei-Auslieferung über eine eigene, zu `/api/files/[id]` parallele Route. Ins bestehende Soft-Delete-/Papierkorb-System integriert.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle ORM (SQLite/better-sqlite3), Tailwind v4 (bestehende Klassen), Vitest.

**Spec:** [docs/superpowers/specs/2026-08-19-equipment-design.md](../specs/2026-08-19-equipment-design.md)

## Global Constraints

- UI-Sprache Deutsch, neue Route `/equipment` (Liste, `/neu`, `/[id]`, `/[id]/bearbeiten`).
- CRUD über `requireUser()` — kein `requireAdmin()`-Sonderfall, wie bei Songs/Setlisten/Termine.
- Soft-Delete via `deletedAt`/`deletedById`-Paar, integriert ins bestehende Papierkorb-System (`lib/trash.ts`, `TrashKind`).
- Kein Umbau der bestehenden `attachments`-Tabelle/Songs-Codepfade — Equipment-Dateien bekommen eine eigene, parallele Tabelle `equipment_attachments`.
- Styling ausschließlich über bestehende Komponenten-Klassen (`.card .btn .btn-primary .btn-sm .input .label .badge .headline .mono-display .link-danger .btn-danger`) — keine neuen CSS-Klassen.
- Nach jeder Mutation `revalidatePath("/", "layout")`.
- `data/` nie löschen/überschreiben. Vor dem Schema-Task (Task 1) den Dev-Server stoppen oder `./scripts/backup.sh` laufen lassen — Auto-Migration beim Neuladen von `lib/db/schema.ts` (siehe AGENTS.md).
- Commits: deutsch, ein Feature-Block pro Commit.
- Verifikation: `npx tsc --noEmit` + `npm run build` + `npm test` durchgängig grün, abschließend kompletter Browser-Durchlauf. Nur reine Query-/Trash-Logik bekommt Vitest-Tests (bestehendes Projektmuster — `lib/files.ts`, Server Actions, API-Routen und UI-Komponenten haben im ganzen Projekt keine Unit-Tests und werden per Browser verifiziert).

---

## Task 1: Datenbank-Schema, Konstanten und Filter

**Files:**
- Modify: `lib/db/schema.ts`
- Modify: `lib/constants.ts`
- Modify: `lib/db/filters.ts`
- Create: `drizzle/00XX_*.sql` (generiert)

**Interfaces:**
- Produces: Drizzle-Tabellen `equipment`, `equipmentContributions`, `equipmentAttachments`; Typen `Equipment`, `EquipmentCategory`, `EquipmentStatus`, `EquipmentContribution`, `EquipmentAttachment` (alle aus `@/lib/db/schema`). Konstanten `EQUIPMENT_CATEGORY`, `EQUIPMENT_CATEGORY_ORDER`, `EQUIPMENT_STATUS`, `EQUIPMENT_STATUS_ORDER`, `EQUIPMENT_PHOTO_MAX_BYTES`, `EQUIPMENT_INVOICE_MAX_BYTES`, `EQUIPMENT_PHOTO_MIMES`, `EQUIPMENT_INVOICE_MIMES` (aus `@/lib/constants`). Filter `equipmentAktiv`, `equipmentAttachmentAktiv` (aus `@/lib/db/filters`).

- [ ] **Step 1: `equipment`-Tabelle in `lib/db/schema.ts` ergänzen**

Direkt nach der `songs`-Tabelle (nach Zeile 59, vor `songLinks`) einfügen:

```ts
export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category", {
    enum: ["amp", "mic", "cable_accessory", "pa_speaker", "light", "other"],
  })
    .notNull()
    .default("other"),
  status: text("status", {
    enum: ["in_use", "lent_out", "broken", "retired"],
  })
    .notNull()
    .default("in_use"),
  acquisitionDate: text("acquisition_date"), // ISO-Datum YYYY-MM-DD, wie events.date
  acquisitionCost: real("acquisition_cost"), // Euro
  location: text("location"),
  notes: text("notes"),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  // Papierkorb: NULL = aktiv. Siehe docs/specs/2026-07-23-papierkorb-design.md
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedById: integer("deleted_by_id").references(() => users.id),
});

export const equipmentContributions = sqliteTable(
  "equipment_contributions",
  {
    equipmentId: integer("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    amount: real("amount").notNull(), // Euro
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.equipmentId, t.userId] })]
);

export const equipmentAttachments = sqliteTable("equipment_attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  equipmentId: integer("equipment_id")
    .notNull()
    .references(() => equipment.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["foto", "rechnung"] }).notNull(),
  storedName: text("stored_name").notNull(),
  originalName: text("original_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  // Papierkorb: NULL = aktiv. Siehe docs/specs/2026-07-23-papierkorb-design.md
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  deletedById: integer("deleted_by_id").references(() => users.id),
});
```

- [ ] **Step 2: Typen am Dateiende von `lib/db/schema.ts` ergänzen**

Nach der Zeile `export type AttendanceStatus = ...` (letzte Zeile der Datei) anfügen:

```ts
export type Equipment = typeof equipment.$inferSelect;
export type EquipmentCategory = Equipment["category"];
export type EquipmentStatus = Equipment["status"];
export type EquipmentContribution = typeof equipmentContributions.$inferSelect;
export type EquipmentAttachment = typeof equipmentAttachments.$inferSelect;
```

- [ ] **Step 3: Konstanten in `lib/constants.ts` ergänzen**

Im Import-Block am Dateianfang `EquipmentCategory, EquipmentStatus` zur bestehenden Type-Import-Liste aus `@/lib/db/schema` hinzufügen. Nach dem Block `ATTENDANCE_STATUS` (vor `INSTRUMENT_SUGGESTIONS`) einfügen:

```ts
export const EQUIPMENT_CATEGORY: Record<
  EquipmentCategory,
  { label: string; badge: string }
> = {
  amp: { label: "Verstärker", badge: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  mic: { label: "Mikrofon", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  pa_speaker: { label: "Lautsprecher/PA", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  light: { label: "Licht", badge: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  cable_accessory: { label: "Kabel/Zubehör", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
  other: { label: "Sonstiges", badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

export const EQUIPMENT_CATEGORY_ORDER: EquipmentCategory[] = [
  "amp",
  "mic",
  "pa_speaker",
  "light",
  "cable_accessory",
  "other",
];

export const EQUIPMENT_STATUS: Record<
  EquipmentStatus,
  { label: string; badge: string; dot: string }
> = {
  in_use: {
    label: "In Nutzung",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  lent_out: {
    label: "Verliehen",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
  },
  broken: {
    label: "Defekt",
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
    dot: "bg-red-400",
  },
  retired: {
    label: "Ausgemustert",
    badge: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    dot: "bg-zinc-500",
  },
};

export const EQUIPMENT_STATUS_ORDER: EquipmentStatus[] = [
  "in_use",
  "lent_out",
  "broken",
  "retired",
];

export const EQUIPMENT_PHOTO_MAX_BYTES = 20 * 1024 * 1024;
export const EQUIPMENT_INVOICE_MAX_BYTES = 20 * 1024 * 1024;

export const EQUIPMENT_PHOTO_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const EQUIPMENT_INVOICE_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);
```

- [ ] **Step 4: Filter in `lib/db/filters.ts` ergänzen**

```ts
import { isNull } from "drizzle-orm";
import { songs, setlists, events, attachments, equipment, equipmentAttachments } from "@/lib/db/schema";

// … bestehende Zeilen unverändert …

export const equipmentAktiv = isNull(equipment.deletedAt);
export const equipmentAttachmentAktiv = isNull(equipmentAttachments.deletedAt);
```

- [ ] **Step 5: Migration generieren und Typecheck prüfen**

Vor diesem Schritt sicherstellen, dass der Dev-Server (`bandmate-dev`) gestoppt ist oder `./scripts/backup.sh` gelaufen ist (Global Constraints).

Run: `npm run db:generate`
Expected: Neue Datei `drizzle/00XX_*.sql` mit `CREATE TABLE` für `equipment`, `equipment_contributions`, `equipment_attachments`.

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/constants.ts lib/db/filters.ts drizzle/
git commit -m "feat: Datenmodell für Equipment-Bereich anlegen"
```

---

## Task 2: Test-Fixtures für Equipment erweitern

**Files:**
- Modify: `tests/helpers/fixtures.ts`

**Interfaces:**
- Consumes: `equipment`, `equipmentContributions`, `equipmentAttachments` aus `@/lib/db/schema` (Task 1).
- Produces: `anlegen()` liefert zusätzlich `equipment: { verstaerker, mikrofon }` — `verstaerker` hat zwei Beteiligungen (Anna 500€ mit Vermerk „Vorschuss", Bert 400€) und je einen Foto- und Rechnungs-Anhang; `mikrofon` hat keine Beteiligungen/Anhänge (bewusst asymmetrisch, wie beim Rest der Fixtures).

- [ ] **Step 1: Imports ergänzen**

Import-Block am Dateianfang um `equipment, equipmentContributions, equipmentAttachments` erweitern:

```ts
import {
  users,
  songs,
  songLinks,
  attachments,
  comments,
  votes,
  practiceStatus,
  setlists,
  setlistItems,
  events,
  eventAttendance,
  eventSongs,
  notificationSettings,
  notificationLog,
  notificationRuns,
  equipment,
  equipmentContributions,
  equipmentAttachments,
} from "@/lib/db/schema";
```

- [ ] **Step 2: `leeren()` erweitern**

Ganz am Anfang von `leeren()` (vor `notificationLog`) einfügen, da `equipment_attachments`/`equipment_contributions` per FK an `equipment` hängen und `equipment` an `users`:

```ts
export async function leeren() {
  await db.delete(equipmentAttachments);
  await db.delete(equipmentContributions);
  await db.delete(equipment);
  await db.delete(notificationLog);
  // … Rest unverändert …
```

- [ ] **Step 3: `anlegen()` erweitern**

Direkt vor dem abschließenden `return { users: ... }` einfügen:

```ts
  const [verstaerker] = await db
    .insert(equipment)
    .values({
      name: "Marshall JCM800",
      category: "amp",
      status: "in_use",
      acquisitionDate: isoTag(-200),
      acquisitionCost: 900,
      location: "Proberaum",
      createdById: anna.id,
    })
    .returning();
  const [mikrofon] = await db
    .insert(equipment)
    .values({ name: "Shure SM58", category: "mic", createdById: bert.id })
    .returning();

  await db.insert(equipmentContributions).values([
    { equipmentId: verstaerker.id, userId: anna.id, amount: 500, note: "Vorschuss" },
    { equipmentId: verstaerker.id, userId: bert.id, amount: 400 },
  ]);

  await db.insert(equipmentAttachments).values([
    {
      equipmentId: verstaerker.id,
      kind: "foto",
      storedName: "amp.jpg",
      originalName: "amp-foto.jpg",
      mime: "image/jpeg",
      size: 1000,
      uploadedById: anna.id,
    },
    {
      equipmentId: verstaerker.id,
      kind: "rechnung",
      storedName: "amp.pdf",
      originalName: "rechnung.pdf",
      mime: "application/pdf",
      size: 2000,
      uploadedById: anna.id,
    },
  ]);
```

Und die Rückgabe erweitern:

```ts
  return {
    users: { anna, bert, clara, dora },
    songs: { vorschlag, inProbe, repertoire, archiv },
    setlists: { setliste, leereSetliste },
    events: { kommenderGig, kommendeProbe, alteProbe },
    equipment: { verstaerker, mikrofon },
  };
}
```

- [ ] **Step 4: Bestehende Tests laufen lassen**

Run: `npm test`
Expected: Alle bisherigen Tests weiterhin grün (die Fixture-Erweiterung darf nichts an bestehendem Verhalten ändern).

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/fixtures.ts
git commit -m "test: Equipment-Testdaten zu den gemeinsamen Fixtures hinzufügen"
```

---

## Task 3: Queries — Equipment-Liste, -Detail und Datei-Freigabe

**Files:**
- Modify: `lib/queries.ts`
- Create: `tests/equipment.test.ts`

**Interfaces:**
- Consumes: `equipment`, `equipmentContributions`, `equipmentAttachments`, `type Equipment`, `type EquipmentAttachment` (Task 1); `equipmentAktiv`, `equipmentAttachmentAktiv` (Task 1); Fixtures aus Task 2.
- Produces: `fetchEquipmentList(): Promise<EquipmentListItem[]>`, `fetchEquipmentDetail(equipmentId: number): Promise<EquipmentDetail | null>`, `fetchServableEquipmentAttachment(attachmentId: number): Promise<EquipmentAttachment | null>` — alle aus `@/lib/queries`. Typen `EquipmentListItem`, `EquipmentDetail` (aus `@/lib/queries`).

- [ ] **Step 1: Test schreiben — `tests/equipment.test.ts`**

```ts
import { beforeAll, describe, expect, it } from "vitest";
import {
  fetchEquipmentList,
  fetchEquipmentDetail,
  fetchServableEquipmentAttachment,
} from "@/lib/queries";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
});

describe("fetchEquipmentList", () => {
  it("liefert alle aktiven Geräte mit Beteiligungssumme und Dateizählern", async () => {
    const liste = await fetchEquipmentList();
    expect(liste).toHaveLength(2);

    const verstaerker = liste.find((e) => e.id === f.equipment.verstaerker.id)!;
    expect(verstaerker.contributionTotal).toBe(900);
    expect(verstaerker.photoCount).toBe(1);
    expect(verstaerker.invoiceCount).toBe(1);

    const mikrofon = liste.find((e) => e.id === f.equipment.mikrofon.id)!;
    expect(mikrofon.contributionTotal).toBe(0);
    expect(mikrofon.photoCount).toBe(0);
    expect(mikrofon.invoiceCount).toBe(0);
  });
});

describe("fetchEquipmentDetail", () => {
  it("liefert Beteiligungen mit Namen, sortiert nach Mitglied", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id);
    expect(detail).not.toBeNull();
    expect(detail!.contributions).toHaveLength(2);
    expect(detail!.contributions.map((c) => c.userName)).toEqual([
      "Anna Admin",
      "Bert Bass",
    ]);
    expect(
      detail!.contributions.find((c) => c.userName === "Anna Admin")?.note
    ).toBe("Vorschuss");
    expect(detail!.createdByName).toBe("Anna Admin");
  });

  it("liefert nur aktive Anhänge", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id);
    expect(detail!.attachments).toHaveLength(2);
    expect(detail!.attachments.map((a) => a.kind).sort()).toEqual(["foto", "rechnung"]);
  });

  it("liefert null für unbekannte Geräte", async () => {
    expect(await fetchEquipmentDetail(999999)).toBeNull();
  });
});

describe("fetchServableEquipmentAttachment", () => {
  it("liefert den Anhang, wenn Gerät und Anhang aktiv sind", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id);
    const foto = detail!.attachments.find((a) => a.kind === "foto")!;
    const servable = await fetchServableEquipmentAttachment(foto.id);
    expect(servable?.id).toBe(foto.id);
  });

  it("liefert null für unbekannte Anhänge", async () => {
    expect(await fetchServableEquipmentAttachment(999999)).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/equipment.test.ts`
Expected: FAIL — `fetchEquipmentList`/`fetchEquipmentDetail`/`fetchServableEquipmentAttachment` existieren noch nicht in `@/lib/queries`.

- [ ] **Step 3: Imports in `lib/queries.ts` erweitern**

Den bestehenden Import-Block am Dateianfang erweitern:

```ts
import {
  songs,
  votes,
  comments,
  attachments,
  practiceStatus,
  users,
  events,
  eventSongs,
  setlists,
  setlistItems,
  equipment,
  equipmentContributions,
  equipmentAttachments,
  type Song,
  type Setlist,
  type BandEvent,
  type AttendanceStatus,
  type EventKind,
  type Equipment,
  type EquipmentAttachment,
} from "@/lib/db/schema";
import {
  songAktiv,
  setlistAktiv,
  eventAktiv,
  anhangAktiv,
  equipmentAktiv,
  equipmentAttachmentAktiv,
} from "@/lib/db/filters";
```

- [ ] **Step 4: Query-Funktionen implementieren**

Am Ende von `lib/queries.ts` anfügen:

```ts
export type EquipmentListItem = Equipment & {
  contributionTotal: number;
  photoCount: number;
  invoiceCount: number;
};

/** Equipment-Liste mit Beteiligungssumme und Datei-Zählern. */
export async function fetchEquipmentList(): Promise<EquipmentListItem[]> {
  const rows = await db
    .select({
      item: equipment,
      contributionTotal: sql<number>`coalesce((select sum(c.amount) from equipment_contributions c where c.equipment_id = equipment.id), 0)`,
      photoCount: sql<number>`(select count(*) from equipment_attachments a where a.equipment_id = equipment.id and a.kind = 'foto' and a.deleted_at is null)`,
      invoiceCount: sql<number>`(select count(*) from equipment_attachments a where a.equipment_id = equipment.id and a.kind = 'rechnung' and a.deleted_at is null)`,
    })
    .from(equipment)
    .where(equipmentAktiv)
    .orderBy(desc(equipment.createdAt));

  return rows.map((r) => ({
    ...r.item,
    contributionTotal: r.contributionTotal,
    photoCount: r.photoCount,
    invoiceCount: r.invoiceCount,
  }));
}

export type EquipmentDetail = {
  equipment: Equipment;
  contributions: { userId: number; amount: number; note: string | null; userName: string }[];
  attachments: EquipmentAttachment[];
  createdByName: string | null;
};

/** Equipment-Detail: Stammdaten, Beteiligungen mit Namen, aktive Anhänge. */
export async function fetchEquipmentDetail(equipmentId: number): Promise<EquipmentDetail | null> {
  const item = await db.query.equipment.findFirst({
    where: and(eq(equipment.id, equipmentId), equipmentAktiv),
  });
  if (!item) return null;

  const [contributions, attachmentRows, createdBy] = await Promise.all([
    db
      .select({
        userId: equipmentContributions.userId,
        amount: equipmentContributions.amount,
        note: equipmentContributions.note,
        userName: users.name,
      })
      .from(equipmentContributions)
      .innerJoin(users, eq(equipmentContributions.userId, users.id))
      .where(eq(equipmentContributions.equipmentId, equipmentId))
      .orderBy(users.name),
    db.query.equipmentAttachments.findMany({
      where: (a, { eq, and, isNull }) => and(eq(a.equipmentId, equipmentId), isNull(a.deletedAt)),
      orderBy: (a, { asc }) => [asc(a.kind), asc(a.createdAt)],
    }),
    item.createdById
      ? db.query.users.findFirst({ where: eq(users.id, item.createdById), columns: { name: true } })
      : Promise.resolve(undefined),
  ]);

  return {
    equipment: item,
    contributions,
    attachments: attachmentRows,
    createdByName: createdBy?.name ?? null,
  };
}

/**
 * Equipment-Anhang für `/api/equipment-files/[id]` — oder `null`, wenn er nicht
 * (mehr) herausgegeben werden darf. Analog `fetchServableAttachment`: prüft
 * sowohl den Anhang als auch das zugehörige Gerät auf Papierkorb-Status.
 */
export async function fetchServableEquipmentAttachment(
  attachmentId: number
): Promise<EquipmentAttachment | null> {
  const [row] = await db
    .select({ attachment: equipmentAttachments })
    .from(equipmentAttachments)
    .innerJoin(equipment, eq(equipmentAttachments.equipmentId, equipment.id))
    .where(and(eq(equipmentAttachments.id, attachmentId), equipmentAttachmentAktiv, equipmentAktiv))
    .limit(1);
  return row?.attachment ?? null;
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg prüfen**

Run: `npx vitest run tests/equipment.test.ts`
Expected: PASS (alle Tests grün).

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 6: Commit**

```bash
git add lib/queries.ts tests/equipment.test.ts
git commit -m "feat: Equipment-Queries für Liste, Detail und Datei-Freigabe"
```

---

## Task 4: Datei-Uploads — `lib/files.ts` und Auslieferungs-Route

**Files:**
- Modify: `lib/files.ts`
- Create: `app/api/equipment-files/[id]/route.ts`

**Interfaces:**
- Consumes: `EQUIPMENT_PHOTO_MAX_BYTES`, `EQUIPMENT_INVOICE_MAX_BYTES`, `EQUIPMENT_PHOTO_MIMES`, `EQUIPMENT_INVOICE_MIMES` (Task 1); `equipmentAttachments` (Task 1); `fetchServableEquipmentAttachment` (Task 3).
- Produces: `saveEquipmentUpload(opts): Promise<void>`, `equipmentAttachmentPath(equipmentId: number, storedName: string): string`, `deleteStoredEquipmentFile(equipmentId: number, storedName: string): void` — alle aus `@/lib/files`. Route `GET /api/equipment-files/[id]`.

- [ ] **Step 1: `lib/files.ts` erweitern**

Imports am Dateianfang erweitern:

```ts
import { db, uploadsDir } from "@/lib/db";
import { attachments, equipmentAttachments } from "@/lib/db/schema";
import {
  AUDIO_MAX_BYTES,
  AUDIO_MIMES,
  SHEET_MAX_BYTES,
  SHEET_MIMES,
  EQUIPMENT_PHOTO_MAX_BYTES,
  EQUIPMENT_INVOICE_MAX_BYTES,
  EQUIPMENT_PHOTO_MIMES,
  EQUIPMENT_INVOICE_MIMES,
} from "@/lib/constants";
```

Am Dateiende anfügen:

```ts
const EQUIPMENT_EXT_WHITELIST = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".heic", ".heif",
]);

/**
 * Validiert und speichert einen Equipment-Upload unter
 * data/uploads/equipment/<equipmentId>/, legt den Anhang-Datensatz an.
 * Eigene Funktion statt Wiederverwendung von saveUpload — siehe Entwurf
 * (Ansatz A: equipment_attachments bleibt von attachments getrennt).
 */
export async function saveEquipmentUpload(opts: {
  file: File;
  equipmentId: number;
  kind: "foto" | "rechnung";
  userId: number;
}) {
  const { file, equipmentId, kind, userId } = opts;
  if (!file || file.size === 0) throw new Error("Keine Datei ausgewählt.");

  const maxBytes = kind === "foto" ? EQUIPMENT_PHOTO_MAX_BYTES : EQUIPMENT_INVOICE_MAX_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      `Datei ist zu groß (max. ${Math.round(maxBytes / 1024 / 1024)} MB).`
    );
  }
  const allowed = kind === "foto" ? EQUIPMENT_PHOTO_MIMES : EQUIPMENT_INVOICE_MIMES;
  if (!allowed.has(file.type)) {
    throw new Error(
      kind === "foto"
        ? "Nur Bilder erlaubt (PNG, JPG, WebP, HEIC)."
        : "Nur PDF oder Bilder erlaubt (PDF, PNG, JPG, WebP, HEIC)."
    );
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!EQUIPMENT_EXT_WHITELIST.has(ext)) throw new Error("Dateiendung nicht erlaubt.");

  const dir = path.join(uploadsDir, "equipment", String(equipmentId));
  fs.mkdirSync(dir, { recursive: true });
  const storedName = `${crypto.randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, storedName), buffer);

  await db.insert(equipmentAttachments).values({
    equipmentId,
    kind,
    storedName,
    originalName: file.name,
    mime: file.type,
    size: file.size,
    uploadedById: userId,
  });
}

export function equipmentAttachmentPath(equipmentId: number, storedName: string) {
  const safe = path.basename(storedName);
  return path.join(uploadsDir, "equipment", String(equipmentId), safe);
}

export function deleteStoredEquipmentFile(equipmentId: number, storedName: string) {
  try {
    fs.unlinkSync(equipmentAttachmentPath(equipmentId, storedName));
  } catch {
    // Datei fehlt schon — ignorieren
  }
}
```

- [ ] **Step 2: API-Route erstellen — `app/api/equipment-files/[id]/route.ts`**

1:1 nach Vorbild von `app/api/files/[id]/route.ts`, nur mit den Equipment-Pendants:

```ts
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { currentUser } from "@/lib/auth";
import { fetchServableEquipmentAttachment } from "@/lib/queries";
import { equipmentAttachmentPath } from "@/lib/files";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();
  if (!user) return new Response("Nicht angemeldet", { status: 401 });

  const { id } = await ctx.params;
  const attachment = await fetchServableEquipmentAttachment(Number(id));
  if (!attachment) return new Response("Nicht gefunden", { status: 404 });

  const filePath = equipmentAttachmentPath(attachment.equipmentId, attachment.storedName);
  if (!fs.existsSync(filePath)) {
    return new Response("Datei fehlt auf dem Server", { status: 404 });
  }
  const stat = fs.statSync(filePath);

  const download = req.nextUrl.searchParams.has("download");
  const ext = path.extname(attachment.storedName);
  const filename = attachment.originalName.toLowerCase().endsWith(ext.toLowerCase())
    ? attachment.originalName
    : `${attachment.originalName}${ext}`;
  const baseHeaders: Record<string, string> = {
    "Content-Type": attachment.mime,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(
      filename
    )}`,
    "Cache-Control": "private, max-age=3600",
  };

  const range = req.headers.get("range");
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2]
      ? Math.min(parseInt(match[2], 10), stat.size - 1)
      : stat.size - 1;
    if (Number.isNaN(start) || start > end || start >= stat.size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      },
    });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(stat.size) },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add lib/files.ts "app/api/equipment-files/[id]/route.ts"
git commit -m "feat: Datei-Upload und Auslieferung für Equipment-Anhänge"
```

---

## Task 5: Papierkorb-Integration

**Files:**
- Modify: `lib/trash.ts`
- Modify: `tests/trash.test.ts`

**Interfaces:**
- Consumes: `equipment`, `equipmentAttachments` (Task 1); `deleteStoredEquipmentFile` (Task 4); Fixtures aus Task 2.
- Produces: `TrashKind` erweitert um `"equipment" | "equipmentAttachment"`. `fetchTrash`, `fetchTrashLabel`, `restore`, `purge`, `purgeExpired` behandeln beide neuen Kinds. Keine Signaturänderung — bestehende Aufrufer (`components/trash.tsx`, `lib/actions/trash.ts`, `app/(app)/papierkorb/page.tsx`) funktionieren unverändert weiter.

- [ ] **Step 1: Tests erweitern — `tests/trash.test.ts`**

Import-Block erweitern:

```ts
import { songs, events, attachments, setlists, equipment, equipmentAttachments } from "@/lib/db/schema";
```

Nach der Helper-Funktion `loeschen` (vor `langeHer`) einfügen:

```ts
const loeschenEquipment = (id: number, wann = new Date()) =>
  db.update(equipment).set({ deletedAt: wann, deletedById: f.users.anna.id }).where(eq(equipment.id, id));
```

Nach dem `describe("Terminserien im Papierkorb", ...)`-Block (vor `describe("automatisches Aufräumen", ...)`) einfügen:

```ts
describe("Equipment im Papierkorb", () => {
  it("erscheint im Papierkorb und lässt sich wiederherstellen", async () => {
    await loeschenEquipment(f.equipment.verstaerker.id);
    const liste = await fetchTrash();
    const eintrag = liste.find((e) => e.kind === "equipment")!;
    expect(eintrag.label).toBe("Marshall JCM800");

    const n = await restore("equipment", f.equipment.verstaerker.id);
    expect(n).toBe(1);
    expect((await fetchTrash()).some((e) => e.kind === "equipment")).toBe(false);
  });

  it("löscht beim endgültigen Entfernen auch die zugehörigen Dateien", async () => {
    await loeschenEquipment(f.equipment.verstaerker.id);
    const dir = `${uploadsDir}/equipment/${f.equipment.verstaerker.id}`;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/amp.jpg`, "x");

    const n = await purge("equipment", f.equipment.verstaerker.id);
    expect(n).toBe(1);
    expect(fs.existsSync(`${dir}/amp.jpg`)).toBe(false);
  });
});

describe("Equipment-Anhänge im Papierkorb", () => {
  it("erscheint mit Bezug zum Gerät und lässt sich wiederherstellen", async () => {
    const [datei] = await db
      .select()
      .from(equipmentAttachments)
      .where(eq(equipmentAttachments.equipmentId, f.equipment.verstaerker.id))
      .limit(1);
    await db
      .update(equipmentAttachments)
      .set({ deletedAt: new Date(), deletedById: f.users.anna.id })
      .where(eq(equipmentAttachments.id, datei.id));

    const liste = await fetchTrash();
    const eintrag = liste.find((e) => e.kind === "equipmentAttachment")!;
    expect(eintrag.sublabel).toContain("Marshall JCM800");

    const n = await restore("equipmentAttachment", datei.id);
    expect(n).toBe(1);
  });
});
```

In `describe("automatisches Aufräumen", ...)` einen weiteren Test ergänzen (nach dem Serien-Test):

```ts
  it("räumt ein abgelaufenes Equipment mitsamt Anhängen weg", async () => {
    await loeschenEquipment(f.equipment.verstaerker.id, langeHer());

    const bericht = await purgeExpired();
    expect(bericht.equipment).toBe(1);

    const liste = await fetchTrash();
    expect(liste.some((e) => e.kind === "equipment")).toBe(false);
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag prüfen**

Run: `npx vitest run tests/trash.test.ts`
Expected: FAIL — `"equipment"`/`"equipmentAttachment"` sind noch keine gültigen `TrashKind`-Werte, `fetchTrash` liefert sie nicht.

- [ ] **Step 3: `lib/trash.ts` erweitern**

Imports erweitern:

```ts
import { songs, setlists, events, attachments, users, equipment, equipmentAttachments } from "@/lib/db/schema";
import { deleteStoredFile, deleteStoredEquipmentFile } from "@/lib/files";
```

`TrashKind`, `TRASH_LABEL`, `KINDS` erweitern:

```ts
export type TrashKind = "song" | "setlist" | "event" | "attachment" | "equipment" | "equipmentAttachment";

export const TRASH_LABEL: Record<TrashKind, string> = {
  song: "Song",
  setlist: "Setliste",
  event: "Termin",
  attachment: "Datei",
  equipment: "Equipment",
  equipmentAttachment: "Equipment-Datei",
};

const KINDS: TrashKind[] = ["song", "setlist", "event", "attachment", "equipment", "equipmentAttachment"];
```

`fetchTrash()`: die `Promise.all`-Destrukturierung um zwei Query-Ergebnisse erweitern und die zwei Queries in das Array aufnehmen:

```ts
  const [songRows, setlistRows, eventRows, attachmentRows, equipmentRows, equipmentAttachmentRows] = await Promise.all([
    // … die vier bestehenden Queries unverändert …
    db
      .select({ id: equipment.id, name: equipment.name, deletedAt: equipment.deletedAt, byName: users.name })
      .from(equipment)
      .leftJoin(users, eq(equipment.deletedById, users.id))
      .where(isNotNull(equipment.deletedAt)),
    db
      .select({
        id: equipmentAttachments.id,
        name: equipmentAttachments.originalName,
        equipmentName: equipment.name,
        deletedAt: equipmentAttachments.deletedAt,
        byName: users.name,
      })
      .from(equipmentAttachments)
      .innerJoin(equipment, eq(equipmentAttachments.equipmentId, equipment.id))
      .leftJoin(users, eq(equipmentAttachments.deletedById, users.id))
      .where(isNotNull(equipmentAttachments.deletedAt)),
  ]);
```

Nach der bestehenden `for (const r of attachmentRows)`-Schleife (vor `return eintraege.sort(...)`) einfügen:

```ts
  for (const r of equipmentRows) {
    eintraege.push({
      kind: "equipment", id: r.id, label: r.name, sublabel: null,
      deletedAt: r.deletedAt!, deletedByName: r.byName, count: 1, restTage: restTage(r.deletedAt!),
    });
  }

  for (const r of equipmentAttachmentRows) {
    eintraege.push({
      kind: "equipmentAttachment", id: r.id, label: r.name, sublabel: `zu „${r.equipmentName}"`,
      deletedAt: r.deletedAt!, deletedByName: r.byName, count: 1, restTage: restTage(r.deletedAt!),
    });
  }
```

`fetchTrashLabel()`: vor der abschließenden `attachment`-Fallback-Zeile zwei weitere `if`-Blöcke einfügen:

```ts
  if (kind === "equipment") {
    const r = await db.query.equipment.findFirst({ where: eq(equipment.id, id), columns: { name: true, deletedAt: true } });
    return r?.deletedAt ? r.name : null;
  }
  if (kind === "equipmentAttachment") {
    const r = await db.query.equipmentAttachments.findFirst({ where: eq(equipmentAttachments.id, id), columns: { originalName: true, deletedAt: true } });
    return r?.deletedAt ? r.originalName : null;
  }
```

`restore()`: vor der abschließenden `attachment`-Fallback-Zeile zwei weitere `if`-Blöcke einfügen:

```ts
  if (kind === "equipment") {
    const r = await db.update(equipment).set(zurueck).where(and(eq(equipment.id, id), isNotNull(equipment.deletedAt))).returning({ id: equipment.id });
    return r.length;
  }
  if (kind === "equipmentAttachment") {
    const r = await db.update(equipmentAttachments).set(zurueck).where(and(eq(equipmentAttachments.id, id), isNotNull(equipmentAttachments.deletedAt))).returning({ id: equipmentAttachments.id });
    return r.length;
  }
```

`purge()`: vor der abschließenden `attachment`-Fallback-Logik zwei weitere `if`-Blöcke einfügen:

```ts
  if (kind === "equipment") {
    const item = await db.query.equipment.findFirst({ where: and(eq(equipment.id, id), isNotNull(equipment.deletedAt)) });
    if (!item) return 0;
    const dateien = await db.query.equipmentAttachments.findMany({ where: eq(equipmentAttachments.equipmentId, id) });
    for (const datei of dateien) deleteStoredEquipmentFile(id, datei.storedName);
    await db.delete(equipment).where(eq(equipment.id, id));
    return 1;
  }
  if (kind === "equipmentAttachment") {
    const anhang = await db.query.equipmentAttachments.findFirst({ where: and(eq(equipmentAttachments.id, id), isNotNull(equipmentAttachments.deletedAt)) });
    if (!anhang) return 0;
    deleteStoredEquipmentFile(anhang.equipmentId, anhang.storedName);
    await db.delete(equipmentAttachments).where(eq(equipmentAttachments.id, id));
    return 1;
  }
```

`purgeExpired()`: `bericht`-Objekt und die Aufräum-Schleifen erweitern:

```ts
  const bericht: PurgeReport = { song: 0, setlist: 0, event: 0, attachment: 0, equipment: 0, equipmentAttachment: 0 };

  const alteEquipmentAnhaenge = await db
    .select({ id: equipmentAttachments.id })
    .from(equipmentAttachments)
    .where(and(isNotNull(equipmentAttachments.deletedAt), lt(equipmentAttachments.deletedAt, grenze)));
  for (const a of alteEquipmentAnhaenge) bericht.equipmentAttachment += await purge("equipmentAttachment", a.id);

  const alteEquipment = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(isNotNull(equipment.deletedAt), lt(equipment.deletedAt, grenze)));
  for (const e of alteEquipment) bericht.equipment += await purge("equipment", e.id);
```

(Reihenfolge im Funktionskörper: diese beiden Blöcke vor oder nach den bestehenden — sie sind von Songs/Setlisten/Terminen unabhängig, Position spielt keine Rolle.)

- [ ] **Step 4: Test laufen lassen, Erfolg prüfen**

Run: `npx vitest run tests/trash.test.ts`
Expected: PASS (alle Tests grün, inkl. der bestehenden).

Run: `npm test`
Expected: Gesamte Suite grün.

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 5: Commit**

```bash
git add lib/trash.ts tests/trash.test.ts
git commit -m "feat: Equipment und Equipment-Dateien in den Papierkorb integrieren"
```

---

## Task 6: Server Actions — Equipment-CRUD und Datei-Uploads

**Files:**
- Create: `lib/actions/equipment.ts`
- Create: `lib/actions/equipment-attachments.ts`

**Interfaces:**
- Consumes: `equipment`, `equipmentContributions`, `type EquipmentCategory`, `type EquipmentStatus` (Task 1); `EQUIPMENT_CATEGORY_ORDER`, `EQUIPMENT_STATUS_ORDER` (Task 1); `requireUser` (`@/lib/auth`); `type FormState` (`@/lib/actions/auth`); `saveEquipmentUpload` (Task 4); `equipmentAttachments` (Task 1).
- Produces: `createEquipment`, `updateEquipment` (Signatur `(prev: FormState, formData: FormData) => Promise<FormState>`, für `useActionState`), `deleteEquipment(equipmentId: number): Promise<void>` — aus `@/lib/actions/equipment`. `uploadEquipmentAttachment` (gleiche `FormState`-Signatur), `deleteEquipmentAttachment(attachmentId: number): Promise<void>` — aus `@/lib/actions/equipment-attachments`.

- [ ] **Step 1: `lib/actions/equipment.ts` erstellen**

```ts
"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { equipment, equipmentContributions, type EquipmentCategory, type EquipmentStatus } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { EQUIPMENT_CATEGORY_ORDER, EQUIPMENT_STATUS_ORDER } from "@/lib/constants";
import type { FormState } from "@/lib/actions/auth";

function readEquipmentFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "other") as EquipmentCategory;
  const statusRaw = String(formData.get("status") ?? "in_use") as EquipmentStatus;
  const acquisitionDate = String(formData.get("acquisitionDate") ?? "").trim();
  const costRaw = String(formData.get("acquisitionCost") ?? "").trim();
  const acquisitionCost = costRaw ? Number(costRaw) : null;
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  return {
    name,
    category: EQUIPMENT_CATEGORY_ORDER.includes(categoryRaw) ? categoryRaw : "other",
    status: EQUIPMENT_STATUS_ORDER.includes(statusRaw) ? statusRaw : "in_use",
    acquisitionDate: acquisitionDate || null,
    acquisitionCost: acquisitionCost !== null && Number.isFinite(acquisitionCost) ? acquisitionCost : null,
    location: location || null,
    notes: notes || null,
  };
}

function readContributions(formData: FormData) {
  const userIds = formData.getAll("contribUserId").map(String);
  const amounts = formData.getAll("contribAmount").map(String);
  const notes = formData.getAll("contribNote").map(String);
  const parsed = userIds
    .map((userIdRaw, i) => ({
      userId: Number(userIdRaw),
      amount: Number(amounts[i]),
      note: notes[i]?.trim() || null,
    }))
    .filter((c) => Number.isInteger(c.userId) && c.userId > 0 && Number.isFinite(c.amount) && c.amount > 0);

  // Ein Mitglied kann nur eine Beteiligungszeile haben (Composite-PK) — bei
  // versehentlicher Doppelauswahl im Formular gewinnt die letzte Zeile, statt
  // dass der Insert an der Unique-Constraint scheitert.
  const byUser = new Map<number, (typeof parsed)[number]>();
  for (const c of parsed) byUser.set(c.userId, c);
  return [...byUser.values()];
}

export async function createEquipment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const fields = readEquipmentFields(formData);
  if (!fields.name) return { error: "Der Name darf nicht leer sein." };

  const [item] = await db
    .insert(equipment)
    .values({ ...fields, createdById: user.id })
    .returning();

  const contributions = readContributions(formData);
  if (contributions.length > 0) {
    await db
      .insert(equipmentContributions)
      .values(contributions.map((c) => ({ ...c, equipmentId: item.id })));
  }

  revalidatePath("/", "layout");
  redirect(`/equipment/${item.id}`);
}

export async function updateEquipment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireUser();
  const equipmentId = Number(formData.get("equipmentId"));
  const fields = readEquipmentFields(formData);
  if (!fields.name) return { error: "Der Name darf nicht leer sein." };

  await db
    .update(equipment)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(equipment.id, equipmentId));

  // Beteiligungen komplett ersetzen, wie Songs es mit Links macht.
  await db.delete(equipmentContributions).where(eq(equipmentContributions.equipmentId, equipmentId));
  const contributions = readContributions(formData);
  if (contributions.length > 0) {
    await db
      .insert(equipmentContributions)
      .values(contributions.map((c) => ({ ...c, equipmentId })));
  }

  revalidatePath("/", "layout");
  redirect(`/equipment/${equipmentId}`);
}

/**
 * Legt das Gerät in den Papierkorb. Fotos, Rechnungen und Beteiligungen
 * bleiben erhalten — siehe lib/trash.ts.
 */
export async function deleteEquipment(equipmentId: number) {
  const user = await requireUser();
  await db
    .update(equipment)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(eq(equipment.id, equipmentId));
  revalidatePath("/", "layout");
  redirect(`/equipment?undo=equipment:${equipmentId}`);
}
```

- [ ] **Step 2: `lib/actions/equipment-attachments.ts` erstellen**

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { equipmentAttachments } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { saveEquipmentUpload } from "@/lib/files";
import type { FormState } from "@/lib/actions/auth";

export async function uploadEquipmentAttachment(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const user = await requireUser();
  const equipmentId = Number(formData.get("equipmentId"));
  const kind = formData.get("kind") === "rechnung" ? "rechnung" : "foto";
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Datei auswählen." };
  }

  try {
    await saveEquipmentUpload({ file, equipmentId, kind, userId: user.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload fehlgeschlagen." };
  }

  revalidatePath(`/equipment/${equipmentId}`);
  return { success: kind === "foto" ? "Foto hochgeladen." : "Rechnung hochgeladen." };
}

/**
 * Legt die Datei in den Papierkorb. Bleibt auf der Platte, bis endgültig
 * gelöscht wird — das „Rückgängig" auf der Equipment-Seite hängt daran.
 */
export async function deleteEquipmentAttachment(attachmentId: number) {
  const user = await requireUser();
  const attachment = await db.query.equipmentAttachments.findFirst({
    where: eq(equipmentAttachments.id, attachmentId),
  });
  if (!attachment) return;
  await db
    .update(equipmentAttachments)
    .set({ deletedAt: new Date(), deletedById: user.id })
    .where(eq(equipmentAttachments.id, attachmentId));
  revalidatePath(`/equipment/${attachment.equipmentId}`);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/equipment.ts lib/actions/equipment-attachments.ts
git commit -m "feat: Server Actions für Equipment-CRUD und Datei-Uploads"
```

---

## Task 7: Icon und Navigation

**Files:**
- Modify: `components/icons.tsx`
- Modify: `components/nav-links.tsx`

**Interfaces:**
- Produces: `IconEquipment` (aus `@/components/icons`), neuer Nav-Eintrag `/equipment`.

- [ ] **Step 1: `IconEquipment` in `components/icons.tsx` ergänzen**

Nach `IconMembers` (Dateiende) anfügen — Amp/Speaker-Motiv im bestehenden Feather-Stil:

```tsx
export function IconEquipment({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="9" r="3" />
      <line x1="8" y1="16" x2="16" y2="16" />
      <line x1="8" y1="19" x2="16" y2="19" />
    </Svg>
  );
}
```

- [ ] **Step 2: Nav-Eintrag in `components/nav-links.tsx` ergänzen**

```tsx
import {
  IconDashboard,
  IconSongs,
  IconSetlists,
  IconCalendar,
  IconMembers,
  IconEquipment,
} from "@/components/icons";
```

```tsx
  const links: NavItem[] = [
    { href: "/", label: "Dashboard", Icon: IconDashboard },
    { href: "/songs", label: "Songs", Icon: IconSongs },
    { href: "/setlisten", label: "Setlisten", Icon: IconSetlists },
    { href: "/termine", label: "Termine", Icon: IconCalendar },
    { href: "/mitglieder", label: "Mitglieder", Icon: IconMembers },
    { href: "/equipment", label: "Equipment", Icon: IconEquipment },
  ];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add components/icons.tsx components/nav-links.tsx
git commit -m "feat: Equipment-Icon und Navigationspunkt ergänzen"
```

---

## Task 8: Formular-Komponente

**Files:**
- Create: `components/equipment-form.tsx`

**Interfaces:**
- Consumes: `createEquipment`, `updateEquipment` (Task 6); `EQUIPMENT_CATEGORY_ORDER`, `EQUIPMENT_CATEGORY`, `EQUIPMENT_STATUS_ORDER`, `EQUIPMENT_STATUS` (Task 1); `type Equipment` (Task 1); `SubmitButton`, `FormMsg` (`@/components/form`); `IconClose` (`@/components/icons`).
- Produces: `EquipmentForm({ equipment?, contributions?, members }): JSX.Element` — Props: `equipment?: Equipment`, `contributions?: { userId: number; amount: number; note: string | null }[]`, `members: { id: number; name: string }[]`.

- [ ] **Step 1: `components/equipment-form.tsx` erstellen**

```tsx
"use client";

import { useActionState, useState } from "react";
import { createEquipment, updateEquipment } from "@/lib/actions/equipment";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";
import { IconClose } from "@/components/icons";
import {
  EQUIPMENT_CATEGORY_ORDER,
  EQUIPMENT_CATEGORY,
  EQUIPMENT_STATUS_ORDER,
  EQUIPMENT_STATUS,
} from "@/lib/constants";
import type { Equipment } from "@/lib/db/schema";

const initial: FormState = {};

type ContributionRow = { id: number; userId: string; amount: string; note: string };

export function EquipmentForm({
  equipment,
  contributions,
  members,
}: {
  equipment?: Equipment;
  contributions?: { userId: number; amount: number; note: string | null }[];
  members: { id: number; name: string }[];
}) {
  const isEdit = Boolean(equipment);
  const [state, action] = useActionState(isEdit ? updateEquipment : createEquipment, initial);
  const [rows, setRows] = useState<ContributionRow[]>(() =>
    contributions && contributions.length > 0
      ? contributions.map((c, i) => ({
          id: i,
          userId: String(c.userId),
          amount: String(c.amount),
          note: c.note ?? "",
        }))
      : [{ id: 0, userId: "", amount: "", note: "" }]
  );
  const [cost, setCost] = useState(
    equipment?.acquisitionCost != null ? String(equipment.acquisitionCost) : ""
  );

  const addRow = () => setRows((r) => [...r, { id: Date.now(), userId: "", amount: "", note: "" }]);
  const removeRow = (id: number) => setRows((r) => r.filter((row) => row.id !== id));
  const updateRow = (id: number, patch: Partial<ContributionRow>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const sum = rows.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  const costNum = Number(cost) || 0;
  const diff = costNum - sum;

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="equipmentId" value={equipment!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-name">Name *</label>
          <input
            id="ef-name"
            className="input text-lg"
            name="name"
            defaultValue={equipment?.name ?? ""}
            required
            autoFocus={!isEdit}
          />
        </div>
        <div>
          <label className="label" htmlFor="ef-category">Kategorie</label>
          <select id="ef-category" className="input" name="category" defaultValue={equipment?.category ?? "other"}>
            {EQUIPMENT_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{EQUIPMENT_CATEGORY[c].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ef-status">Zustand</label>
          <select id="ef-status" className="input" name="status" defaultValue={equipment?.status ?? "in_use"}>
            {EQUIPMENT_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{EQUIPMENT_STATUS[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ef-date">Anschaffungsdatum</label>
          <input
            id="ef-date"
            className="input mono-display"
            name="acquisitionDate"
            type="date"
            defaultValue={equipment?.acquisitionDate ?? ""}
          />
        </div>
        <div>
          <label className="label" htmlFor="ef-cost">Anschaffungskosten (€)</label>
          <input
            id="ef-cost"
            className="input mono-display"
            name="acquisitionCost"
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="ef-location">Standort/Lagerort</label>
          <input
            id="ef-location"
            className="input"
            name="location"
            defaultValue={equipment?.location ?? ""}
            placeholder="z.B. Proberaum"
          />
        </div>
      </div>

      <div>
        <h3 className="label">Kostenbeteiligung der Mitglieder</h3>
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-2 border-b border-line-soft/40 pb-3 sm:flex-row sm:border-0 sm:pb-0"
            >
              <select
                className="input sm:w-48"
                name="contribUserId"
                value={row.userId}
                onChange={(e) => updateRow(row.id, { userId: e.target.value })}
              >
                <option value="">Mitglied wählen …</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                className="input mono-display sm:w-32"
                name="contribAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Betrag €"
                value={row.amount}
                onChange={(e) => updateRow(row.id, { amount: e.target.value })}
              />
              <div className="flex w-full gap-2 sm:flex-1">
                <input
                  className="input flex-1"
                  name="contribNote"
                  placeholder="Vermerk (optional)"
                  value={row.note}
                  onChange={(e) => updateRow(row.id, { note: e.target.value })}
                />
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger self-center px-3"
                    onClick={() => removeRow(row.id)}
                    title="Zeile entfernen"
                  >
                    <IconClose className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-sm mt-2" onClick={addRow}>
          + weitere Beteiligung
        </button>
        <p className="mono-display mt-2 text-sm text-mute">
          Summe der Beteiligungen: {sum.toFixed(2)} €
        </p>
        {cost.trim() !== "" && Math.abs(diff) > 0.001 && (
          <p className="mt-1 text-xs text-amber-300">
            {diff > 0
              ? `${diff.toFixed(2)} € der Anschaffungskosten sind noch keinem Mitglied zugeordnet.`
              : `${Math.abs(diff).toFixed(2)} € mehr eingetragen als die Anschaffungskosten.`}
          </p>
        )}
      </div>

      <div>
        <label className="label" htmlFor="ef-notes">Notizen</label>
        <textarea
          id="ef-notes"
          className="input min-h-20"
          name="notes"
          defaultValue={equipment?.notes ?? ""}
          placeholder="z.B. Seriennummer, Garantie, Kaufort, …"
        />
      </div>

      <FormMsg state={state} />
      <div className="flex gap-3">
        <SubmitButton pendingText={isEdit ? "Speichern …" : "Anlegen …"}>
          {isEdit ? "Änderungen speichern" : "Gerät anlegen"}
        </SubmitButton>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 3: Commit**

```bash
git add components/equipment-form.tsx
git commit -m "feat: Formular-Komponente für Equipment mit Beteiligungszeilen"
```

---

## Task 9: Attachment- und Lösch-Komponenten

**Files:**
- Create: `components/equipment-attachments.tsx`
- Create: `components/equipment-actions.tsx`

**Interfaces:**
- Consumes: `uploadEquipmentAttachment`, `deleteEquipmentAttachment` (Task 6); `deleteEquipment` (Task 6); `restoreItem` (`@/lib/actions/trash`, bereits vorhanden — nimmt jetzt auch `"equipmentAttachment"` als `kind`, siehe Task 5); `SubmitButton`, `FormMsg` (`@/components/form`).
- Produces: `EquipmentUploadForm({ equipmentId, kind })`, `DeleteEquipmentAttachmentButton({ attachmentId, name })` — aus `@/components/equipment-attachments`. `DeleteEquipmentButton({ equipmentId, name })` — aus `@/components/equipment-actions`.

- [ ] **Step 1: `components/equipment-attachments.tsx` erstellen**

```tsx
"use client";

import { useActionState, useState, useTransition } from "react";
import { uploadEquipmentAttachment, deleteEquipmentAttachment } from "@/lib/actions/equipment-attachments";
import { restoreItem } from "@/lib/actions/trash";
import type { FormState } from "@/lib/actions/auth";
import { SubmitButton, FormMsg } from "@/components/form";

const initial: FormState = {};

export function EquipmentUploadForm({
  equipmentId,
  kind,
}: {
  equipmentId: number;
  kind: "foto" | "rechnung";
}) {
  const [state, action] = useActionState(uploadEquipmentAttachment, initial);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="equipmentId" value={equipmentId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-2">
        <input
          className="input flex-1"
          type="file"
          name="file"
          required
          accept={kind === "foto" ? "image/*" : ".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"}
          capture={kind === "foto" ? "environment" : undefined}
        />
        <SubmitButton className="btn" pendingText="Lädt hoch …">
          Hochladen
        </SubmitButton>
      </div>
      <p className="text-xs text-faint">
        {kind === "foto"
          ? "Bild, auch direkt mit der Kamera aufgenommen — max. 20 MB"
          : "PDF oder Bild — max. 20 MB"}
      </p>
      <FormMsg state={state} />
    </form>
  );
}

/**
 * Löschen legt die Datei in den Papierkorb. Kein Redirect zum Anhängen des
 * „Rückgängig" — die Komponente merkt sich den Zustand selbst, wie bei Songs.
 */
export function DeleteEquipmentAttachmentButton({
  attachmentId,
  name,
}: {
  attachmentId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [geloescht, setGeloescht] = useState(false);

  if (geloescht) {
    return (
      <span className="flex items-center gap-2 text-xs text-faint">
        im Papierkorb
        <button
          type="button"
          disabled={pending}
          className="text-accent-hi underline cursor-pointer disabled:opacity-50"
          onClick={() =>
            startTransition(async () => {
              await restoreItem("equipmentAttachment", attachmentId);
              setGeloescht(false);
            })
          }
        >
          Rückgängig
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      className="link-danger text-xs"
      onClick={() => {
        if (confirm(`„${name}" in den Papierkorb legen?`))
          startTransition(async () => {
            await deleteEquipmentAttachment(attachmentId);
            setGeloescht(true);
          });
      }}
    >
      löschen
    </button>
  );
}
```

- [ ] **Step 2: `components/equipment-actions.tsx` erstellen**

```tsx
"use client";

import { useTransition } from "react";
import { deleteEquipment } from "@/lib/actions/equipment";

/** Gerät löschen (Papierkorb), an derselben Stelle wie bei Song/Setliste/Termin. */
export function DeleteEquipmentButton({
  equipmentId,
  name,
}: {
  equipmentId: number;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="btn btn-sm btn-danger"
      onClick={() => {
        if (
          confirm(
            `„${name}" in den Papierkorb legen?\n\nFotos, Rechnungen und Beteiligungen bleiben erhalten und kommen bei einer Wiederherstellung mit zurück.`
          )
        )
          startTransition(() => deleteEquipment(equipmentId));
      }}
    >
      In den Papierkorb
    </button>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add components/equipment-attachments.tsx components/equipment-actions.tsx
git commit -m "feat: Upload- und Lösch-Komponenten für Equipment-Anhänge und -Geräte"
```

---

## Task 10: Seiten — Liste & Neu anlegen

**Files:**
- Create: `app/(app)/equipment/page.tsx`
- Create: `app/(app)/equipment/neu/page.tsx`

**Interfaces:**
- Consumes: `fetchEquipmentList` (Task 3); `EQUIPMENT_CATEGORY`, `EQUIPMENT_CATEGORY_ORDER`, `EQUIPMENT_STATUS` (Task 1); `EquipmentForm` (Task 8); `UndoBanner` (`@/components/undo-banner`, bereits vorhanden).

- [ ] **Step 1: `app/(app)/equipment/page.tsx` erstellen**

```tsx
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fetchEquipmentList } from "@/lib/queries";
import { EQUIPMENT_CATEGORY, EQUIPMENT_CATEGORY_ORDER, EQUIPMENT_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { EquipmentCategory } from "@/lib/db/schema";
import { UndoBanner } from "@/components/undo-banner";

export const metadata = { title: "Equipment" };

type Search = { category?: string; q?: string; undo?: string };

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireUser();
  const params = await searchParams;
  const category =
    params.category && EQUIPMENT_CATEGORY_ORDER.includes(params.category as EquipmentCategory)
      ? (params.category as EquipmentCategory)
      : undefined;
  const q = (params.q ?? "").toLowerCase().trim();

  const all = await fetchEquipmentList();
  let list = category ? all.filter((e) => e.category === category) : all;
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q));

  return (
    <div>
      <UndoBanner undo={params.undo} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="headline text-3xl">Equipment</h1>
          <p className="mt-1 text-sm text-mute">
            Gemeinsam angeschafftes Band-Equipment mit Kostenbeteiligungen.
          </p>
        </div>
        <Link href="/equipment/neu" className="btn btn-primary">
          + Gerät anlegen
        </Link>
      </div>

      <form className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap" action="/equipment" method="get">
        <input
          className="input w-full sm:max-w-64"
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Gerät suchen …"
        />
        <select className="input w-full sm:max-w-48" name="category" defaultValue={category ?? ""}>
          <option value="">Alle Kategorien</option>
          {EQUIPMENT_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{EQUIPMENT_CATEGORY[c].label}</option>
          ))}
        </select>
        <button className="btn w-full sm:w-auto" type="submit">Filtern</button>
      </form>

      <div className="mt-6 space-y-2">
        {list.length === 0 && (
          <div className="card p-10 text-center text-mute">
            {q || category ? "Nichts gefunden." : "Noch kein Equipment angelegt."}
          </div>
        )}
        {list.map((item) => {
          const categoryMeta = EQUIPMENT_CATEGORY[item.category];
          const statusMeta = EQUIPMENT_STATUS[item.status];
          return (
            <Link
              key={item.id}
              href={`/equipment/${item.id}`}
              className="card flex items-center gap-4 p-4 transition hover:border-accent/40"
            >
              <span className={`badge shrink-0 ${categoryMeta.badge}`}>{categoryMeta.label}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{item.name}</p>
                <p className="truncate text-sm text-mute">
                  {item.location ?? "—"}
                  {item.acquisitionDate ? ` · angeschafft ${formatDate(item.acquisitionDate)}` : ""}
                </p>
              </div>
              <span className={`badge hidden shrink-0 sm:inline-flex ${statusMeta.badge}`}>
                <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
              <div className="mono-display hidden shrink-0 text-right text-xs text-mute sm:block">
                {item.acquisitionCost != null && <p>{item.acquisitionCost.toFixed(2)} €</p>}
                {item.contributionTotal > 0 && (
                  <p className="text-faint">{item.contributionTotal.toFixed(2)} € beigetragen</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `app/(app)/equipment/neu/page.tsx` erstellen**

```tsx
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { EquipmentForm } from "@/components/equipment-form";

export const metadata = { title: "Equipment anlegen" };

export default async function NeuesEquipmentPage() {
  await requireUser();
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.name);

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Gerät anlegen</h1>
      <div className="card mt-6 p-6">
        <EquipmentForm members={members} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/equipment/page.tsx" "app/(app)/equipment/neu/page.tsx"
git commit -m "feat: Equipment-Liste und Anlegen-Seite"
```

---

## Task 11: Seiten — Detailansicht & Bearbeiten

**Files:**
- Create: `app/(app)/equipment/[id]/page.tsx`
- Create: `app/(app)/equipment/[id]/bearbeiten/page.tsx`

**Interfaces:**
- Consumes: `fetchEquipmentDetail` (Task 3); `EQUIPMENT_CATEGORY`, `EQUIPMENT_STATUS` (Task 1); `EquipmentUploadForm`, `DeleteEquipmentAttachmentButton` (Task 9); `DeleteEquipmentButton` (Task 9); `EquipmentForm` (Task 8); `IconEdit` (`@/components/icons`, bereits vorhanden); `formatDate`, `formatBytes` (`@/lib/format`).

- [ ] **Step 1: `app/(app)/equipment/[id]/page.tsx` erstellen**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fetchEquipmentDetail } from "@/lib/queries";
import { EQUIPMENT_CATEGORY, EQUIPMENT_STATUS } from "@/lib/constants";
import { formatDate, formatBytes } from "@/lib/format";
import { EquipmentUploadForm, DeleteEquipmentAttachmentButton } from "@/components/equipment-attachments";
import { DeleteEquipmentButton } from "@/components/equipment-actions";
import { IconEdit } from "@/components/icons";

export default async function EquipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const data = await fetchEquipmentDetail(Number(id));
  if (!data) notFound();

  const { equipment, contributions, attachments, createdByName } = data;
  const categoryMeta = EQUIPMENT_CATEGORY[equipment.category];
  const statusMeta = EQUIPMENT_STATUS[equipment.status];
  const photos = attachments.filter((a) => a.kind === "foto");
  const invoices = attachments.filter((a) => a.kind === "rechnung");
  const contributionTotal = contributions.reduce((acc, c) => acc + c.amount, 0);
  const diff = (equipment.acquisitionCost ?? 0) - contributionTotal;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/equipment" className="text-sm text-mute hover:text-ink">
          ← Alles Equipment
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="headline text-4xl">{equipment.name}</h1>
              <span className={`badge ${categoryMeta.badge}`}>{categoryMeta.label}</span>
              <span className={`badge ${statusMeta.badge}`}>
                <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-1 text-mute">
              {equipment.location ?? "Kein Standort hinterlegt"}
              {createdByName ? ` · angelegt von ${createdByName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/equipment/${equipment.id}/bearbeiten`} className="btn">
              <IconEdit className="size-4" /> Bearbeiten
            </Link>
            <DeleteEquipmentButton equipmentId={equipment.id} name={equipment.name} />
          </div>
        </div>

        <div className="card mt-4 p-4 sm:px-5 sm:py-3">
          <div className="mono-display flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span>
              <span className="text-faint">ANGESCHAFFT </span>
              {formatDate(equipment.acquisitionDate)}
            </span>
            <span>
              <span className="text-faint">KOSTEN </span>
              {equipment.acquisitionCost != null ? `${equipment.acquisitionCost.toFixed(2)} €` : "–"}
            </span>
            <span>
              <span className="text-faint">BEITRÄGE </span>
              {contributionTotal.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          <section className="space-y-3">
            <h2 className="headline text-lg">Fotos</h2>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((file) => (
                  <div key={file.id} className="card space-y-2 p-2">
                    <a href={`/api/equipment-files/${file.id}`} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/equipment-files/${file.id}`}
                        alt={file.originalName}
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    </a>
                    <div className="flex items-center justify-between gap-2 px-1 pb-1">
                      <span className="truncate text-xs text-faint">{file.originalName}</span>
                      <DeleteEquipmentAttachmentButton attachmentId={file.id} name={file.originalName} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {photos.length === 0 && <p className="text-sm text-faint">Noch keine Fotos hochgeladen.</p>}
            <EquipmentUploadForm equipmentId={equipment.id} kind="foto" />
          </section>

          <section className="space-y-3">
            <h2 className="headline text-lg">Rechnungen &amp; Belege</h2>
            {invoices.length > 0 && (
              <ul className="space-y-2">
                {invoices.map((file) => (
                  <li key={file.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
                    <a
                      className="min-w-0 flex-1 truncate text-accent-hi hover:underline"
                      href={`/api/equipment-files/${file.id}`}
                      target="_blank"
                      rel="noopener"
                    >
                      {file.originalName}
                    </a>
                    <span className="shrink-0 text-xs text-faint">{formatBytes(file.size)}</span>
                    <a
                      className="shrink-0 text-xs text-accent-hi hover:underline"
                      href={`/api/equipment-files/${file.id}?download=1`}
                    >
                      Download
                    </a>
                    <DeleteEquipmentAttachmentButton attachmentId={file.id} name={file.originalName} />
                  </li>
                ))}
              </ul>
            )}
            {invoices.length === 0 && <p className="text-sm text-faint">Noch keine Rechnungen hochgeladen.</p>}
            <EquipmentUploadForm equipmentId={equipment.id} kind="rechnung" />
          </section>

          {equipment.notes && (
            <section>
              <h2 className="headline mb-3 text-lg">Notizen</h2>
              <div className="card p-5 text-sm whitespace-pre-wrap">{equipment.notes}</div>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-8">
          <section className="card p-5">
            <h2 className="headline mb-3 text-lg">Beteiligungen</h2>
            {contributions.length === 0 ? (
              <p className="text-sm text-faint">Noch keine Beteiligungen eingetragen.</p>
            ) : (
              <ul className="space-y-2">
                {contributions.map((c) => (
                  <li key={c.userId} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{c.userName}</span>
                      <span className="mono-display shrink-0">{c.amount.toFixed(2)} €</span>
                    </div>
                    {c.note && <p className="text-xs text-faint">{c.note}</p>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mono-display mt-4 border-t border-line-soft pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-faint">SUMME</span>
                <span>{contributionTotal.toFixed(2)} €</span>
              </div>
              {equipment.acquisitionCost != null && Math.abs(diff) > 0.001 && (
                <div className="mt-1 flex items-center justify-between text-amber-300">
                  <span className="text-faint">{diff > 0 ? "OFFEN" : "MEHR ALS KOSTEN"}</span>
                  <span>{Math.abs(diff).toFixed(2)} €</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `app/(app)/equipment/[id]/bearbeiten/page.tsx` erstellen**

```tsx
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { fetchEquipmentDetail } from "@/lib/queries";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { EquipmentForm } from "@/components/equipment-form";

export const metadata = { title: "Equipment bearbeiten" };

export default async function EquipmentBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const data = await fetchEquipmentDetail(Number(id));
  if (!data) notFound();
  const members = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(users.name);

  return (
    <div className="max-w-2xl">
      <h1 className="headline text-3xl">Gerät bearbeiten</h1>
      <div className="card mt-6 p-6">
        <EquipmentForm equipment={data.equipment} contributions={data.contributions} members={members} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/equipment/[id]/page.tsx" "app/(app)/equipment/[id]/bearbeiten/page.tsx"
git commit -m "feat: Equipment-Detailansicht und Bearbeiten-Seite"
```

---

## Task 12: Gesamtverifikation & Abschluss

**Files:**
- Modify: `FEATURES.md`

**Interfaces:** (keine — reine Verifikation und Doku-Abschluss)

- [ ] **Step 1: Vollständige Prüfung**

Run: `npx tsc --noEmit`
Expected: Keine Fehler.

Run: `npm test`
Expected: Gesamte Suite grün.

Run: `npm run build`
Expected: Build erfolgreich.

- [ ] **Step 2: Browser-Durchlauf**

Dev-Server `bandmate-dev` starten (`.claude/launch.json`), eingeloggt als bestehender Nutzer:

1. `/equipment` öffnen — leere Liste bzw. bestehende Testdaten sichtbar, Nav-Punkt „Equipment" aktiv markiert.
2. „+ Gerät anlegen" — Name, Kategorie, Status, Anschaffungsdatum/-kosten, Standort, zwei Beteiligungszeilen mit Betrag + Vermerk ausfüllen, Live-Summe und Abweichungs-Hinweis prüfen, speichern.
3. Auf der Detailseite: Foto per normaler Dateiauswahl hochladen, Foto per Kamera-Input hochladen (mobile Emulation im Browser reicht — `capture="environment"` löst am echten Smartphone die Kamera aus), Rechnung als PDF hochladen.
4. Beteiligungs-Tabelle inkl. Summe/Abweichung prüfen.
5. „Bearbeiten" — Werte ändern, Beteiligung entfernen, speichern, Änderungen auf der Detailseite prüfen.
6. Ein einzelnes Foto löschen → „im Papierkorb"-Anzeige → „Rückgängig" prüfen.
7. Gerät löschen → Redirect zur Liste mit „Rückgängig"-Band → `/papierkorb` öffnen, Eintrag „Equipment" sehen, wiederherstellen.
8. Gerät erneut löschen, in `/papierkorb` als Admin endgültig löschen — Eintrag und Dateien sind weg.
9. Liste: Filter nach Kategorie und Suche prüfen.

- [ ] **Step 3: FEATURES.md abschließen**

In `FEATURES.md` den Eintrag „Equipment-Verwaltung" unter Welle 3 von *(in Umsetzung, …)* auf *erledigt* mit heutigem Datum umstellen (gleiches Muster wie die übrigen Welle-3-Punkte), analog:

```markdown
- [x] **Equipment-Verwaltung** — *erledigt DD.MM.2026. Entwurf:
  [docs/superpowers/specs/2026-08-19-equipment-design.md](docs/superpowers/specs/2026-08-19-equipment-design.md)*
  Bereich für allgemeines Band-Equipment: Stammdaten (Kategorie, Anschaffungsdatum/-kosten,
  Standort, Zustand, Notizen), Kostenbeteiligung einzelner Mitglieder mit frei eintragbaren
  Beträgen + Vermerk, Foto-Upload (auch direkt per Smartphone-Kamera) und Rechnungs-Upload je
  Gerät. Liste aller Geräte mit Detailansicht inkl. Beteiligungsübersicht. Eigene
  `equipment_attachments`-Tabelle parallel zu den Song-Anhängen, ins bestehende
  Papierkorb-System integriert.
```

(Datum beim tatsächlichen Abschluss der Implementierung einsetzen, nicht das Datum der Planerstellung.)

- [ ] **Step 4: Commit**

```bash
git add FEATURES.md
git commit -m "docs: Equipment-Verwaltung in FEATURES.md als erledigt markieren"
```
