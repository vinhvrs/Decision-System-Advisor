"use client";

import type { TradeSummaryStats } from "@/src/hooks/useTradeSummary";
import { formatOpenPnl } from "@/src/libs/tradingPnl";

interface TradingSummaryPanelProps {
  stats: TradeSummaryStats;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export default function TradingSummaryPanel({
  stats, loading = false, error = null, onRefresh,
}: TradingSummaryPanelProps) {
  const totalTone = stats.totalProfit > 0
    ? "text-[var(--dsa-positive)]"
    : stats.totalProfit < 0
      ? "text-[var(--dsa-negative)]"
      : "text-[var(--dsa-text)]";

  return (
    <section className="dsa-panel overflow-hidden text-xs">
      <header className="flex items-center justify-between border-b border-[var(--dsa-border)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-white">Trade summary</p>
          <p className="mt-0.5 text-[10px] text-[var(--dsa-text-muted)]">Paper/open-ticket P&amp;L context</p>
        </div>
        {onRefresh ? (
          <button type="button" onClick={onRefresh} className="text-[10px] text-[var(--dsa-text-muted)] hover:text-white">
            Refresh
          </button>
        ) : null}
      </header>

      <div className="p-3">
        {loading ? <p className="mb-2 animate-pulse text-[10px] text-[var(--dsa-text-muted)]">Updating…</p> : null}
        {error && error !== "401" ? <p className="mb-2 text-[10px] text-[var(--dsa-negative)]">{error}</p> : null}

        <p className="dsa-section-label">Total P/L</p>
        <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${totalTone}`}>
          {formatOpenPnl(stats.totalProfit)}
        </p>
        <p className="mt-1 text-[10px] text-[var(--dsa-text-muted)]">
          Realized {formatOpenPnl(stats.realizedProfit)} · Open {formatOpenPnl(stats.unrealizedProfit)}
        </p>

        <div className="mt-3 grid grid-cols-2 border-t border-[var(--dsa-border)]">
          <div className="border-r border-[var(--dsa-border)] py-2 pr-2">
            <p className="text-[9px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">Buy tickets</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[var(--dsa-positive)]">{stats.buyTrades}</p>
          </div>
          <div className="py-2 pl-2">
            <p className="text-[9px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">Sell tickets</p>
            <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-[var(--dsa-negative)]">{stats.sellTrades}</p>
          </div>
        </div>

        <p className="mt-2 text-[9px] leading-relaxed text-[var(--dsa-text-muted)]">
          Buy/Sell here are executed ticket directions, not research-bias labels. Counts include open and closed tickets.
        </p>
      </div>
    </section>
  );
}
