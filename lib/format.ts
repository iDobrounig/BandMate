/** Sekunden → "3:45" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** "3:45" oder "225" → Sekunden */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "–";
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return d.toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "–";
  return date.toLocaleString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Gage in Euro, deutsche Notation: 400 → "400 €", 1250 → "1.250 €".
 * Bewusst "de-DE" (Punkt als Tausendertrenner) statt "de-AT" — ICU rendert
 * de-AT mit schmalem Leerzeichen ("1 250"), was bei Beträgen ungewohnt wirkt.
 */
export function formatFee(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} €`;
}
