import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  fetchSongList,
  fetchSongDetail,
  fetchSetlists,
  fetchEvents,
  getSetlistPrintData,
} from "@/lib/queries";
import { db } from "@/lib/db";
import { setlists, setlistItems, songs } from "@/lib/db/schema";
import { anlegen, isoTag } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
});

describe("fetchSongList", () => {
  it("liefert alle Songs mit Vorschlagendem", async () => {
    const liste = await fetchSongList(f.users.anna.id, f.bandId);
    expect(liste).toHaveLength(4);
    const vorschlag = liste.find((s) => s.id === f.songs.vorschlag.id)!;
    expect(vorschlag.suggestedByName).toBe("Bert Bass");
    // Songs ohne Vorschlagenden dürfen nicht wegfallen (LEFT JOIN, kein INNER)
    expect(liste.find((s) => s.id === f.songs.inProbe.id)?.suggestedByName).toBeNull();
  });

  it("zählt Stimmen getrennt nach dafür und dagegen", async () => {
    const liste = await fetchSongList(f.users.anna.id, f.bandId);
    const vorschlag = liste.find((s) => s.id === f.songs.vorschlag.id)!;
    expect(vorschlag.upvotes).toBe(2);
    expect(vorschlag.downvotes).toBe(1);
  });

  it("liefert die eigene Stimme je nach Betrachter", async () => {
    const alsAnna = await fetchSongList(f.users.anna.id, f.bandId);
    const alsClara = await fetchSongList(f.users.clara.id, f.bandId);
    const id = f.songs.vorschlag.id;
    expect(alsAnna.find((s) => s.id === id)!.myVote).toBe(1);
    expect(alsClara.find((s) => s.id === id)!.myVote).toBe(-1);
    // Ohne eigene Stimme: 0, nicht null
    expect(alsAnna.find((s) => s.id === f.songs.inProbe.id)!.myVote).toBe(0);
  });

  it("zählt Kommentare, Audios, Noten und Übe-Status getrennt", async () => {
    const liste = await fetchSongList(f.users.anna.id, f.bandId);
    const vorschlag = liste.find((s) => s.id === f.songs.vorschlag.id)!;
    const inProbe = liste.find((s) => s.id === f.songs.inProbe.id)!;

    expect(vorschlag.commentCount).toBe(2);
    expect(vorschlag.audioCount).toBe(0);

    // audioCount und sheetCount dürfen sich nicht vermischen
    expect(inProbe.audioCount).toBe(1);
    expect(inProbe.sheetCount).toBe(2);
    expect(inProbe.commentCount).toBe(0);

    // readyCount zählt nur "ready", nicht "practicing"
    expect(inProbe.readyCount).toBe(2);
  });
});

describe("fetchSongDetail", () => {
  it("liefert null für einen unbekannten Song", async () => {
    expect(await fetchSongDetail(999_999, f.bandId)).toBeNull();
  });

  it("sammelt Links, Dateien, Kommentare, Stimmen und Übe-Status", async () => {
    const detail = (await fetchSongDetail(f.songs.inProbe.id, f.bandId))!;
    expect(detail.song.title).toBe("In Probe");
    expect(detail.files).toHaveLength(3);
    expect(detail.practice).toHaveLength(3);
    expect(detail.comments).toHaveLength(0);

    const vorschlag = (await fetchSongDetail(f.songs.vorschlag.id, f.bandId))!;
    expect(vorschlag.links).toHaveLength(1);
    expect(vorschlag.votes).toHaveLength(3);
    expect(vorschlag.comments.map((c) => c.userName)).toEqual(["Anna Admin", "Clara Cello"]);
    expect(vorschlag.suggestedByName).toBe("Bert Bass");
  });

  it("blendet deaktivierte Mitglieder aus der Band-Übersicht aus", async () => {
    const detail = (await fetchSongDetail(f.songs.inProbe.id, f.bandId))!;
    const namen = detail.allUsers.map((u) => u.name);
    expect(namen).toContain("Anna Admin");
    expect(namen).not.toContain("Dora Draussen");
    expect(detail.allUsers).toHaveLength(3);
  });
});

describe("fetchSetlists", () => {
  it("zählt Songs und summiert die Dauer je Setliste", async () => {
    const listen = await fetchSetlists(f.bandId);
    const sommerfest = listen.find((s) => s.id === f.setlists.setliste.id)!;
    expect(sommerfest.songCount).toBe(2);
    expect(sommerfest.totalSeconds).toBe(240 + 180);
  });

  it("liefert für eine leere Setliste 0 statt null", async () => {
    const listen = await fetchSetlists(f.bandId);
    const leer = listen.find((s) => s.id === f.setlists.leereSetliste.id)!;
    expect(leer.songCount).toBe(0);
    expect(leer.totalSeconds).toBe(0);
  });
});

describe("fetchEvents", () => {
  it("trennt kommende von vergangenen Terminen", async () => {
    const kommend = await fetchEvents(f.users.anna.id, f.bandId);
    const vergangen = await fetchEvents(f.users.anna.id, f.bandId, { past: true });

    expect(kommend.map((e) => e.title)).toEqual(["Bandprobe", "Sommerfest"]); // nach Datum
    expect(vergangen.map((e) => e.title)).toEqual(["Alte Probe"]);
  });

  it("zählt Zu-, Ab- und Vielleicht-Sagen getrennt", async () => {
    const kommend = await fetchEvents(f.users.anna.id, f.bandId);
    const gig = kommend.find((e) => e.id === f.events.kommenderGig.id)!;
    expect(gig.yesCount).toBe(2);
    expect(gig.maybeCount).toBe(1);
    expect(gig.noCount).toBe(0);
  });

  it("liefert den eigenen Status je nach Betrachter", async () => {
    const alsClara = await fetchEvents(f.users.clara.id, f.bandId);
    const alsDora = await fetchEvents(f.users.dora.id, f.bandId);
    const id = f.events.kommenderGig.id;
    expect(alsClara.find((e) => e.id === id)!.myStatus).toBe("maybe");
    expect(alsDora.find((e) => e.id === id)!.myStatus).toBeNull();
  });

  it("hängt den Setlisten-Namen an, ohne Termine ohne Setliste zu verlieren", async () => {
    const kommend = await fetchEvents(f.users.anna.id, f.bandId);
    expect(kommend.find((e) => e.id === f.events.kommenderGig.id)!.setlistName).toBe("Sommerfest");
    expect(kommend.find((e) => e.id === f.events.kommendeProbe.id)!.setlistName).toBeNull();
  });

  it("beachtet das Limit", async () => {
    const kommend = await fetchEvents(f.users.anna.id, f.bandId, { limit: 1 });
    expect(kommend).toHaveLength(1);
    expect(kommend[0].date).toBe(isoTag(3)); // das näheste zuerst
  });
});

describe("getSetlistPrintData", () => {
  it("liefert null für eine unbekannte Setliste", async () => {
    expect(await getSetlistPrintData(999_999, f.bandId)).toBeNull();
  });

  it("liefert null für eine in den Papierkorb gelegte Setliste", async () => {
    const [sl] = await db.insert(setlists).values({ bandId: f.bandId, name: "Gelöschter Testabend" }).returning();
    await db.update(setlists).set({ deletedAt: new Date() }).where(eq(setlists.id, sl.id));

    expect(await getSetlistPrintData(sl.id, f.bandId)).toBeNull();

    await db.delete(setlists).where(eq(setlists.id, sl.id));
  });

  describe("mit Sets, Pausen und Songs", () => {
    let setlistId: number;
    let songAId: number;
    let songBId: number;

    beforeAll(async () => {
      const [sl] = await db
        .insert(setlists)
        .values({ bandId: f.bandId, name: "Testabend", targetSeconds: 500 })
        .returning();
      setlistId = sl.id;

      const [songA] = await db
        .insert(songs)
        .values({
          bandId: f.bandId,
          title: "Opener",
          artist: "Testband",
          status: "repertoire",
          songKey: "G",
          capo: 2,
          tempoBpm: 100,
          durationSeconds: 200,
        })
        .returning();
      songAId = songA.id;
      const [songB] = await db
        .insert(songs)
        .values({ bandId: f.bandId, title: "Rausschmeißer", status: "repertoire", songKey: "D", durationSeconds: 220 })
        .returning();
      songBId = songB.id;

      await db.insert(setlistItems).values([
        { setlistId, kind: "section", label: "Set 1", position: 1 },
        { setlistId, kind: "song", songId: songAId, position: 2, note: "Intro leise" },
        { setlistId, kind: "break", breakSeconds: 600, label: "Umbau", position: 3 },
        { setlistId, kind: "section", label: "Set 2", position: 4 },
        { setlistId, kind: "song", songId: songBId, position: 5 },
      ]);
    });

    afterAll(async () => {
      await db.delete(setlists).where(eq(setlists.id, setlistId)); // FK cascade räumt setlistItems mit auf
      await db.delete(songs).where(eq(songs.id, songAId));
      await db.delete(songs).where(eq(songs.id, songBId));
    });

    it("fasst Sets, Pausen und Zielzeit-Abgleich zusammen", async () => {
      const data = await getSetlistPrintData(setlistId, f.bandId);
      expect(data).not.toBeNull();
      expect(data!.setlist.name).toBe("Testabend");
      expect(data!.items.map((i) => i.kind)).toEqual([
        "section",
        "song",
        "break",
        "section",
        "song",
      ]);
      expect(data!.structure.musicSeconds).toBe(420);
      expect(data!.structure.breakSeconds).toBe(600);
      expect(data!.structure.totalSeconds).toBe(1020);
      expect(data!.cmp).toEqual({ diffSeconds: 520, over: true });

      const set1 = data!.items.find((i) => i.label === "Set 1")!;
      const set2 = data!.items.find((i) => i.label === "Set 2")!;
      expect(data!.sectionSummaries.get(set1.id)).toEqual({ songCount: 1, seconds: 200 });
      expect(data!.sectionSummaries.get(set2.id)).toEqual({ songCount: 1, seconds: 220 });

      // Verifiziere Song-Feld-Mapping: songA mit allen Feldern
      const itemA = data!.items.find((i) => i.kind === "song" && i.note === "Intro leise")!;
      expect(itemA.title).toBe("Opener");
      expect(itemA.artist).toBe("Testband");
      expect(itemA.songKey).toBe("G");
      expect(itemA.capo).toBe(2);
      expect(itemA.tempoBpm).toBe(100);
      expect(itemA.durationSeconds).toBe(200);

      // Verifiziere Song-Feld-Mapping: songB
      const itemB = data!.items.find((i) => i.kind === "song" && i.title === "Rausschmeißer")!;
      expect(itemB.artist).toBeNull();
      expect(itemB.songKey).toBe("D");
      expect(itemB.capo).toBeNull();
      expect(itemB.tempoBpm).toBeNull();
      expect(itemB.note).toBeNull();
      expect(itemB.durationSeconds).toBe(220);
    });

    it("blendet einen in den Papierkorb gelegten Song aus, behält Sets und Pausen", async () => {
      await db.update(songs).set({ deletedAt: new Date() }).where(eq(songs.id, songAId));

      const data = await getSetlistPrintData(setlistId, f.bandId);
      expect(data).not.toBeNull();
      expect(data!.items.map((i) => i.kind)).toEqual(["section", "break", "section", "song"]);

      await db.update(songs).set({ deletedAt: null }).where(eq(songs.id, songAId));
    });
  });
});
