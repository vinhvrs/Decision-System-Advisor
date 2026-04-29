"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { InstrumentService } from "@/src/services/Instrument.service";
import type { InstrumentData } from "@/src/types/InstrumentData";
import LightChart from "@/src/components/charts/LightChart";

type PresetKey = "7d" | "1m" | "1y" | "10y";
type CandleUnit = "1d" | "1mo" | "1y";
type Speed = 1 | 2 | 4 | 8;

type TradeLog = {
  side: "buy" | "sell";
  at: string;
  price: number;
  qty: number;
  cashAfter: number;
};

const PRESETS: Record<PresetKey, { label: string; days: number }> = {
  "7d": { label: "7 days ago", days: 7 },
  "1m": { label: "1 month ago", days: 30 },
  "1y": { label: "1 year ago", days: 365 },
  "10y": { label: "10 years ago", days: 3650 },
};

const SPEED_INTERVAL_MS: Record<Speed, number> = {
  1: 600,
  2: 320,
  4: 160,
  8: 80,
};

const INITIAL_VISIBLE_BARS = 20;

function toDayMs(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function fmtMoney(v: number): string {
  return `$${Number.isFinite(v) ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0.00"}`;
}

function makeBucketKey(ts: string, unit: CandleUnit): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (unit === "1y") return `${y}`;
  if (unit === "1mo") return `${y}-${m}`;
  return `${y}-${m}-${day}`;
}

export default function TradingHistoryPage() {
  const getTodayIso = () => new Date().toISOString().slice(0, 10);
  const [symbol, setSymbol] = useState("AAPL");
  const [preset, setPreset] = useState<PresetKey>("1y");
  const [candleUnit, setCandleUnit] = useState<CandleUnit>("1d");
  const [startingCash, setStartingCash] = useState(10_000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawBars, setRawBars] = useState<InstrumentData[]>([]);
  const [cursor, setCursor] = useState(0);
  const [cash, setCash] = useState(10_000);
  const [shares, setShares] = useState(0);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [speed, setSpeed] = useState<Speed>(1);
  const [targetDate, setTargetDate] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

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
  const canStep = cursor < bars.length - 1;
  const minDate = bars[0]?.timestamp ? fmtDate(bars[0].timestamp) : "";
  const maxDate = bars[bars.length - 1]?.timestamp ? fmtDate(bars[bars.length - 1].timestamp) : "";

  const stopAuto = () => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setAutoRunning(false);
  };

  const stepForward = () => {
    setCursor((c) => {
      const next = Math.min(c + 1, bars.length - 1);
      if (next >= bars.length - 1) stopAuto();
      return next;
    });
  };

  useEffect(() => {
    if (!targetDate) {
      setTargetDate(getTodayIso());
    }
  }, [targetDate]);

  useEffect(() => {
    if (!autoRunning || !bars.length) return;
    const interval = SPEED_INTERVAL_MS[speed];
    timerRef.current = window.setInterval(() => {
      setCursor((c) => {
        const next = Math.min(c + 1, bars.length - 1);
        if (targetDate) {
          const targetTs = new Date(targetDate).getTime();
          const nextTs = new Date(bars[next]?.timestamp || "").getTime();
          if (Number.isFinite(targetTs) && Number.isFinite(nextTs) && nextTs >= targetTs) {
            stopAuto();
            return next;
          }
        }
        if (next >= bars.length - 1) {
          stopAuto();
          return next;
        }
        return next;
      });
    }, interval);
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoRunning, bars, speed, targetDate]);

  useEffect(() => {
    if (!bars.length) return;
    setCursor((c) => Math.min(c, Math.max(0, bars.length - 1)));
  }, [bars.length]);

  const loadHistory = async () => {
    stopAuto();
    setLoading(true);
    setError(null);
    try {
      const days = PRESETS[preset].days;
      const now = Date.now();
      const targetEnd = now - toDayMs(days);
      const targetStart = targetEnd - toDayMs(days * 2);
      const fromDate = new Date(targetStart).toISOString().slice(0, 10);
      const toDate = new Date(targetEnd).toISOString().slice(0, 10);
      const apiPeriod = candleUnit === "1d" ? "daily" : candleUnit === "1mo" ? "monthly" : "yearly";
      const historyRows = await InstrumentService.getInstrumentDataHistory(symbol.trim().toUpperCase(), {
        from: fromDate,
        to: toDate,
        period: apiPeriod,
      });
      let scoped = [...historyRows]
        .filter((r) => Number.isFinite(Number(r.close)))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (scoped.length < INITIAL_VISIBLE_BARS) {
        const fallbackFrom = new Date(targetStart - toDayMs(Math.max(days * 6, 3650))).toISOString().slice(0, 10);
        const fallbackRows = await InstrumentService.getInstrumentDataHistory(symbol.trim().toUpperCase(), {
          from: fallbackFrom,
          to: new Date(now).toISOString().slice(0, 10),
          period: apiPeriod,
        });
        scoped = [...fallbackRows]
          .filter((r) => Number.isFinite(Number(r.close)))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      if (scoped.length < 2) {
        setRawBars([]);
        setCursor(0);
        setError("Not enough candles to simulate this period.");
        return;
      }

      setRawBars(scoped);
      setCash(startingCash);
      setShares(0);
      setLogs([]);
      setTargetDate(getTodayIso());
      setCursor(Math.min(INITIAL_VISIBLE_BARS - 1, Math.max(0, scoped.length - 1)));
    } catch {
      setError("Failed to load history candles.");
      setRawBars([]);
      setCursor(0);
    } finally {
      setLoading(false);
    }
  };

  const buyAll = () => {
    if (!currentBar || currentPrice <= 0 || cash <= 0) return;
    const qty = Math.floor(cash / currentPrice);
    if (qty <= 0) return;
    const cost = qty * currentPrice;
    const nextCash = cash - cost;
    setCash(nextCash);
    setShares((s) => s + qty);
    setLogs((prev) => [{ side: "buy", at: currentBar.timestamp, price: currentPrice, qty, cashAfter: nextCash }, ...prev]);
  };

  const sellAll = () => {
    if (!currentBar || currentPrice <= 0 || shares <= 0) return;
    const qty = shares;
    const proceeds = qty * currentPrice;
    const nextCash = cash + proceeds;
    setCash(nextCash);
    setShares(0);
    setLogs((prev) => [{ side: "sell", at: currentBar.timestamp, price: currentPrice, qty, cashAfter: nextCash }, ...prev]);
  };

  const resetRun = () => {
    stopAuto();
    if (!bars.length) return;
    setCursor(Math.min(INITIAL_VISIBLE_BARS - 1, bars.length - 1));
    setCash(startingCash);
    setShares(0);
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-[#0b1220] px-4 py-6 text-[#e5e7eb] tablet:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Trading History Simulator</h1>
            <p className="mt-1 text-sm text-white/70">Replay past candles, trade manually, then speed up to a chosen end date.</p>
          </div>
          <Link href="/trading" className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10">
            Back to Trading
          </Link>
        </div>

        <section className="rounded-2xl border border-[#2b3139] bg-[#111827]/70 p-3">
          <div className="grid grid-cols-1 gap-2 laptop:grid-cols-6">
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="Symbol (AAPL)" />
            <select value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400">
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k}>{p.label}</option>
              ))}
            </select>
            <select value={candleUnit} onChange={(e) => setCandleUnit(e.target.value as CandleUnit)} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400">
              <option value="1d">1 day / candle</option>
              <option value="1mo">1 month / candle</option>
              <option value="1y">1 year / candle</option>
            </select>
            <input type="number" min={100} step={100} value={startingCash} onChange={(e) => setStartingCash(Math.max(100, Number(e.target.value) || 100))} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="Starting cash" />
            <button onClick={loadHistory} disabled={loading || !symbol.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-60">{loading ? "Loading..." : "Load History"}</button>
            <button onClick={resetRun} disabled={!bars.length} className="rounded-lg border border-white/20 px-4 py-2 text-sm disabled:opacity-60">Reset Run</button>
          </div>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>

        <section className="rounded-2xl border border-[#2b3139] bg-[#0f172a] p-2">
          <div className="rounded-lg border border-[#2b3139] bg-[#111827] p-2">
            <LightChart
              symbol={symbol.trim().toUpperCase()}
              data={chartCandles}
              period={candleUnit === "1d" ? "daily" : candleUnit === "1mo" ? "monthly" : "yearly"}
              showTrading={false}
              indicators={[]}
            />
          </div>
          <div className="mt-2 rounded-lg border border-white/10 bg-[#111827]/95 p-2 shadow-lg backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/90">Paper Trading Simulator</p>
            <p className="mt-0.5 text-[11px] text-white/65">Market @ {fmtMoney(currentPrice)}</p>
            <p className="mt-1 text-[10px] text-white/70">
              O {fmtMoney(Number(currentBar?.open ?? 0))} &nbsp; H {fmtMoney(Number(currentBar?.high ?? 0))} &nbsp; L {fmtMoney(Number(currentBar?.low ?? 0))} &nbsp; C {fmtMoney(currentPrice)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <button onClick={buyAll} disabled={!currentBar || cash < currentPrice} className="rounded bg-[#16c784] px-2.5 py-1 text-xs font-semibold text-[#0b1220] disabled:opacity-60">Buy</button>
              <button onClick={sellAll} disabled={!currentBar || shares <= 0} className="rounded bg-[#ea3943] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60">Sell</button>
              <button onClick={stepForward} disabled={!canStep} className="rounded bg-[#1f2937] px-2.5 py-1 text-xs text-white disabled:opacity-60">Next</button>
              <select value={String(speed)} onChange={(e) => setSpeed(Number(e.target.value) as Speed)} className="rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs">
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
                <option value="8">8x</option>
              </select>
              <input type="date" min={minDate || undefined} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="rounded border border-white/10 bg-[#0b1220] px-1.5 py-1 text-xs" />
              <button onClick={() => setAutoRunning(true)} disabled={!canStep || autoRunning} className="rounded bg-[#2563eb] px-2 py-1 text-xs font-semibold disabled:opacity-60">Speed Up</button>
              <button onClick={stopAuto} disabled={!autoRunning} className="rounded bg-[#1f2937] px-2 py-1 text-xs disabled:opacity-60">Stop</button>
            </div>
            <p className="mt-2 text-[10px] text-white/70">
              Position: {shares > 0 ? "Long" : "Flat"} &nbsp; Equity: {fmtMoney(equity)} &nbsp; Profit and Loss:{" "}
              <span className={pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                {pnl >= 0 ? "+" : ""}
                {fmtMoney(pnl)} ({pnlPct.toFixed(2)}%)
              </span>
            </p>
            <p className="text-[10px] text-white/55">
              Cash: {fmtMoney(cash)} · Shares: {shares.toLocaleString("en-US")} · Progress: {bars.length ? `${cursor + 1}/${bars.length}` : "—"} · Candle unit: {candleUnit === "1d" ? "one day" : candleUnit === "1mo" ? "one month" : "one year"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/80">Trade log</h2>
          {!logs.length ? (
            <p className="text-sm text-white/60">No trades yet.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((t, i) => (
                <div key={`${t.at}-${i}`} className="rounded-lg border border-white/10 px-3 py-2 text-sm">
                  <span className={t.side === "buy" ? "text-emerald-400" : "text-red-400"}>{t.side.toUpperCase()}</span>{" "}
                  {t.qty.toLocaleString("en-US")} @ {fmtMoney(t.price)} on {fmtDate(t.at)} | cash after {fmtMoney(t.cashAfter)}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

