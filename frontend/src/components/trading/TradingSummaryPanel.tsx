"use client";

import type { TradeSummaryStats } from "@/src/hooks/useTradeSummary";

interface TradingSummaryPanelProps {
  stats: TradeSummaryStats;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

function formatProfit(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(4)}`;
}

export default function TradingSummaryPanel({
  stats,
  loading = false,
  error = null,
  onRefresh,
}: TradingSummaryPanelProps) {
  const totalColor =
    stats.totalProfit >= 0 ? "text-emerald-300" : stats.totalProfit < 0 ? "text-rose-300" : "text-slate-200";

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur px-4 py-3 text-slate-100 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-semibold">Trade summary</span>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="text-[10px] text-slate-400 hover:text-slate-200"
          >
            Refresh
          </button>
        ) : null}
      </div>

      {loading && (
        <p className="text-xs text-slate-400 animate-pulse">Updating summary…</p>
      )}

      {error && error !== "401" && (
        <p className="mb-2 text-xs text-rose-400">{error}</p>
      )}

      <div className="space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Total profit</p>
          <p className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${totalColor}`}>
            {formatProfit(stats.totalProfit)}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">
            Realized {formatProfit(stats.realizedProfit)} · Open{" "}
            {formatProfit(stats.unrealizedProfit)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-slate-700/60 pt-3">
          <div className="rounded-md bg-slate-800/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Buy trades</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-emerald-300/90">
              {stats.buyTrades}
            </p>
          </div>
          <div className="rounded-md bg-slate-800/50 px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Sell trades</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-rose-300/90">
              {stats.sellTrades}
            </p>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        Counts include open and closed tickets. Total profit is realized plus open P/L.
      </p>
    </div>
  );
}
