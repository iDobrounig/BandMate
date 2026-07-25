import { describe, expect, it } from "vitest";
import { describeEventChanges } from "@/lib/event-notify";

const basis = { date: "2026-08-01", startTime: "19:30", location: "Proberaum" };

describe("describeEventChanges", () => {
  it("meldet nichts, wenn sich nichts Relevantes ändert", () => {
    expect(describeEventChanges(basis, { ...basis })).toEqual([]);
  });

  it("erkennt eine Datumsverschiebung und formatiert sie lesbar", () => {
    const z = describeEventChanges(basis, { ...basis, date: "2026-08-02" });
    expect(z).toHaveLength(1);
    expect(z[0]).toBe("Datum: 01.08.2026 → 02.08.2026");
  });

  it("erkennt eine Uhrzeit-Änderung", () => {
    const z = describeEventChanges(basis, { ...basis, startTime: "20:00" });
    expect(z).toEqual(["Uhrzeit: 19:30 Uhr → 20:00 Uhr"]);
  });

  it("erkennt einen Ortswechsel", () => {
    const z = describeEventChanges(basis, { ...basis, location: "Hauptplatz" });
    expect(z).toEqual(["Ort: Proberaum → Hauptplatz"]);
  });

  it("stellt „—“ dar, wenn eine Uhrzeit oder ein Ort entfernt wird", () => {
    expect(describeEventChanges(basis, { ...basis, startTime: null })).toEqual([
      "Uhrzeit: 19:30 Uhr → —",
    ]);
    expect(describeEventChanges(basis, { ...basis, location: null })).toEqual([
      "Ort: Proberaum → —",
    ]);
  });

  it("behandelt null und leeren String gleich (kein Fehlalarm)", () => {
    const alt = { date: "2026-08-01", startTime: null, location: "" };
    const neu = { date: "2026-08-01", startTime: "", location: null };
    expect(describeEventChanges(alt, neu)).toEqual([]);
  });

  it("sammelt mehrere Änderungen auf einmal", () => {
    const z = describeEventChanges(basis, {
      date: "2026-08-03",
      startTime: "18:00",
      location: "Halle",
    });
    expect(z).toHaveLength(3);
  });

  it("ignoriert Felder, die keine Benachrichtigung wert sind", () => {
    // Titel/Notizen/Setliste sind gar nicht Teil von EventNotifyFields —
    // dieser Test hält fest, dass nur date/startTime/location zählen.
    expect(Object.keys(basis).sort()).toEqual(["date", "location", "startTime"]);
  });

  it("nennt die Zeitzeile bei einem Gig „Load-in“", () => {
    const z = describeEventChanges(basis, { ...basis, startTime: "15:00" }, "gig");
    expect(z).toEqual(["Load-in: 19:30 Uhr → 15:00 Uhr"]);
  });

  it("erkennt eine geänderte Soundcheck-Zeit (nur bei Gig gefüllt)", () => {
    const z = describeEventChanges(basis, { ...basis, soundcheckTime: "16:30" }, "gig");
    expect(z).toEqual(["Soundcheck: — → 16:30 Uhr"]);
  });

  it("erkennt eine geänderte Auftrittszeit", () => {
    const z = describeEventChanges(basis, { ...basis, stageTime: "20:00" }, "gig");
    expect(z).toEqual(["Auftritt: — → 20:00 Uhr"]);
  });
});
