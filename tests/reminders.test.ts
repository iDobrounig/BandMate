import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  notificationLog,
  notificationRuns,
  users,
} from "@/lib/db/schema";
import { planReminders, runReminders, tagePlus } from "@/lib/reminders";
import { saveSettings } from "@/lib/notifications";
import { saveSubscription } from "@/lib/push-subscriptions";
import { sendToUser } from "@/lib/push";

vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
const push = vi.mocked(webpush.sendNotification);
vi.mock("@/lib/push", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/push")>();
  return { ...orig, sendToUser: vi.fn(orig.sendToUser) };
});

import { anlegen } from "./helpers/fixtures";
import { TEST_VAPID } from "./helpers/vapid";

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

describe("runReminders mit Push", () => {
  const VAPID = TEST_VAPID;
  beforeEach(() => {
    Object.assign(process.env, VAPID);
    push.mockReset();
    push.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  });
  afterEach(() => {
    for (const k of Object.keys(VAPID)) delete process.env[k];
  });

  const geraet = (userId: number) =>
    saveSubscription(
      userId,
      { endpoint: `https://fcm.googleapis.com/fcm/send/${userId}`, p256dh: "p", auth: "a" },
      "Test"
    );
  const kanal = (userId: number, notifyChannel: "beides" | "push" | "mail") =>
    db.update(users).set({ notifyChannel }).where(eq(users.id, userId));
  const logVon = (userId: number) =>
    db.select().from(notificationLog).where(eq(notificationLog.userId, userId));

  it("'push' mit Gerät: Push-Log ok, keine Mail-Zeile", async () => {
    await terminAn(2);
    await geraet(f.users.anna.id);
    await kanal(f.users.anna.id, "push");
    await runReminders(URL);
    const log = await logVon(f.users.anna.id);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ channel: "push", status: "ok" });
  });

  it("zweiter Lauf nach erfolgreichem Push verschickt nichts", async () => {
    await terminAn(2);
    await geraet(f.users.anna.id);
    await kanal(f.users.anna.id, "push");
    await runReminders(URL);
    push.mockClear();
    await runReminders(URL);
    expect(push).not.toHaveBeenCalled();
  });

  it("Push ok + Mail fehler ('beides'): zweiter Lauf verschickt nichts", async () => {
    await terminAn(2);
    await geraet(f.users.anna.id); // 'beides' ist Standard; SMTP ist im Test aus
    await runReminders(URL);
    const log = await logVon(f.users.anna.id);
    expect(log.map((l) => `${l.channel}:${l.status}`).sort()).toEqual([
      "mail:fehler",
      "push:ok",
    ]);
    push.mockClear();
    const zweiter = await runReminders(URL);
    expect(push).not.toHaveBeenCalled();
    expect(await logVon(f.users.anna.id)).toHaveLength(2);
    // Anna gilt als erledigt; nur bert/clara (ohne Gerät) werden erneut versucht.
    expect(zweiter.errors).toBe(2);
  });

  it("'push', Push 410 → Mail-Versuch wird geloggt (fehler, da kein SMTP)", async () => {
    await terminAn(2);
    await geraet(f.users.anna.id);
    await kanal(f.users.anna.id, "push");
    push.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    await runReminders(URL);
    const log = await db
      .select()
      .from(notificationLog)
      .where(and(eq(notificationLog.userId, f.users.anna.id), eq(notificationLog.channel, "mail")));
    expect(log).toHaveLength(1);
    expect(log[0].status).toBe("fehler");
  });

  it("Push-Erinnerung nutzt TTL 43200 und urgency 'high'", async () => {
    const e = await terminAn(2);
    await geraet(f.users.anna.id);
    await runReminders(URL);
    expect(push.mock.calls[0][2]).toMatchObject({ TTL: 43200, urgency: "high" });
    expect(JSON.parse(String(push.mock.calls[0][1]))).toMatchObject({
      title: "BandMate · Testband",
      url: `/termine/${e.id}`,
    });
  });

  it("Ausnahme im Push-Zweig bricht den Lauf nicht ab, Mail-Rückfall greift", async () => {
    await terminAn(2);
    await geraet(f.users.anna.id);
    await kanal(f.users.anna.id, "push");
    vi.mocked(sendToUser).mockRejectedValueOnce(new Error("SQLITE_BUSY"));
    const r = await runReminders(URL);
    // anna: Push-Fehler + Mail-Versuch; bert/clara: Mail-Versuch — alle drei protokolliert
    const mails = await db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.channel, "mail"));
    expect(mails.map((m) => m.userId).sort()).toEqual(
      [f.users.anna.id, f.users.bert.id, f.users.clara.id].sort()
    );
    const annaPush = await db
      .select()
      .from(notificationLog)
      .where(and(eq(notificationLog.userId, f.users.anna.id), eq(notificationLog.channel, "push")));
    expect(annaPush[0]).toMatchObject({ status: "fehler" });
    expect(r.errors).toBe(4);
  });

  it("note zählt Push mit", async () => {
    await terminAn(2);
    await geraet(f.users.anna.id);
    await kanal(f.users.anna.id, "push");
    const r = await runReminders(URL);
    expect(r.sent).toBe(1);
    expect(r.note).toContain("1 Push");
  });
});
