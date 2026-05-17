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

function biasFromIndicators(r: BeginnerBoardRow): "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" {
  const s = r.scores;
  const parts = [s.reputation, s.price_period, s.candle_change, s.volume, s.liquidity, s.people_care]
    .map(Number)
    .filter((v) => Number.isFinite(v));
  const avg = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 3;
  const st = Math.max(0, Math.min(5, Math.round(Number(r.strong_count)) || 0));
  const tilt = (st - 2.5) * 1.25 + (avg - 3) * 1.1;
  if (tilt >= 2.2) return "Strong Buy";
  if (tilt >= 0.8) return "Buy";
  if (tilt <= -2.2) return "Strong Sell";
  if (tilt <= -0.8) return "Sell";
  return "Hold";
}

function MiniTrend({ values }: { values?: number[] }) {
  const arr = Array.isArray(values) ? values : [];
  if (arr.length < 2) return <span className="text-white/40">—</span>;
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
  const stroke = arr[arr.length - 1] >= arr[0] ? "#16c784" : "#ea3943";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mx-auto block" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
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
      const payload = await BeginnerService.getDashboardDaily({ maxAgeMs: 30_000, staleWhileRevalidateMs: 90_000 });
      if (cancelled) return;
      setRows(payload?.rows ?? []);
      setLoading(false);
    };
    load();
    const t = window.setInterval(load, 150_000);
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
    <Card title="Watchlist Dashboard" className={clsx("min-w-0", className)}>
      {watchlistLoading || loading ? (
        <div className="text-sm text-white/60">Loading watchlist dashboard…</div>
      ) : watchSymbols.size === 0 ? (
        <div className="text-sm text-white/60">Add symbols to your watchlist to see your personalized dashboard.</div>
      ) : wlRows.length === 0 ? (
        <div className="text-sm text-white/60">No dashboard rows matched your watchlist symbols yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-white/50">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">24h %</th>
                <th className="px-2 py-2 text-center">Stance</th>
                <th className="px-2 py-2 text-center">Str</th>
                <th className="px-2 py-2 text-right">Profit</th>
                <th className="px-2 py-2 text-right">Vol $</th>
                <th className="px-2 py-2 text-right">Care</th>
                <th className="px-2 py-2 text-center">Trend</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">End order</th>
              </tr>
            </thead>
            <tbody>
              {wlRows.map((r, idx) => {
                const pct = Number(r.change_pct_snapshot);
                const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
                const pctCls = pct > 0 ? "text-[#16c784]" : pct < 0 ? "text-[#ea3943]" : "text-white/60";
                const stance = biasFromIndicators(r);
                const sym = String(r.symbol || "").toUpperCase();
                const profit = profitBySymbol.get(sym) ?? 0;
                const profitCls = profit > 0 ? "text-[#16c784]" : profit < 0 ? "text-[#ea3943]" : "text-white/60";
                const openTickets = openTicketsForSymbol(sym);
                const hasOpen = openTickets.length > 0;
                const busy = endingSymbol === sym;
                return (
                  <tr key={r.symbol} className={`border-t border-white/10 ${idx % 2 ? "bg-white/[0.02]" : ""}`}>
                    <td className="px-2 py-2 text-white/60">{idx + 1}</td>
                    <td className="px-2 py-2">
                      <Link href={`/companies/profile/${r.symbol.toLowerCase()}`} className="hover:text-blue-300">
                        <div className="font-medium text-white">{r.company_name}</div>
                        <div className="text-xs text-white/50">{r.symbol}</div>
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{fmtUsd(r.price)}</td>
                    <td className={`px-2 py-2 text-right font-mono ${pctCls}`}>
                      <span className="inline-flex items-center gap-0.5">
                        <Icon className="h-3.5 w-3.5" />
                        {fmtSignedPct(pct)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold">{stance}</span>
                    </td>
                    <td className="px-2 py-2 text-center font-mono text-[#7b9cff]">
                      {r.strong_count}/5
                    </td>
                    <td className={`px-2 py-2 text-right font-mono ${profitCls}`}>
                      {profit >= 0 ? "+" : ""}
                      {profit.toFixed(2)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{fmtUsd(r.liquidity)}</td>
                    <td className="px-2 py-2 text-right font-mono">{Number.isFinite(r.people_watching) ? r.people_watching : "—"}</td>
                    <td className="px-2 py-2 text-center">
                      <MiniTrend values={r.chart} />
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!hasOpen || busy}
                        title={hasOpen ? "Close all open positions for this symbol" : "No open position for this symbol"}
                        onClick={() => void handleEndOrder(sym, r.price)}
                        className={clsx(
                          "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                          hasOpen && !busy
                            ? "bg-white/15 text-white hover:bg-rose-500/80 hover:text-white"
                            : "bg-white/5 text-white/40 cursor-not-allowed"
                        )}
                      >
                        {busy ? "Ending…" : "End order"}
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

