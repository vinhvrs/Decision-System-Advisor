/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ISeriesApi,
  IChartApi,
  Time,
  LogicalRange,
} from "lightweight-charts";
import { TradingServices } from "@/src/services/Trading.service";
import { useTradeApiQueue } from "@/src/hooks/useTradeApiQueue";

type TF = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  symbol: string;
  data: any[];
  realtimeCandle?: any;
  period: TF;
  onLoadMore?: () => void;
  indicators?: string[];
  /** When false, only candles are shown (no paper trading overlay). Default true. */
  showTrading?: boolean;
  /** Market type for ticket API. Default "stock". */
  market?: "stock";
  /** Open positions for current symbol from API - syncs paper trading & chart */
  positionsForSymbol?: Array<{ id: string; type: string; volume: number; price: number; leverage?: number }>;
}

type TradeSide = "buy" | "sell";
type PositionSide = "flat" | "long" | "short";

type Trade = {
  id: string;
  time: Time;
  price: number;
  side: TradeSide;
  volume: number;
  leverage: number;
};

type Marker = {
  time: Time;
  position: "aboveBar" | "belowBar" | "inBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "square";
  text?: string;
};

const INDICATOR_COLORS: Record<string, string> = {
  ema20: "#2962FF",
  ema50: "#FF9800",
  ema100: "#F44336",
  sma20: "#4CAF50",
  sma50: "#9C27B0",
  bollinger_upper: "#90A4AE",
  bollinger_middle: "#78909C",
  bollinger_lower: "#90A4AE",
  rsi: "#FFD54F",
  macd: "#26C6DA",
  macd_signal: "#FF7043",
  stochastic_k: "#66BB6A",
  stochastic_d: "#AB47BC",
};

function normalizeToSec(t: any): number | null {
  const ms = Number(t);
  if (!ms || Number.isNaN(ms)) return null;
  if (ms < 10_000_000_000) return ms;
  return Math.floor(ms / 1000);
}

function toNumber(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcEMA(data: any[], period: number) {
  if (!data.length) return [];
  const k = 2 / (period + 1);
  let ema = toNumber(data[0].close);

  return data.map((d, i) => {
    const close = toNumber(d.close);
    ema = i === 0 ? close : (close - ema) * k + ema;
    return { time: d.time, value: ema };
  });
}

function calcSMA(data: any[], period: number) {
  const results: { time: any; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, item) => acc + toNumber(item.close), 0);
    results.push({ time: data[i].time, value: sum / period });
  }
  return results;
}

function calcStdDev(values: number[]) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calcBollingerBands(data: any[], period = 20, multiplier = 2) {
  const upper: { time: any; value: number }[] = [];
  const middle: { time: any; value: number }[] = [];
  const lower: { time: any; value: number }[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    const slice = data.slice(i - period + 1, i + 1).map((d) => toNumber(d.close));
    const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
    const std = calcStdDev(slice);

    middle.push({ time: data[i].time, value: sma });
    upper.push({ time: data[i].time, value: sma + multiplier * std });
    lower.push({ time: data[i].time, value: sma - multiplier * std });
  }

  return { upper, middle, lower };
}

function calcRSI(data: any[], period = 14) {
  const results: { time: any; value: number }[] = [];
  if (data.length <= period) return results;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = toNumber(data[i].close) - toNumber(data[i - 1].close);
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  results.push({
    time: data[period].time,
    value: 100 - 100 / (1 + rs),
  });

  for (let i = period + 1; i < data.length; i++) {
    const diff = toNumber(data[i].close) - toNumber(data[i - 1].close);
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    results.push({
      time: data[i].time,
      value: 100 - 100 / (1 + rs),
    });
  }

  return results;
}

function calcMACD(data: any[], fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);

  const macdLine = emaFast
    .map((f, i) => {
      const s = emaSlow[i];
      if (!f || !s) return null;
      return { time: f.time, value: f.value - s.value };
    })
    .filter(Boolean) as { time: any; value: number }[];

  const signalLine = calcEMA(
    macdLine.map((m) => ({ ...m, close: m.value })),
    signalPeriod
  );

  const histogram = macdLine
    .map((m, i) => {
      const s = signalLine[i];
      if (!s) return null;
      return { time: m.time, value: m.value - s.value };
    })
    .filter(Boolean) as { time: any; value: number }[];

  return { macdLine, signalLine, histogram };
}

function calcStochastic(data: any[], period = 14, smoothK = 3, smoothD = 3) {
  const rawK: { time: any; value: number }[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;

    const slice = data.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...slice.map((d) => toNumber(d.high)));
    const lowestLow = Math.min(...slice.map((d) => toNumber(d.low)));
    const close = toNumber(data[i].close);

    const value =
      highestHigh === lowestLow
        ? 0
        : ((close - lowestLow) / (highestHigh - lowestLow)) * 100;

    rawK.push({ time: data[i].time, value });
  }

  const k = calcSMA(
    rawK.map((d) => ({ ...d, close: d.value })),
    smoothK
  );

  const d = calcSMA(
    k.map((item) => ({ ...item, close: item.value })),
    smoothD
  );

  return { k, d };
}

export default function LightChart({
  symbol,
  data,
  realtimeCandle,
  onLoadMore,
  indicators = [],
  showTrading = true,
  market = "stock",
  positionsForSymbol = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const displayMapRef = useRef<Map<number, any>>(new Map());
  const loadMoreLockRef = useRef(false);
  const tradesRef = useRef<Trade[]>([]);
  const markersRef = useRef<Marker[]>([]);
  const positionPriceLineRef = useRef<any>(null);
  const seriesMarkersRef = useRef<any>(null);
  /** Tickets created for current position: [{ id, volume }] */
  const ticketIdsRef = useRef<Array<{ id: string; volume: number }>>([]);
  /** Run timeScale.fitContent once per symbol after first non-empty data (not on every realtime tick). */
  const shouldFitTimeScaleRef = useRef(true);

  const [vol, setVol] = useState<number>(1);
  const [leverage, setLeverage] = useState<number>(1);
  const [position, setPosition] = useState<{
    side: PositionSide;
    qty: number;
    avgPrice: number;
    leverage?: number;
  }>({ side: "flat", qty: 0, avgPrice: 0 });
  const positionRef = useRef(position);
  const positionSyncedFromApiRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    shouldFitTimeScaleRef.current = true;
  }, [symbol]);

  const { enqueueCreate, enqueueClose } = useTradeApiQueue({
    onTicketCreated: (ticketId, volume) => {
      ticketIdsRef.current = [...ticketIdsRef.current, { id: ticketId, volume }];
    },
    onTicketChanged: () => window.dispatchEvent(new CustomEvent("ticket-changed")),
  });

  useEffect(() => {
    if (!positionsForSymbol?.length) {
      positionSyncedFromApiRef.current = false;
      setPosition((p) => (p.side !== "flat" ? { side: "flat", qty: 0, avgPrice: 0 } : p));
      ticketIdsRef.current = [];
      return;
    }
    const buyTickets = positionsForSymbol.filter((p) => (p.type || "").toLowerCase() === "buy");
    const sellTickets = positionsForSymbol.filter((p) => (p.type || "").toLowerCase() === "sell");
    const buyVol = buyTickets.reduce((s, t) => s + Number(t.volume || 0), 0);
    const sellVol = sellTickets.reduce((s, t) => s + Number(t.volume || 0), 0);
    const net = buyVol - sellVol;
    ticketIdsRef.current = positionsForSymbol.map((t) => ({
      id: t.id,
      volume: Number(t.volume || 0),
    }));
    if (net > 0) {
      const totalVol = buyTickets.reduce((s, t) => s + Number(t.volume || 0), 0);
      const avg = totalVol > 0
        ? buyTickets.reduce((s, t) => s + Number(t.price || 0) * Number(t.volume || 0), 0) / totalVol
        : 0;
      const lev = buyTickets[0]?.leverage ?? 1;
      const newPos = { side: "long" as const, qty: net, avgPrice: avg, leverage: lev };
      positionRef.current = newPos;
      setPosition(newPos);
      positionSyncedFromApiRef.current = true;
    } else if (net < 0) {
      const totalVol = sellTickets.reduce((s, t) => s + Number(t.volume || 0), 0);
      const avg = totalVol > 0
        ? sellTickets.reduce((s, t) => s + Number(t.price || 0) * Number(t.volume || 0), 0) / totalVol
        : 0;
      const lev = sellTickets[0]?.leverage ?? 1;
      const newPos = { side: "short" as const, qty: Math.abs(net), avgPrice: avg, leverage: lev };
      positionRef.current = newPos;
      setPosition(newPos);
      positionSyncedFromApiRef.current = true;
    } else {
      ticketIdsRef.current = [];
      positionRef.current = { side: "flat", qty: 0, avgPrice: 0 };
      setPosition({ side: "flat", qty: 0, avgPrice: 0 });
      positionSyncedFromApiRef.current = false;
    }
  }, [positionsForSymbol]);

  const [hover, setHover] = useState<{
    time: Time | null;
    o: number | null;
    h: number | null;
    l: number | null;
    c: number | null;
    v: number | null;
  }>({ time: null, o: null, h: null, l: null, c: null, v: null });

  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const minChartHeight = 200;
    const syncChartSize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const box = containerRef.current;
      const w = Math.floor(box.clientWidth);
      const h = Math.max(Math.floor(box.clientHeight), minChartHeight);
      chartRef.current.applyOptions({ width: w, height: h });
    };

    const chart = createChart(el, {
      width: Math.max(1, el.clientWidth),
      height: Math.max(minChartHeight, el.clientHeight || minChartHeight),
      layout: {
        background: { type: ColorType.Solid, color: "#0B1220" },
        textColor: "#DDD",
      },
      grid: {
        vertLines: { color: "#1E222D" },
        horzLines: { color: "#1E222D" },
      },
      timeScale: {
        borderColor: "#334155",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#334155",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    seriesMarkersRef.current = createSeriesMarkers(candleSeries, []);

    const crosshairMove = (param: any) => {
      if (!param) return;
      const time = param.time ?? null;
      if (!time) return;

      const seriesData = param.seriesData?.get?.(candleSeries);
      const o = typeof seriesData?.open === "number" ? seriesData.open : null;
      const h = typeof seriesData?.high === "number" ? seriesData.high : null;
      const l = typeof seriesData?.low === "number" ? seriesData.low : null;
      const c =
        (typeof seriesData?.close === "number" && seriesData.close) ||
        (typeof seriesData?.value === "number" && seriesData.value) ||
        null;

      const fromMap = displayMapRef.current.get(Number(time));
      const v =
        fromMap && typeof fromMap.volume === "number" ? (fromMap.volume as number) : null;

      setHover({ time, o, h, l, c, v });
    };

    chart.subscribeCrosshairMove(crosshairMove);

    syncChartSize();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncChartSize();
          })
        : null;
    resizeObserver?.observe(el);

    const handleWindowResize = () => syncChartSize();
    window.addEventListener("resize", handleWindowResize);
    requestAnimationFrame(() => syncChartSize());

    return () => {
      chart.unsubscribeCrosshairMove(crosshairMove);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleWindowResize);
      indicatorSeriesRef.current = [];
      displayMapRef.current.clear();
      try {
        seriesMarkersRef.current?.detach?.();
      } catch {}
      seriesMarkersRef.current = null;
      chart.remove();
    };
  }, []);

  const mergedCandleData = useMemo(() => {
    const map = new Map<number, any>();

    data.forEach((d) => {
      const t = normalizeToSec(d.time);
      if (t === null) return;

      map.set(t, {
        time: t as Time,
        open: toNumber(d.open),
        high: toNumber(d.high),
        low: toNumber(d.low),
        close: toNumber(d.close),
        volume: d.volume == null ? undefined : toNumber(d.volume),
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
  }, [data]);

  const lastCandle = useMemo(() => {
    if (!mergedCandleData.length) return null;
    return mergedCandleData[mergedCandleData.length - 1];
  }, [mergedCandleData]);

  // Always execute trades at the latest price (not crosshair price)
  const marketContext = useMemo(() => {
    const t = normalizeToSec(realtimeCandle?.time) ?? (lastCandle?.time as number | undefined);
    const time = (t ? (t as Time) : (lastCandle?.time as Time | undefined)) ?? null;
    const price =
      (realtimeCandle && typeof realtimeCandle.close === "number"
        ? (realtimeCandle.close as number)
        : null) ??
      (typeof lastCandle?.close === "number" ? (lastCandle.close as number) : null);
    return { time, price };
  }, [lastCandle, realtimeCandle]);

  const ohlcvContext = useMemo(() => {
    // Prefer hover candle values (display), fall back to latest candle / realtime candle
    const time = hover.time ?? marketContext.time ?? null;

    const last = lastCandle as any;
    const rt = realtimeCandle as any;

    const o =
      hover.o ??
      (rt && typeof rt.open === "number" ? (rt.open as number) : null) ??
      (last && typeof last.open === "number" ? (last.open as number) : null);
    const h =
      hover.h ??
      (rt && typeof rt.high === "number" ? (rt.high as number) : null) ??
      (last && typeof last.high === "number" ? (last.high as number) : null);
    const l =
      hover.l ??
      (rt && typeof rt.low === "number" ? (rt.low as number) : null) ??
      (last && typeof last.low === "number" ? (last.low as number) : null);
    const c =
      hover.c ??
      (rt && typeof rt.close === "number" ? (rt.close as number) : null) ??
      (last && typeof last.close === "number" ? (last.close as number) : null);
    const v =
      hover.v ??
      (rt && typeof rt.volume === "number" ? (rt.volume as number) : null) ??
      (last && typeof last.volume === "number" ? (last.volume as number) : null);

    return { time, o, h, l, c, v };
  }, [hover, lastCandle, marketContext.time, realtimeCandle]);

  const markTradesOnChart = useCallback(() => {
    const seriesMarkers = seriesMarkersRef.current;
    if (!seriesMarkers?.setMarkers) return;

    const markers: Marker[] = [
      ...tradesRef.current.map((t) => ({
        time: t.time,
        position: (t.side === "buy" ? "belowBar" : "aboveBar") as Marker["position"],
        color: t.side === "buy" ? "#26A69A" : "#EF5350",
        shape: (t.side === "buy" ? "arrowUp" : "arrowDown") as Marker["shape"],
        text: `${t.side.toUpperCase()} ${t.volume}×${t.leverage} @ ${t.price}`,
      })),
      ...markersRef.current,
    ];

    try {
      seriesMarkers.setMarkers(markers);
    } catch (e) {
      console.warn("setMarkers failed:", e);
    }
  }, []);

  const addTrade = useCallback(
    (side: TradeSide, overrideVol?: number) => {
      const { time, price } = marketContext;
      if (!time || price == null) return;
      const rawVol = overrideVol ?? vol;
      const v = Number.isFinite(rawVol) && rawVol > 0 ? rawVol : 1;
      const lev = Number.isFinite(leverage) && leverage > 0 ? leverage : 1;
      const p = positionRef.current;

      const t: Trade = {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        time,
        price,
        side,
        volume: v,
        leverage: lev,
      };
      tradesRef.current = [...tradesRef.current, t];

      const isOpposite =
        (p.side === "long" && side === "sell") || (p.side === "short" && side === "buy");
      const dir = p.side === "long" ? 1 : p.side === "short" ? -1 : 0;

      if (p.side !== "flat" && isOpposite) {
        const closeVol = Math.min(p.qty, v);
        const factor = (closeVol * (p.leverage ?? 1)) / (p.avgPrice || 1);
        const realized = dir * (price - p.avgPrice) * factor;
        const isProfit = realized >= 0;
        markersRef.current = [
          ...markersRef.current,
          {
            time,
            position: isProfit ? "aboveBar" : "belowBar",
            color: isProfit ? "#22C55E" : "#EF4444",
            shape: "square",
            text: `${isProfit ? "+" : "-"}${Math.abs(realized).toFixed(4)}`,
          },
        ];
      }

      let newState: typeof p;
      const toClose: string[] = [];
      const toCreate: { vol: number }[] = [];

      if (p.side === "flat") {
        toCreate.push({ vol: v });
        newState = { side: side === "buy" ? "long" : "short", qty: v, avgPrice: price, leverage: lev };
      } else if (p.side === "long" && side === "buy") {
        toCreate.push({ vol: v });
        const newQty = p.qty + v;
        const newAvg = (p.avgPrice * p.qty + price * v) / newQty;
        newState = { ...p, qty: newQty, avgPrice: newAvg };
      } else if (p.side === "short" && side === "sell") {
        toCreate.push({ vol: v });
        const newQty = p.qty + v;
        const newAvg = (p.avgPrice * p.qty + price * v) / newQty;
        newState = { ...p, qty: newQty, avgPrice: newAvg };
      } else {
        const closeVol = Math.min(p.qty, v);
        const toCloseItems = [...ticketIdsRef.current];
        let closed = 0;
        const remaining: Array<{ id: string; volume: number }> = [];
        for (const item of toCloseItems) {
          if (closed >= closeVol) {
            remaining.push(item);
            continue;
          }
          if (item.volume <= closeVol - closed) {
            toClose.push(item.id);
            closed += item.volume;
          } else {
            remaining.push(item);
          }
        }
        ticketIdsRef.current = remaining;

        if (v < p.qty) {
          newState = { ...p, qty: p.qty - v };
        } else if (v === p.qty) {
          remaining.forEach((item) => toClose.push(item.id));
          ticketIdsRef.current = [];
          newState = { side: "flat", qty: 0, avgPrice: 0 };
        } else {
          const remainingVol = v - p.qty;
          toCreate.push({ vol: remainingVol });
          newState = {
            side: side === "buy" ? "long" : "short",
            qty: remainingVol,
            avgPrice: price,
            leverage: lev,
          };
          ticketIdsRef.current = [];
        }
      }

      positionRef.current = newState;
      setPosition(newState);

      for (const { vol: createVol } of toCreate) {
        enqueueCreate(
          {
            type: side === "buy" ? "Buy" : "Sell",
            market,
            symbol,
            volume: createVol,
            price,
            leverage: lev,
          },
          createVol
        );
      }
      if (toClose.length > 0) {
        enqueueClose(toClose, price);
      }

      markTradesOnChart();
    },
    [markTradesOnChart, marketContext, vol, leverage, market, symbol, enqueueCreate, enqueueClose]
  );

  const closePosition = useCallback(() => {
    if (position.side === "flat") return;
    const idsFromApi = (positionsForSymbol || []).map((p) => p.id).filter(Boolean);
    const idsFromLocal = ticketIdsRef.current.map((t) => t.id);
    const allIds = [...new Set([...idsFromApi, ...idsFromLocal])];
    if (allIds.length === 0) return;

    // Optimistic: update UI immediately
    ticketIdsRef.current = [];
    setPosition({ side: "flat", qty: 0, avgPrice: 0 });
    window.dispatchEvent(new CustomEvent("ticket-changed"));

    // API in background
    const price = marketContext.price ?? undefined;
    Promise.all(allIds.map((id) => TradingServices.closeTicket(id, price))).catch((e) =>
      console.error("Close position failed:", e)
    );
  }, [position.side, positionsForSymbol, marketContext.price]);

  const currentPrice = marketContext.price ?? 0;
  const unrealizedPnl = useMemo(() => {
    if (position.side === "flat" || !currentPrice || !position.avgPrice) return 0;
    const dir = position.side === "long" ? 1 : -1;
    const lev = position.leverage ?? 1;
    // P = (Current - Open) × (Volume × Leverage / Open) for Long; (Open - Current) × (...) for Short
    const factor = (position.qty * lev) / position.avgPrice;
    return dir * (currentPrice - position.avgPrice) * factor;
  }, [currentPrice, position.avgPrice, position.qty, position.leverage, position.side]);

  // Dotted entry line showing current position avg price
  useEffect(() => {
    const candleSeries = seriesRef.current;
    if (!candleSeries) return;

    // remove when flat
    if (position.side === "flat") {
      if (positionPriceLineRef.current) {
        try {
          candleSeries.removePriceLine(positionPriceLineRef.current);
        } catch {}
        positionPriceLineRef.current = null;
      }
      return;
    }

    const color = position.side === "long" ? "#26A69A" : "#EF5350";
    const title = `${position.side.toUpperCase()} AVG`;

    if (!positionPriceLineRef.current) {
      try {
        positionPriceLineRef.current = candleSeries.createPriceLine({
          price: position.avgPrice,
          color,
          lineWidth: 2,
          lineStyle: 1, // dotted
          axisLabelVisible: true,
          title,
        } as any);
      } catch (e) {
        console.warn("createPriceLine failed:", e);
      }
      return;
    }

    try {
      positionPriceLineRef.current.applyOptions({
        price: position.avgPrice,
        color,
        title,
        lineStyle: 1,
      });
    } catch {}
  }, [position.avgPrice, position.side]);

  useEffect(() => {
    if (!seriesRef.current) return;

    displayMapRef.current.clear();
    mergedCandleData.forEach((item) => {
      displayMapRef.current.set(item.time as number, item);
    });

    // Merge realtime candle into display so socket ticks update the SAME bar (not create new ones)
    if (realtimeCandle) {
      const t = normalizeToSec(realtimeCandle.time);
      if (t != null && Number.isFinite(t)) {
        const open = toNumber(realtimeCandle.open);
        const high = toNumber(realtimeCandle.high);
        const low = toNumber(realtimeCandle.low);
        const close = toNumber(realtimeCandle.close);
        const vol = realtimeCandle.volume != null ? toNumber(realtimeCandle.volume) : undefined;
        // Bucket time: matches last bar → update, newer → add
        displayMapRef.current.set(t, {
          time: t as Time,
          open,
          high,
          low,
          close,
          volume: vol,
        });
      }
    }

    const sortedData = Array.from(displayMapRef.current.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    if (!sortedData.length) return;

    try {
      seriesRef.current.setData(sortedData);
    } catch (e) {
      console.error("Candle setData error:", e);
    }

    const chart = chartRef.current;
    const box = containerRef.current;
    if (chart && box) {
      const w = Math.max(1, Math.floor(box.clientWidth));
      const h = Math.max(200, Math.floor(box.clientHeight));
      chart.applyOptions({ width: w, height: h });
      if (shouldFitTimeScaleRef.current && sortedData.length > 0) {
        shouldFitTimeScaleRef.current = false;
        requestAnimationFrame(() => {
          try {
            chart.timeScale().fitContent();
          } catch {
            /* ignore */
          }
        });
      }
    }

    // re-apply markers after any full setData()
    markTradesOnChart();

    loadMoreLockRef.current = false;
  }, [mergedCandleData, realtimeCandle, markTradesOnChart]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    indicatorSeriesRef.current.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });
    indicatorSeriesRef.current = [];

    const sortedData = Array.from(displayMapRef.current.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    if (!sortedData.length || indicators.length === 0) return;

    indicators.forEach((id) => {
      if (id.startsWith("ema")) {
        const p = parseInt(id.replace("ema", ""), 10);
        if (!Number.isFinite(p)) return;

        const lineData = calcEMA(sortedData, p);
        const lineSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS[id] || "#FFFFFF",
          lineWidth: 2,
          title: id.toUpperCase(),
          priceLineVisible: false,
          lastValueVisible: true,
        });
        lineSeries.setData(lineData as any);
        indicatorSeriesRef.current.push(lineSeries);
        return;
      }

      if (id.startsWith("sma")) {
        const p = parseInt(id.replace("sma", ""), 10);
        if (!Number.isFinite(p)) return;

        const lineData = calcSMA(sortedData, p);
        const lineSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS[id] || "#FFFFFF",
          lineWidth: 2,
          title: id.toUpperCase(),
          priceLineVisible: false,
          lastValueVisible: true,
        });
        lineSeries.setData(lineData as any);
        indicatorSeriesRef.current.push(lineSeries);
        return;
      }

      if (id === "bollinger") {
        const { upper, middle, lower } = calcBollingerBands(sortedData, 20, 2);

        const upperSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.bollinger_upper,
          lineWidth: 1,
          lineStyle: 2,
          title: "BB Upper",
          priceLineVisible: false,
        });

        const middleSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.bollinger_middle,
          lineWidth: 2,
          title: "BB Middle",
          priceLineVisible: false,
        });

        const lowerSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.bollinger_lower,
          lineWidth: 1,
          lineStyle: 2,
          title: "BB Lower",
          priceLineVisible: false,
        });

        upperSeries.setData(upper as any);
        middleSeries.setData(middle as any);
        lowerSeries.setData(lower as any);

        indicatorSeriesRef.current.push(upperSeries, middleSeries, lowerSeries);
        return;
      }

      if (id === "rsi") {
        const rsiData = calcRSI(sortedData, 14);

        const rsiSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.rsi,
          lineWidth: 2,
          title: "RSI 14",
          priceLineVisible: false,
          lastValueVisible: true,
        });

        rsiSeries.setData(rsiData as any);
        indicatorSeriesRef.current.push(rsiSeries);

        const rsi70 = chart.addSeries(LineSeries, {
          color: "#EF5350",
          lineWidth: 1,
          lineStyle: 2,
          title: "RSI 70",
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const rsi30 = chart.addSeries(LineSeries, {
          color: "#26A69A",
          lineWidth: 1,
          lineStyle: 2,
          title: "RSI 30",
          priceLineVisible: false,
          lastValueVisible: false,
        });

        rsi70.setData(rsiData.map((d) => ({ time: d.time, value: 70 })) as any);
        rsi30.setData(rsiData.map((d) => ({ time: d.time, value: 30 })) as any);

        indicatorSeriesRef.current.push(rsi70, rsi30);
        return;
      }

      if (id === "macd") {
        const { macdLine, signalLine, histogram } = calcMACD(sortedData, 12, 26, 9);

        const histSeries = chart.addSeries(HistogramSeries, {
          title: "MACD Hist",
          priceLineVisible: false,
          lastValueVisible: false,
        });

        histSeries.setData(
          histogram.map((d) => ({
            time: d.time,
            value: d.value,
            color: d.value >= 0 ? "#26A69A" : "#EF5350",
          })) as any
        );

        const macdSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.macd,
          lineWidth: 2,
          title: "MACD",
          priceLineVisible: false,
        });

        const signalSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.macd_signal,
          lineWidth: 2,
          title: "Signal",
          priceLineVisible: false,
        });

        macdSeries.setData(macdLine as any);
        signalSeries.setData(signalLine as any);

        indicatorSeriesRef.current.push(histSeries, macdSeries, signalSeries);
        return;
      }

      if (id === "stochastic") {
        const { k, d } = calcStochastic(sortedData, 14, 3, 3);

        const kSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.stochastic_k,
          lineWidth: 2,
          title: "%K",
          priceLineVisible: false,
        });

        const dSeries = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.stochastic_d,
          lineWidth: 2,
          title: "%D",
          priceLineVisible: false,
        });

        kSeries.setData(k as any);
        dSeries.setData(d as any);

        indicatorSeriesRef.current.push(kSeries, dSeries);

        const overbought = chart.addSeries(LineSeries, {
          color: "#EF5350",
          lineWidth: 1,
          lineStyle: 2,
          title: "80",
          priceLineVisible: false,
          lastValueVisible: false,
        });

        const oversold = chart.addSeries(LineSeries, {
          color: "#26A69A",
          lineWidth: 1,
          lineStyle: 2,
          title: "20",
          priceLineVisible: false,
          lastValueVisible: false,
        });

        overbought.setData(k.map((item) => ({ time: item.time, value: 80 })) as any);
        oversold.setData(k.map((item) => ({ time: item.time, value: 20 })) as any);

        indicatorSeriesRef.current.push(overbought, oversold);
      }
    });
  }, [indicators, mergedCandleData]);

  useEffect(() => {
    if (!chartRef.current || !onLoadMore) return;

    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range || loadMoreLockRef.current) return;
      if (range.from < 10) {
        loadMoreLockRef.current = true;
        onLoadMore();
      }
    };

    chartRef.current
      .timeScale()
      .subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chartRef.current
        ?.timeScale()
        .unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [onLoadMore]);

  return (
    <div className="relative h-full min-h-[200px] w-full min-w-0">
      <div ref={containerRef} className="absolute inset-0 min-h-[200px]" />

      {showTrading && (
      <div className="absolute top-3 left-3 z-10 rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur px-3 py-2 text-slate-100 text-xs shadow">
        <div className="flex items-center gap-2">
          <div className="font-semibold">Paper trading</div>
          <div className="text-slate-300">
            market @ {marketContext.price != null ? marketContext.price.toFixed(4) : "--"}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-5 gap-2 text-[11px]">
          <div>
            <span className="text-slate-400">O</span>{" "}
            <span className="font-semibold">
              {ohlcvContext.o != null ? ohlcvContext.o.toFixed(4) : "--"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">H</span>{" "}
            <span className="font-semibold">
              {ohlcvContext.h != null ? ohlcvContext.h.toFixed(4) : "--"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">L</span>{" "}
            <span className="font-semibold">
              {ohlcvContext.l != null ? ohlcvContext.l.toFixed(4) : "--"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">C</span>{" "}
            <span className="font-semibold">
              {ohlcvContext.c != null ? ohlcvContext.c.toFixed(4) : "--"}
            </span>
          </div>
          <div>
            <span className="text-slate-400">V</span>{" "}
            <span className="font-semibold">
              {ohlcvContext.v != null ? String(ohlcvContext.v) : "--"}
            </span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <label className="text-slate-300 text-[11px]">Vol</label>
            <input
              value={vol}
              onChange={(e) => setVol(Math.max(0.0001, Number(e.target.value) || 1))}
              className="w-16 rounded bg-slate-800/80 border border-slate-700 px-2 py-1 outline-none text-[11px]"
              type="number"
              min={0.0001}
              step={0.1}
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-slate-300 text-[11px]">Lev</label>
            <input
              value={leverage}
              onChange={(e) => setLeverage(Math.max(0.01, Math.min(1000, Number(e.target.value) || 1)))}
              className="w-14 rounded bg-slate-800/80 border border-slate-700 px-2 py-1 outline-none text-[11px]"
              type="number"
              min={0.01}
              max={1000}
              step={0.1}
            />
          </div>

          <button
            onClick={() => addTrade("buy")}
            className="rounded bg-emerald-600/90 hover:bg-emerald-600 px-2 py-1 font-semibold disabled:opacity-50"
            type="button"
            disabled={!marketContext.time || marketContext.price == null}
          >
            Buy
          </button>
          <button
            onClick={() => addTrade("sell")}
            className="rounded bg-rose-600/90 hover:bg-rose-600 px-2 py-1 font-semibold disabled:opacity-50"
            type="button"
            disabled={!marketContext.time || marketContext.price == null}
          >
            Sell
          </button>
          <button
            onClick={() => closePosition()}
            className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1 font-semibold disabled:opacity-50"
            type="button"
            disabled={position.side === "flat" || !marketContext.time || marketContext.price == null}
          >
            Close
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-slate-200">
          <div>
            Pos:{" "}
            <span className="font-semibold">
              {position.side === "flat"
                ? "FLAT"
                : `${position.side.toUpperCase()} ${position.qty}`}
            </span>
          </div>
          <div>
            Avg: <span className="font-semibold">{position.avgPrice ? position.avgPrice.toFixed(4) : "--"}</span>
          </div>
          <div>
            uPnL:{" "}
            <span className={`font-semibold ${unrealizedPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {position.side === "flat" ? "--" : unrealizedPnl.toFixed(4)}
            </span>
          </div>
          <div className="text-slate-400">Trades: {tradesRef.current.length}</div>
        </div>
      </div>
      )}
    </div>
  );
}