"use client";

import { useWatchlist } from "@/src/hooks/useWatchlist";
import TradingChart from "@/src/components/charts/page";
import Card from "@/src/sections/Card";

const DEFAULT_SYMBOLS = ["AAPL", "MSFT", "AMD"];

export default function WatchlistCharts() {
  const { items, loading } = useWatchlist();

  const symbols = items.length > 0
    ? items.slice(0, 6).map((i) => i.symbol)
    : DEFAULT_SYMBOLS;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {symbols.map((symbol) => (
        <Card
          key={symbol}
          className="flex h-[520px] min-h-0 flex-col overflow-hidden"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        >
          <div className="min-h-0 flex-1">
            <TradingChart defaultSymbol={symbol} isFixed />
          </div>
        </Card>
      ))}
    </div>
  );
}
