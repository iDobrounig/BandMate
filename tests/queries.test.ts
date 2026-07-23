import { beforeAll, describe, expect, it } from "vitest";
import {
  fetchSongList,
  fetchSongDetail,
  fetchSetlists,
  fetchEvents,
} from "@/lib/queries";
import { anlegen, isoTag } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
});

describe("fetchSongList", () => {
  it("liefert alle Songs mit Vorschlagendem", async () => {
    const liste = await fetchSongList(f.users.anna.id);
    expect(liste).toHaveLength(4);
    const vorschlag = liste.find((s) => s.id === f.songs.vorschlag.id)!;
    expect(vorschlag.suggestedByName).toBe("Bert Bass");
    // Songs ohne Vorschlagenden dürfen nicht wegfallen (LEFT JOIN, kein INNER)
    expect(liste.find((s) => s.id === f.songs.inProbe.id)?.suggestedByName).toBeNull();
  });

  it("zählt Stimmen getrennt nach dafür und dagegen", async () => {
    const liste = await fetchSongList(f.users.anna.id);
    const vorschlag = liste.find((s) => s.id === f.songs.vorschlag.id)!;
    expect(vorschlag.upvotes).toBe(2);
    expect(vorschlag.downvotes).toBe(1);
  });

  it("liefert die eigene Stimme je nach Betrachter", async () => {
    const alsAnna = await fetchSongList(f.users.anna.id);
    const alsClara = await fetchSongList(f.users.clara.id);
    const id = f.songs.vorschlag.id;
    expect(alsAnna.find((s) => s.id === id)!.myVote).toBe(1);
    expect(alsClara.find((s) => s.id === id)!.myVote).toBe(-1);
    // Ohne eigene Stimme: 0, nicht null
    expect(alsAnna.find((s) => s.id === f.songs.inProbe.id)!.myVote).toBe(0);
  });

  it("zählt Kommentare, Audios, Noten und Übe-Status getrennt", async () => {
    const liste = await fetchSongList(f.users.anna.id);
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
    expect(await fetchSongDetail(999_999)).toBeNull();
  });

  it("sammelt Links, Dateien, Kommentare, Stimmen und Übe-Status", async () => {
    const detail = (await fetchSongDetail(f.songs.inProbe.id))!;
    expect(detail.song.title).toBe("In Probe");
    expect(detail.files).toHaveLength(3);
    expect(detail.practice).toHaveLength(3);
    expect(detail.comments).toHaveLength(0);

    const vorschlag = (await fetchSongDetail(f.songs.vorschlag.id))!;
    expect(vorschlag.links).toHaveLength(1);
    expect(vorschlag.votes).toHaveLength(3);
    expect(vorschlag.comments.map((c) => c.userName)).toEqual(["Anna Admin", "Clara Cello"]);
    expect(vorschlag.suggestedByName).toBe("Bert Bass");
  });

  it("blendet deaktivierte Mitglieder aus der Band-Übersicht aus", async () => {
    const detail = (await fetchSongDetail(f.songs.inProbe.id))!;
    const namen = detail.allUsers.map((u) => u.name);
    expect(namen).toContain("Anna Admin");
    expect(namen).not.toContain("Dora Draussen");
    expect(detail.allUsers).toHaveLength(3);
  });
});

describe("fetchSetlists", () => {
  it("zählt Songs und summiert die Dauer je Setliste", async () => {
    const listen = await fetchSetlists();
    const sommerfest = listen.find((s) => s.id === f.setlists.setliste.id)!;
    expect(sommerfest.songCount).toBe(2);
    expect(sommerfest.totalSeconds).toBe(240 + 180);
  });

  it("liefert für eine leere Setliste 0 statt null", async () => {
    const listen = await fetchSetlists();
    const leer = listen.find((s) => s.id === f.setlists.leereSetliste.id)!;
    expect(leer.songCount).toBe(0);
    expect(leer.totalSeconds).toBe(0);
  });
});

describe("fetchEvents", () => {
  it("trennt kommende von vergangenen Terminen", async () => {
    const kommend = await fetchEvents(f.users.anna.id);
    const vergangen = await fetchEvents(f.users.anna.id, { past: true });

    expect(kommend.map((e) => e.title)).toEqual(["Bandprobe", "Sommerfest"]); // nach Datum
    expect(vergangen.map((e) => e.title)).toEqual(["Alte Probe"]);
  });

  it("zählt Zu-, Ab- und Vielleicht-Sagen getrennt", async () => {
    const kommend = await fetchEvents(f.users.anna.id);
    const gig = kommend.find((e) => e.id === f.events.kommenderGig.id)!;
    expect(gig.yesCount).toBe(2);
    expect(gig.maybeCount).toBe(1);
    expect(gig.noCount).toBe(0);
  });

  it("liefert den eigenen Status je nach Betrachter", async () => {
    const alsClara = await fetchEvents(f.users.clara.id);
    const alsDora = await fetchEvents(f.users.dora.id);
    const id = f.events.kommenderGig.id;
    expect(alsClara.find((e) => e.id === id)!.myStatus).toBe("maybe");
    expect(alsDora.find((e) => e.id === id)!.myStatus).toBeNull();
  });

  it("hängt den Setlisten-Namen an, ohne Termine ohne Setliste zu verlieren", async () => {
    const kommend = await fetchEvents(f.users.anna.id);
    expect(kommend.find((e) => e.id === f.events.kommenderGig.id)!.setlistName).toBe("Sommerfest");
    expect(kommend.find((e) => e.id === f.events.kommendeProbe.id)!.setlistName).toBeNull();
  });

  it("beachtet das Limit", async () => {
    const kommend = await fetchEvents(f.users.anna.id, { limit: 1 });
    expect(kommend).toHaveLength(1);
    expect(kommend[0].date).toBe(isoTag(3)); // das näheste zuerst
  });
});
