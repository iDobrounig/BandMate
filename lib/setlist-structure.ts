export type StructureItem = {
  kind: "song" | "section" | "break";
  label: string | null;
  durationSeconds: number | null;
  breakSeconds: number | null;
};

export type SetSummary = { label: string | null; songCount: number; seconds: number };

export type SetlistStructure = {
  sets: SetSummary[];
  musicSeconds: number;
  breakSeconds: number;
  totalSeconds: number; // musicSeconds + breakSeconds
};

/**
 * Fasst eine geordnete Setlisten-Liste zu Sets (Segmente zwischen Überschriften),
 * Musik-, Pausen- und Gesamtzeit zusammen. Pausen splitten kein Set.
 */
export function summarizeSetlist(items: StructureItem[]): SetlistStructure {
  const sets: SetSummary[] = [];
  let cur: SetSummary = { label: null, songCount: 0, seconds: 0 };
  let musicSeconds = 0;
  let breakSeconds = 0;

  for (const item of items) {
    if (item.kind === "section") {
      sets.push(cur);
      cur = { label: item.label, songCount: 0, seconds: 0 };
    } else if (item.kind === "song") {
      cur.songCount += 1;
      cur.seconds += item.durationSeconds ?? 0;
      musicSeconds += item.durationSeconds ?? 0;
    } else if (item.kind === "break") {
      breakSeconds += item.breakSeconds ?? 0;
    }
  }
  sets.push(cur);

  // Führendes leeres Segment (ohne Namen, ohne Songs) verwerfen; benannte leere
  // Sets bleiben stehen.
  if (sets.length > 0 && sets[0].label === null && sets[0].songCount === 0) {
    sets.shift();
  }

  return { sets, musicSeconds, breakSeconds, totalSeconds: musicSeconds + breakSeconds };
}

/** Differenz zur Zielzeit; null ohne Zielzeit. over=true, wenn programmiert > Ziel. */
export function compareTarget(
  totalSeconds: number,
  targetSeconds: number | null
): { diffSeconds: number; over: boolean } | null {
  if (targetSeconds == null) return null;
  return {
    diffSeconds: Math.abs(targetSeconds - totalSeconds),
    over: totalSeconds > targetSeconds,
  };
}
