import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { saveSubscription, listSubscriptions } from "@/lib/push-subscriptions";
import { isPushConfigured, sendToUser, vapidPublicKey, PUSH_TTL } from "@/lib/push";
import { anlegen } from "./helpers/fixtures";

vi.mock("web-push", () => ({ default: { sendNotification: vi.fn() } }));
const send = vi.mocked(webpush.sendNotification);

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

const VAPID = {
  VAPID_PUBLIC_KEY: "pub-key",
  VAPID_PRIVATE_KEY: "priv-key",
  VAPID_SUBJECT: "mailto:test@example.com",
};

beforeEach(async () => {
  f = await anlegen();
  send.mockReset();
  send.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
  Object.assign(process.env, VAPID);
});

afterEach(() => {
  for (const k of Object.keys(VAPID)) delete process.env[k];
});

const payload = { title: "BandMate · Testband", body: "Hallo", url: "/" };
const sub = (n: number) => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
  p256dh: `p${n}`,
  auth: `a${n}`,
});
const fehler = (statusCode: number) =>
  Object.assign(new Error(`Status ${statusCode}`), { statusCode, body: "", headers: {} });

describe("Push-Versand", () => {
  it("ohne VAPID: nicht konfiguriert, kein Versandversuch", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    await saveSubscription(f.users.anna.id, sub(1), "A");
    expect(isPushConfigured()).toBe(false);
    expect(vapidPublicKey()).toBeNull();
    const r = await sendToUser(f.users.anna.id, payload, { ttl: PUSH_TTL.sofort, urgency: "normal" });
    expect(r.delivered).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("schickt an alle Geräte mit JSON-Payload, TTL, urgency und vapidDetails", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await saveSubscription(f.users.anna.id, sub(2), "B");
    expect(isPushConfigured()).toBe(true);
    expect(vapidPublicKey()).toBe("pub-key");
    const r = await sendToUser(f.users.anna.id, payload, { ttl: 86400, urgency: "normal" });
    expect(r).toMatchObject({ delivered: 2, failed: 0, removed: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(
      { endpoint: sub(1).endpoint, keys: { p256dh: "p1", auth: "a1" } },
      JSON.stringify(payload),
      expect.objectContaining({
        TTL: 86400,
        urgency: "normal",
        vapidDetails: {
          subject: "mailto:test@example.com",
          publicKey: "pub-key",
          privateKey: "priv-key",
        },
      })
    );
  });

  it("Erfolg setzt lastSuccessAt", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await sendToUser(f.users.anna.id, payload, { ttl: 60, urgency: "high" });
    const [abo] = await listSubscriptions(f.users.anna.id);
    expect(abo.lastSuccessAt).toBeInstanceOf(Date);
  });

  it("410 und 404 löschen das Abo und zählen als removed, nicht als failed", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await saveSubscription(f.users.anna.id, sub(2), "B");
    send.mockRejectedValueOnce(fehler(410)).mockRejectedValueOnce(fehler(404));
    const r = await sendToUser(f.users.anna.id, payload, { ttl: 60, urgency: "normal" });
    expect(r).toMatchObject({ delivered: 0, failed: 0, removed: 2 });
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("500 behält das Abo, zählt failed und liefert lastError", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    send.mockRejectedValueOnce(fehler(500));
    const r = await sendToUser(f.users.anna.id, payload, { ttl: 60, urgency: "normal" });
    expect(r).toMatchObject({ delivered: 0, failed: 1, removed: 0 });
    expect(r.lastError).toContain("500");
    expect(await listSubscriptions(f.users.anna.id)).toHaveLength(1);
  });

  it("ein Fehler bei Gerät 1 hält Gerät 2 nicht auf", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await saveSubscription(f.users.anna.id, sub(2), "B");
    send.mockRejectedValueOnce(new Error("Netz weg"));
    const r = await sendToUser(f.users.anna.id, payload, { ttl: 60, urgency: "normal" });
    expect(r).toMatchObject({ delivered: 1, failed: 1 });
  });

  it("schickt nur an Geräte DIESER Person", async () => {
    await saveSubscription(f.users.bert.id, sub(9), "B");
    const r = await sendToUser(f.users.anna.id, payload, { ttl: 60, urgency: "normal" });
    expect(r.delivered).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});
