/**
 * Zusagen-Quote: Zusagen / (Zusagen+Absagen). "Vielleicht" und offene
 * Rückmeldungen fließen bewusst nicht ein — sie sind kein Signal in
 * keine Richtung. null, wenn noch nie mit ja/nein geantwortet wurde.
 */
export function attendancePercentage(yes: number, no: number): number | null {
  if (yes + no === 0) return null;
  return Math.round((yes / (yes + no)) * 100);
}
