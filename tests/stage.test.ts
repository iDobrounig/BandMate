import { describe, expect, it } from "vitest";
import {
  nextSongTitle,
  formatCountdown,
  upcomingItems,
  describeUpcoming,
  type StageItem,
} from "@/lib/stage";

const song = (id: number, title: string): StageItem => ({
  id,
  kind: "song",
  label: null,
  title,
});
const section = (id: number, label: string): StageItem => ({
  id,
  kind: "section",
  label,
  title: null,
});
const pause = (id: number): StageItem => ({
  id,
  kind: "break",
  label: null,
  title: null,
});

describe("nextSongTitle", () => {
  it("findet den unmittelbar folgenden Song", () => {
    const items = [song(1, "Erster"), pause(2), song(3, "Zweiter")];
    expect(nextSongTitle(items, 1)).toBe("Zweiter");
  });

  it("überspringt weitere Pausen und Überschriften", () => {
    const items = [pause(1), section(2, "Set 2"), pause(3), song(4, "Los")];
    expect(nextSongTitle(items, 0)).toBe("Los");
  });

  it("gibt null zurück, wenn kein Song mehr folgt", () => {
    const items = [song(1, "Letzter"), pause(2)];
    expect(nextSongTitle(items, 1)).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("zeigt verbleibende Zeit als m:ss", () => {
    expect(formatCountdown(134)).toBe("2:14");
  });
  it("füllt die Sekunden zweistellig", () => {
    expect(formatCountdown(65)).toBe("1:05");
  });
  it("zeigt null als 0:00", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });
  it("kippt den Überzug ins Plus", () => {
    expect(formatCountdown(-134)).toBe("+2:14");
  });
});

describe("upcomingItems", () => {
  const items = [song(1, "A"), song(2, "B"), pause(3), song(4, "C")];
  it("liefert die nächsten n Elemente nach dem Index", () => {
    expect(upcomingItems(items, 0, 2).map((i) => i.id)).toEqual([2, 3]);
  });
  it("wird am Listenende kürzer", () => {
    expect(upcomingItems(items, 2, 2).map((i) => i.id)).toEqual([4]);
  });
  it("ist am letzten Element leer", () => {
    expect(upcomingItems(items, 3, 2)).toEqual([]);
  });
});

describe("describeUpcoming", () => {
  it("beschreibt eine Pause mit Dauer und Label", () => {
    expect(
      describeUpcoming({ id: 1, kind: "break", label: "Umbau", title: null, breakSeconds: 120 })
    ).toBe("⏸ Pause · 2 min: Umbau");
  });
  it("beschreibt eine Set-Überschrift", () => {
    expect(
      describeUpcoming({ id: 1, kind: "section", label: "Zugaben", title: null })
    ).toBe("▸ Set: Zugaben");
  });
  it("beschreibt einen Song mit Interpret und Tonart", () => {
    expect(
      describeUpcoming({
        id: 1,
        kind: "song",
        label: null,
        title: "Sultans of Swing",
        artist: "Dire Straits",
        songKey: "Dm",
      })
    ).toBe("Sultans of Swing · Dire Straits · Tonart Dm");
  });
  it("lässt fehlende Song-Felder weg", () => {
    expect(
      describeUpcoming({ id: 1, kind: "song", label: null, title: "Nur Titel" })
    ).toBe("Nur Titel");
  });
});
