import { describe, expect, it } from "vitest";
import { attendancePercentage } from "@/lib/attendance";

describe("attendancePercentage", () => {
  it("ist null ohne jede Ja/Nein-Rückmeldung", () => {
    expect(attendancePercentage(0, 0)).toBeNull();
  });

  it("rundet auf ganze Prozent", () => {
    expect(attendancePercentage(3, 1)).toBe(75);
    expect(attendancePercentage(1, 3)).toBe(25);
    expect(attendancePercentage(1, 2)).toBe(33); // 33.33... -> 33
  });

  it("ist 100 ohne jede Absage", () => {
    expect(attendancePercentage(4, 0)).toBe(100);
  });

  it("ist 0 ohne jede Zusage", () => {
    expect(attendancePercentage(0, 4)).toBe(0);
  });
});
