/**
 * Akkord-Erkennung und Transposition — pure Funktionen, client-tauglich.
 * Unterstützt englische (B = H) und deutsche Schreibweise (H, B = Bb):
 * Kommt in einem Text ein H vor, wird deutsche Notation angenommen.
 */

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
// Praxisübliche Mischung, wenn das Original keine klare Vorliebe zeigt
const HYBRID_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

export type AccidentalPreference = "sharp" | "flat" | "auto";

const BASE_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, H: 11,
};

// Gängige Akkord-Suffixe (Whitelist, damit normale Wörter nicht als Akkord gelten)
const SUFFIX_RE =
  /^(?:(?:maj|min|m|dim|aug|sus|add|mmaj)?\d{0,2})(?:(?:sus|add|maj|b|#)\d{1,2})*(?:b5|#5|#9|b9|#11|b13|\+|°|o7|°7)?$/;

export type ParsedChord = {
  rootSemitone: number;
  rootHasFlat: boolean;
  suffix: string;
  bassSemitone: number | null;
  bassHasFlat: boolean;
};

function parseNote(
  note: string,
  german: boolean
): { semitone: number; hasFlat: boolean } | null {
  const match = note.match(/^([A-H])([#b]?)$/);
  if (!match) return null;
  const [, letter, accidental] = match;
  let semitone = BASE_SEMITONES[letter];
  if (semitone === undefined) return null;
  if (german && letter === "B") semitone = 10; // deutsches B = Bb
  if (accidental === "#") semitone += 1;
  if (accidental === "b") semitone -= 1;
  return { semitone: ((semitone % 12) + 12) % 12, hasFlat: accidental === "b" };
}

export function parseChord(token: string, german = false): ParsedChord | null {
  const [main, bass, ...rest] = token.split("/");
  if (rest.length > 0 || !main) return null;

  const match = main.match(/^([A-H][#b]?)(.*)$/);
  if (!match) return null;
  const [, rootStr, suffix] = match;
  const root = parseNote(rootStr, german);
  if (!root || !SUFFIX_RE.test(suffix)) return null;

  let bassNote: { semitone: number; hasFlat: boolean } | null = null;
  if (bass !== undefined) {
    bassNote = parseNote(bass, german);
    if (!bassNote) return null;
  }

  return {
    rootSemitone: root.semitone,
    rootHasFlat: root.hasFlat,
    suffix,
    bassSemitone: bassNote?.semitone ?? null,
    bassHasFlat: bassNote?.hasFlat ?? false,
  };
}

function noteName(
  semitone: number,
  preference: AccidentalPreference,
  german: boolean
): string {
  const s = ((semitone % 12) + 12) % 12;
  if (german) {
    if (s === 11) return "H";
    if (s === 10) return "B";
  }
  if (preference === "flat") return FLAT_NAMES[s];
  if (preference === "sharp") return SHARP_NAMES[s];
  return HYBRID_NAMES[s];
}

export function transposeChord(
  token: string,
  semitones: number,
  opts: { preference?: AccidentalPreference; german?: boolean } = {}
): string | null {
  const german = opts.german ?? false;
  const chord = parseChord(token, german);
  if (!chord) return null;
  const preference =
    opts.preference ?? (chord.rootHasFlat ? "flat" : "auto");
  let result =
    noteName(chord.rootSemitone + semitones, preference, german) + chord.suffix;
  if (chord.bassSemitone !== null) {
    result += "/" + noteName(chord.bassSemitone + semitones, preference, german);
  }
  return result;
}

/** Enthält der Text deutsche H-Akkorde? Dann deutsche Notation verwenden. */
export function detectGermanNotation(text: string): boolean {
  return /(^|\s)H[#b]?(m|maj|min|dim|aug|sus|add|\d|\s|\/|$)/m.test(text);
}

/** Zeile besteht überwiegend aus Akkord-Tokens? Dann wird sie transponiert. */
export function isChordLine(line: string, german = false): boolean {
  const trimmed = line.trim();
  if (!trimmed || /^\[.*\]$/.test(trimmed)) return false;
  const tokens = trimmed.split(/\s+/).filter((t) => !/^[|:x\d().\-–]+$/.test(t));
  if (tokens.length === 0) return false;
  const chordCount = tokens.filter((t) => parseChord(t, german) !== null).length;
  return chordCount / tokens.length >= 0.6;
}

/** Transponiert nur Akkordzeilen, Text bleibt unangetastet. */
export function transposeLyrics(text: string, semitones: number): string {
  if (semitones === 0) return text;
  const german = detectGermanNotation(text);
  // Vorzeichen-Vorliebe aus dem Original ableiten
  const flats = (text.match(/[A-H]b/g) ?? []).length;
  const sharps = (text.match(/[A-H]#/g) ?? []).length;
  const preference: AccidentalPreference =
    flats > sharps ? "flat" : sharps > flats ? "sharp" : "auto";

  return text
    .split("\n")
    .map((line) => {
      if (!isChordLine(line, german)) return line;
      return line
        .split(/(\s+)/)
        .map((part) => {
          if (/^\s*$/.test(part)) return part;
          return (
            transposeChord(part, semitones, { preference, german }) ?? part
          );
        })
        .join("");
    })
    .join("\n");
}

/**
 * Transponiert eine Tonart-Angabe wie "Dm", "G-Dur", "Bb". Nicht parsebare
 * Angaben bleiben unverändert (null = keine Änderung möglich).
 */
export function transposeKey(key: string, semitones: number): string | null {
  const match = key.trim().match(/^([A-H][#b]?)(.*)$/);
  if (!match) return null;
  const [, rootStr, rest] = match;
  const german = /^H/.test(rootStr) || /(dur|moll)/i.test(rest);
  const root = parseNote(rootStr, german);
  if (!root) return null;
  return (
    noteName(root.semitone + semitones, root.hasFlat ? "flat" : "auto", german) +
    rest
  );
}
