import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationLog, pushSubscriptions, users } from "@/lib/db/schema";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
});

const logZeile = (channel?: "mail" | "push") =>
  db.insert(notificationLog).values({
    kind: "reminder",
    refType: "event_soon",
    refId: 1,
    userId: f.users.anna.id,
    status: "ok",
    ...(channel ? { channel } : {}),
  });

const abo = (userId: number, endpoint = "https://fcm.googleapis.com/fcm/send/a") =>
  db.insert(pushSubscriptions).values({
    userId,
    endpoint,
    p256dh: "p",
    auth: "a",
    label: "Testgerät",
  });

describe("Schema für Web Push", () => {
  it("Log-Zeile ohne channel bekommt 'mail'", async () => {
    await logZeile();
    const [z] = await db.select().from(notificationLog);
    expect(z.channel).toBe("mail");
  });

  it("gleiche Erinnerung darf je Kanal einmal geloggt werden", async () => {
    await logZeile("mail");
    await logZeile("push");
    expect(await db.select().from(notificationLog)).toHaveLength(2);
  });

  it("doppelter Eintrag im selben Kanal wird abgewiesen", async () => {
    await logZeile("mail");
    await expect(logZeile("mail")).rejects.toThrow();
  });

  it("neuer User hat notifyChannel 'beides'", async () => {
    const u = await db.query.users.findFirst({ where: eq(users.id, f.users.anna.id) });
    expect(u?.notifyChannel).toBe("beides");
  });

  it("Abo wird mit dem User gelöscht (cascade)", async () => {
    // Frischer User ohne Bandmitgliedschaft/Inhalte — sonst blockieren andere FKs.
    const [neu] = await db
      .insert(users)
      .values({ name: "Neu", email: "neu@test.at", passwordHash: "x" })
      .returning();
    await abo(neu.id);
    await db.delete(users).where(eq(users.id, neu.id));
    expect(await db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("endpoint ist eindeutig", async () => {
    await abo(f.users.anna.id);
    await expect(abo(f.users.bert.id)).rejects.toThrow();
  });
});
