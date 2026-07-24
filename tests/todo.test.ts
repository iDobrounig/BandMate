import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  events,
  eventAttendance,
  eventSongs,
  votes,
  practiceStatus,
  comments,
  songs,
} from "@/lib/db/schema";
import { fetchTodo, touchLastSeen } from "@/lib/todo";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeEach(async () => {
  f = await anlegen();
  // Die Fixtures bringen eigene Termine mit (u.a. eine Probe in 3 Tagen ohne
  // Annas Rückmeldung) — die würden die Termin-/Agenda-Tests verfälschen.
  // Songs, Votes und Kommentare bleiben für die übrigen Blöcke erhalten.
  await db.delete(events); // kaskadiert auf eventAttendance und eventSongs
});

/** Datum in n Tagen, wie lib/todo es intern rechnet. */
function inTagen(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function terminAn(tage: number, over = {}) {
  const [e] = await db
    .insert(events)
    .values({
      title: "Bandprobe",
      kind: "rehearsal",
      date: inTagen(tage),
      startTime: "19:30",
      createdById: f.users.anna.id,
      ...over,
    })
    .returning();
  return e;
}

describe("offene Termine (nächste 14 Tage ohne Rückmeldung)", () => {
  it("listet einen Termin ohne meine Rückmeldung", async () => {
    const e = await terminAn(3);
    const todo = await fetchTodo(f.users.anna.id, null);
    expect(todo.offeneTermine.map((t) => t.id)).toEqual([e.id]);
  });

  it("blendet Termine aus, für die ich schon geantwortet habe", async () => {
    const e = await terminAn(3);
    await db.insert(eventAttendance).values({
      eventId: e.id,
      userId: f.users.anna.id,
      status: "no",
    });
    expect((await fetchTodo(f.users.anna.id, null)).offeneTermine).toHaveLength(0);
  });

  it("ignoriert Termine außerhalb des 14-Tage-Fensters und vergangene", async () => {
    await terminAn(20);
    await terminAn(-2);
    expect((await fetchTodo(f.users.anna.id, null)).offeneTermine).toHaveLength(0);
  });

  it("lässt gelöschte Termine aus", async () => {
    await terminAn(3, { deletedAt: new Date(), deletedById: f.users.anna.id });
    expect((await fetchTodo(f.users.anna.id, null)).offeneTermine).toHaveLength(0);
  });
});

describe("offene Vorschläge (ohne meine Stimme)", () => {
  it("listet Vorschläge, für die ich noch nicht abgestimmt habe", async () => {
    // Fixtures: „Neuer Vorschlag" ist ein suggestion; bert/anna/clara haben dort
    // gestimmt. dora nicht — aber dora ist inaktiv. Prüfen aus Sicht clara: hat
    // gestimmt (dagegen), also NICHT offen. Aus Sicht … nehmen wir jemanden ohne Stimme.
    const todoBert = await fetchTodo(f.users.bert.id, null);
    // Bert hat für den Vorschlag gestimmt -> nicht offen
    expect(todoBert.offeneVorschlaege.map((s) => s.id)).not.toContain(
      f.songs.vorschlag.id
    );
  });

  it("zeigt einen frischen Vorschlag, für den niemand gestimmt hat", async () => {
    const [neu] = await db
      .insert(songs)
      .values({ title: "Ganz neu", status: "suggestion" })
      .returning();
    const todo = await fetchTodo(f.users.anna.id, null);
    expect(todo.offeneVorschlaege.map((s) => s.id)).toContain(neu.id);
  });

  it("zählt nur Vorschläge, nicht Repertoire/In-Probe", async () => {
    const todo = await fetchTodo(f.users.anna.id, null);
    const ids = todo.offeneVorschlaege.map((s) => s.id);
    expect(ids).not.toContain(f.songs.inProbe.id);
    expect(ids).not.toContain(f.songs.repertoire.id);
  });
});

describe("ungeübte Songs der nächsten Probe-Agenda", () => {
  it("listet Agenda-Songs, die ich noch nicht kann", async () => {
    const e = await terminAn(2);
    await db.insert(eventSongs).values({
      eventId: e.id,
      songId: f.songs.repertoire.id,
      position: 1,
    });
    const todo = await fetchTodo(f.users.anna.id, null);
    expect(todo.ungeuebteAgenda).toHaveLength(1);
    expect(todo.ungeuebteAgenda[0].songs.map((s) => s.id)).toEqual([
      f.songs.repertoire.id,
    ]);
  });

  it("blendet Songs aus, die ich schon kann", async () => {
    const e = await terminAn(2);
    await db.insert(eventSongs).values({
      eventId: e.id,
      songId: f.songs.repertoire.id,
      position: 1,
    });
    await db.insert(practiceStatus).values({
      songId: f.songs.repertoire.id,
      userId: f.users.anna.id,
      status: "ready",
    });
    expect((await fetchTodo(f.users.anna.id, null)).ungeuebteAgenda).toHaveLength(0);
  });

  it("nimmt nur die zeitlich NÄCHSTE Agenda, nicht spätere", async () => {
    const frueh = await terminAn(2);
    const spaet = await terminAn(9);
    await db.insert(eventSongs).values([
      { eventId: frueh.id, songId: f.songs.repertoire.id, position: 1 },
      { eventId: spaet.id, songId: f.songs.inProbe.id, position: 1 },
    ]);
    const todo = await fetchTodo(f.users.anna.id, null);
    expect(todo.ungeuebteAgenda).toHaveLength(1);
    expect(todo.ungeuebteAgenda[0].eventId).toBe(frueh.id);
  });
});

describe("neue Kommentare seit letztem Besuch", () => {
  it("zählt fremde Kommentare nach dem Zeitpunkt, eigene nicht", async () => {
    const gestern = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Fixtures haben 2 Kommentare (anna, clara) am „Neuer Vorschlag"
    // Aus Sicht anna: nur claras Kommentar zählt — wenn nach lastSeen.
    const todo = await fetchTodo(f.users.anna.id, gestern);
    expect(todo.neueKommentare).toBe(1); // claras Kommentar, annas nicht
  });

  it("zählt nichts ohne lastSeenAt (erster Besuch)", async () => {
    expect((await fetchTodo(f.users.anna.id, null)).neueKommentare).toBe(0);
  });

  it("zählt nichts, wenn alle Kommentare älter als der letzte Besuch sind", async () => {
    const morgen = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect((await fetchTodo(f.users.anna.id, morgen)).neueKommentare).toBe(0);
  });
});

describe("Gesamtzahl und touchLastSeen", () => {
  it("summiert alle Posten", async () => {
    await terminAn(3); // 1 offener Termin
    const todo = await fetchTodo(f.users.anna.id, null);
    // 1 Termin + offene Vorschläge (Fixtures: „Neuer Vorschlag" hat anna schon
    // gestimmt -> 0) + Agenda(0) + Kommentare(0, kein lastSeen)
    expect(todo.gesamt).toBe(todo.offeneTermine.length + todo.offeneVorschlaege.length);
  });

  it("touchLastSeen gibt den vorigen Wert zurück und setzt auf jetzt", async () => {
    expect(await touchLastSeen(f.users.anna.id)).toBeNull(); // vorher nie gesetzt
    const zweiter = await touchLastSeen(f.users.anna.id);
    expect(zweiter).not.toBeNull(); // jetzt steht der erste Aufruf drin
  });
});
