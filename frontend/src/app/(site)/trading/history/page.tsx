"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { InstrumentService } from "@/src/services/Instrument.service";
import type { InstrumentData } from "@/src/types/InstrumentData";
import LightChart from "@/src/components/charts/LightChart";
import { DEV_SYMBOL_SEED } from "@/src/libs/symbolDevIdb";

type HistoryPeriod = "daily" | "weekly" | "monthly" | "yearly";
type Speed = 1 | 2 | 4;
type CurrencyCode = "USD" | "EUR" | "VND";
type OrderSide = "buy" | "sell";
type HorizonPreset = "1Y" | "3Y" | "5Y" | "10Y";

type TradeLog = {
  side: "buy" | "sell";
  at: string;
  price: number;
  qty: number;
  leverage: number;
  cashAfter: number;
};

type AdviceRow = {
  symbol: string;
  asOf: string;
  value: number;
  quality: number;
  growth: number;
  momentum: number;
  stability: number;
  sentiment: number;
  advice: "ACCUMULATE" | "KEEP" | "REVIEW";
  note: string;
};

const SPEED_INTERVAL_MS: Record<Speed, number> = {
  // 1x means one candle every 15 seconds.
  1: 15_000,
  // 2x, 4x are faster multiples.
  2: 7_500,
  4: 3_750,
};

const INITIAL_VISIBLE_BARS = 20;
const HISTORY_SYMBOL_OPTIONS = DEV_SYMBOL_SEED.slice(0, 10).map((s) => ({
  symbol: s.symbol.toUpperCase(),
  label: s.company_name,
}));
const HORIZON_DAYS: Record<HorizonPreset, number> = {
  "1Y": 365,
  "3Y": 365 * 3,
  "5Y": 365 * 5,
  "10Y": 365 * 10,
};

const DEMO_HISTORY_ADVICE_BASE: Omit<AdviceRow, "asOf">[] = [
  { symbol: "AAPL", value: 4.2, quality: 4.8, growth: 4.3, momentum: 3.6, stability: 4.7, sentiment: 4.0, advice: "ACCUMULATE", note: "Strong quality and balance sheet with durable growth." },
  { symbol: "MSFT", value: 4.0, quality: 4.9, growth: 4.5, momentum: 3.8, stability: 4.8, sentiment: 4.2, advice: "ACCUMULATE", note: "High quality compounder with resilient cash generation." },
  { symbol: "GOOGL", value: 4.3, quality: 4.6, growth: 4.2, momentum: 3.7, stability: 4.5, sentiment: 3.8, advice: "ACCUMULATE", note: "Attractive value/quality mix and strong moat." },
  { symbol: "AMZN", value: 3.7, quality: 4.4, growth: 4.6, momentum: 3.9, stability: 4.1, sentiment: 4.1, advice: "ACCUMULATE", note: "Growth remains strong; valuation still acceptable." },
  { symbol: "NVDA", value: 2.9, quality: 4.7, growth: 4.9, momentum: 4.5, stability: 3.5, sentiment: 4.4, advice: "KEEP", note: "Excellent growth but valuation and cyclicality need caution." },
  { symbol: "TSLA", value: 3.0, quality: 3.8, growth: 4.2, momentum: 3.3, stability: 2.9, sentiment: 3.6, advice: "REVIEW", note: "Execution upside exists, but volatility and uncertainty remain high." },
  { symbol: "META", value: 3.8, quality: 4.5, growth: 4.1, momentum: 3.7, stability: 4.2, sentiment: 3.9, advice: "KEEP", note: "Solid fundamentals; monitor spend discipline and margins." },
  { symbol: "JPM", value: 4.1, quality: 4.3, growth: 3.6, momentum: 3.1, stability: 4.4, sentiment: 3.7, advice: "KEEP", note: "Defensive quality with fair value in current cycle." },
  { symbol: "V", value: 3.9, quality: 4.7, growth: 4.0, momentum: 3.5, stability: 4.6, sentiment: 3.8, advice: "ACCUMULATE", note: "Consistent high returns and strong long-term payment tailwinds." },
  { symbol: "JNJ", value: 4.0, quality: 4.4, growth: 3.2, momentum: 2.8, stability: 4.8, sentiment: 3.5, advice: "KEEP", note: "Lower growth but strong stability for long-horizon allocation." },
];

function toDayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function fmtMoney(v: number, currency: CurrencyCode): string {
  const n = Number.isFinite(v) ? v : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
}

function investingSideLabel(side: OrderSide): string {
  return side === "buy" ? "Accumulate" : "Reduce";
}

function clampScore(v: number): number {
  return Math.max(1, Math.min(5, Number(v.toFixed(1))));
}

function decideAdvice(row: Omit<AdviceRow, "asOf" | "advice" | "note">): AdviceRow["advice"] {
  const avg = (row.value + row.quality + row.growth + row.momentum + row.stability + row.sentiment) / 6;
  if (avg >= 4.05 && row.quality >= 4.0 && row.stability >= 3.6) return "ACCUMULATE";
  if (avg >= 3.35) return "KEEP";
  return "REVIEW";
}

export default function TradingHistoryPage() {
  const getTodayIso = () => new Date().toISOString().slice(0, 10);
  const today = getTodayIso();
  const [symbol, setSymbol] = useState("AAPL");
  const [fromDate, setFromDate] = useState(shiftDays(today, -365));
  const [toDate, setToDate] = useState(today);
  const [horizonPreset, setHorizonPreset] = useState<HorizonPreset>("1Y");
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>("daily");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [startingCash, setStartingCash] = useState(10_000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedBars, setSeedBars] = useState<InstrumentData[]>([]);
  const [rawBars, setRawBars] = useState<InstrumentData[]>([]);
  const [cursor, setCursor] = useState(0);
  const [cash, setCash] = useState(10_000);
  const [shares, setShares] = useState(0);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [speed, setSpeed] = useState<Speed>(1);
  const [orderSide, setOrderSide] = useState<OrderSide>("buy");
  const [orderVolume, setOrderVolume] = useState(1);
  const [orderLeverage, setOrderLeverage] = useState(1);
  const [targetDate, setTargetDate] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const demoHistoryAdviceRows = useMemo(() => {
    const offsetByPreset: Record<HorizonPreset, number> = { "1Y": 14, "3Y": 45, "5Y": 75, "10Y": 120 };
    const horizonTiltByPreset: Record<HorizonPreset, number> = { "1Y": 0.1, "3Y": 0.0, "5Y": -0.1, "10Y": -0.2 };
    const asOf = shiftDays(toDate || today, -offsetByPreset[horizonPreset]);

    return DEMO_HISTORY_ADVICE_BASE.map((row, i) => {
      const phase = ((i % 5) - 2) * 0.05;
      const tilt = horizonTiltByPreset[horizonPreset] + phase;
      const scored = {
        symbol: row.symbol,
        value: clampScore(row.value + tilt * 0.5),
        quality: clampScore(row.quality + tilt * 0.2),
        growth: clampScore(row.growth + tilt * 0.6),
        momentum: clampScore(row.momentum + tilt * 0.7),
        stability: clampScore(row.stability + tilt * 0.3),
        sentiment: clampScore(row.sentiment + tilt * 0.4),
      };
      const advice = decideAdvice(scored);
      const noteSuffix =
        horizonPreset === "1Y"
          ? " Short horizon is more sensitive to momentum."
          : horizonPreset === "3Y"
            ? " Mid horizon balances growth and quality."
            : horizonPreset === "5Y"
              ? " Long horizon weights durability over short moves."
              : " Very long horizon emphasizes stability and resilience.";
      return {
        ...scored,
        asOf,
        advice,
        note: `${row.note}${noteSuffix}`,
      };
    });
  }, [horizonPreset, toDate, today]);

  const bars = useMemo(() => rawBars, [rawBars]);
  const currentBar = bars[cursor] ?? null;
  const currentPrice = Number(currentBar?.close ?? 0);
  const equity = cash + shares * currentPrice;
  const pnl = equity - startingCash;
  const pnlPct = startingCash > 0 ? (pnl / startingCash) * 100 : 0;
  const visibleBars = useMemo(() => bars.slice(0, Math.max(0, cursor + 1)), [bars, cursor]);
  const chartCandles = useMemo(
    () =>
      visibleBars.map((b) => ({
        time: Math.floor(new Date(b.timestamp).getTime() / 1000),
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume || 0),
      })),
    [visibleBars]
  );
  const targetTs = targetDate ? new Date(`${targetDate}T00:00:00Z`).getTime() : NaN;
  const canStep = useMemo(() => {
    if (!bars.length) return false;
    const next = cursor + 1;
    if (next >= bars.length) return false;
    if (!Number.isFinite(targetTs)) return true;
    const nextTs = new Date(bars[next]?.timestamp || "").getTime();
    return Number.isFinite(nextTs) && nextTs <= targetTs;
  }, [bars, cursor, targetTs]);

  const stopAuto = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setAutoRunning(false);
  };

  const applyHorizonPreset = (preset: HorizonPreset) => {
    const nextFrom = shiftDays(toDate || today, -HORIZON_DAYS[preset]);
    setHorizonPreset(preset);
    setFromDate(nextFrom);
  };

  const stepForward = () => {
    setCursor((c) => {
      const next = Math.min(c + 1, bars.length - 1);
      if (!Number.isFinite(targetTs)) {
        if (next >= bars.length - 1) stopAuto();
        return next;
      }
      const nextTs = new Date(bars[next]?.timestamp || "").getTime();
      if (!Number.isFinite(nextTs) || nextTs > targetTs || next >= bars.length - 1) {
        stopAuto();
      }
      return nextTs > targetTs ? c : next;
    });
  };

  useEffect(() => {
    if (!targetDate) {
      setTargetDate(toDate);
    }
  }, [targetDate, toDate]);

  useEffect(() => {
    if (!targetDate) return;
    if (targetDate < fromDate) {
      setTargetDate(fromDate);
      return;
    }
    if (targetDate > toDate) {
      setTargetDate(toDate);
    }
  }, [targetDate, fromDate, toDate]);

  useEffect(() => {
    if (!autoRunning || !bars.length) return;
    const interval = SPEED_INTERVAL_MS[speed];
    timerRef.current = window.setInterval(() => {
      setCursor((c) => {
        const next = Math.min(c + 1, bars.length - 1);
        if (!Number.isFinite(targetTs)) {
          if (next >= bars.length - 1) stopAuto();
          return next;
        }
        const nextTs = new Date(bars[next]?.timestamp || "").getTime();
        if (!Number.isFinite(nextTs) || nextTs > targetTs || next >= bars.length - 1) {
          stopAuto();
        }
        return nextTs > targetTs ? c : next;
      });
    }, interval);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRunning, bars, speed, targetTs]);

  useEffect(() => {
    if (!bars.length) return;
    setCursor((c) => Math.min(c, Math.max(0, bars.length - 1)));
  }, [bars.length]);

  const loadHistory = async () => {
    stopAuto();
    setLoading(true);
    setError(null);
    try {
      if (!fromDate || !toDate) {
        setError("Please choose both From and To dates.");
        setRawBars([]);
        setCursor(0);
        return;
      }
      if (fromDate > toDate) {
        setError("From date must be earlier than or equal to To date.");
        setRawBars([]);
        setCursor(0);
        return;
      }
      const historyRows = await InstrumentService.getInstrumentDataHistory(symbol.trim().toUpperCase(), {
        from: fromDate,
        to: toDate,
        period: historyPeriod,
      });
      let scoped = [...historyRows]
        .filter((r) => Number.isFinite(Number(r.close)))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (scoped.length < 1) {
        setRawBars([]);
        setSeedBars([]);
        setCursor(0);
        setError("Not enough candles to simulate this period.");
        return;
      }

      setSeedBars(scoped);
      setRawBars(scoped);
      setCash(startingCash);
      setShares(0);
      setLogs([]);
      setTargetDate(toDate);
      // Show full selected range immediately (A -> B), not only initial replay window.
      setCursor(Math.max(0, scoped.length - 1));
    } catch {
      setError("Failed to load history candles.");
      setRawBars([]);
      setSeedBars([]);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  };

  const placeOrder = () => {
    if (!currentBar || currentPrice <= 0) return;
    const vol = Math.max(0, Number(orderVolume) || 0);
    const lev = Math.max(1, Number(orderLeverage) || 1);
    const qty = vol * lev;
    if (qty <= 0) return;

    const cashDelta = qty * currentPrice;
    const nextCash = orderSide === "buy" ? cash - cashDelta : cash + cashDelta;
    const nextShares = orderSide === "buy" ? shares + qty : shares - qty;

    setCash(nextCash);
    setShares(nextShares);
    setLogs((prev) => [
      {
        side: orderSide,
        at: currentBar.timestamp,
        price: currentPrice,
        qty,
        leverage: lev,
        cashAfter: nextCash,
      },
      ...prev,
    ]);
  };

  const resetRun = () => {
    stopAuto();
    if (!seedBars.length) return;
    setRawBars(seedBars);
    // Keep full-range visibility after reset; replay controls can still step when target is adjusted.
    setCursor(Math.max(0, seedBars.length - 1));
    setCash(startingCash);
    setShares(0);
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-[#0b1220] px-4 py-6 text-[#e5e7eb] tablet:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Investing History Simulator</h1>
            <p className="mt-1 text-sm text-white/70">Review past candles, place long-horizon paper decisions, then speed up to your target date.</p>
          </div>
          <Link href="/trading" className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">
            Back to Investing
          </Link>
        </div>

        <section className="rounded-2xl border border-[#2b3139] bg-[#111827]/70 p-3">
          <div className="grid grid-cols-1 gap-2 laptop:grid-cols-8">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400">
              {HISTORY_SYMBOL_OPTIONS.map((opt) => (
                <option key={opt.symbol} value={opt.symbol}>
                  {opt.symbol} - {opt.label}
                </option>
              ))}
            </select>
            <input type="date" value={fromDate} max={toDate || today} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <input type="date" value={toDate} min={fromDate || undefined} max={today} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400" />
            <select value={historyPeriod} onChange={(e) => setHistoryPeriod(e.target.value as HistoryPeriod)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="daily">Period: Daily</option>
              <option value="weekly">Period: Weekly</option>
              <option value="monthly">Period: Monthly</option>
              <option value="yearly">Period: Yearly</option>
            </select>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="USD">Currency: USD ($)</option>
              <option value="EUR">Currency: EUR (€)</option>
              <option value="VND">Currency: VND (₫)</option>
            </select>
            <input type="number" min={100} step={100} value={startingCash} onChange={(e) => setStartingCash(Math.max(100, Number(e.target.value) || 100))} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="Starting cash" />
            <button onClick={loadHistory} disabled={loading || !symbol.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-60">{loading ? "Loading..." : "Load History"}</button>
            <button onClick={resetRun} disabled={!bars.length} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-60">Reset Run</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/65">Long-horizon presets:</span>
            {(Object.keys(HORIZON_DAYS) as HorizonPreset[]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyHorizonPreset(preset)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  horizonPreset === preset
                    ? "border-blue-400 bg-blue-500/20 text-blue-200"
                    : "border-white/20 bg-black/20 text-white/80 hover:bg-white/10"
                }`}
              >
                {preset}
              </button>
            ))}
            <span className="text-[11px] text-white/50">Frontend display helper only. Market period still uses Daily/Weekly/Monthly/Yearly.</span>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        <section className="rounded-2xl border border-[#2b3139] bg-[#0f172a] p-3">
          <div className="rounded-lg border border-[#2b3139] bg-[#111827] p-3">
            <div className="h-[min(66vh,760px)] min-h-[420px] w-full">
            <LightChart
              symbol={symbol.trim().toUpperCase()}
              data={chartCandles}
              period={historyPeriod}
              showTrading={false}
              indicators={[]}
            />
            </div>
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-[#111827]/95 p-2 shadow-lg backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">Paper Investing Simulator</p>
            <p className="mt-0.5 text-[11px] text-white/65">Market Price ({currency}) @ {fmtMoney(currentPrice, currency)}</p>
            <p className="mt-1 text-[10px] text-white/70">
              Open: {fmtMoney(Number(currentBar?.open ?? 0), currency)} &nbsp; High: {fmtMoney(Number(currentBar?.high ?? 0), currency)} &nbsp; Low: {fmtMoney(Number(currentBar?.low ?? 0), currency)} &nbsp; Close: {fmtMoney(currentPrice, currency)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-white/70">Decision:</span>
              <select value={orderSide} onChange={(e) => setOrderSide(e.target.value as OrderSide)} className="rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs">
                <option value="buy">ACCUMULATE</option>
                <option value="sell">REDUCE</option>
              </select>
              <span className="text-[10px] text-white/70">By volume:</span>
              <input type="number" min={0.01} step={0.01} value={orderVolume} onChange={(e) => setOrderVolume(Math.max(0.01, Number(e.target.value) || 0.01))} className="w-20 rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs" />
              <span className="text-[10px] text-white/70">By weight:</span>
              <input type="number" min={1} step={1} value={orderLeverage} onChange={(e) => setOrderLeverage(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs" />
              <button onClick={placeOrder} disabled={!currentBar || currentPrice <= 0} className="rounded bg-[#2563eb] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60">Place</button>
              <button onClick={stepForward} disabled={!canStep} className="rounded bg-[#1f2937] px-2.5 py-1 text-xs text-white disabled:opacity-60">Next</button>
              <span className="text-[10px] text-white/70">Speed:</span>
              <select value={String(speed)} onChange={(e) => setSpeed(Number(e.target.value) as Speed)} className="rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs">
                <option value="1">1x (15s/candle)</option>
                <option value="2">2x (7.5s/candle)</option>
                <option value="4">4x (3.75s/candle)</option>
              </select>
              <input type="date" min={fromDate || undefined} max={toDate || undefined} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs" />
              <button onClick={() => setAutoRunning(true)} disabled={!canStep || autoRunning} className="rounded bg-[#2563eb] px-2 py-1 text-xs font-semibold disabled:opacity-60">Speed Up</button>
              <button onClick={stopAuto} disabled={!autoRunning} className="rounded bg-[#1f2937] px-2 py-1 text-xs disabled:opacity-60">Stop</button>
            </div>
            <p className="mt-2 text-[10px] text-white/70">
              Position: {shares > 0 ? "Long" : "Flat"} &nbsp; Equity ({currency}): {fmtMoney(equity, currency)} &nbsp; Profit and Loss:{" "}
              <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {pnl >= 0 ? "+" : ""}
                {fmtMoney(pnl, currency)} ({pnlPct.toFixed(2)}%)
              </span>
            </p>
            <p className="text-[10px] text-white/55">
              Cash ({currency}): {fmtMoney(cash, currency)} · Shares: {shares.toLocaleString("en-US")} · Progress: {bars.length ? `${cursor + 1}/${bars.length}` : "—"} · Period: {historyPeriod}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/80">Investing decision log</h2>
          {!logs.length ? (
            <p className="text-sm text-white/60">No decisions yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((t, i) => (
                <div key={`${t.at}-${i}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className={t.side === "buy" ? "text-emerald-400" : "text-red-400"}>{investingSideLabel(t.side)}</span>{" "}
                  {t.qty.toLocaleString("en-US")} (x{t.leverage}) @ {fmtMoney(t.price, currency)} on {fmtDate(t.at)} | cash after {fmtMoney(t.cashAfter, currency)}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-white/80">History Advice (Demo)</h2>
          <p className="mb-3 text-xs text-white/60">
            Simulated 6-attribute investing radar for 10 fixed symbols. Advice is long-horizon oriented.
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-white/[0.04] text-white/70">
                <tr>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Value</th>
                  <th className="px-3 py-2">Quality</th>
                  <th className="px-3 py-2">Growth</th>
                  <th className="px-3 py-2">Momentum</th>
                  <th className="px-3 py-2">Stability</th>
                  <th className="px-3 py-2">Sentiment</th>
                  <th className="px-3 py-2">Advice</th>
                  <th className="px-3 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {demoHistoryAdviceRows.map((row) => (
                  <tr key={`${row.symbol}-${row.asOf}`} className="border-t border-white/10">
                    <td className="px-3 py-2 font-mono text-white/75">{row.asOf}</td>
                    <td className="px-3 py-2 font-semibold">{row.symbol}</td>
                    <td className="px-3 py-2">{row.value.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.quality.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.growth.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.momentum.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.stability.toFixed(1)}</td>
                    <td className="px-3 py-2">{row.sentiment.toFixed(1)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 font-semibold ${
                          row.advice === "ACCUMULATE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : row.advice === "KEEP"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {row.advice}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white/70">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

