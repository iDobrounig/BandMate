import { describe, expect, it } from "vitest";
import { isLimited, record, reset } from "@/lib/rate-limit";

describe("Rate-Limit", () => {
  it("sperrt ab dem Limit und gibt nach Ablauf des Fensters wieder frei", () => {
    const key = "test:fenster";
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(isLimited(key, 3, t0)).toBe(false);
      record(key, 60_000, t0);
    }
    expect(isLimited(key, 3, t0)).toBe(true);
    expect(isLimited(key, 3, t0 + 59_999)).toBe(true);
    expect(isLimited(key, 3, t0 + 60_000)).toBe(false);
  });

  it("das Fenster beginnt mit dem ersten Versuch, spätere verlängern es nicht", () => {
    const key = "test:start";
    record(key, 1_000, 0);
    record(key, 1_000, 900);
    expect(isLimited(key, 2, 999)).toBe(true);
    expect(isLimited(key, 2, 1_000)).toBe(false);
  });

  it("reset hebt die Sperre auf, Schlüssel sind getrennt", () => {
    record("test:a", 60_000, 0);
    record("test:a", 60_000, 0);
    expect(isLimited("test:a", 2, 1)).toBe(true);
    expect(isLimited("test:b", 2, 1)).toBe(false);
    reset("test:a");
    expect(isLimited("test:a", 2, 1)).toBe(false);
  });
});
