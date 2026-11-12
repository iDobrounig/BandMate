import { beforeAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
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
