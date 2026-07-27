/**
 * Reine Helfer für den Bühnenmodus — client-tauglich, ohne Seiteneffekte.
 */

export type StageItem = {
  id: number;
  kind: "song" | "section" | "break";
  label: string | null;
  title: string | null;
  artist?: string | null;
  songKey?: string | null;
  breakSeconds?: number | null;
};

/**
 * Titel des nächsten Songs nach dem Element an `index` (für die Pausen-Seite
 * „Weiter mit …"). Überspringt weitere Pausen/Überschriften. null, wenn kein
 * Song mehr folgt.
 */
export function nextSongTitle(items: StageItem[], index: number): string | null {
  for (let i = index + 1; i < items.length; i++) {
    if (items[i].kind === "song") return items[i].title;
  }
  return null;
}

/**
 * Countdown-Anzeige: verbleibende Sekunden als "m:ss". Läuft die Pause über,
 * kippt sie ins Plus ("+m:ss"), damit der Überzug sichtbar bleibt.
 */
export function formatCountdown(remainingSeconds: number): string {
  const over = remainingSeconds < 0;
  const abs = Math.abs(remainingSeconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${over ? "+" : ""}${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Die nächsten `n` Elemente nach `index` (für die „Als nächstes"-Vorschau der
 * Notenpult-Ansicht). Am Listenende entsprechend kürzer bzw. leer.
 */
export function upcomingItems<T>(items: T[], index: number, n: number): T[] {
  return items.slice(index + 1, index + 1 + n);
}

/**
 * Einzeiler-Beschreibung eines kommenden Elements für die Vorschau.
 * Song: „Titel · Interpret · Tonart X". Pause: „⏸ Pause · N min".
 * Set-Überschrift: „▸ Set: Name".
 */
export function describeUpcoming(item: StageItem): string {
  if (item.kind === "break") {
    const min = item.breakSeconds ? Math.round(item.breakSeconds / 60) : 0;
    const dauer = min > 0 ? ` · ${min} min` : "";
    return `⏸ Pause${dauer}${item.label ? `: ${item.label}` : ""}`;
  }
  if (item.kind === "section") {
    return `▸ Set: ${item.label ?? "Set"}`;
  }
  return [
    item.title,
    item.artist,
    item.songKey ? `Tonart ${item.songKey}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
