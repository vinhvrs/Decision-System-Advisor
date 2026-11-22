import ScreenerWorkspace from "@/src/new-terminal/workspaces/ScreenerWorkspace";
import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import type { DailyAnalytics, Metrics, Universe } from "@/src/new-terminal/feeds";
import { readData } from "@/src/new-terminal/serverData";

export default async function ScreenerPage() {
  const [initialRows, universePayload, initialFund, initialTech, initialDaily] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<{ data: Universe[] }>("/api/v1/universe", 60),
    readData<Metrics>("/api/v1/sourced-fundamentals/AAPL", 120),
    readData<Metrics>("/api/v1/metrics/AAPL?timeframe=daily", 60),
    readData<DailyAnalytics>("/api/market/daily-analytics", 300),
  ]);
  return <ScreenerWorkspace
    initialRows={initialRows}
    initialUniverse={universePayload?.data ?? []}
    initialFund={initialFund}
    initialTech={initialTech}
    initialDaily={initialDaily}
  />;
}

export const dynamic = "force-dynamic";
