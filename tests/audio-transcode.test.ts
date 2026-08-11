import { describe, expect, it } from "vitest";
import { buildTranscodeArgs } from "@/lib/audio-transcode";

describe("buildTranscodeArgs", () => {
  it("nutzt die Standard-Bitrate aus den Konstanten", () => {
    expect(buildTranscodeArgs("in.webm", "out.ogg")).toEqual([
      "-i",
      "in.webm",
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "48k",
      "-y",
      "out.ogg",
    ]);
  });

  it("übernimmt eine abweichende Bitrate", () => {
    expect(buildTranscodeArgs("in.mp4", "out.ogg", 64)).toEqual([
      "-i",
      "in.mp4",
      "-vn",
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      "-y",
      "out.ogg",
    ]);
  });
});
