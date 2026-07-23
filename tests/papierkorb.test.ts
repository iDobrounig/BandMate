import { beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { songs, setlists, events, attachments } from "@/lib/db/schema";
import {
  fetchSongList,
  fetchSongDetail,
  fetchSetlists,
  fetchEvents,
  fetchServableAttachment,
} from "@/lib/queries";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

// Jeder Test startet mit frischem, ungelöschtem Zustand.
beforeEach(async () => {
  f = await anlegen();
});

const jetzt = () => new Date();

async function songLoeschen(id: number) {
  await db
    .update(songs)
    .set({ deletedAt: jetzt(), deletedById: f.users.anna.id })
    .where(eq(songs.id, id));
}

describe("gelöschter Song", () => {
  it("verschwindet aus der Songliste, ohne die anderen mitzunehmen", async () => {
    await songLoeschen(f.songs.vorschlag.id);
    const liste = await fetchSongList(f.users.anna.id);
    expect(liste).toHaveLength(3);
    expect(liste.map((s) => s.id)).not.toContain(f.songs.vorschlag.id);
    expect(liste.map((s) => s.id)).toContain(f.songs.inProbe.id);
  });

  it("ist über die Detailseite nicht mehr erreichbar", async () => {
    await songLoeschen(f.songs.inProbe.id);
    expect(await fetchSongDetail(f.songs.inProbe.id)).toBeNull();
  });

  it("zählt nicht mehr zur Setlisten-Länge und -Dauer", async () => {
    const vorher = (await fetchSetlists()).find((s) => s.id === f.setlists.setliste.id)!;
    expect(vorher.songCount).toBe(2);
    expect(vorher.totalSeconds).toBe(420);

    // "Sitzt Schon" (240 s) liegt auf Position 1 der Setliste
    await songLoeschen(f.songs.repertoire.id);

    const nachher = (await fetchSetlists()).find((s) => s.id === f.setlists.setliste.id)!;
    expect(nachher.songCount).toBe(1);
    expect(nachher.totalSeconds).toBe(180);
  });

  it("gibt seine Dateien nicht mehr über den Direktlink heraus", async () => {
    const [datei] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.songId, f.songs.inProbe.id))
      .limit(1);

    expect(await fetchServableAttachment(datei.id)).not.toBeNull();
    await songLoeschen(f.songs.inProbe.id);
    // Der Anhang selbst ist NICHT markiert — nur sein Song. Ohne den Join wäre
    // die Datei hier weiter abrufbar und der Papierkorb per URL umgehbar.
    expect(await fetchServableAttachment(datei.id)).toBeNull();
  });

  it("taucht mit seiner alten Position wieder auf, wenn er wiederhergestellt wird", async () => {
    await songLoeschen(f.songs.repertoire.id);
    await db
      .update(songs)
      .set({ deletedAt: null, deletedById: null })
      .where(eq(songs.id, f.songs.repertoire.id));

    const setliste = (await fetchSetlists()).find((s) => s.id === f.setlists.setliste.id)!;
    expect(setliste.songCount).toBe(2);
    expect(setliste.totalSeconds).toBe(420);
    expect((await fetchSongDetail(f.songs.repertoire.id))?.song.title).toBe("Sitzt Schon");
  });
});

describe("gelöschter Anhang", () => {
  it("zählt nicht mehr mit und fehlt auf der Songseite", async () => {
    const noten = await db
      .select()
      .from(attachments)
      .where(eq(attachments.songId, f.songs.inProbe.id));
    const eineNote = noten.find((a) => a.kind === "sheet")!;

    await db
      .update(attachments)
      .set({ deletedAt: jetzt(), deletedById: f.users.anna.id })
      .where(eq(attachments.id, eineNote.id));

    const liste = await fetchSongList(f.users.anna.id);
    const inProbe = liste.find((s) => s.id === f.songs.inProbe.id)!;
    expect(inProbe.sheetCount).toBe(1);
    expect(inProbe.audioCount).toBe(1); // die Audio-Datei bleibt unberührt

    const detail = (await fetchSongDetail(f.songs.inProbe.id))!;
    expect(detail.files).toHaveLength(2);
    expect(detail.files.map((a) => a.id)).not.toContain(eineNote.id);

    expect(await fetchServableAttachment(eineNote.id)).toBeNull();
  });
});

describe("gelöschte Setliste", () => {
  it("verschwindet aus der Übersicht", async () => {
    await db
      .update(setlists)
      .set({ deletedAt: jetzt(), deletedById: f.users.anna.id })
      .where(eq(setlists.id, f.setlists.setliste.id));

    const listen = await fetchSetlists();
    expect(listen.map((s) => s.id)).not.toContain(f.setlists.setliste.id);
    expect(listen.map((s) => s.id)).toContain(f.setlists.leereSetliste.id);
  });

  it("lässt den verknüpften Termin stehen und nimmt ihm nur den Namen", async () => {
    await db
      .update(setlists)
      .set({ deletedAt: jetzt(), deletedById: f.users.anna.id })
      .where(eq(setlists.id, f.setlists.setliste.id));

    const kommend = await fetchEvents(f.users.anna.id);
    const gig = kommend.find((e) => e.id === f.events.kommenderGig.id);
    // Der Termin selbst darf NICHT verschwinden — das wäre der klassische
    // Fehler, den Filter ins WHERE statt in die JOIN-Bedingung zu schreiben.
    expect(gig).toBeDefined();
    expect(gig!.setlistName).toBeNull();
  });
});

describe("gelöschter Termin", () => {
  it("verschwindet aus kommenden und vergangenen Terminen", async () => {
    await db
      .update(events)
      .set({ deletedAt: jetzt(), deletedById: f.users.anna.id })
      .where(
        inArray(events.id, [f.events.kommenderGig.id, f.events.alteProbe.id])
      );

    const kommend = await fetchEvents(f.users.anna.id);
    const vergangen = await fetchEvents(f.users.anna.id, { past: true });

    expect(kommend.map((e) => e.id)).toEqual([f.events.kommendeProbe.id]);
    expect(vergangen).toHaveLength(0);
  });
});
