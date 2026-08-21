import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { equipment, equipmentAttachments } from "@/lib/db/schema";
import {
  fetchEquipmentList,
  fetchEquipmentDetail,
  fetchServableEquipmentAttachment,
} from "@/lib/queries";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

// Ab hier beforeEach statt beforeAll: die neuen Tests unten löschen (weich)
// Geräte/Anhänge und dürfen die anderen Tests in dieser Datei nicht mit
// verändertem Zustand kontaminieren — jeder Test startet frisch, wie in
// tests/papierkorb.test.ts und tests/trash.test.ts.
beforeEach(async () => {
  f = await anlegen();
});

describe("fetchEquipmentList", () => {
  it("liefert alle aktiven Geräte mit Beteiligungssumme und Dateizählern", async () => {
    const liste = await fetchEquipmentList(f.bandId);
    expect(liste).toHaveLength(2);

    const verstaerker = liste.find((e) => e.id === f.equipment.verstaerker.id)!;
    expect(verstaerker.contributionTotal).toBe(900);
    expect(verstaerker.photoCount).toBe(1);
    expect(verstaerker.invoiceCount).toBe(1);

    const mikrofon = liste.find((e) => e.id === f.equipment.mikrofon.id)!;
    expect(mikrofon.contributionTotal).toBe(0);
    expect(mikrofon.photoCount).toBe(0);
    expect(mikrofon.invoiceCount).toBe(0);
  });
});

describe("fetchEquipmentDetail", () => {
  it("liefert Beteiligungen mit Namen, sortiert nach Mitglied", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id, f.bandId);
    expect(detail).not.toBeNull();
    expect(detail!.contributions).toHaveLength(2);
    expect(detail!.contributions.map((c) => c.userName)).toEqual([
      "Anna Admin",
      "Bert Bass",
    ]);
    expect(
      detail!.contributions.find((c) => c.userName === "Anna Admin")?.note
    ).toBe("Vorschuss");
    expect(detail!.createdByName).toBe("Anna Admin");
  });

  it("liefert nur aktive Anhänge", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id, f.bandId);
    expect(detail!.attachments).toHaveLength(2);
    expect(detail!.attachments.map((a) => a.kind).sort()).toEqual(["foto", "rechnung"]);
  });

  it("liefert null für unbekannte Geräte", async () => {
    expect(await fetchEquipmentDetail(999999, f.bandId)).toBeNull();
  });
});

describe("fetchServableEquipmentAttachment", () => {
  it("liefert den Anhang, wenn Gerät und Anhang aktiv sind", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id, f.bandId);
    const foto = detail!.attachments.find((a) => a.kind === "foto")!;
    const servable = await fetchServableEquipmentAttachment(foto.id, [f.bandId]);
    expect(servable?.id).toBe(foto.id);
  });

  it("liefert null für unbekannte Anhänge", async () => {
    expect(await fetchServableEquipmentAttachment(999999, [f.bandId])).toBeNull();
  });
});

describe("gelöschtes Gerät", () => {
  async function geraetLoeschen(id: number) {
    await db.update(equipment).set({ deletedAt: new Date() }).where(eq(equipment.id, id));
  }

  it("verschwindet aus fetchEquipmentList, ohne das andere Gerät mitzunehmen", async () => {
    await geraetLoeschen(f.equipment.verstaerker.id);
    const liste = await fetchEquipmentList(f.bandId);
    expect(liste.map((e) => e.id)).not.toContain(f.equipment.verstaerker.id);
    expect(liste.map((e) => e.id)).toContain(f.equipment.mikrofon.id);
  });

  it("ist über fetchEquipmentDetail nicht mehr erreichbar", async () => {
    await geraetLoeschen(f.equipment.mikrofon.id);
    expect(await fetchEquipmentDetail(f.equipment.mikrofon.id, f.bandId)).toBeNull();
  });

  it("gibt seine Dateien nicht mehr über den Direktlink heraus", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id, f.bandId);
    const foto = detail!.attachments.find((a) => a.kind === "foto")!;

    expect(await fetchServableEquipmentAttachment(foto.id, [f.bandId])).not.toBeNull();
    await geraetLoeschen(f.equipment.verstaerker.id);
    // Der Anhang selbst ist NICHT markiert — nur sein Gerät. Ohne den Join
    // wäre die Datei hier weiter abrufbar und der Papierkorb per URL
    // umgehbar.
    expect(await fetchServableEquipmentAttachment(foto.id, [f.bandId])).toBeNull();
  });
});

describe("gelöschter Equipment-Anhang", () => {
  it("verschwindet aus den Anhängen und aus photoCount/invoiceCount, ohne das Gerät zu berühren", async () => {
    const vorher = await fetchEquipmentDetail(f.equipment.verstaerker.id, f.bandId);
    const foto = vorher!.attachments.find((a) => a.kind === "foto")!;

    await db
      .update(equipmentAttachments)
      .set({ deletedAt: new Date() })
      .where(eq(equipmentAttachments.id, foto.id));

    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id, f.bandId);
    expect(detail!.attachments.map((a) => a.id)).not.toContain(foto.id);

    const liste = await fetchEquipmentList(f.bandId);
    const verstaerker = liste.find((e) => e.id === f.equipment.verstaerker.id)!;
    expect(verstaerker.photoCount).toBe(0);
    expect(verstaerker.invoiceCount).toBe(1);
  });
});
