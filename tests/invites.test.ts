import { beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bandMembers, invites } from "@/lib/db/schema";
import { consumeInvite, fetchValidInvite, joinBand, makeInvite } from "@/lib/invites";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let a: Fixtures;

beforeEach(async () => {
  await db.delete(invites);
  a = await anlegen();
});

async function rolleVon(userId: number) {
  const m = await db.query.bandMembers.findFirst({
    where: and(eq(bandMembers.bandId, a.bandId), eq(bandMembers.userId, userId)),
  });
  return m && { role: m.role, active: m.active };
}

function tokenAus(url: string) {
  return url.split("/einladung/")[1];
}

describe("Einladungen", () => {
  it("lässt sich genau einmal einlösen", async () => {
    const res = await makeInvite(a.bandId, "neu@test.at", "member", a.users.anna.id);
    if ("error" in res) throw new Error(res.error);
    const token = tokenAus(res.url);

    expect(await fetchValidInvite(token)).not.toBeNull();
    expect(await consumeInvite(token)).toBe(true);
    expect(await consumeInvite(token)).toBe(false);
    expect(await fetchValidInvite(token)).toBeNull();
  });

  it("verweigert Einladung für aktive Mitglieder", async () => {
    const res = await makeInvite(a.bandId, a.users.bert.email, "member", a.users.anna.id);
    expect(res).toEqual({ error: "Diese Person ist bereits in der Band." });
  });

  it("stuft einen aktiven Band-Admin über einen Mitglieds-Link nicht herab", async () => {
    await joinBand(a.users.anna.id, a.bandId, "member");
    expect(await rolleVon(a.users.anna.id)).toEqual({ role: "band_admin", active: true });
  });

  it("stuft ein aktives Mitglied über einen Admin-Link hoch", async () => {
    await joinBand(a.users.bert.id, a.bandId, "band_admin");
    expect(await rolleVon(a.users.bert.id)).toEqual({ role: "band_admin", active: true });
  });

  it("reaktiviert Ausgetretene mit der Rolle aus der Einladung", async () => {
    await db
      .update(bandMembers)
      .set({ role: "band_admin" })
      .where(and(eq(bandMembers.bandId, a.bandId), eq(bandMembers.userId, a.users.dora.id)));
    await joinBand(a.users.dora.id, a.bandId, "member");
    expect(await rolleVon(a.users.dora.id)).toEqual({ role: "member", active: true });
  });
});
