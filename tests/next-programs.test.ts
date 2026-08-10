import { beforeAll, describe, expect, it } from "vitest";
import { fetchUpcomingPrograms } from "@/lib/queries";
import { anlegen, leeren } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
});

describe("fetchUpcomingPrograms", () => {
  it("liefert die nächste Probe mit ihrer Agenda", async () => {
    const { probe } = await fetchUpcomingPrograms();
    expect(probe).not.toBeNull();
    expect(probe!.event.id).toBe(f.events.kommendeProbe.id);
    expect(probe!.agendaSongs.map((s) => s.title)).toEqual(["In Probe"]);
    expect(probe!.setlist).toBeNull();
  });

  it("liefert den nächsten Gig mit verknüpfter Setliste, wenn keine Agenda existiert", async () => {
    const { gig } = await fetchUpcomingPrograms();
    expect(gig).not.toBeNull();
    expect(gig!.event.id).toBe(f.events.kommenderGig.id);
    expect(gig!.agendaSongs).toEqual([]);
    expect(gig!.setlist).toEqual({ id: f.setlists.setliste.id, name: "Sommerfest", songCount: 2 });
  });

  it("liefert null, wenn keine Termine dieser Art anstehen", async () => {
    await leeren();
    const { probe, gig } = await fetchUpcomingPrograms();
    expect(probe).toBeNull();
    expect(gig).toBeNull();
  });
});
