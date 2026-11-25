import ChartLabWorkspace, { type ChartBar } from "@/src/new-terminal/workspaces/ChartLabWorkspace";
import { readData } from "@/src/new-terminal/serverData";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import type { Calendar, Correlation, DailyAnalytics, Metrics, Universe } from "@/src/new-terminal/feeds";

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
  const compared = [...new Set([symbol, "SPY", "QQQ", "BTC-USD"])];
  const [historyPayload, initialRows, universePayload, initialMetrics, initialDaily, initialCalendar, initialCorrelation] = await Promise.all([
    readData<{ data?: ChartBar[]; quality?: string }>(
      `/api/market/daily-history/${encodeURIComponent(symbol)}?${query}`,
      300,
    ),
    readMarketSnapshot().catch(() => []),
    readData<{ data: Universe[] }>("/api/v1/universe", 60),
    readData<Metrics>(`/api/v1/metrics/${encodeURIComponent(symbol)}?timeframe=daily`, 60),
    readData<DailyAnalytics>("/api/market/daily-analytics", 300),
    readData<Calendar>(`/api/v1/economic-calendar?symbol=${encodeURIComponent(symbol)}&limit=1000`, 60),
    readData<Correlation>(`/api/v1/correlation?symbols=${encodeURIComponent(compared.join(","))}&window=60`, 120),
  ]);
  const bars = (historyPayload?.data ?? [])
    .filter(bar => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite))
    .sort((a, b) => a.timestamps.localeCompare(b.timestamps));

  return <ChartLabWorkspace
    initialSymbol={symbol}
    initialHistory={{ bars, visibleStart }}
    initialRows={initialRows}
    initialUniverse={universePayload?.data ?? []}
    initialMetrics={initialMetrics}
    initialDaily={initialDaily}
    initialCalendar={initialCalendar}
    initialCalendarTime={now.getTime()}
    initialCorrelation={initialCorrelation}
  />;
}

export const dynamic = "force-dynamic";
