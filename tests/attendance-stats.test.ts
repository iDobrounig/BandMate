import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events, eventAttendance } from "@/lib/db/schema";
import { fetchAttendanceStats } from "@/lib/queries";
import { anlegen, isoTag } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
  // Zusätzliche vergangene Probe mit Rückmeldungen — die Basis-Fixtures haben
  // nur eine vergangene Probe (alteProbe) ganz ohne Rückmeldung.
  const [probeMitRSVP] = await db
    .insert(events)
    .values({
      title: "Alte Probe mit RSVP",
      kind: "rehearsal",
      date: isoTag(-5),
      createdById: f.users.anna.id,
    })
    .returning();
  await db.insert(eventAttendance).values([
    { eventId: probeMitRSVP.id, userId: f.users.anna.id, status: "yes" },
    { eventId: probeMitRSVP.id, userId: f.users.bert.id, status: "no" },
    { eventId: probeMitRSVP.id, userId: f.users.clara.id, status: "maybe" },
  ]);
});

describe("fetchAttendanceStats", () => {
  it("zählt Zusagen aus vergangenen Proben", async () => {
    const stats = await fetchAttendanceStats();
    const anna = stats.find((s) => s.userId === f.users.anna.id)!;
    expect(anna.yes).toBe(1);
    expect(anna.no).toBe(0);
    expect(anna.percentage).toBe(100);
  });

  it("zählt Absagen und berechnet die Quote entsprechend", async () => {
    const stats = await fetchAttendanceStats();
    const bert = stats.find((s) => s.userId === f.users.bert.id)!;
    expect(bert.no).toBe(1);
    expect(bert.yes).toBe(0);
    expect(bert.percentage).toBe(0);
  });

  it("'Vielleicht' fließt nicht in die Quote ein", async () => {
    const stats = await fetchAttendanceStats();
    const clara = stats.find((s) => s.userId === f.users.clara.id)!;
    expect(clara.maybe).toBe(1);
    expect(clara.yes).toBe(0);
    expect(clara.no).toBe(0);
    expect(clara.percentage).toBeNull();
  });

  it("zählt Zusagen aus künftigen Terminen (Gig) nicht mit", async () => {
    // Anna hat beim künftigen Gig 'yes' zugesagt — darf hier nicht auftauchen.
    const stats = await fetchAttendanceStats();
    const anna = stats.find((s) => s.userId === f.users.anna.id)!;
    expect(anna.yes).toBe(1); // nur aus der einen vergangenen Probe
  });

  it("lässt deaktivierte Mitglieder aus", async () => {
    const stats = await fetchAttendanceStats();
    expect(stats.find((s) => s.userId === f.users.dora.id)).toBeUndefined();
  });

  it("sortiert alphabetisch nach Name", async () => {
    const stats = await fetchAttendanceStats();
    const names = stats.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "de")));
  });
});
