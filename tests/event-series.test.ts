import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events } from "@/lib/db/schema";
import { fetchSeriesInstances } from "@/lib/queries";
import { anlegen, isoTag } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;
const seriesId = "test-serie-abc";

beforeAll(async () => {
  f = await anlegen();
  // Eigene kleine Serie: zwei vergangene, zwei künftige Termine.
  await db.insert(events).values([
    { bandId: f.bandId, title: "Serie", kind: "rehearsal", date: isoTag(-14), seriesId, createdById: f.users.anna.id },
    { bandId: f.bandId, title: "Serie", kind: "rehearsal", date: isoTag(-7), seriesId, createdById: f.users.anna.id },
    { bandId: f.bandId, title: "Serie", kind: "rehearsal", date: isoTag(7), seriesId, createdById: f.users.anna.id },
    { bandId: f.bandId, title: "Serie", kind: "rehearsal", date: isoTag(14), seriesId, createdById: f.users.anna.id },
  ]);
});

describe("fetchSeriesInstances", () => {
  it("liefert alle Instanzen der Serie, nach Datum sortiert", async () => {
    const instances = await fetchSeriesInstances(seriesId, f.bandId);
    expect(instances.map((i) => i.date)).toEqual(
      [isoTag(-14), isoTag(-7), isoTag(7), isoTag(14)]
    );
  });

  it("erlaubt den Vergangen/Künftig-Split per JS-Datum", async () => {
    const instances = await fetchSeriesInstances(seriesId, f.bandId);
    const today = isoTag(0);
    const future = instances.filter((i) => i.date >= today);
    const past = instances.length - future.length;
    expect(future).toHaveLength(2);
    expect(past).toBe(2);
  });

  it("liefert eine leere Liste für eine unbekannte Serien-ID", async () => {
    const instances = await fetchSeriesInstances("gibt-es-nicht", f.bandId);
    expect(instances).toEqual([]);
  });
});
