import { execFile } from "node:child_process";
import { RECORDING_BITRATE_KBPS } from "@/lib/constants";

const TRANSCODE_TIMEOUT_MS = 15 * 60 * 1000;

/** Reine Argument-Liste für ffmpeg — kein I/O, testbar ohne echtes ffmpeg. */
export function buildTranscodeArgs(
  inputPath: string,
  outputPath: string,
  bitrateKbps: number = RECORDING_BITRATE_KBPS
): string[] {
  return [
    "-i",
    inputPath,
    "-vn",
    "-c:a",
    "libopus",
    "-b:a",
    `${bitrateKbps}k`,
    "-y",
    outputPath,
  ];
}

/**
 * Transkodiert eine rohe Browser-Aufnahme (WebM/Opus oder MP4/AAC, je nach
 * Browser) nach OGG/Opus. Immer echtes Transcoding statt Remux, damit die
 * Zielgröße unabhängig davon ist, ob der Browser `audioBitsPerSecond`
 * beachtet hat (Safari tut das teils nicht).
 */
export function transcodeToOpus(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      buildTranscodeArgs(inputPath, outputPath),
      { timeout: TRANSCODE_TIMEOUT_MS },
      (error) => {
        if (error) {
          reject(new Error("Konvertierung fehlgeschlagen."));
          return;
        }
        resolve();
      }
    );
  });
}
