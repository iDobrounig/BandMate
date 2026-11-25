import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import {
  saveSubscription,
  removeSubscription,
  removeSubscriptionById,
  listSubscriptions,
  countDevices,
} from "@/lib/push-subscriptions";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
});

const sub = (n: number | string, p256dh = "p-key", auth = "a-key") => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${n}`,
  p256dh,
  auth,
});

describe("Push-Abos", () => {
  it("speichert ein Abo und listet es", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "iPhone · Safari");
    const liste = await listSubscriptions(f.users.anna.id);
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({ endpoint: sub(1).endpoint, label: "iPhone · Safari" });
  });

  it("gleicher Endpoint erneut → keine zweite Zeile, Schlüssel aktualisiert", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await saveSubscription(f.users.anna.id, sub(1, "neu-p", "neu-a"), "B");
    const alle = await db.select().from(pushSubscriptions);
    expect(alle).toHaveLength(1);
    expect(alle[0]).toMatchObject({ p256dh: "neu-p", auth: "neu-a", label: "B" });
  });

  it("Endpoint eines anderen Users wechselt den Besitzer", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await saveSubscription(f.users.bert.id, sub(1), "A");
    expect(await listSubscriptions(f.users.anna.id)).toHaveLength(0);
    expect(await listSubscriptions(f.users.bert.id)).toHaveLength(1);
  });

  it("mehr als 10 Abos → das älteste fällt weg", async () => {
    for (let i = 1; i <= 11; i++) await saveSubscription(f.users.anna.id, sub(i), `G${i}`);
    const liste = await listSubscriptions(f.users.anna.id);
    expect(liste).toHaveLength(10);
    expect(liste.map((l) => l.endpoint)).not.toContain(sub(1).endpoint);
    expect(liste.map((l) => l.endpoint)).toContain(sub(11).endpoint);
  });

  it("listet das neueste zuerst", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "alt");
    await saveSubscription(f.users.anna.id, sub(2), "neu");
    expect((await listSubscriptions(f.users.anna.id))[0].label).toBe("neu");
  });

  it("removeSubscription löscht nur eigene", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await removeSubscription(f.users.bert.id, sub(1).endpoint);
    expect(await listSubscriptions(f.users.anna.id)).toHaveLength(1);
    await removeSubscription(f.users.anna.id, sub(1).endpoint);
    expect(await listSubscriptions(f.users.anna.id)).toHaveLength(0);
  });

  it("removeSubscriptionById liefert false für fremde ID", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    const [abo] = await listSubscriptions(f.users.anna.id);
    expect(await removeSubscriptionById(f.users.bert.id, abo.id)).toBe(false);
    expect(await listSubscriptions(f.users.anna.id)).toHaveLength(1);
    expect(await removeSubscriptionById(f.users.anna.id, abo.id)).toBe(true);
    expect(await listSubscriptions(f.users.anna.id)).toHaveLength(0);
  });

  it("countDevices zählt je User, fehlende = nicht in Map", async () => {
    await saveSubscription(f.users.anna.id, sub(1), "A");
    await saveSubscription(f.users.anna.id, sub(2), "B");
    await saveSubscription(f.users.bert.id, sub(3), "C");
    const m = await countDevices([f.users.anna.id, f.users.bert.id, f.users.clara.id]);
    expect(m.get(f.users.anna.id)).toBe(2);
    expect(m.get(f.users.bert.id)).toBe(1);
    expect(m.has(f.users.clara.id)).toBe(false);
    expect((await countDevices([])).size).toBe(0);
  });
});
