import { readMarketSnapshot } from "@/src/new-terminal/marketSnapshot";
import { readData } from "@/src/new-terminal/serverData";
import type { Calendar, Crypto, DailyAnalytics, Macro, News } from "@/src/new-terminal/feeds";
import type { Metadata } from "next";
import MarketsWorkspace from "@/src/new-terminal/workspaces/MarketsWorkspace";

export const metadata: Metadata = {
  title: "Markets | DSA",
  description: "Source-aware market research workspace.",
};

export default async function HomePage() {
  const [rows, daily, macro, crypto, calendar, news] = await Promise.all([
    readMarketSnapshot().catch(() => []),
    readData<DailyAnalytics>("/api/market/daily-analytics", 300),
    readData<Macro>("/api/v1/macro/dashboard", 60),
    readData<Crypto>("/api/v1/crypto-context", 60),
    readData<Calendar>("/api/v1/economic-calendar?limit=12", 60),
    readData<{ data: News[] }>("/api/news?page=1", 60),
  ]);

  return (
    <MarketsWorkspace
      initialRows={rows}
      initialDaily={daily}
      initialMacro={macro}
      initialCrypto={crypto}
      initialCalendar={calendar}
      initialNews={news}
    />
  );
}

export const dynamic = "force-dynamic";
