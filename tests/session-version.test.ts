import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, pushSubscriptions } from "@/lib/db/schema";
import { saveSubscription, listSubscriptions } from "@/lib/push-subscriptions";
import { setPassword } from "@/lib/auth";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let a: Fixtures;

beforeAll(async () => {
  a = await anlegen();
});

async function laden(id: number) {
  return (await db.query.users.findFirst({ where: eq(users.id, id) }))!;
}

describe("setPassword", () => {
  it("setzt den Hash und zählt sessionVersion hoch (meldet andere Sessions ab)", async () => {
    const vorher = await laden(a.users.bert.id);
    expect(vorher.sessionVersion).toBe(0);

    const neu = await setPassword(a.users.bert.id, "neues-passwort");
    const nachher = await laden(a.users.bert.id);

    expect(neu).toBe(1);
    expect(nachher.sessionVersion).toBe(1);
    expect(bcrypt.compareSync("neues-passwort", nachher.passwordHash)).toBe(true);

    expect(await setPassword(a.users.bert.id, "noch-eins-123")).toBe(2);
  });

  it("räumt beim Reset den Token mit ab und lässt andere User unberührt", async () => {
    await db
      .update(users)
      .set({ resetToken: "abc", resetTokenExpiresAt: new Date() })
      .where(eq(users.id, a.users.clara.id));
    await setPassword(a.users.clara.id, "reset-passwort", {
      resetToken: null,
      resetTokenExpiresAt: null,
    });
    const clara = await laden(a.users.clara.id);
    expect(clara.resetToken).toBeNull();
    expect(clara.resetTokenExpiresAt).toBeNull();
    expect((await laden(a.users.anna.id)).sessionVersion).toBe(0);
  });
});

describe("setPassword und Push-Geräte", () => {
  // Eigene Person, damit die übrigen Tests (sessionVersion von anna) unberührt bleiben.
  let pw: { id: number };
  beforeAll(async () => {
    [pw] = await db
      .insert(users)
      .values({ name: "Push Wechsel", email: "pw@test.at", passwordHash: "x" })
      .returning();
  });

  const abo = (userId: number, n: string) =>
    saveSubscription(
      userId,
      { endpoint: `https://fcm.googleapis.com/fcm/send/pw-${n}`, p256dh: "p", auth: "a" },
      "Test"
    );

  it("entfernt die Push-Geräte der Person (abgemeldete Geräte bekommen nichts mehr)", async () => {
    await abo(pw.id, "1");
    await abo(pw.id, "2");
    await abo(a.users.clara.id, "3");
    await setPassword(pw.id, "anna-neu-123");
    expect(await listSubscriptions(pw.id)).toHaveLength(0);
    expect(await listSubscriptions(a.users.clara.id)).toHaveLength(1);
    await db.delete(pushSubscriptions);
  });

  it("behält das Gerät, an dem das Passwort geändert wurde", async () => {
    await abo(pw.id, "hier");
    await abo(pw.id, "anderes");
    await setPassword(pw.id, "anna-neu-456", {}, {
      keepPushEndpoint: "https://fcm.googleapis.com/fcm/send/pw-hier",
    });
    const rest = await listSubscriptions(pw.id);
    expect(rest.map((r) => r.endpoint)).toEqual(["https://fcm.googleapis.com/fcm/send/pw-hier"]);
    await db.delete(pushSubscriptions);
  });
});
