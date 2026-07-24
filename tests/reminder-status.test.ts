import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { notificationRuns } from "@/lib/db/schema";
import { fetchReminderStatus } from "@/lib/notifications";
import { anlegen } from "./helpers/fixtures";

beforeEach(async () => {
  await anlegen();
});

const vorTagen = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function lauf(over: Partial<typeof notificationRuns.$inferInsert> = {}) {
  await db.insert(notificationRuns).values({
    art: "reminders",
    startedAt: new Date(),
    finishedAt: new Date(),
    sentCount: 0,
    errorCount: 0,
    ...over,
  });
}

describe("fetchReminderStatus", () => {
  it("ist stale, wenn noch nie ein Lauf verzeichnet wurde", async () => {
    const s = await fetchReminderStatus();
    expect(s.lastRunAt).toBeNull();
    expect(s.stale).toBe(true);
  });

  it("ist nicht stale bei einem frischen, fehlerfreien Lauf", async () => {
    await lauf({ startedAt: new Date(), sentCount: 3, errorCount: 0 });
    const s = await fetchReminderStatus();
    expect(s.sentCount).toBe(3);
    expect(s.stale).toBe(false);
  });

  it("wird stale, wenn der letzte Lauf älter als zwei Tage ist", async () => {
    await lauf({ startedAt: vorTagen(3) });
    expect((await fetchReminderStatus()).stale).toBe(true);
  });

  it("ist stale, sobald der letzte Lauf Fehler hatte — auch wenn frisch", async () => {
    await lauf({ startedAt: new Date(), sentCount: 2, errorCount: 1 });
    const s = await fetchReminderStatus();
    expect(s.errorCount).toBe(1);
    expect(s.stale).toBe(true);
  });

  it("betrachtet nur den JÜNGSTEN Lauf", async () => {
    await lauf({ startedAt: vorTagen(5), sentCount: 9 }); // alt
    await lauf({ startedAt: new Date(), sentCount: 4, errorCount: 0 }); // frisch
    const s = await fetchReminderStatus();
    expect(s.sentCount).toBe(4);
    expect(s.stale).toBe(false);
  });

  it("ignoriert Läufe anderer Art (z.B. digest)", async () => {
    await lauf({ art: "digest", startedAt: new Date(), sentCount: 7 });
    // Nur ein digest-Lauf, kein reminders-Lauf → als „nie gelaufen" behandelt
    const s = await fetchReminderStatus();
    expect(s.lastRunAt).toBeNull();
    expect(s.stale).toBe(true);
  });
});
