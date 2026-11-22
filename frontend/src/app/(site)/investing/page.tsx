import ChartLabWorkspace, { type ChartBar } from "@/src/new-terminal/workspaces/ChartLabWorkspace";
import { readData } from "@/src/new-terminal/serverData";

const RANGE_DAYS = 186;
const WARMUP_DAYS = 120;

export default async function InvestingPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol: raw } = await searchParams;
  const symbol = raw && /^[A-Z0-9.\-^=]{1,20}$/i.test(raw) ? raw.toUpperCase() : "AAPL";
  const now = new Date();
  const visible = new Date(now.getTime() - RANGE_DAYS * 86400000);
  const warmup = new Date(visible.getTime() - WARMUP_DAYS * 86400000);
  const visibleStart = visible.toISOString().slice(0, 10);
  const query = new URLSearchParams({
    from: warmup.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  });
  const payload = await readData<{ data?: ChartBar[]; quality?: string }>(
    `/api/market/daily-history/${encodeURIComponent(symbol)}?${query}`,
    300,
  );
  const bars = (payload?.data ?? [])
    .filter(bar => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((a, b) => a.timestamps.localeCompare(b.timestamps));

  return <ChartLabWorkspace
    initialSymbol={symbol}
    initialHistory={{ bars, visibleStart }}
  />;
}

export const dynamic = "force-dynamic";
