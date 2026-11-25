export type MarketRow = {
  symbol: string;
  market: string;
  price: number | null;
  change_pct: number | null;
  traded_value: number | null;
  market_cap?: number | null;
  sector?: string | null;
  as_of: string | null;
  session_date?: string | null;
  previous_session_date?: string | null;
  last_sync_at?: string | null;
  coverage_partial?: boolean;
  session_final?: boolean;
  provider_error?: boolean;
};

export type EquityParticipation = {
  session_date: string | null;
  previous_session_date: string | null;
  universe_count: number;
  breadth_count: number;
  traded_value_count: number;
  advancing: number;
  declining: number;
  unchanged: number;
  up_value: number | null;
  down_value: number | null;
  flat_value: number | null;
  traded_value: number | null;
  symbols: string[];
};

export type MarketSnapshot = {
  data: MarketRow[];
  equity_session_rows?: MarketRow[];
  meta?: { equity_participation?: EquityParticipation };
};

export async function readMarketSnapshotFeed(): Promise<MarketSnapshot> {
  const result = await fetch("https://data.aitemple.tech/api/v1/market-heatmap", {
    next: { revalidate: 20 },
    signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
  });
  if (!result.ok) throw new Error(`Market snapshot returned ${result.status}`);
  const snapshot: MarketSnapshot = await result.json();
  if (!Array.isArray(snapshot.data)) throw new Error("Market snapshot is missing rows");
  return snapshot;
}

export async function readMarketSnapshot(): Promise<MarketRow[]> {
  return (await readMarketSnapshotFeed()).data;
}
