/**
 * Removes parenthetical segments such as "Inc (NASDAQ: XYZ)" → "Inc".
 * Repeats until stable so simple nested cases collapse.
 */
export function stripParentheticals(input: string | null | undefined): string {
  if (input == null) return "";
  let s = String(input).trim();
  let prev = "";
  for (let i = 0; i < 12 && s !== prev; i++) {
    prev = s;
    s = s.replace(/\s*\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  }
  return s;
}

export function formatCompactVolume(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(n);
}
