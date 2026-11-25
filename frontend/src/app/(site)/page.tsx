import { readMarketSnapshotFeed } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import { ECONOMIC_CALENDAR_PATH, type Calendar, type Crypto, type DailyAnalytics, type Macro, type News } from "@/src/new-terminal/feeds";
import type { Metadata } from "next";
import MarketsWorkspace from "@/src/new-terminal/workspaces/MarketsWorkspace";

export const metadata: Metadata = {
  title: "Markets | DSA",
  description: "Source-aware market research workspace.",
};

export default async function HomePage() {
  const [snapshot, daily, macro, crypto, calendar, news] = await Promise.all([
    readMarketSnapshotFeed().catch(() => ({ data: [] })),
    readData<DailyAnalytics>("/api/market/daily-analytics", 300),
    readData<Macro>("/api/v1/macro/dashboard", 300),
    readData<Crypto>("/api/v1/crypto-context", 60),
    readData<Calendar>(ECONOMIC_CALENDAR_PATH, 60),
    readData<{ data: News[] }>("/api/news?per_page=40&page=1", 60),
  ]);

  return (
    <MarketsWorkspace
      initialSnapshot={snapshot}
      initialDaily={daily}
      initialMacro={macro}
      initialCrypto={crypto}
      initialCalendar={calendar}
      initialNews={news}
    />
  );
}

export const dynamic = "force-dynamic";
