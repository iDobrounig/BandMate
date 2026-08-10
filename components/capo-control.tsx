"use client";

const FRETS = [0, 1, 2, 3, 4, 5, 6, 7];

export function CapoSelect({
  capoFret,
  onChange,
  compact = false,
}: {
  capoFret: number;
  onChange: (fret: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className={`label mb-0 ${compact ? "text-xs" : ""}`}>Capo</span>
      <select
        className={`input ${compact ? "w-16 py-1 text-sm" : "w-16"}`}
        value={capoFret}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Capo-Bund"
      >
        {FRETS.map((fret) => (
          <option key={fret} value={fret}>
            {fret === 0 ? "–" : fret}
          </option>
        ))}
      </select>
    </div>
  );
}
