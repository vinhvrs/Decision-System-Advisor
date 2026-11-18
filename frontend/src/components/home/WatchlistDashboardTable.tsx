"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Card from "@/src/sections/Card";
import { useWatchlist } from "@/src/hooks/useWatchlist";
import { usePositions } from "@/src/hooks/usePositions";
import { BeginnerService, type BeginnerBoardRow } from "@/src/services/Beginner.service";

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtSignedPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

type ResearchBias =
  | "Strong Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Strong Bearish"
  | "Not Rated";

function rowIsEligibleForBias(r: BeginnerBoardRow): boolean {
  if (r.analysis_eligible === false) return false;
  if (
    r.data_state === "missing" ||
    r.data_state === "partial" ||
    r.data_state === "synthetic"
  ) {
    return false;
  }

  const s = r.scores;
  const parts = [
    s?.reputation,
    s?.price_period,
    s?.candle_change,
    s?.volume,
    s?.liquidity,
    s?.people_care,
  ].map(Number);

  return (
    parts.every((value) => Number.isFinite(value) && value >= 1 && value <= 5) &&
    Number.isFinite(Number(r.strong_count))
  );
}

/** Preserve the existing watchlist composite thresholds for eligible rows only. */
function researchBiasFromIndicators(r: BeginnerBoardRow): ResearchBias {
  if (!rowIsEligibleForBias(r)) return "Not Rated";

  const s = r.scores;
  const parts = [
    s.reputation,
    s.price_period,
    s.candle_change,
    s.volume,
    s.liquidity,
    s.people_care,
  ].map(Number);
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
  const st = Math.max(0, Math.min(5, Math.round(Number(r.strong_count)) || 0));
  const tilt = (st - 2.5) * 1.25 + (avg - 3) * 1.1;

  if (tilt >= 2.2) return "Strong Bullish";
  if (tilt >= 0.8) return "Bullish";
  if (tilt <= -2.2) return "Strong Bearish";
  if (tilt <= -0.8) return "Bearish";
  return "Neutral";
}

function biasClass(bias: ResearchBias): string {
  if (bias === "Strong Bullish" || bias === "Bullish") {
    return "border-[rgba(44,182,125,0.25)] bg-[rgba(44,182,125,0.08)] text-[var(--dsa-positive)]";
  }
  if (bias === "Strong Bearish" || bias === "Bearish") {
    return "border-[rgba(231,91,100,0.25)] bg-[rgba(231,91,100,0.08)] text-[var(--dsa-negative)]";
  }
  return "border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] text-[var(--dsa-text-muted)]";
}

function MiniTrend({
  values,
  historyState,
}: {
  values?: number[];
  historyState?: BeginnerBoardRow["history_state"];
}) {
  const arr = Array.isArray(values) ? values : [];

  // Never render a realtime-appended point as if it were persisted history.
  if (historyState === "missing" || historyState === "short" || arr.length < 2) {
    return (
      <span
        className="text-[10px] text-[var(--dsa-text-muted)]"
        title="Persisted history is unavailable or too short"
      >
        —
      </span>
    );
  }

  const w = 72;
  const h = 24;
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const range = max - min || 1;
  const points = arr
    .map((v, i) => {
      const x = (i / (arr.length - 1)) * (w - 2) + 1;
      const y = h - 1 - ((v - min) / range) * (h - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = arr[arr.length - 1] >= arr[0] ? "#2cb67d" : "#e75b64";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mx-auto block" aria-hidden>
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

type WatchlistDashboardTableProps = {
  className?: string;
};

export default function WatchlistDashboardTable({ className }: WatchlistDashboardTableProps) {
  const { items: watchlist, loading: watchlistLoading } = useWatchlist();
  const { positions, closePosition, refetch } = usePositions(300);
  const [rows, setRows] = useState<BeginnerBoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSymbol, setEndingSymbol] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const payload = await BeginnerService.getDashboardDaily({
          maxAgeMs: 30_000,
          staleWhileRevalidateMs: 90_000,
        });
        if (cancelled) return;
        setRows(payload?.rows ?? []);
      } catch {
        // Keep the last known good rows on transient refresh failures.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 150_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const watchSymbols = useMemo(
    () => new Set(watchlist.map((w) => String(w.symbol || "").toUpperCase()).filter(Boolean)),
    [watchlist]
  );

  const profitBySymbol = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of positions) {
      const sym = String(p.symbol || "").toUpperCase();
      if (!sym) continue;
      const cur = out.get(sym) ?? 0;
      const val = Number(p.profit);
      out.set(sym, cur + (Number.isFinite(val) ? val : 0));
    }
    return out;
  }, [positions]);

  const wlRows = useMemo(() => {
    const filtered = rows.filter((r) => watchSymbols.has(String(r.symbol || "").toUpperCase()));
    filtered.sort((a, b) => a.rank - b.rank);
    return filtered;
  }, [rows, watchSymbols]);

  const openTicketsForSymbol = useCallback(
    (symU: string) =>
      positions.filter(
        (p) => String(p.symbol || "").toUpperCase() === symU && p.status === "open"
      ),
    [positions]
  );

  const handleEndOrder = useCallback(
    async (symU: string, rowPrice: number | null | undefined) => {
      const tickets = openTicketsForSymbol(symU);
      if (!tickets.length) return;
      setEndingSymbol(symU);
      const px = rowPrice != null && Number.isFinite(Number(rowPrice)) ? Number(rowPrice) : undefined;
      try {
        for (const p of tickets) {
          await closePosition(p.id, px ?? (p.current_price != null ? Number(p.current_price) : undefined));
        }
        window.dispatchEvent(new CustomEvent("ticket-changed"));
        await refetch();
      } finally {
        setEndingSymbol(null);
      }
    },
    [closePosition, openTicketsForSymbol, refetch]
  );

  return (
    <Card className={clsx("min-w-0", className)} bodyClassName="p-0">
      {watchlistLoading || loading ? (
        <div className="px-3 py-5 text-xs text-[var(--dsa-text-muted)]">
          Loading watchlist…
        </div>
      ) : watchSymbols.size === 0 ? (
        <div className="px-3 py-5 text-xs text-[var(--dsa-text-muted)]">
          Add symbols to the watchlist to populate this table.
        </div>
      ) : wlRows.length === 0 ? (
        <div className="px-3 py-5 text-xs text-[var(--dsa-text-muted)]">
          No current dashboard rows match the tracked symbols.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] border-collapse text-xs">
            <thead className="bg-[var(--dsa-surface-2)] text-[10px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
              <tr>
                <th className="px-2.5 py-2 text-right">#</th>
                <th className="px-2.5 py-2 text-left">Symbol</th>
                <th className="px-2.5 py-2 text-right">Price</th>
                <th className="px-2.5 py-2 text-right">Daily %</th>
                <th className="px-2.5 py-2 text-center">Bias</th>
                <th className="px-2.5 py-2 text-center">Str</th>
                <th className="px-2.5 py-2 text-right">P/L</th>
                <th className="px-2.5 py-2 text-right">Liquidity</th>
                <th className="px-2.5 py-2 text-right">Watchers</th>
                <th className="px-2.5 py-2 text-center">History</th>
                <th className="whitespace-nowrap px-2.5 py-2 text-right">Position</th>
              </tr>
            </thead>

            <tbody>
              {wlRows.map((r, idx) => {
                const pct = Number(r.change_pct_snapshot);
                const pctMissing = r.missing_fields?.includes("change_pct") ?? false;
                const pctUsable = !pctMissing && Number.isFinite(pct);
                const Icon = !pctUsable ? Minus : pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
                const pctCls =
                  !pctUsable
                    ? "dsa-data-muted"
                    : pct > 0
                      ? "dsa-data-positive"
                      : pct < 0
                        ? "dsa-data-negative"
                        : "dsa-data-muted";

                const bias = researchBiasFromIndicators(r);
                const eligible = rowIsEligibleForBias(r);
                const sym = String(r.symbol || "").toUpperCase();
                const profit = profitBySymbol.get(sym) ?? 0;
                const profitCls =
                  profit > 0
                    ? "dsa-data-positive"
                    : profit < 0
                      ? "dsa-data-negative"
                      : "dsa-data-muted";
                const openTickets = openTicketsForSymbol(sym);
                const hasOpen = openTickets.length > 0;
                const busy = endingSymbol === sym;

                return (
                  <tr
                    key={r.symbol}
                    className="border-t border-[var(--dsa-border)] odd:bg-[var(--dsa-surface-1)] even:bg-[rgba(255,255,255,0.012)] hover:bg-[var(--dsa-surface-2)]"
                  >
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[var(--dsa-text-muted)]">
                      {idx + 1}
                    </td>
                    <td className="px-2.5 py-2">
                      <Link
                        href={`/companies/profile/${r.symbol.toLowerCase()}`}
                        className="group block min-w-0"
                      >
                        <span className="font-mono text-xs font-semibold text-[#8ab4ff] group-hover:underline">
                          {sym}
                        </span>
                        <span className="ml-2 max-w-[180px] truncate text-[10px] text-[var(--dsa-text-muted)]">
                          {r.company_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                      {fmtUsd(r.price)}
                    </td>
                    <td className={`px-2.5 py-2 text-right font-mono tabular-nums ${pctCls}`}>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        <Icon className="h-3 w-3" />
                        {pctUsable ? fmtSignedPct(pct) : "—"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <span
                        className={`inline-flex rounded-[var(--dsa-radius-sm)] border px-1.5 py-0.5 text-[10px] font-semibold ${biasClass(bias)}`}
                        title={r.analysis_reason ?? "Research bias derived from the existing Str + radar composite"}
                      >
                        {bias}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-center font-mono tabular-nums">
                      {eligible ? (
                        <span className="text-[#8ab4ff]">{r.strong_count}/5</span>
                      ) : (
                        <span className="text-[var(--dsa-text-muted)]">—</span>
                      )}
                    </td>
                    <td className={`px-2.5 py-2 text-right font-mono tabular-nums ${profitCls}`}>
                      {profit >= 0 ? "+" : ""}
                      {profit.toFixed(2)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                      {fmtUsd(r.liquidity)}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                      {Number.isFinite(r.people_watching) ? r.people_watching : "—"}
                    </td>
                    <td className="px-2.5 py-2 text-center">
                      <MiniTrend values={r.chart} historyState={r.history_state} />
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2 text-right">
                      <button
                        type="button"
                        disabled={!hasOpen || busy}
                        title={hasOpen ? "Close all open positions for this symbol" : "No open position for this symbol"}
                        onClick={() => void handleEndOrder(sym, r.price)}
                        className={clsx(
                          "rounded-[var(--dsa-radius-sm)] border px-2 py-1 text-[10px] font-medium transition-colors",
                          hasOpen && !busy
                            ? "border-[var(--dsa-border-strong)] text-[var(--dsa-text-secondary)] hover:border-[rgba(231,91,100,0.45)] hover:bg-[rgba(231,91,100,0.08)] hover:text-[var(--dsa-negative)]"
                            : "cursor-not-allowed border-[var(--dsa-border)] text-[var(--dsa-text-muted)] opacity-55"
                        )}
                      >
                        {busy ? "Closing…" : hasOpen ? "Close" : "—"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
