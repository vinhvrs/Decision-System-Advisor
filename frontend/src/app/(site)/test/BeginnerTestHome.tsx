"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CompanyService } from "@/src/services/Company.service";
import { InstrumentService } from "@/src/services/Instrument.service";
import { BeginnerService, type BeginnerBoardRow, type BeginnerOverview } from "@/src/services/Beginner.service";
import BeginnerRadarChart from "./BeginnerRadarChart";
import { Heart, TrendingUp, BarChart3, Droplets, Users, Clock, ChevronRight, Trophy } from "lucide-react";

type Period = "daily" | "yearly";

type SymbolOption = { symbol: string; company_name?: string };

type CandleRow = {
  timestamps?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatShares(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function parseCandleTime(row: CandleRow): number {
  const raw = row.timestamps;
  if (!raw) return 0;
  const s = String(raw);
  const d = s.includes("T") ? new Date(s) : new Date(s.replace(" ", "T") + "Z");
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

function dayBiasFromRow(r: BeginnerBoardRow): "buy" | "sell" | "flat" {
  if (r.day_bias === "buy" || r.day_bias === "sell" || r.day_bias === "flat") return r.day_bias;
  const ch = r.change_pct_snapshot;
  if (!Number.isFinite(ch)) return "flat";
  if (ch > 0) return "buy";
  if (ch < 0) return "sell";
  return "flat";
}

function dayBiasBorderClass(bias: "buy" | "sell" | "flat"): string {
  if (bias === "buy") return "border-l-[6px] border-l-emerald-400";
  if (bias === "sell") return "border-l-[6px] border-l-rose-500";
  return "border-l-[6px] border-l-white/25";
}

export default function BeginnerTestHome() {
  const [symbols, setSymbols] = useState<SymbolOption[]>([]);
  const [symbol, setSymbol] = useState("NVDA");
  const [period, setPeriod] = useState<Period>("daily");
  const [overview, setOverview] = useState<BeginnerOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [candleNote, setCandleNote] = useState<string | null>(null);
  const [boardRows, setBoardRows] = useState<BeginnerBoardRow[]>([]);
  const [boardLegend, setBoardLegend] = useState<{
    strong_rule?: string;
    tie_break?: string;
    buy_sell?: string;
  } | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);

  useEffect(() => {
    CompanyService.topCompanies(50, "liquidity")
      .then((rows) => {
        const list = (rows || []).map((r: { symbol?: string; company_name?: string }) => ({
          symbol: String(r.symbol || "").toUpperCase(),
          company_name: r.company_name,
        }));
        const uniq = Array.from(
          new Map(list.filter((x: SymbolOption) => x.symbol).map((x: SymbolOption) => [x.symbol, x])).values()
        ) as SymbolOption[];
        setSymbols(uniq.length ? uniq : [{ symbol: "NVDA" }, { symbol: "AAPL" }, { symbol: "MSFT" }]);
      })
      .catch(() => setSymbols([{ symbol: "NVDA" }, { symbol: "AAPL" }, { symbol: "MSFT" }]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBoardLoading(true);
    BeginnerService.getRankingBoard(60)
      .then((payload) => {
        if (cancelled) return;
        setBoardRows(payload?.rows ?? []);
        setBoardLegend(payload?.legend ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setBoardRows([]);
          setBoardLegend(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);
    BeginnerService.getOverview(symbol).then((data) => {
      if (!cancelled) {
        setOverview(data);
        setOverviewLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const loadCandles = useCallback(async () => {
    setCandlesLoading(true);
    setCandleNote(null);
    try {
      const limit = period === "daily" ? 400 : 80;
      const raw = await InstrumentService.getInstrumentData(symbol, period, limit, 1);
      const list = (raw || []) as CandleRow[];
      const sorted = [...list].sort((a, b) => parseCandleTime(a) - parseCandleTime(b));
      setCandles(sorted);
      if (sorted.length < 2) {
        setCandleNote(
          period === "yearly"
            ? "We need a bit more yearly history to compare two bars — try daily for now."
            : "Not enough recent bars to compare yet."
        );
      }
    } catch {
      setCandles([]);
      setCandleNote("Could not load price bars for this symbol and period.");
    } finally {
      setCandlesLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  const candleInsights = useMemo(() => {
    if (candles.length < 1) return null;
    const last = candles[candles.length - 1];
    const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
    const o = Number(last.open);
    const c = Number(last.close);
    const insideBar = pctChange(o, c);
    const vsPrevClose = prev ? pctChange(Number(prev.close), c) : null;
    return {
      lastClose: c,
      insideBar,
      vsPrevClose,
      lastVolume: Number(last.volume) || 0,
    };
  }, [candles]);

  const periodLabel = period === "daily" ? "day" : "year";

  const rowForRadar = useMemo(() => {
    if (!boardRows.length) return null;
    const hit = boardRows.find((r) => r.symbol === symbol);
    return hit ?? boardRows[0];
  }, [boardRows, symbol]);

  const radarFallback = rowForRadar && rowForRadar.symbol !== symbol;

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/80 via-[#0b1220] to-cyan-950/40" />
        <div className="relative max-w-3xl mx-auto px-4 py-14 phone:py-18 text-center">
          <p className="text-sm uppercase tracking-widest text-indigo-300/90 mb-3">Friendly test page</p>
          <h1 className="text-3xl phone:text-4xl font-bold leading-tight">
            Understand a stock — <span className="text-indigo-400">without the jargon</span>
          </h1>
          <p className="mt-4 text-white/70 text-base phone:text-lg max-w-xl mx-auto">
            Pick a company, choose daily or yearly bars, and see price movement, trading activity, and how many
            people here are paying attention.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <label className="sr-only" htmlFor="beginner-symbol">
              Symbol
            </label>
            <select
              id="beginner-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-left font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
            >
              {symbols.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol}
                  {s.company_name ? ` — ${s.company_name}` : ""}
                </option>
              ))}
            </select>
            <div className="inline-flex rounded-xl border border-white/15 p-1 bg-black/20">
              {(["daily", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    period === p ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {p === "daily" ? "Daily" : "Yearly"}
                </button>
              ))}
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 mt-8 text-sm text-indigo-300 hover:text-indigo-200"
          >
            Back to main site
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Near full-width radar board for easier reading */}
      <div className="w-full max-w-[min(1680px,calc(100vw-1.25rem))] mx-auto px-2 sm:px-4 pt-6 pb-4">
        <section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-5 sm:p-7 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4 mb-5">
            <div className="flex items-start gap-3 shrink-0">
              <div className="p-2 rounded-xl bg-violet-500/20 text-violet-300">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Friendly radar ranking</h2>
                <p className="text-sm text-white/55 mt-1 max-w-3xl">
                  Each trait is scored from <strong>1–5</strong> (higher = stronger vs other names on this list). We
                  count how many traits are <strong>4 or 5</strong>, rank from most to least, then break ties with{" "}
                  <strong>liquidity</strong>, then <strong>volume</strong>, then <strong>watchlist saves</strong>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-white/45 lg:ml-auto lg:max-w-md">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200/90">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" aria-hidden />
                Buy = snapshot day up
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-200/90">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500" aria-hidden />
                Sell = snapshot day down
              </span>
            </div>
          </div>
          {boardLegend?.strong_rule && (
            <p className="text-xs text-white/45 mb-1 leading-relaxed">{boardLegend.strong_rule}</p>
          )}
          {boardLegend?.tie_break && (
            <p className="text-xs text-white/45 mb-1 leading-relaxed">{boardLegend.tie_break}</p>
          )}
          {boardLegend?.buy_sell && (
            <p className="text-xs text-amber-200/70 mb-4 leading-relaxed">{boardLegend.buy_sell}</p>
          )}

          {boardLoading ? (
            <p className="text-white/40 animate-pulse py-8 text-center">Loading rankings…</p>
          ) : boardRows.length === 0 ? (
            <p className="text-sm text-amber-200/90 py-6 text-center">No snapshot data to rank yet.</p>
          ) : (
            <div className="grid gap-8 xl:grid-cols-12 xl:items-start">
              <div className="overflow-x-auto rounded-xl border border-white/10 xl:col-span-7">
                <table className="w-full text-sm text-left min-w-[520px]">
                  <thead className="bg-black/30 text-white/50 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Symbol</th>
                      <th className="px-2 py-2 font-medium text-center">Day</th>
                      <th className="px-3 py-2 font-medium text-center">Strong</th>
                      <th className="px-3 py-2 font-medium text-right hidden sm:table-cell">Liquidity</th>
                      <th className="px-3 py-2 font-medium text-right hidden md:table-cell">Volume</th>
                      <th className="px-3 py-2 font-medium text-right">Care</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boardRows.map((r) => {
                      const bias = dayBiasFromRow(r);
                      return (
                        <tr
                          key={r.symbol}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSymbol(r.symbol)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSymbol(r.symbol);
                            }
                          }}
                          className={`border-t border-white/5 cursor-pointer transition hover:bg-white/5 ${dayBiasBorderClass(
                            bias
                          )} ${r.symbol === symbol ? "bg-indigo-600/20 ring-1 ring-inset ring-indigo-400/35" : ""}`}
                        >
                          <td className="px-3 py-2.5 font-mono text-white/70">{r.rank}</td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-semibold text-white">{r.symbol}</span>
                            <span className="block text-xs text-white/40 truncate max-w-[200px] sm:max-w-[240px]">
                              {r.company_name}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                bias === "buy"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : bias === "sell"
                                    ? "bg-rose-500/20 text-rose-200 border border-rose-500/45"
                                    : "bg-white/10 text-white/55 border border-white/15"
                              }`}
                            >
                              {bias === "buy" ? "Buy" : bias === "sell" ? "Sell" : "Flat"}
                            </span>
                            <span className="block text-[10px] text-white/35 mt-0.5 font-mono">
                              {Number.isFinite(r.change_pct_snapshot)
                                ? `${r.change_pct_snapshot >= 0 ? "+" : ""}${r.change_pct_snapshot.toFixed(2)}%`
                                : "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="font-mono font-bold text-indigo-300">{r.strong_count}</span>
                            <span className="text-white/35">/6</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-white/80 hidden sm:table-cell">
                            {formatUsd(r.liquidity)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-white/80 hidden md:table-cell">
                            {formatShares(r.volume)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-white/80">{r.people_watching}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="xl:col-span-5 min-w-0">
                {rowForRadar && (
                  <>
                    <p className="text-sm text-white/70 mb-1">
                      Radar for{" "}
                      <span className="font-mono font-semibold text-white">{rowForRadar.symbol}</span>
                      {radarFallback ? (
                        <span className="text-white/45"> (top pick — your dropdown is not on this board)</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-white/40 mb-3">
                      Reputation · Price vs peers · Candle change · Volume · Liquidity · People care — click a row to
                      inspect that symbol below.
                    </p>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-2 min-h-[320px] h-[min(420px,50vh)]">
                      <BeginnerRadarChart data={rowForRadar.radar} />
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/50">
                      <div>
                        Scores: Rep {rowForRadar.scores.reputation} · Price {rowForRadar.scores.price_period} · Move{" "}
                        {rowForRadar.scores.candle_change}
                      </div>
                      <div>
                        Vol {rowForRadar.scores.volume} · Liq {rowForRadar.scores.liquidity} · Care{" "}
                        {rowForRadar.scores.people_care}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Reputation / community */}
        <section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-300">
              <Heart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">How much people care</h2>
              <p className="text-sm text-white/55 mt-1">
                We count how many signed-in users saved this ticker to their watchlist. More saves usually means
                more people are tracking the story — not a buy/sell recommendation.
              </p>
              {overviewLoading ? (
                <p className="mt-4 text-white/40 animate-pulse">Loading…</p>
              ) : overview ? (
                <>
                  <p className="mt-4 text-2xl font-bold text-white">{overview.people_watching}</p>
                  <p className="text-sm text-white/60">watchlist saves on DSA</p>
                  <p className="mt-3 text-white/85 leading-relaxed">{overview.reputation_label}</p>
                </>
              ) : (
                <p className="mt-4 text-amber-200/90 text-sm">No live snapshot for this symbol yet.</p>
              )}
            </div>
          </div>
        </section>

        {/* Price & snapshot */}
        <section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Price right now (from our latest daily snapshot)</h2>
              <p className="text-sm text-white/55 mt-1">
                This is a simple “where it last traded” number we store for the dashboard. It updates when our
                market data refreshes — not a live tick-by-tick feed.
              </p>
              {overviewLoading ? (
                <p className="mt-4 text-white/40 animate-pulse">Loading…</p>
              ) : overview ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Last price</p>
                    <p className="text-3xl font-mono font-bold mt-1">{formatUsd(overview.price)}</p>
                    <p className="text-sm text-white/55 mt-1">{overview.company_name}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Change that day (snapshot)</p>
                    <p
                      className={`text-2xl font-mono font-bold mt-1 ${
                        overview.change_pct_snapshot >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {overview.change_pct_snapshot >= 0 ? "+" : ""}
                      {overview.change_pct_snapshot.toFixed(2)}%
                    </p>
                    <p className="text-xs text-white/45 mt-1">Compared to that day’s opening level in our data</p>
                  </div>
                  {overview.market_cap != null && overview.market_cap > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-xs uppercase tracking-wide text-white/45">Company size (market cap)</p>
                      <p className="text-lg font-mono mt-1">{formatUsd(overview.market_cap)}</p>
                      <p className="text-xs text-white/45 mt-1">Rough idea of total market value — from company profile</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Candles: same period */}
        <section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">
                Change between candles ({period === "daily" ? "each day" : "each year"})
              </h2>
              <p className="text-sm text-white/55 mt-1">
                Each candle is one {periodLabel}: the thick part shows where price opened and closed. We compare
                the <strong>last</strong> candle to the one before it, and also show open → close inside the last
                candle.
              </p>
              {candlesLoading ? (
                <p className="mt-4 text-white/40 animate-pulse">Loading bars…</p>
              ) : candleInsights ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl bg-black/25 border border-white/10 p-4">
                    <p className="text-xs uppercase text-white/45">Latest bar — close price</p>
                    <p className="text-2xl font-mono font-semibold mt-1">{formatUsd(candleInsights.lastClose)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-black/25 border border-white/10 p-4">
                      <p className="text-xs uppercase text-white/45">Inside the last candle</p>
                      <p className="text-sm text-white/60 mt-1">Open → close on that {periodLabel}</p>
                      <p
                        className={`text-xl font-mono font-bold mt-2 ${
                          (candleInsights.insideBar ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {candleInsights.insideBar == null
                          ? "—"
                          : `${candleInsights.insideBar >= 0 ? "+" : ""}${candleInsights.insideBar.toFixed(2)}%`}
                      </p>
                    </div>
                    <div className="rounded-xl bg-black/25 border border-white/10 p-4">
                      <p className="text-xs uppercase text-white/45">Versus previous candle</p>
                      <p className="text-sm text-white/60 mt-1">Last close vs previous close</p>
                      <p
                        className={`text-xl font-mono font-bold mt-2 ${
                          (candleInsights.vsPrevClose ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {candleInsights.vsPrevClose == null
                          ? "—"
                          : `${candleInsights.vsPrevClose >= 0 ? "+" : ""}${candleInsights.vsPrevClose.toFixed(2)}%`}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-4">
                    <p className="text-xs uppercase text-white/45">Volume on the latest bar</p>
                    <p className="text-lg font-mono mt-1">{formatShares(candleInsights.lastVolume)} shares</p>
                    <p className="text-xs text-white/45 mt-1">How many shares traded in that {periodLabel} — higher often means more attention</p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-white/50 text-sm">No bar data loaded.</p>
              )}
              {candleNote && <p className="mt-3 text-sm text-amber-200/90">{candleNote}</p>}
            </div>
          </div>
        </section>

        {/* Volume & liquidity from snapshot */}
        <section className="rounded-2xl border border-white/10 bg-[#111827]/80 p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300">
              <Droplets className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Volume & liquidity (plain English)</h2>
              <p className="text-sm text-white/55 mt-1">
                <strong>Volume</strong> is how many shares traded. <strong>Liquidity</strong> here is price × volume
                for the latest snapshot — a rough sense of how much money moved, not a bank balance.
              </p>
              {overviewLoading ? (
                <p className="mt-4 text-white/40 animate-pulse">Loading…</p>
              ) : overview ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-black/25 border border-white/10 p-4">
                    <p className="text-xs uppercase text-white/45">Volume (snapshot)</p>
                    <p className="text-xl font-mono font-semibold mt-1">{formatShares(overview.volume)}</p>
                    <p className="text-xs text-white/45 mt-1">Shares in our last update</p>
                  </div>
                  <div className="rounded-xl bg-black/25 border border-white/10 p-4">
                    <p className="text-xs uppercase text-white/45">Liquidity (snapshot)</p>
                    <p className="text-xl font-mono font-semibold mt-1">{formatUsd(overview.liquidity)}</p>
                    <p className="text-xs text-white/45 mt-1">Price × volume — activity proxy</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-6 flex gap-3">
          <Users className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-indigo-200">What this page is not</h3>
            <p className="text-sm text-white/60 mt-2 leading-relaxed">
              This is a learning layout: short explanations, rounded numbers, and community interest — not financial
              advice. For deeper tools, charts, and news, use the rest of the site when you’re ready.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Link href={`/companies/profile/${symbol.toLowerCase()}`} className="text-sm text-indigo-300 hover:underline">
                Company profile →
              </Link>
              <Link href="/search" className="text-sm text-indigo-300 hover:underline">
                Search companies →
              </Link>
            </div>
          </div>
        </section>

        <p className="flex items-center gap-2 text-xs text-white/35 justify-center pb-8">
          <Clock className="w-3.5 h-3.5" />
          Snapshot times follow server data — not real-time exchange clocks.
        </p>
      </div>
    </div>
  );
}
