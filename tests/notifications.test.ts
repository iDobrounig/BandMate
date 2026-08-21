import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationSettings, users } from "@/lib/db/schema";
import {
  fetchSettings,
  saveSettings,
  fetchRecipients,
  readSettingsForm,
} from "@/lib/notifications";
import { NOTIFY_KINDS } from "@/lib/constants";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
});

const namen = (r: { name: string }[]) => r.map((x) => x.name).sort();

describe("Standardwerte", () => {
  it("liefert für jemanden ohne gespeicherte Zeile überall den Standard", async () => {
    const s = await fetchSettings(f.users.anna.id);
    expect(s.suggestion).toBe("sofort");
    expect(s.reminder).toBe("sofort");
    expect(Object.keys(s)).toHaveLength(5);
  });

  it("speichert nur Abweichungen, nicht den Standard", async () => {
    await saveSettings(f.users.anna.id, {
      suggestion: "nie",
      comment: "sofort", // = Standard, darf keine Zeile erzeugen
    });
    const zeilen = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.userId, f.users.anna.id));
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].kind).toBe("suggestion");
  });

  it("räumt die Zeile wieder weg, wenn jemand zum Standard zurückkehrt", async () => {
    await saveSettings(f.users.anna.id, { suggestion: "nie" });
    expect(await db.select().from(notificationSettings)).toHaveLength(1);

    await saveSettings(f.users.anna.id, { suggestion: "sofort" });
    expect(await db.select().from(notificationSettings)).toHaveLength(0);
    expect((await fetchSettings(f.users.anna.id)).suggestion).toBe("sofort");
  });

  it("weist einen Modus ab, den es für diesen Typ nicht gibt", async () => {
    // "gesammelt" ergibt bei einer Erinnerung keinen Sinn
    expect(NOTIFY_KINDS.reminder.modes).not.toContain("gesammelt");
    await saveSettings(f.users.anna.id, { reminder: "gesammelt" });
    expect(await db.select().from(notificationSettings)).toHaveLength(0);
    expect((await fetchSettings(f.users.anna.id)).reminder).toBe("sofort");
  });
});

describe("Empfänger für Sofortmails", () => {
  it("nimmt standardmäßig alle aktiven Mitglieder außer dem Auslöser", async () => {
    const e = await fetchRecipients("suggestion", f.bandId, { excludeUserId: f.users.bert.id });
    expect(namen(e)).toEqual(["Anna Admin", "Clara Cello"]);
  });

  it("lässt deaktivierte Mitglieder immer weg", async () => {
    const e = await fetchRecipients("suggestion", f.bandId);
    expect(namen(e)).not.toContain("Dora Draussen");
    expect(e).toHaveLength(3);
  });

  it("überspringt, wer „nie\" eingestellt hat", async () => {
    await saveSettings(f.users.clara.id, { suggestion: "nie" });
    const e = await fetchRecipients("suggestion", f.bandId);
    expect(namen(e)).toEqual(["Anna Admin", "Bert Bass"]);
  });

  it("überspringt auch „gesammelt\" — das kommt erst im Digest", async () => {
    await saveSettings(f.users.clara.id, { suggestion: "gesammelt" });
    const e = await fetchRecipients("suggestion", f.bandId);
    expect(namen(e)).not.toContain("Clara Cello");
  });

  it("hält die Ereignistypen auseinander", async () => {
    await saveSettings(f.users.clara.id, { suggestion: "nie" });
    // Nur Vorschläge abgestellt — Termine kommen weiterhin an. Genau das ging
    // mit dem alten einen Schalter nicht.
    expect(namen(await fetchRecipients("suggestion", f.bandId))).not.toContain("Clara Cello");
    expect(namen(await fetchRecipients("event_new", f.bandId))).toContain("Clara Cello");
    expect(namen(await fetchRecipients("reminder", f.bandId))).toContain("Clara Cello");
  });

  it("liefert niemanden, wenn alle abgestellt haben", async () => {
    for (const u of [f.users.anna, f.users.bert, f.users.clara]) {
      await saveSettings(u.id, { comment: "nie" });
    }
    expect(await fetchRecipients("comment", f.bandId)).toHaveLength(0);
  });
});

describe("Formular auslesen", () => {
  it("übernimmt gültige Werte und ignoriert Unfug", () => {
    const fd = new FormData();
    fd.set("notify_suggestion", "nie");
    fd.set("notify_comment", "gesammelt");
    fd.set("notify_reminder", "gesammelt"); // für Erinnerungen nicht erlaubt
    fd.set("notify_event_new", "quatsch");

    const gelesen = readSettingsForm(fd);
    expect(gelesen.suggestion).toBe("nie");
    expect(gelesen.comment).toBe("gesammelt");
    expect(gelesen.reminder).toBeUndefined();
    expect(gelesen.event_new).toBeUndefined();
  });
});

describe("Migration der alten Einstellung", () => {
  it("bildet den alten Aus-Schalter als „nie\" über alle Typen ab", async () => {
    // Was Migration 0005 für notify_by_email = 0 erzeugt hat
    await db.insert(notificationSettings).values(
      (["suggestion", "comment", "event_new", "event_changed", "reminder"] as const).map(
        (kind) => ({ userId: f.users.clara.id, kind, channel: "mail" as const, mode: "nie" as const })
      )
    );

    const s = await fetchSettings(f.users.clara.id);
    expect(Object.values(s).every((m) => m === "nie")).toBe(true);
    for (const kind of ["suggestion", "comment", "event_new", "event_changed", "reminder"] as const) {
      expect(namen(await fetchRecipients(kind, f.bandId))).not.toContain("Clara Cello");
    }
  });

  it("lässt alle anderen unverändert alles bekommen", async () => {
    const uebrig = await db.select().from(users).where(eq(users.active, true));
    expect(uebrig.length).toBeGreaterThan(0);
    expect(namen(await fetchRecipients("suggestion", f.bandId))).toEqual([
      "Anna Admin",
      "Bert Bass",
      "Clara Cello",
    ]);
  });
});
