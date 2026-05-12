"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { InstrumentService } from "@/src/services/Instrument.service";
import type { InstrumentData } from "@/src/types/InstrumentData";
import LightChart, {
  type HistoryAdviceHover,
  type HistoryCandlePick,
  type HistoryOrderMarker,
  type HistoryRectPick,
} from "@/src/components/charts/LightChart";
import { DEV_SYMBOL_SEED } from "@/src/libs/symbolDevIdb";

const PAPER_SESSION_STORAGE_KEY = "dsa.tradingHistory.paper.v1";

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

type ChartOpenOrder = {
  id: string;
  timeSec: number;
  side: OrderSide;
  qty: number;
  leverage: number;
  entryPrice: number;
  atIso: string;
};

function rectKey(r: HistoryRectPick): string {
  return `${r.timeFrom}|${r.timeTo}|${r.priceLow}|${r.priceHigh}`;
}

function newChartOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

type HistoryAdviceApiRow = {
  as_of_ts: string;
  symbol: string;
  value_score: number | string;
  quality_score: number | string;
  growth_score: number | string;
  momentum_score: number | string;
  stability_score: number | string;
  sentiment_score: number | string;
  advice: string;
  note?: string | null;
};

function adviceDayKey(raw: string): string {
  return String(raw || "").slice(0, 10);
}

function numField(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeApiAdvice(s: string): HistoryAdviceHover["advice"] {
  const u = String(s || "").toUpperCase();
  if (u === "BUY" || u === "HOLD" || u === "WATCH") return u;
  return "WATCH";
}

function apiRowToAdviceHover(r: HistoryAdviceApiRow): HistoryAdviceHover {
  return {
    asOfDate: adviceDayKey(r.as_of_ts),
    advice: normalizeApiAdvice(r.advice),
    note: r.note != null && String(r.note).trim() !== "" ? String(r.note) : null,
    valueScore: numField(r.value_score),
    qualityScore: numField(r.quality_score),
    growthScore: numField(r.growth_score),
    momentumScore: numField(r.momentum_score),
    stabilityScore: numField(r.stability_score),
    sentimentScore: numField(r.sentiment_score),
  };
}

/** Latest `history_advice` row on or before each candle UTC day (hover while stepping). */
function buildHistoryAdviceByCandleDay(
  symbolUpper: string,
  apiRows: HistoryAdviceApiRow[],
  barTimestamps: string[]
): Record<string, HistoryAdviceHover> {
  const sym = symbolUpper.trim().toUpperCase();
  const sorted = apiRows
    .filter((x) => String(x.symbol || "").trim().toUpperCase() === sym)
    .map((r) => ({ d: adviceDayKey(r.as_of_ts), hover: apiRowToAdviceHover(r) }))
    .filter((x) => x.d.length >= 10)
    .sort((a, b) => a.d.localeCompare(b.d));

  if (!sorted.length || !barTimestamps.length) return {};

  const sortedDays = sorted.map((s) => s.d);
  const uniqueBarDays = [
    ...new Set(
      barTimestamps
        .map((ts) => {
          const ms = new Date(ts).getTime();
          if (Number.isNaN(ms)) return "";
          return new Date(ms).toISOString().slice(0, 10);
        })
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));

  const out: Record<string, HistoryAdviceHover> = {};
  for (const day of uniqueBarDays) {
    let lo = 0;
    let hi = sortedDays.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (sortedDays[m] <= day) {
        ans = m;
        lo = m + 1;
      } else {
        hi = m - 1;
      }
    }
    if (ans >= 0) out[day] = sorted[ans].hover;
  }
  return out;
}

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

function buildPaperRunKey(parts: {
  symbol: string;
  fromDate: string;
  toDate: string;
  historyPeriod: HistoryPeriod;
  startingCash: number;
}): string {
  return [
    parts.symbol.trim().toUpperCase(),
    parts.fromDate,
    parts.toDate,
    parts.historyPeriod,
    String(parts.startingCash),
  ].join("|");
}

type PaperSessionV1 = {
  runKey: string;
  cash: number;
  shares: number;
  logs: TradeLog[];
  cursor: number;
  drawnRects?: HistoryRectPick[];
  chartOpenOrders?: ChartOpenOrder[];
};

function readPaperSession(): PaperSessionV1 | null {
  try {
    const raw = sessionStorage.getItem(PAPER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as PaperSessionV1;
    if (!o || typeof o.runKey !== "string") return null;
    return o;
  } catch {
    return null;
  }
}

function writePaperSession(data: PaperSessionV1) {
  try {
    sessionStorage.setItem(PAPER_SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

function clampScore(v: number): number {
  return Math.max(1, Math.min(5, Number(v.toFixed(1))));
}

function decideAdvice(row: Omit<AdviceRow, "asOf" | "advice" | "note">): AdviceRow["advice"] {
  const scores = [row.value, row.quality, row.growth, row.momentum, row.stability, row.sentiment];
  const avg = scores.reduce((a, b) => a + b, 0) / 6;
  const spread = Math.max(...scores) - Math.min(...scores);
  if (avg >= 2.85 && avg <= 3.72 && spread <= 1.35) return "KEEP";
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
  const cashRef = useRef(10_000);
  const sharesRef = useRef(0);
  const [logs, setLogs] = useState<TradeLog[]>([]);
  const [speed, setSpeed] = useState<Speed>(1);
  const [orderSide, setOrderSide] = useState<OrderSide>("buy");
  const [orderVolume, setOrderVolume] = useState(1);
  const [orderLeverage, setOrderLeverage] = useState(1);
  const [targetDate, setTargetDate] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const [chartDrawMode, setChartDrawMode] = useState(false);
  const [drawnRects, setDrawnRects] = useState<HistoryRectPick[]>([]);
  const [chartOpenOrders, setChartOpenOrders] = useState<ChartOpenOrder[]>([]);
  const [investPopup, setInvestPopup] = useState<{
    clientX: number;
    clientY: number;
    pick: HistoryCandlePick;
  } | null>(null);
  const investPopupRef = useRef<HTMLDivElement | null>(null);
  const [historyAdviceApiRows, setHistoryAdviceApiRows] = useState<HistoryAdviceApiRow[]>([]);
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
  const historyAdviceByCandleDay = useMemo(
    () =>
      buildHistoryAdviceByCandleDay(
        symbol.trim().toUpperCase(),
        historyAdviceApiRows,
        rawBars.map((b) => b.timestamp)
      ),
    [symbol, historyAdviceApiRows, rawBars]
  );
  const historyOrderMarkers = useMemo((): HistoryOrderMarker[] => {
    return chartOpenOrders.map((o) => ({
      id: o.id,
      timeSec: o.timeSec,
      side: o.side,
      qty: o.qty,
      leverage: o.leverage,
      price: o.entryPrice,
    }));
  }, [chartOpenOrders]);
  useEffect(() => {
    cashRef.current = cash;
  }, [cash]);
  useEffect(() => {
    sharesRef.current = shares;
  }, [shares]);
  const currentBar = bars[cursor] ?? null;
  const currentPrice = Number(currentBar?.close ?? 0);
  const equity = cash + shares * currentPrice;

  useEffect(() => {
    if (!investPopup) return;
    const onDoc = (ev: MouseEvent) => {
      if (investPopupRef.current?.contains(ev.target as Node)) return;
      setInvestPopup(null);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [investPopup]);
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

  /** Persist paper portfolio + decision log for this tab (sessionStorage). */
  useEffect(() => {
    if (!bars.length || !fromDate || !toDate) return;
    const runKey = buildPaperRunKey({
      symbol: symbol.trim().toUpperCase(),
      fromDate,
      toDate,
      historyPeriod,
      startingCash,
    });
    writePaperSession({
      runKey,
      cash,
      shares,
      logs,
      cursor,
      drawnRects,
      chartOpenOrders,
    });
  }, [symbol, fromDate, toDate, historyPeriod, startingCash, bars.length, cash, shares, logs, cursor, drawnRects, chartOpenOrders]);

  const loadHistory = async () => {
    stopAuto();
    setLoading(true);
    setError(null);
    setHistoryAdviceApiRows([]);
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
      const sym = symbol.trim().toUpperCase();
      const [historyRows, advicePayload] = await Promise.all([
        InstrumentService.getInstrumentDataHistory(sym, {
          from: fromDate,
          to: toDate,
          period: historyPeriod,
        }),
        InstrumentService.getHistoryAdvice(sym, fromDate, toDate).catch(() => []),
      ]);
      setHistoryAdviceApiRows(Array.isArray(advicePayload) ? (advicePayload as HistoryAdviceApiRow[]) : []);
      let scoped = [...historyRows]
        .filter((r) => Number.isFinite(Number(r.close)))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      if (scoped.length < 1) {
        setRawBars([]);
        setSeedBars([]);
        setCursor(0);
        setHistoryAdviceApiRows([]);
        setError("Not enough candles to simulate this period.");
        return;
      }

      setSeedBars(scoped);
      setRawBars(scoped);
      setTargetDate(toDate);

      const runKey = buildPaperRunKey({
        symbol: symbol.trim().toUpperCase(),
        fromDate,
        toDate,
        historyPeriod,
        startingCash,
      });
      const saved = readPaperSession();
      let initialCash = startingCash;
      let initialShares = 0;
      let initialLogs: TradeLog[] = [];
      let initialCursor = Math.max(0, scoped.length - 1);
      if (saved?.runKey === runKey) {
        initialCash = typeof saved.cash === "number" ? saved.cash : startingCash;
        initialShares = typeof saved.shares === "number" ? saved.shares : 0;
        initialLogs = Array.isArray(saved.logs) ? saved.logs : [];
        const c = typeof saved.cursor === "number" ? saved.cursor : initialCursor;
        initialCursor = Math.min(Math.max(0, c), scoped.length - 1);
        setDrawnRects(Array.isArray(saved.drawnRects) ? saved.drawnRects : []);
        setChartOpenOrders(
          Array.isArray(saved.chartOpenOrders) ? (saved.chartOpenOrders as ChartOpenOrder[]) : []
        );
      } else {
        setDrawnRects([]);
        setChartOpenOrders([]);
      }
      cashRef.current = initialCash;
      sharesRef.current = initialShares;
      setCash(initialCash);
      setShares(initialShares);
      setLogs(initialLogs);
      setCursor(initialCursor);
    } catch {
      setError("Failed to load history candles.");
      setRawBars([]);
      setSeedBars([]);
      setCursor(0);
      setHistoryAdviceApiRows([]);
    } finally {
      setLoading(false);
    }
  };

  const placeOrderAt = useCallback(
    (price: number, atIso: string, opts?: { timeSec?: number }) => {
      if (!Number.isFinite(price) || price <= 0) return;
      const vol = Math.max(0, Number(orderVolume) || 0);
      const lev = Math.max(1, Number(orderLeverage) || 1);
      const qty = vol * lev;
      if (qty <= 0) return;
      const side = orderSide;
      const cashDelta = qty * price;
      const timeSec =
        opts?.timeSec ?? Math.floor(new Date(atIso).getTime() / 1000);
      const marker: ChartOpenOrder = {
        id: newChartOrderId(),
        timeSec,
        side,
        qty,
        leverage: lev,
        entryPrice: price,
        atIso,
      };
      const prevCash = cashRef.current;
      const prevShares = sharesRef.current;
      const nextCash = side === "buy" ? prevCash - cashDelta : prevCash + cashDelta;
      const nextShares = side === "buy" ? prevShares + qty : prevShares - qty;
      cashRef.current = nextCash;
      sharesRef.current = nextShares;
      setCash(nextCash);
      setShares(nextShares);
      setChartOpenOrders((p) => [...p, marker]);
      setLogs((prev) => [
        {
          side,
          at: atIso,
          price,
          qty,
          leverage: lev,
          cashAfter: nextCash,
        },
        ...prev,
      ]);
    },
    [orderSide, orderVolume, orderLeverage]
  );

  const closeChartOrderById = useCallback(
    (orderId: string) => {
      const order = chartOpenOrders.find((o) => o.id === orderId);
      if (!order) return;
      const exitPrice = Number(currentBar?.close ?? 0);
      if (!Number.isFinite(exitPrice) || exitPrice <= 0) return;
      const exitAt = currentBar?.timestamp ?? new Date().toISOString();
      const cashDelta = order.qty * exitPrice;
      const prevCash = cashRef.current;
      const prevShares = sharesRef.current;
      const nextCash =
        order.side === "buy" ? prevCash + cashDelta : prevCash - cashDelta;
      const nextShares =
        order.side === "buy" ? prevShares - order.qty : prevShares + order.qty;
      cashRef.current = nextCash;
      sharesRef.current = nextShares;
      setCash(nextCash);
      setShares(nextShares);
      setChartOpenOrders((p) => p.filter((o) => o.id !== orderId));
      setLogs((lg) => [
        {
          side: order.side === "buy" ? "sell" : "buy",
          at: exitAt,
          price: exitPrice,
          qty: order.qty,
          leverage: order.leverage,
          cashAfter: nextCash,
        },
        ...lg,
      ]);
    },
    [chartOpenOrders, currentBar]
  );

  const placeOrder = () => {
    if (!currentBar || currentPrice <= 0) return;
    const sec = Math.floor(new Date(currentBar.timestamp).getTime() / 1000);
    placeOrderAt(currentPrice, currentBar.timestamp, { timeSec: sec });
  };

  const resetRun = () => {
    stopAuto();
    if (!seedBars.length) return;
    setRawBars(seedBars);
    // Keep full-range visibility after reset; replay controls can still step when target is adjusted.
    setCursor(Math.max(0, seedBars.length - 1));
    cashRef.current = startingCash;
    sharesRef.current = 0;
    setCash(startingCash);
    setShares(0);
    setLogs([]);
    setChartOpenOrders([]);
    setDrawnRects([]);
    try {
      sessionStorage.removeItem(PAPER_SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const pickToBarTimestamp = useCallback(
    (pick: HistoryCandlePick) => {
      const sec = pick.timeSec;
      const hit = bars.find((b) => Math.floor(new Date(b.timestamp).getTime() / 1000) === sec);
      return hit?.timestamp ?? new Date(sec * 1000).toISOString();
    },
    [bars]
  );

  const onChartCandleDoubleClick = useCallback(
    (pick: HistoryCandlePick) => {
      const atBar = chartOpenOrders.filter((o) => o.timeSec === pick.timeSec);
      if (!atBar.length) return;
      closeChartOrderById(atBar[atBar.length - 1].id);
    },
    [chartOpenOrders, closeChartOrderById]
  );

  const onChartDrawRect = useCallback((rect: HistoryRectPick) => {
    setDrawnRects((prev) => [...prev, rect]);
  }, []);

  const onRemoveDrawnRect = useCallback((r: HistoryRectPick) => {
    setDrawnRects((prev) => prev.filter((x) => rectKey(x) !== rectKey(r)));
  }, []);

  const onCandleContextMenu = useCallback(
    (pick: HistoryCandlePick, screenPoint: { clientX: number; clientY: number }) => {
      setInvestPopup({
        clientX: screenPoint.clientX,
        clientY: screenPoint.clientY,
        pick,
      });
    },
    []
  );

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
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-white/70">
            <span className="text-white/50">Chart:</span>
            <button
              type="button"
              onClick={() => setChartDrawMode(false)}
              className={`rounded border px-2 py-0.5 ${!chartDrawMode ? "border-blue-400 bg-blue-500/20 text-blue-100" : "border-white/20 hover:bg-white/10"}`}
            >
              Pan / zoom / hover
            </button>
            <button
              type="button"
              onClick={() => setChartDrawMode(true)}
              className={`rounded border px-2 py-0.5 ${chartDrawMode ? "border-amber-400 bg-amber-500/20 text-amber-100" : "border-white/20 hover:bg-white/10"}`}
            >
              Draw rectangle
            </button>
            <span className="text-white/45">
              Hover: OHLCV + advice · Right-click candle: investing box (place at that bar) · Double-click a candle with an arrow: close that order at current price · Right-click a drawn zone: remove rectangle
            </span>
          </div>
          <div className="rounded-lg border border-[#2b3139] bg-[#111827] p-3">
            <div className="h-[min(66vh,760px)] min-h-[420px] w-full">
              <LightChart
                symbol={symbol.trim().toUpperCase()}
                data={chartCandles}
                period={historyPeriod}
                showTrading={false}
                indicators={[]}
                historyDrawnRects={drawnRects}
                historyAdviceByCandleDay={historyAdviceByCandleDay}
                historyOrderMarkers={historyOrderMarkers}
                historyInteraction={{
                  enabled: true,
                  showHoverDetail: true,
                  drawMode: chartDrawMode,
                  onCandleDoubleClick: onChartCandleDoubleClick,
                  onCandleContextMenu: onCandleContextMenu,
                  onRemoveDrawnRect: onRemoveDrawnRect,
                  onDrawRect: onChartDrawRect,
                }}
              />
            </div>
          </div>
          {investPopup ? (
            <div
              ref={investPopupRef}
              role="dialog"
              aria-label="Place paper order at candle"
              className="fixed z-[200] w-56 rounded-lg border border-white/20 bg-[#111827] p-2.5 text-xs text-[#e5e7eb] shadow-2xl"
              style={{
                left: Math.min(
                  Math.max(8, investPopup.clientX),
                  typeof window !== "undefined" ? window.innerWidth - 240 : investPopup.clientX
                ),
                top: Math.min(
                  Math.max(8, investPopup.clientY),
                  typeof window !== "undefined" ? window.innerHeight - 220 : investPopup.clientY
                ),
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <p className="mb-1.5 font-semibold text-white/90">Paper order at candle</p>
              <p className="mb-2 font-mono text-[10px] text-white/55">
                {new Date(investPopup.pick.timeSec * 1000).toISOString().slice(0, 10)} · C{" "}
                {investPopup.pick.close.toFixed(4)}
              </p>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-[10px] text-white/70">
                  <span className="w-16 shrink-0">Side</span>
                  <select
                    value={orderSide}
                    onChange={(e) => setOrderSide(e.target.value as OrderSide)}
                    className="min-w-0 flex-1 rounded border border-white/15 bg-[#0b1220] px-1 py-0.5"
                  >
                    <option value="buy">Accumulate</option>
                    <option value="sell">Reduce</option>
                  </select>
                </label>
                <label className="flex items-center gap-1 text-[10px] text-white/70">
                  <span className="w-16 shrink-0">Volume</span>
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={orderVolume}
                    onChange={(e) => setOrderVolume(Math.max(0.01, Number(e.target.value) || 0.01))}
                    className="w-full rounded border border-white/15 bg-[#0b1220] px-1 py-0.5"
                  />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-white/70">
                  <span className="w-16 shrink-0">Weight</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={orderLeverage}
                    onChange={(e) => setOrderLeverage(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full rounded border border-white/15 bg-[#0b1220] px-1 py-0.5"
                  />
                </label>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  className="flex-1 rounded bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500"
                  onClick={() => {
                    const atIso = pickToBarTimestamp(investPopup.pick);
                    placeOrderAt(investPopup.pick.close, atIso, { timeSec: investPopup.pick.timeSec });
                    setInvestPopup(null);
                  }}
                >
                  Place
                </button>
                <button
                  type="button"
                  className="rounded border border-white/25 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10"
                  onClick={() => setInvestPopup(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {drawnRects.length > 0 ? (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-100/90">
              <span className="font-semibold">Drawn zones ({drawnRects.length})</span>
              <ul className="mt-1 max-h-24 list-inside list-disc overflow-y-auto text-white/70">
                {drawnRects.map((r, i) => (
                  <li key={`${r.timeFrom}-${r.timeTo}-${i}`}>
                    {new Date(r.timeFrom * 1000).toISOString().slice(0, 10)} →{" "}
                    {new Date(r.timeTo * 1000).toISOString().slice(0, 10)} · ${r.priceLow.toFixed(2)} – $
                    {r.priceHigh.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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

