import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { saveSubscription } from "@/lib/push-subscriptions";
import { saveSettings } from "@/lib/notifications";
import { deliverNotification, type NotifyOpts } from "@/lib/notify";
import { sendBandMail } from "@/lib/mail";
import { sendToUser } from "@/lib/push";
import { anlegen } from "./helpers/fixtures";

vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
vi.mock("@/lib/mail", () => ({ sendBandMail: vi.fn() }));
vi.mock("@/lib/push", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/push")>();
  return { ...orig, sendToUser: vi.fn(orig.sendToUser) };
});

const push = vi.mocked(webpush.sendNotification);
const mail = vi.mocked(sendBandMail);

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

const VAPID = {
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
  VAPID_SUBJECT: "mailto:t@example.com",
};

beforeEach(async () => {
  f = await anlegen();
  push.mockReset();
  push.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  mail.mockReset();
  mail.mockResolvedValue(undefined);
  Object.assign(process.env, VAPID);
});

afterEach(() => {
  for (const k of Object.keys(VAPID)) delete process.env[k];
});

const opts = (over: Partial<NotifyOpts> = {}): NotifyOpts => ({
  kind: "suggestion",
  bandId: f.bandId,
  subject: "Neuer Songvorschlag: Wonderwall",
  heading: "Neuer Songvorschlag",
  intro: "Anna hat einen neuen Song vorgeschlagen:",
  highlight: "Wonderwall – Oasis",
  cta: { label: "Ansehen", url: "/songs/1" },
  excludeUserId: f.users.anna.id,
  ...over,
});

const geraet = (userId: number, n = userId) =>
  saveSubscription(
    userId,
    { endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, p256dh: "p", auth: "a" },
    "Test"
  );
const kanal = (userId: number, notifyChannel: "beides" | "push" | "mail") =>
  db.update(users).set({ notifyChannel }).where(eq(users.id, userId));
const sortiert = (ids: number[]) => [...ids].sort();
const mailAn = () => (mail.mock.calls[0]?.[0] ?? []).slice().sort();

describe("deliverNotification", () => {
  it("ohne Geräte: exakt wie bisher – alle Empfänger per Mail, kein Push", async () => {
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([]);
    expect(sortiert(r.mail)).toEqual(sortiert([f.users.bert.id, f.users.clara.id]));
    expect(push).not.toHaveBeenCalled();
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mailAn()).toEqual(["bert@test.at", "clara@test.at"].sort());
    expect(mail.mock.calls[0][1]).toMatchObject({
      subject: "Neuer Songvorschlag: Wonderwall",
      heading: "Neuer Songvorschlag",
    });
  });

  it("'beides' mit Gerät: Push und Mail", async () => {
    await geraet(f.users.bert.id);
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([f.users.bert.id]);
    expect(r.mail).toContain(f.users.bert.id);
  });

  it("'push' mit Gerät: nur Push", async () => {
    await geraet(f.users.bert.id);
    await kanal(f.users.bert.id, "push");
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([f.users.bert.id]);
    expect(r.mail).not.toContain(f.users.bert.id);
    expect(mailAn()).toEqual(["clara@test.at"]);
  });

  it("'push', Push scheitert an allen Geräten (410) → Mail-Rückfall", async () => {
    await geraet(f.users.bert.id);
    await kanal(f.users.bert.id, "push");
    push.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([]);
    expect(r.mail).toContain(f.users.bert.id);
  });

  it("'mail' mit Gerät: nur Mail", async () => {
    await geraet(f.users.bert.id);
    await kanal(f.users.bert.id, "mail");
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([]);
    expect(r.mail).toContain(f.users.bert.id);
    expect(push).not.toHaveBeenCalled();
  });

  it("Auslöser (excludeUserId) bekommt nichts", async () => {
    await geraet(f.users.anna.id);
    const r = await deliverNotification(opts());
    expect(r.push).not.toContain(f.users.anna.id);
    expect(r.mail).not.toContain(f.users.anna.id);
  });

  it("Matrix 'nie'/'gesammelt' bekommt auf keinem Kanal etwas", async () => {
    await geraet(f.users.bert.id);
    await geraet(f.users.clara.id);
    await saveSettings(f.users.bert.id, { suggestion: "nie" });
    await saveSettings(f.users.clara.id, { suggestion: "gesammelt" });
    const r = await deliverNotification(opts());
    expect(r).toEqual({ push: [], mail: [] });
    expect(push).not.toHaveBeenCalled();
    expect(mail).not.toHaveBeenCalled();
  });

  it("ohne VAPID: 'push'-Nutzer mit Gerät bekommt Mail", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await geraet(f.users.bert.id);
    await kanal(f.users.bert.id, "push");
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([]);
    expect(r.mail).toContain(f.users.bert.id);
    expect(push).not.toHaveBeenCalled();
  });

  it("Ausnahme im Push-Zweig (z.B. DB gesperrt) verhindert die Mail nicht", async () => {
    await geraet(f.users.bert.id);
    await kanal(f.users.bert.id, "push");
    vi.mocked(sendToUser).mockRejectedValueOnce(new Error("SQLITE_BUSY"));
    const r = await deliverNotification(opts());
    expect(r.push).toEqual([]);
    expect(sortiert(r.mail)).toEqual(sortiert([f.users.bert.id, f.users.clara.id]));
    expect(mailAn()).toEqual(["bert@test.at", "clara@test.at"].sort());
  });

  it("Push-Titel enthält den Bandnamen der auslösenden Band", async () => {
    await geraet(f.users.bert.id);
    await deliverNotification(opts());
    const payload = JSON.parse(String(push.mock.calls[0][1]));
    expect(payload).toMatchObject({
      title: "BandMate · Testband",
      body: "Anna hat einen neuen Song vorgeschlagen: Wonderwall – Oasis",
      url: "/songs/1",
    });
    expect(push.mock.calls[0][2]).toMatchObject({ TTL: 86400, urgency: "normal" });
  });
});
