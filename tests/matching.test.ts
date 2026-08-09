import { describe, expect, it } from "vitest";
import { matchesDuplicateTitle } from "@/lib/matching";

describe("matchesDuplicateTitle", () => {
  it("erkennt exakte Übereinstimmung unabhängig von Groß-/Kleinschreibung", () => {
    expect(matchesDuplicateTitle("Wonderwall", "wonderwall")).toBe(true);
  });

  it("erkennt Zusätze in Klammern in beide Richtungen", () => {
    expect(matchesDuplicateTitle("Wonderwall (Unplugged)", "Wonderwall")).toBe(true);
    expect(matchesDuplicateTitle("Wonderwall", "Wonderwall (Unplugged)")).toBe(true);
  });

  it("ignoriert zu kurze Eingaben", () => {
    expect(matchesDuplicateTitle("Wonderwall", "w")).toBe(false);
  });

  it("liefert false ohne Teilstring-Treffer", () => {
    expect(matchesDuplicateTitle("Wonderwall", "Creep")).toBe(false);
  });
});
