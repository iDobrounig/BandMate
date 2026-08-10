import { describe, expect, it } from "vitest";
import { capoShapeLyrics, capoShapeKey } from "@/lib/chords";

describe("capoShapeLyrics", () => {
  it("transponiert einen einzelnen Akkord um -capoFret", () => {
    // Capo 3: klingt G, Griff ist E (G ist 3 Halbtöne über E)
    expect(capoShapeLyrics("G", 3)).toBe("E");
  });

  it("transponiert eine Mehrfach-Akkord-Zeile", () => {
    expect(capoShapeLyrics("C  G  Am  F", 2)).toBe("Bb  F  Gm  Eb");
  });

  it("wickelt bei Unterlauf korrekt in die vorige Oktave (Tonklasse)", () => {
    // Capo 5 bei C: 0 - 5 = -5 mod 12 = 7 -> G
    expect(capoShapeLyrics("C", 5)).toBe("G");
  });

  it("lässt den Text bei Capo 0 unverändert", () => {
    const text = "C  G  Am  F";
    expect(capoShapeLyrics(text, 0)).toBe(text);
  });

  it("lässt Nicht-Akkord-Text unangetastet", () => {
    const text = "Strophe 1:\nEin Text ohne Akkorde.";
    expect(capoShapeLyrics(text, 3)).toBe(text);
  });
});

describe("capoShapeKey", () => {
  it("transponiert eine einfache Tonart", () => {
    expect(capoShapeKey("G", 3)).toBe("E");
  });

  it("erhält Tonart-Zusätze wie 'm'", () => {
    expect(capoShapeKey("Am", 2)).toBe("Gm");
  });

  it("funktioniert mit deutscher Notation", () => {
    // H-Dur um 2 Halbtöne herunter -> A-Dur
    expect(capoShapeKey("H-Dur", 2)).toBe("A-Dur");
  });

  it("gibt bei Capo 0 die unveränderte Tonart zurück", () => {
    expect(capoShapeKey("Dm", 0)).toBe("Dm");
  });
});
