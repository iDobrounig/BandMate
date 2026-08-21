import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  notificationLog,
  notificationRuns,
} from "@/lib/db/schema";
import { planReminders, runReminders, tagePlus } from "@/lib/reminders";
import { saveSettings } from "@/lib/notifications";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
});

const URL = "https://band.example.com";

/** Legt einen Termin an dem um `tage` verschobenen Tag an. */
async function terminAn(tage: number, over = {}) {
  const [e] = await db
    .insert(events)
    .values({
      bandId: f.bandId,
      title: "Bandprobe",
      kind: "rehearsal",
      date: tagePlus(tage),
      startTime: "19:30",
      location: "Proberaum",
      createdById: f.users.anna.id,
      ...over,
    })
    .returning();
  return e;
}

const rsvp = (eventId: number, userId: number, status: "yes" | "no" | "maybe") =>
  db.insert(eventAttendance).values({ eventId, userId, status });

const empfaenger = (p: { userId: number }[]) => p.map((x) => x.userId).sort();

describe("2-Tage-Erinnerung (an Unentschiedene)", () => {
  it("geht an alle aktiven, die noch nicht geantwortet haben", async () => {
    const e = await terminAn(2);
    const geplant = await planReminders(URL);
    expect(geplant.every((p) => p.refType === "event_rsvp")).toBe(true);
    expect(geplant.every((p) => p.refId === e.id)).toBe(true);
    // anna, bert, clara — nicht die deaktivierte dora
    expect(empfaenger(geplant)).toEqual(
      [f.users.anna.id, f.users.bert.id, f.users.clara.id].sort()
    );
  });

  it("überspringt, wer schon irgendwie geantwortet hat", async () => {
    const e = await terminAn(2);
    await rsvp(e.id, f.users.bert.id, "no"); // auch „no" zählt als geantwortet
    const geplant = await planReminders(URL);
    expect(empfaenger(geplant)).toEqual([f.users.anna.id, f.users.clara.id].sort());
  });

  it("nennt Titel und Termin im Betreff und Inhalt", async () => {
    await terminAn(2, { title: "Sommerfest", kind: "gig" });
    const [p] = await planReminders(URL);
    expect(p.subject).toContain("Sommerfest");
    expect(p.content.heading).toContain("Gig");
    expect(p.content.cta?.url).toContain("/termine/");
  });
});

describe("Vortags-Erinnerung (an Zusagende)", () => {
  it("geht nur an ja/vielleicht, nicht an Absager oder Stumme", async () => {
    const e = await terminAn(1);
    await rsvp(e.id, f.users.anna.id, "yes");
    await rsvp(e.id, f.users.clara.id, "maybe");
    await rsvp(e.id, f.users.bert.id, "no");
    // dora ist inaktiv, würde selbst mit „yes" nicht erreicht

    const geplant = await planReminders(URL);
    expect(geplant.every((p) => p.refType === "event_soon")).toBe(true);
    expect(empfaenger(geplant)).toEqual([f.users.anna.id, f.users.clara.id].sort());
  });

  it("hängt die Probe-Agenda an", async () => {
    const e = await terminAn(1);
    await rsvp(e.id, f.users.anna.id, "yes");
    await db.insert(eventSongs).values({
      eventId: e.id,
      songId: f.songs.inProbe.id,
      position: 1,
    });

    const [p] = await planReminders(URL);
    const details = (p.content.details ?? []).join("\n");
    expect(details).toContain("In Probe"); // Songtitel aus den Fixtures
  });
});

describe("Zeitfenster", () => {
  it("ignoriert Termine, die nicht genau morgen oder übermorgen sind", async () => {
    await terminAn(0); // heute
    await terminAn(3); // in 3 Tagen
    await rsvp((await terminAn(5)).id, f.users.anna.id, "yes");
    expect(await planReminders(URL)).toHaveLength(0);
  });

  it("lässt gelöschte Termine aus", async () => {
    await terminAn(2, { deletedAt: new Date(), deletedById: f.users.anna.id });
    expect(await planReminders(URL)).toHaveLength(0);
  });
});

describe("Einstellungen", () => {
  it("überspringt, wer Erinnerungen auf „nie\" gestellt hat", async () => {
    await saveSettings(f.users.clara.id, { reminder: "nie" });
    await terminAn(2);
    const geplant = await planReminders(URL);
    expect(empfaenger(geplant)).toEqual([f.users.anna.id, f.users.bert.id].sort());
  });
});

describe("Idempotenz", () => {
  it("plant nichts, was schon erfolgreich versendet wurde", async () => {
    const e = await terminAn(2);
    await db.insert(notificationLog).values({
      kind: "reminder",
      refType: "event_rsvp",
      refId: e.id,
      userId: f.users.anna.id,
      status: "ok",
    });
    const geplant = await planReminders(URL);
    expect(empfaenger(geplant)).toEqual([f.users.bert.id, f.users.clara.id].sort());
  });

  it("plant einen fehlgeschlagenen Versand erneut ein", async () => {
    const e = await terminAn(2);
    await db.insert(notificationLog).values({
      kind: "reminder",
      refType: "event_rsvp",
      refId: e.id,
      userId: f.users.anna.id,
      status: "fehler",
      error: "SMTP kurz weg",
    });
    // „fehler" darf NICHT als erledigt gelten
    const geplant = await planReminders(URL);
    expect(empfaenger(geplant)).toContain(f.users.anna.id);
  });
});

describe("runReminders (ohne SMTP)", () => {
  it("hält den Lauf fest und protokolliert jeden Fehlversuch", async () => {
    await terminAn(2); // 3 Empfänger, aber SMTP ist im Test aus

    const ergebnis = await runReminders(URL);
    expect(ergebnis.sent).toBe(0);
    expect(ergebnis.errors).toBe(3);

    const laeufe = await db.select().from(notificationRuns);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0].art).toBe("reminders");
    expect(laeufe[0].finishedAt).not.toBeNull();
    expect(laeufe[0].errorCount).toBe(3);
    expect(laeufe[0].note).toContain("SMTP nicht konfiguriert");

    const log = await db.select().from(notificationLog);
    expect(log).toHaveLength(3);
    expect(log.every((l) => l.status === "fehler")).toBe(true);
  });

  it("verschickt beim zweiten Lauf dieselben Fehlversuche erneut (kein Duplikat)", async () => {
    await terminAn(2);
    await runReminders(URL);
    await runReminders(URL);
    // Immer noch genau 3 Zeilen — Upsert, nicht Insert
    expect(await db.select().from(notificationLog)).toHaveLength(3);
    expect(await db.select().from(notificationRuns)).toHaveLength(2);
  });
});
