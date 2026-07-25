import { describe, expect, it } from "vitest";
import { formatFee } from "@/lib/format";

describe("formatFee", () => {
  it("formatiert ganze Beträge mit Euro-Zeichen", () => {
    expect(formatFee(400)).toBe("400 €");
  });
  it("nutzt den Tausenderpunkt (de-AT)", () => {
    expect(formatFee(1250)).toBe("1.250 €");
  });
  it("gibt bei null/undefined einen leeren String zurück", () => {
    expect(formatFee(null)).toBe("");
    expect(formatFee(undefined)).toBe("");
  });
  it("behandelt 0 als gültigen Betrag", () => {
    expect(formatFee(0)).toBe("0 €");
  });
});
