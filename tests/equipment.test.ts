import { beforeAll, describe, expect, it } from "vitest";
import {
  fetchEquipmentList,
  fetchEquipmentDetail,
  fetchServableEquipmentAttachment,
} from "@/lib/queries";
import { anlegen } from "./helpers/fixtures";

type Fixtures = Awaited<ReturnType<typeof anlegen>>;
let f: Fixtures;

beforeAll(async () => {
  f = await anlegen();
});

describe("fetchEquipmentList", () => {
  it("liefert alle aktiven Geräte mit Beteiligungssumme und Dateizählern", async () => {
    const liste = await fetchEquipmentList();
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
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id);
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
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id);
    expect(detail!.attachments).toHaveLength(2);
    expect(detail!.attachments.map((a) => a.kind).sort()).toEqual(["foto", "rechnung"]);
  });

  it("liefert null für unbekannte Geräte", async () => {
    expect(await fetchEquipmentDetail(999999)).toBeNull();
  });
});

describe("fetchServableEquipmentAttachment", () => {
  it("liefert den Anhang, wenn Gerät und Anhang aktiv sind", async () => {
    const detail = await fetchEquipmentDetail(f.equipment.verstaerker.id);
    const foto = detail!.attachments.find((a) => a.kind === "foto")!;
    const servable = await fetchServableEquipmentAttachment(foto.id);
    expect(servable?.id).toBe(foto.id);
  });

  it("liefert null für unbekannte Anhänge", async () => {
    expect(await fetchServableEquipmentAttachment(999999)).toBeNull();
  });
});
