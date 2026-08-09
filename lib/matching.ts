/**
 * Ob `input` beim Songvorschlag als Dublette von `existingTitle` gelten soll.
 * Reine Funktion (kein DB-Zugriff), damit sie ohne Fixtures testbar ist.
 */
export function matchesDuplicateTitle(existingTitle: string, input: string): boolean {
  const a = existingTitle.trim().toLowerCase();
  const b = input.trim().toLowerCase();
  if (b.length < 2) return false;
  return a.includes(b) || b.includes(a);
}
