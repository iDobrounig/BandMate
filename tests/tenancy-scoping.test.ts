import { beforeAll, describe, expect, it } from "vitest";
import {
  fetchSongList,
  fetchSongDetail,
  fetchSetlists,
  fetchEvents,
  getSetlistPrintData,
  fetchEquipmentList,
  fetchEquipmentDetail,
  fetchBandMembers,
  fetchAttendanceStats,
  fetchServableAttachment,
} from "@/lib/queries";
import { fetchTrash } from "@/lib/trash";
import { db } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { anlegen, zweiteBandAnlegen } from "./helpers/fixtures";

/**
 * Mandantenfähigkeit (Welle 4): das Sicherheitsnetz gegen Datenlecks zwischen
 * Bands. Zwei Bands mit eigenen Inhalten; jede Lesefunktion darf ausschließlich
 * Inhalte der übergebenen Band liefern.
 */
type Fixtures = Awaited<ReturnType<typeof anlegen>>;
type Zweite = Awaited<ReturnType<typeof zweiteBandAnlegen>>;
let a: Fixtures;
let b: Zweite;

beforeAll(async () => {
  a = await anlegen();
  b = await zweiteBandAnlegen();
});

describe("Band-Scoping der Lesefunktionen", () => {
  it("fetchSongList liefert nur Songs der eigenen Band", async () => {
    const songsA = await fetchSongList(a.users.anna.id, a.bandId);
    const songsB = await fetchSongList(b.users.egon.id, b.bandId);
    expect(songsA.every((s) => s.bandId === a.bandId)).toBe(true);
    expect(songsB.map((s) => s.id)).toEqual([b.songs.song.id]);
    expect(songsA.map((s) => s.id)).not.toContain(b.songs.song.id);
  });

  it("fetchSongDetail verweigert einen Song der fremden Band", async () => {
    expect(await fetchSongDetail(b.songs.song.id, a.bandId)).toBeNull();
    expect(await fetchSongDetail(a.songs.inProbe.id, b.bandId)).toBeNull();
    expect(await fetchSongDetail(b.songs.song.id, b.bandId)).not.toBeNull();
  });

  it("fetchSetlists und getSetlistPrintData bleiben in der Band", async () => {
    const listB = await fetchSetlists(b.bandId);
    expect(listB.map((s) => s.id)).toEqual([b.setlists.setliste.id]);
    // Fremde Setliste über die eigene Band-ID: nicht auffindbar.
    expect(await getSetlistPrintData(b.setlists.setliste.id, a.bandId)).toBeNull();
    expect(await getSetlistPrintData(a.setlists.setliste.id, b.bandId)).toBeNull();
  });

  it("fetchEvents liefert nur Termine der eigenen Band", async () => {
    const eventsB = await fetchEvents(b.users.egon.id, b.bandId);
    expect(eventsB.map((e) => e.id)).toEqual([b.events.event.id]);
    const eventsA = await fetchEvents(a.users.anna.id, a.bandId);
    expect(eventsA.map((e) => e.id)).not.toContain(b.events.event.id);
  });

  it("fetchEquipmentList/-Detail bleiben in der Band", async () => {
    const equipB = await fetchEquipmentList(b.bandId);
    expect(equipB.map((e) => e.id)).toEqual([b.equipment.equip.id]);
    expect(await fetchEquipmentDetail(b.equipment.equip.id, a.bandId)).toBeNull();
    expect(await fetchEquipmentDetail(a.equipment.verstaerker.id, b.bandId)).toBeNull();
  });

  it("fetchBandMembers und fetchAttendanceStats zählen nur eigene Mitglieder", async () => {
    const membersB = await fetchBandMembers(b.bandId);
    expect(membersB.map((m) => m.id)).toEqual([b.users.egon.id]);
    const statsB = await fetchAttendanceStats(b.bandId);
    expect(statsB.map((s) => s.userId)).toEqual([b.users.egon.id]);
  });

  it("fetchTrash zeigt nur den Papierkorb der eigenen Band", async () => {
    const trashA = await fetchTrash(a.bandId);
    const trashB = await fetchTrash(b.bandId);
    // Nichts gelöscht → beide leer, aber vor allem: keine Vermischung.
    expect(trashA).toEqual([]);
    expect(trashB).toEqual([]);
  });

  it("fetchServableAttachment gibt eine Datei nur an Bands des Users heraus", async () => {
    const [att] = await db
      .insert(attachments)
      .values({
        songId: b.songs.song.id,
        kind: "sheet",
        storedName: "x.pdf",
        originalName: "fremd.pdf",
        mime: "application/pdf",
        size: 1,
        uploadedById: b.users.egon.id,
      })
      .returning();
    // Anna (nur Band a) darf die Datei aus Band b nicht bekommen.
    expect(await fetchServableAttachment(att.id, [a.bandId])).toBeNull();
    // Egon (Band b) schon.
    expect(await fetchServableAttachment(att.id, [b.bandId])).not.toBeNull();
  });
});
