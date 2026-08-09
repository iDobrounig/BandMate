import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events, eventSongs } from "@/lib/db/schema";
import { fetchSongList, fetchSongUsage } from "@/lib/queries";
import { anlegen, isoTag } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
  // Zusätzlicher, vergangener Gig mit Song in der Agenda — für die
  // Repertoire-Gedächtnis-Tests. Die Basis-Fixtures haben nur einen
  // zukünftigen Proben-Termin in event_songs.
  const [alterGig] = await db
    .insert(events)
    .values({ title: "Alter Gig", kind: "gig", date: isoTag(-10), createdById: f.users.anna.id })
    .returning();
  await db
    .insert(eventSongs)
    .values({ eventId: alterGig.id, songId: f.songs.repertoire.id, position: 1 });
});

describe("fetchSongUsage", () => {
  it("zählt zukünftige Agenda-Termine mit, aber nicht als 'zuletzt geprobt'", async () => {
    const usage = await fetchSongUsage(f.songs.inProbe.id);
    expect(usage.agenda.map((a) => a.title)).toEqual(["Bandprobe"]);
    expect(usage.lastRehearsedAt).toBeNull(); // Termin liegt in der Zukunft
    expect(usage.lastPlayedAt).toBeNull();
    expect(usage.setlists.map((s) => s.name)).toEqual(["Sommerfest"]);
  });

  it("liefert 'zuletzt gespielt' aus einem vergangenen Gig", async () => {
    const usage = await fetchSongUsage(f.songs.repertoire.id);
    expect(usage.lastPlayedAt).toBe(isoTag(-10));
    expect(usage.lastRehearsedAt).toBeNull();
  });

  it("liefert leere Listen für einen Song ohne jede Verwendung", async () => {
    const usage = await fetchSongUsage(f.songs.archiv.id);
    expect(usage.setlists).toEqual([]);
    expect(usage.agenda).toEqual([]);
    expect(usage.lastRehearsedAt).toBeNull();
    expect(usage.lastPlayedAt).toBeNull();
  });
});

describe("fetchSongList — lastEventAt", () => {
  it("berücksichtigt nur vergangene Termine für die Sortierung", async () => {
    const liste = await fetchSongList(f.users.anna.id);
    expect(liste.find((s) => s.id === f.songs.repertoire.id)!.lastEventAt).toBe(
      isoTag(-10)
    );
    // Nur ein zukünftiger Proben-Termin -> zählt nicht als "gespielt"
    expect(liste.find((s) => s.id === f.songs.inProbe.id)!.lastEventAt).toBeNull();
  });
});
