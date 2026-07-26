import { describe, expect, it } from "vitest";
import { summarizeSetlist, compareTarget } from "@/lib/setlist-structure";

const song = (durationSeconds: number | null) => ({
  kind: "song" as const,
  label: null,
  durationSeconds,
  breakSeconds: null,
});
const section = (label: string) => ({
  kind: "section" as const,
  label,
  durationSeconds: null,
  breakSeconds: null,
});
const pause = (breakSeconds: number) => ({
  kind: "break" as const,
  label: null,
  durationSeconds: null,
  breakSeconds,
});

describe("summarizeSetlist", () => {
  it("liefert für eine leere Liste Nullwerte", () => {
    expect(summarizeSetlist([])).toEqual({
      sets: [],
      musicSeconds: 0,
      breakSeconds: 0,
      totalSeconds: 0,
    });
  });

  it("gruppiert Songs ohne Überschrift in ein Segment mit label null", () => {
    const r = summarizeSetlist([song(60), song(120)]);
    expect(r.sets).toEqual([{ label: null, songCount: 2, seconds: 180 }]);
    expect(r.musicSeconds).toBe(180);
    expect(r.totalSeconds).toBe(180);
  });

  it("beginnt bei einer Überschrift ein neues, benanntes Set", () => {
    const r = summarizeSetlist([
      section("Warmup"),
      song(60),
      section("Hauptset"),
      song(90),
      song(30),
    ]);
    expect(r.sets).toEqual([
      { label: "Warmup", songCount: 1, seconds: 60 },
      { label: "Hauptset", songCount: 2, seconds: 120 },
    ]);
  });

  it("zählt Pausen in breakSeconds, nicht in ein Set", () => {
    const r = summarizeSetlist([song(60), pause(1200), song(120)]);
    expect(r.sets).toEqual([{ label: null, songCount: 2, seconds: 180 }]);
    expect(r.breakSeconds).toBe(1200);
    expect(r.totalSeconds).toBe(1380);
  });

  it("verwirft ein führendes leeres Segment, behält ein benanntes leeres Set", () => {
    const r = summarizeSetlist([section("Leeres Set")]);
    expect(r.sets).toEqual([{ label: "Leeres Set", songCount: 0, seconds: 0 }]);
  });

  it("behandelt Songs ohne Dauer als 0", () => {
    const r = summarizeSetlist([song(null), song(60)]);
    expect(r.musicSeconds).toBe(60);
    expect(r.sets[0].songCount).toBe(2);
  });
});

describe("compareTarget", () => {
  it("gibt ohne Zielzeit null zurück", () => {
    expect(compareTarget(1000, null)).toBeNull();
  });
  it("meldet under, wenn programmiert unter Ziel liegt", () => {
    expect(compareTarget(4680, 5400)).toEqual({ diffSeconds: 720, over: false });
  });
  it("meldet over, wenn programmiert über Ziel liegt", () => {
    expect(compareTarget(5880, 5400)).toEqual({ diffSeconds: 480, over: true });
  });
  it("meldet bei exakter Übereinstimmung 0 und over=false", () => {
    expect(compareTarget(5400, 5400)).toEqual({ diffSeconds: 0, over: false });
  });
});
