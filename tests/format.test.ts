import { describe, expect, it } from "vitest";
import { formatFee, formatIsoDateTime } from "@/lib/format";

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

describe("formatIsoDateTime", () => {
  it("formatiert als YYYY-mm-dd HH:ii (24h)", () => {
    expect(formatIsoDateTime(new Date(2026, 7, 11, 20, 15))).toBe("2026-08-11 20:15");
  });
  it("füllt einstellige Werte mit führender Null", () => {
    expect(formatIsoDateTime(new Date(2026, 0, 5, 9, 5))).toBe("2026-01-05 09:05");
  });
  it("bleibt im 24h-Format auch nachmittags/abends", () => {
    expect(formatIsoDateTime(new Date(2026, 5, 1, 13, 30))).toBe("2026-06-01 13:30");
  });
});
