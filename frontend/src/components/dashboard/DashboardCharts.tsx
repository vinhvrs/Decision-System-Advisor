"use client";

import { useWatchlist } from "@/src/hooks/useWatchlist";
import TradingChart from "@/src/components/charts/page";
import Card from "@/src/sections/Card";
import WatchlistDashboardTable from "@/src/components/home/WatchlistDashboardTable";

const DEFAULT_MAIN = "NVDA";
const DEFAULT_SIDE = ["AAPL", "MSFT", "ORCL"];

export default function DashboardCharts() {
  const { items, loading: watchlistLoading } = useWatchlist();

  const symbolList = items.map((i) => String(i.symbol || "").toUpperCase()).filter(Boolean);
  const mainSymbol = symbolList[0] ?? DEFAULT_MAIN;
  const sideSymbols = [
    symbolList[1] ?? DEFAULT_SIDE[0],
    symbolList[2] ?? DEFAULT_SIDE[1],
    symbolList[3] ?? DEFAULT_SIDE[2],
  ];
  const usesReferenceSymbols = !watchlistLoading && symbolList.length < 4;

  return (
    <>
      <Card
        title="Primary chart"
        subtitle={
          watchlistLoading
            ? "Loading watchlist context…"
            : symbolList.length
              ? `${mainSymbol} from your watchlist`
              : `${mainSymbol} reference symbol — your watchlist is empty`
        }
        className="flex h-[min(520px,72vh)] min-h-[480px] w-full flex-col overflow-hidden phone:min-h-[500px] tablet:min-h-[560px] laptop:min-h-[620px]"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        <div className="min-h-0 flex-1">
          <TradingChart defaultSymbol={mainSymbol} isFixed={false} />
        </div>
      </Card>

      <div className="flex flex-col gap-1 tablet:flex-row tablet:items-end tablet:justify-between">
        <div>
          <p className="dsa-section-label">Quick charts</p>
          <h3 className="dsa-section-title mt-1">Cross-symbol monitor</h3>
          <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
            Watchlist symbols are used first; reference symbols fill empty slots.
          </p>
        </div>
        {usesReferenceSymbols ? (
          <span className="mt-2 self-start rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1 text-[10px] text-[var(--dsa-text-muted)] tablet:mt-0 tablet:self-auto">
            Reference symbols active
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 pc:grid-cols-3">
        {sideSymbols.map((symbol, index) => {
          const fromWatchlist = Boolean(symbolList[index + 1]);
          return (
            <Card
              key={`${symbol}-${index}`}
              title={symbol}
              subtitle={fromWatchlist ? "Watchlist" : "Reference symbol"}
              className="flex h-[340px] min-h-0 w-full flex-col overflow-hidden phone:h-[360px] laptop:h-[380px]"
              bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
            >
              <div className="min-h-0 flex-1">
                <TradingChart defaultSymbol={symbol} isFixed />
              </div>
            </Card>
          );
        })}
      </div>

      <div className="w-full min-w-0">
        <WatchlistDashboardTable className="w-full" />
      </div>
    </>
  );
}
