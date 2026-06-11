/** Live / display PnL for a paper ticket (matches PositionsPanel). */
export function calcTicketProfit(
  type: "Buy" | "Sell" | string,
  openPrice: number,
  currentPrice: number,
  volume: number,
  leverage: number
): number {
  if (!Number.isFinite(openPrice) || openPrice <= 0 || !Number.isFinite(currentPrice)) return 0;
  const mult = (volume * (leverage || 1)) / openPrice;
  return String(type).toLowerCase() === "buy"
    ? (currentPrice - openPrice) * mult
    : (openPrice - currentPrice) * mult;
}

export function isBuyTicket(type: string | undefined): boolean {
  return String(type || "").toLowerCase() === "buy";
}
