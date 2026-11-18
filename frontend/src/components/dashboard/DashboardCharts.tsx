"use client";

import { useWatchlist } from "@/src/hooks/useWatchlist";
import TradingChart from "@/src/components/charts/page";
import Card from "@/src/sections/Card";
import WatchlistDashboardTable from "@/src/components/home/WatchlistDashboardTable";

const DEFAULT_MAIN = "NVDA";
const DEFAULT_SIDE = ["AAPL", "MSFT", "ORCL"];

export default function DashboardCharts() {
  const { items } = useWatchlist();

  const symbolList = items.map((i) => i.symbol);
  const mainSymbol = symbolList[0] ?? DEFAULT_MAIN;
  const sideSymbols = [
    symbolList[1] ?? DEFAULT_SIDE[0],
    symbolList[2] ?? DEFAULT_SIDE[1],
    symbolList[3] ?? DEFAULT_SIDE[2],
  ];

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="dsa-section-label">Primary chart</p>
            <h3 className="dsa-section-title mt-0.5">{mainSymbol} research chart</h3>
          </div>
          <p className="text-[10px] text-[var(--dsa-text-muted)]">
            Persisted OHLC · realtime quote overlay when available
          </p>
        </div>

        <Card
          className="flex h-[min(500px,68vh)] min-h-[420px] w-full flex-col overflow-hidden tablet:min-h-[480px] laptop:min-h-[520px]"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        >
          <div className="min-h-0 flex-1">
            <TradingChart defaultSymbol={mainSymbol} isFixed={false} />
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-2">
          <p className="dsa-section-label">Watchlist charts</p>
          <div className="mt-0.5 flex flex-wrap items-end justify-between gap-2">
            <h3 className="dsa-section-title">Quick comparison</h3>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">
              First watchlist symbols; defaults are used only when the watchlist has open slots.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-3">
          {sideSymbols.map((symbol) => (
            <Card
              key={symbol}
              className="flex h-[280px] min-h-0 w-full flex-col overflow-hidden laptop:h-[320px]"
              bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            >
              <div className="min-h-0 flex-1">
                <TradingChart defaultSymbol={symbol} isFixed />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2">
          <p className="dsa-section-label">Watchlist</p>
          <h3 className="dsa-section-title mt-0.5">Tracked symbols</h3>
        </div>
        <WatchlistDashboardTable className="w-full" />
      </section>
    </div>
  );
}
