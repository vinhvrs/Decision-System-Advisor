import { IndicatorsWorkspace } from "@/src/new-terminal/workspaces/FeedWorkspaces";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import type { DailyAnalytics, Metrics, Technical, Universe } from "@/src/new-terminal/feeds";

export default async function IndicatorsPage() {
  const [initialRows, universePayload, initialDaily, initialMetrics, initialTechnical] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<{ data: Universe[] }>("/api/v1/universe", 60),
    readData<DailyAnalytics>("/api/market/daily-analytics", 300),
    readData<Metrics>("/api/v1/metrics/AAPL?timeframe=daily", 60),
    readData<Technical>("/api/v1/technical/AAPL?period=daily", 60),
  ]);
  return <IndicatorsWorkspace
    initialRows={initialRows}
    initialUniverse={universePayload?.data ?? []}
    initialDaily={initialDaily}
    initialMetrics={initialMetrics}
    initialTechnical={initialTechnical}
  />;
}
