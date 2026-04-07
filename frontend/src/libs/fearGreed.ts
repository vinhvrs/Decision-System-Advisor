/**
 * Canonical Fear & Greed index (0–100), aligned with Laravel `beginnerFearGreedFromChangePct`
 * and Python `calc_fear_greed_per_symbol`: one mapping for the whole product.
 *
 * `r` = daily snapshot % change (same field as `change_pct_snapshot` on boards / beginner radar).
 *
 *   F = round( clamp_{[0,100]}( 50 + 3.25 · r ) )
 */

export function fearGreedLabelFromValue(v: number): string {
  if (v <= 24) return "Extreme Fear";
  if (v <= 44) return "Fear";
  if (v <= 55) return "Neutral";
  if (v <= 74) return "Greed";
  return "Extreme Greed";
}

export function fearGreedFromChangePct(changePct: number | null | undefined): { value: number; label: string } {
  const r = changePct === null || changePct === undefined ? Number.NaN : Number(changePct);
  if (!Number.isFinite(r)) {
    return { value: 50, label: "Neutral" };
  }
  const raw = 50 + r * 3.25;
  const v = Math.round(Math.max(0, Math.min(100, raw)));
  return { value: v, label: fearGreedLabelFromValue(v) };
}

/** Board toolbar: same formula applied once to the mean snapshot % across listed rows. */
export function fearGreedFromBoardRows(
  rows: ReadonlyArray<{ change_pct_snapshot?: number }>
): { value: number; label: string } {
  if (!rows.length) {
    return fearGreedFromChangePct(undefined);
  }
  let sum = 0;
  let n = 0;
  for (const row of rows) {
    const c = row.change_pct_snapshot;
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    sum += c;
    n++;
  }
  return fearGreedFromChangePct(n ? sum / n : undefined);
}
