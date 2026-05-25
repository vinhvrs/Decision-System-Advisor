"use client";

import { useWatchlist } from "@/src/hooks/useWatchlist";
import TradingChart from "@/src/components/charts/page";
import Card from "@/src/sections/Card";
import WatchlistDashboardTable from "@/src/components/home/WatchlistDashboardTable";

const DEFAULT_MAIN = "NVDA";
const DEFAULT_SIDE = ["AAPL", "MSFT", "AMD"];

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
    <>
      {/* Main chart: first symbol from watchlist or NVDA */}
      <Card
        className="flex h-[min(520px,72vh)] min-h-[480px] w-full flex-col overflow-hidden phone:min-h-[500px] tablet:min-h-[560px] laptop:min-h-[620px] pc:min-h-[680px]"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <div className="min-h-0 flex-1">
          <TradingChart defaultSymbol={mainSymbol} isFixed={false} />
        </div>
      </Card>

      {/* Side charts: next 3 symbols from watchlist or AAPL, MSFT, AMD */}
      <div>
        <h3 className="text-lg font-semibold mb-3 tablet:mb-4">Watchlist Workspace</h3>
        <p className="text-sm text-white/60 mb-4">Quick monitoring for your watchlist symbols.</p>
      </div>
      <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 gap-4 tablet:gap-6">
        {sideSymbols.map((symbol) => (
          <Card
            key={symbol}
            className="flex h-[320px] min-h-0 flex-col overflow-hidden phone:h-[380px] tablet:h-[420px] laptop:h-[480px] pc:h-[520px]"
            bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
          >
            <div className="min-h-0 flex-1">
              <TradingChart defaultSymbol={symbol} isFixed />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 w-full min-w-0">
        <WatchlistDashboardTable className="w-full" />
      </div>
    </>
  );
}
