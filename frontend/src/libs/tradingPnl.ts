/** Live / display PnL for a paper ticket (volume = units held, leverage multiplies exposure). */
export function calcTicketProfit(
  type: "Buy" | "Sell" | string,
  openPrice: number,
  currentPrice: number,
  volume: number,
  leverage: number
): number {
  if (!Number.isFinite(openPrice) || openPrice <= 0 || !Number.isFinite(currentPrice)) return 0;
  const exposure = volume * (leverage || 1);
  return String(type).toLowerCase() === "buy"
    ? (currentPrice - openPrice) * exposure
    : (openPrice - currentPrice) * exposure;
}

/** Unrealized P/L for an aggregated chart position (long / short / flat). */
export function calcPositionUnrealizedPnl(
  side: "long" | "short" | "flat",
  avgPrice: number,
  qty: number,
  leverage: number,
  currentPrice: number
): number {
  if (side === "flat" || !avgPrice || !Number.isFinite(currentPrice)) return 0;
  const exposure = qty * (leverage || 1);
  return side === "long"
    ? (currentPrice - avgPrice) * exposure
    : (avgPrice - currentPrice) * exposure;
}

export function isBuyTicket(type: string | undefined): boolean {
  return String(type || "").toLowerCase() === "buy";
}

/** Human-readable open P/L with sign and dollar amount. */
export function formatOpenPnl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "-";
  const abs = Math.abs(value);
  const digits = abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return `${sign}$${abs.toFixed(digits)}`;
}
