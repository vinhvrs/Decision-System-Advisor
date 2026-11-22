export type MarketRow = {
  symbol: string;
  market: string;
  price: number | null;
  change_pct: number | null;
  traded_value: number | null;
  market_cap?: number | null;
  sector?: string | null;
  as_of: string | null;
};

export async function readMarketSnapshot(): Promise<MarketRow[]> {
  const result = await fetch("https://data.aitemple.tech/api/v1/market-heatmap", {
    next: { revalidate: 20 },
    signal: AbortSignal.timeout(10000),\n      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 DSA-Server/1.0" },
  });
  if (!result.ok) throw new Error(`Market snapshot returned ${result.status}`);
  const { data } = await result.json();
  if (!Array.isArray(data)) throw new Error("Market snapshot is missing rows");
  return data;
}
