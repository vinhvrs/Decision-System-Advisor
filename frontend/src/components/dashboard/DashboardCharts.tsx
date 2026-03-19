"use client";

import { useWatchlist } from "@/src/hooks/useWatchlist";
import TradingChart from "@/src/components/charts/page";
import Card from "@/src/sections/Card";

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
      <Card className="h-[350px] phone:h-[420px] tablet:h-[500px] laptop:h-[560px] pc:h-[620px] overflow-hidden w-full">
        <div className="h-full w-full">
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
          <Card key={symbol} className="h-[320px] phone:h-[380px] tablet:h-[420px] laptop:h-[480px] pc:h-[520px] overflow-hidden p-0">
            <div className="h-full w-full">
              <TradingChart defaultSymbol={symbol} isFixed />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
