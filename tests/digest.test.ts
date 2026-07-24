import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  songs,
  comments,
  events,
  notificationLog,
  notificationRuns,
} from "@/lib/db/schema";
import {
  isoWoche,
  buildDigest,
  runDigest,
  type GatheredContent,
} from "@/lib/digest";
import { saveSettings } from "@/lib/notifications";
import type { TodoData } from "@/lib/todo";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
});

const leererTodo: TodoData = {
  offeneTermine: [],
  offeneVorschlaege: [],
  ungeuebteAgenda: [],
  neueKommentare: 0,
  gesamt: 0,
};
const leerGathered: GatheredContent = {
  neueVorschlaege: [],
  neueTermine: [],
  neueKommentare: 0,
};

describe("isoWoche", () => {
  it("liefert Jahr*100 + Kalenderwoche", () => {
    // 1. Januar 2026 ist ein Donnerstag -> KW 1
    expect(isoWoche(new Date("2026-01-01T12:00:00"))).toBe(202601);
    // Mitte des Jahres irgendeine plausible Woche
    const w = isoWoche(new Date("2026-07-23T12:00:00"));
    expect(w).toBeGreaterThan(202629);
    expect(w).toBeLessThan(202632);
  });

  it("ist für dieselbe Woche stabil (Idempotenz-Schlüssel)", () => {
    const mo = isoWoche(new Date("2026-07-20T09:00:00"));
    const so = isoWoche(new Date("2026-07-26T21:00:00"));
    expect(mo).toBe(so);
  });
});

describe("buildDigest", () => {
  it("liefert null, wenn es nichts zu berichten gibt", () => {
    expect(buildDigest("Anna", leerGathered, leererTodo, "https://x")).toBeNull();
  });

  it("baut Inhalt aus Aufgaben UND Wochen-Posten", () => {
    const todo: TodoData = {
      ...leererTodo,
      offeneVorschlaege: [{ id: 1, title: "X", artist: null }],
      gesamt: 1,
    };
    const g: GatheredContent = {
      ...leerGathered,
      neueTermine: [{ id: 9, title: "Sommerfest", date: "2026-08-01" }],
    };
    const c = buildDigest("Anna", g, todo, "https://band.example.com")!;
    expect(c).not.toBeNull();
    expect(c.intro).toContain("Anna");
    expect(c.details!.some((d) => d.includes("auf deine Stimme"))).toBe(true);
    expect(c.details!.some((d) => d.includes("Sommerfest"))).toBe(true);
    expect(c.cta!.url).toBe("https://band.example.com/");
  });
});

describe("runDigest", () => {
  it("hält den Lauf fest und loggt jeden aktiven digest-Empfänger", async () => {
    // Ohne SMTP im Test: Empfänger mit Inhalt -> Fehler, ohne Inhalt -> ok(still).
    // Fixtures: kommendeProbe in 3 Tagen ohne annas/berts/claras Rückmeldung ->
    // alle haben mindestens den offenen Termin, also Inhalt.
    const r = await runDigest("https://x");
    const laeufe = await db.select().from(notificationRuns);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0].art).toBe("digest");
    expect(laeufe[0].finishedAt).not.toBeNull();

    // 3 aktive, digestEnabled per Default -> 3 Log-Zeilen (fehler, da kein SMTP)
    const log = await db.select().from(notificationLog).where(eq(notificationLog.kind, "digest"));
    expect(log).toHaveLength(3);
  });

  it("überspringt, wer den Digest abgeschaltet hat", async () => {
    await db.update(users).set({ digestEnabled: false }).where(eq(users.id, f.users.clara.id));
    await runDigest("https://x");
    const log = await db.select().from(notificationLog).where(eq(notificationLog.kind, "digest"));
    expect(log.map((l) => l.userId)).not.toContain(f.users.clara.id);
    expect(log).toHaveLength(2);
  });

  it("ist idempotent: ein zweiter Lauf lässt bereits erledigte Empfänger unangetastet", async () => {
    await runDigest("https://x");
    // Erfolg simulieren, mit einem alten sentAt, an dem man ein erneutes
    // Anfassen erkennen würde (Upsert setzt sentAt auf jetzt).
    const alt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    await db
      .update(notificationLog)
      .set({ status: "ok", error: null, sentAt: alt })
      .where(eq(notificationLog.kind, "digest"));

    await runDigest("https://x");

    const zeilen = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.kind, "digest"));
    // Kein sentAt wurde erneuert -> alle wurden übersprungen, nicht neu geschrieben.
    for (const z of zeilen) {
      expect(Math.abs(z.sentAt.getTime() - alt.getTime())).toBeLessThan(2000);
    }
    expect(await db.select().from(notificationRuns)).toHaveLength(2);
  });

  it("loggt auch einen Empfänger OHNE Inhalt (als ok, ohne zu senden)", async () => {
    // Alle Termine weg; der Fixture-Vorschlag hat anna/bert/clara-Stimmen, also
    // kein offener Vorschlag; Default-Settings sind „sofort", kein „gesammelt".
    // Damit ist für alle 3 aktiven Empfänger nichts zu berichten.
    await db.delete(events);

    const r = await runDigest("https://x");
    const log = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.kind, "digest"));

    // Entscheidend: JEDER aktive Digest-Empfänger bekommt eine Zeile — sonst
    // würde ein leerer Empfänger beim nächsten Lauf doch angeschrieben.
    expect(log).toHaveLength(3);
    expect(log.every((l) => l.status === "ok")).toBe(true);
    expect(r.sent).toBe(0);
    expect(r.errors).toBe(0);
  });
});
