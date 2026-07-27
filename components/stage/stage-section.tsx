/** Trenner-Seite für eine Set-Überschrift. */
export function StageSection({ label }: { label: string | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="text-sm uppercase tracking-widest text-faint">Set</span>
      <h2 className="headline text-5xl sm:text-7xl">{label ?? "Set"}</h2>
    </div>
  );
}
