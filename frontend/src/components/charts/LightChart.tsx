/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  CandlestickSeries,
  LineSeries,
  ISeriesApi,
  IChartApi,
  Time,
  Logical,
  LogicalRange,
} from "lightweight-charts";
import { Maximize2, Minimize2 } from "lucide-react";
import { TradingServices } from "@/src/services/Trading.service";
import { useTradeApiQueue } from "@/src/hooks/useTradeApiQueue";
import type { PaperTradingSnapshot } from "@/src/components/paperTrading/paperTradingTypes";

type TF = "daily" | "weekly" | "monthly" | "yearly";

/** Picked candle for history simulator (click / double-click). Times are UNIX seconds. */
export type HistoryCandlePick = {
  timeSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export type HistoryRectPick = {
  timeFrom: number;
  timeTo: number;
  priceLow: number;
  priceHigh: number;
};

/** Snapshot from `history_advice` for hover (keyed by candle UTC day YYYY-MM-DD). */
export type HistoryAdviceHover = {
  asOfDate: string;
  advice: "BUY" | "HOLD" | "WATCH";
  note: string | null;
  valueScore: number;
  qualityScore: number;
  growthScore: number;
  momentumScore: number;
  stabilityScore: number;
  sentimentScore: number;
};

export type HistoryChartInteraction = {
  enabled: boolean;
  /** When true, drag on the chart draws a price–time rectangle (blocks panning while drawing). */
  drawMode: boolean;
  /** Float OHLCV near crosshair (e.g. history simulator). */
  showHoverDetail?: boolean;
  onCandleClick?: (pick: HistoryCandlePick) => void;
  /** History sim: double-click a candle that has an order arrow to close that lot (handled in parent). */
  onCandleDoubleClick?: (pick: HistoryCandlePick) => void;
  onDrawRect?: (rect: HistoryRectPick) => void;
  /** Right-click candle (pan mode): open investing popup at screen coords. */
  onCandleContextMenu?: (
    pick: HistoryCandlePick,
    screenPoint: { clientX: number; clientY: number }
  ) => void;
  /** Right-click inside a drawn zone: remove that rectangle. */
  onRemoveDrawnRect?: (rect: HistoryRectPick) => void;
};

/** Open paper orders shown as arrows on the history chart. */
export type HistoryOrderMarker = {
  id: string;
  timeSec: number;
  side: "buy" | "sell";
  qty: number;
  leverage: number;
  price: number;
};

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
  /** Open positions for current symbol from API - syncs paper trading & chart markers */
  positionsForSymbol?: Array<{
    id: string;
    type: string;
    volume: number;
    price: number;
    leverage?: number;
    created_at?: string;
    open?: string | null;
  }>;
  /** Investing history page: click / double-click candles, draw-mode rectangles. */
  historyInteraction?: HistoryChartInteraction;
  /** Finished rectangles to draw on the chart (history simulator). */
  historyDrawnRects?: HistoryRectPick[];
  /** Per-candle UTC day (YYYY-MM-DD) → latest advice on or before that day. */
  historyAdviceByCandleDay?: Record<string, HistoryAdviceHover>;
  /** Paper orders at candle times (arrows); double-click bar with arrow closes in parent. */
  historyOrderMarkers?: HistoryOrderMarker[];
  /** Profile sidebar: current position + trade history. */
  onPaperTradingChange?: (snapshot: PaperTradingSnapshot) => void;
  /** Toolbar rendered over the expanded chart. */
  expandedToolbar?: ReactNode;
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

const HISTORY_LOAD_MORE_THRESHOLD = 10;

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
  if (t == null || t === "") return null;
  if (typeof t === "string" && /[a-zA-Z]/.test(t)) {
    const parsed = new Date(t).getTime();
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  const ms = Number(t);
  if (!ms || Number.isNaN(ms)) return null;
  if (ms < 10_000_000_000) return ms;
  return Math.floor(ms / 1000);
}

function snapTimeToBars(sec: number | null, barTimes: number[], fallback: Time | null): Time | null {
  if (sec == null) return fallback;
  if (!barTimes.length) return fallback;
  if (barTimes.includes(sec)) return sec as Time;
  let best = barTimes[0];
  let bestDist = Math.abs(barTimes[0] - sec);
  for (const t of barTimes) {
    const d = Math.abs(t - sec);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best as Time;
}

/** Entry markers on the live chart should sit on the forming candle (rightmost bar). */
function entryMarkerBarTime(
  eventSec: number | null,
  barTimes: number[],
  latestBarTime: Time | null,
  livePaperTrading: boolean
): Time | null {
  if (livePaperTrading && latestBarTime != null) return latestBarTime;
  return snapTimeToBars(eventSec, barTimes, latestBarTime);
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

function timeParamToSec(t: Time | undefined): number | null {
  if (t === undefined || t === null) return null;
  if (typeof t === "number") {
    return t < 10_000_000_000 ? t : Math.floor(t / 1000);
  }
  return null;
}

/** Pixel offset inside the chart container (matches lightweight-charts coordinate space). */
function pointerOffsetInChartContainer(
  e: { clientX: number; clientY: number },
  container: HTMLDivElement | null
): { x: number; y: number } | null {
  if (!container) return null;
  const r = container.getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

const NO_HISTORY_DRAWN_RECTS: HistoryRectPick[] = [];

function HistorySimulatorHoverTip(props: {
  tip: { x: number; y: number; pick: HistoryCandlePick };
  symbol: string;
  historyAdviceByCandleDay?: Record<string, HistoryAdviceHover>;
}) {
  const { tip, symbol, historyAdviceByCandleDay } = props;
  const candleDay = new Date(tip.pick.timeSec * 1000).toISOString().slice(0, 10);
  const adv = historyAdviceByCandleDay?.[candleDay];
  const adviceCls =
    adv?.advice === "BUY"
      ? "bg-emerald-500/25 text-emerald-200"
      : adv?.advice === "HOLD"
        ? "bg-amber-500/20 text-amber-100"
        : adv?.advice === "WATCH"
          ? "bg-slate-500/25 text-slate-200"
          : "";

  return (
    <div
      className="pointer-events-none absolute z-[40] w-[min(280px,calc(100%-16px))] max-w-[min(280px,calc(100%-16px))] rounded-md border border-white/20 bg-[#0b1220]/95 px-2.5 py-2 text-[10px] leading-snug text-[#e5e7eb] shadow-xl backdrop-blur-sm"
      style={{
        left: tip.x + 12,
        top: tip.y + 12,
      }}
    >
      <div className="mb-1 border-b border-white/10 pb-1 font-mono text-[9px] text-white/55">
        {symbol} · {candleDay}
      </div>
      <div className="grid grid-cols-[1.25rem_1fr] gap-x-1 gap-y-0.5 font-mono tabular-nums">
        <span className="text-white/45">O</span>
        <span>{tip.pick.open.toFixed(4)}</span>
        <span className="text-white/45">H</span>
        <span>{tip.pick.high.toFixed(4)}</span>
        <span className="text-white/45">L</span>
        <span>{tip.pick.low.toFixed(4)}</span>
        <span className="text-white/45">C</span>
        <span>{tip.pick.close.toFixed(4)}</span>
        <span className="text-white/45">V</span>
        <span>
          {tip.pick.volume != null ? tip.pick.volume.toLocaleString("en-US") : "—"}
        </span>
      </div>
      {adv ? (
        <div className="mt-2 border-t border-white/10 pt-1.5">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-white/45">Advice</span>
            <span className="text-[9px] text-white/35">· as of {adv.asOfDate}</span>
          </div>
          <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${adviceCls}`}>
            {adv.advice}
          </span>
          {adv.note ? (
            <p className="mt-1 text-[9px] leading-relaxed text-white/65">{adv.note}</p>
          ) : null}
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 font-mono text-[9px] tabular-nums text-white/55">
            <span>Val {adv.valueScore.toFixed(2)}</span>
            <span>Qual {adv.qualityScore.toFixed(2)}</span>
            <span>Grow {adv.growthScore.toFixed(2)}</span>
            <span>Mom {adv.momentumScore.toFixed(2)}</span>
            <span>Stab {adv.stabilityScore.toFixed(2)}</span>
            <span>Sent {adv.sentimentScore.toFixed(2)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
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
  historyInteraction,
  historyDrawnRects,
  historyAdviceByCandleDay,
  historyOrderMarkers,
  onPaperTradingChange,
  expandedToolbar,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const displayMapRef = useRef<Map<number, any>>(new Map());
  const loadMoreLockRef = useRef(false);
  const onLoadMoreRef = useRef(onLoadMore);
  const previousDataFirstTimeRef = useRef<number | null>(null);
  const tradesRef = useRef<Trade[]>([]);
  const markersRef = useRef<Marker[]>([]);
  const positionPriceLineRef = useRef<any>(null);
  const seriesMarkersRef = useRef<any>(null);
  /** Tickets created for current position: [{ id, volume }] */
  const ticketIdsRef = useRef<Array<{ id: string; volume: number }>>([]);
  /** Tickets we are closing or have closed locally — ignore until absent from API. */
  const closedTicketIdsRef = useRef<Set<string>>(new Set());
  /** Run timeScale.fitContent once per symbol after first non-empty data (not on every realtime tick). */
  const shouldFitTimeScaleRef = useRef(true);

  const historyInteractionRef = useRef(historyInteraction);

  const historyDrawnRectsPropRef = useRef(historyDrawnRects);

  const clickLastRef = useRef<{ timeSec: number; at: number } | null>(null);
  const clickSingleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [rectDrag, setRectDrag] = useState<{
    active: boolean;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const [historyHoverTip, setHistoryHoverTip] = useState<{
    x: number;
    y: number;
    pick: HistoryCandlePick;
  } | null>(null);
  const [expandedChart, setExpandedChart] = useState(false);
  const [expandedOverlayBox, setExpandedOverlayBox] = useState<{
    left: number;
    top: number;
    closeLeft: number;
    closeTop: number;
    maxWidth: number;
  } | null>(null);
  const expandedToolbarPortal =
    expandedChart && expandedToolbar && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className="fixed z-[10000] pointer-events-auto select-none"
              style={
                expandedOverlayBox
                  ? {
                      left: expandedOverlayBox.left,
                      top: expandedOverlayBox.top,
                      maxWidth: expandedOverlayBox.maxWidth,
                    }
                  : { left: 32, top: 32, maxWidth: "calc(100vw - 7rem)" }
              }
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerMove={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onMouseDown={(event) => event.stopPropagation()}
              onMouseMove={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
              onWheel={(event) => event.stopPropagation()}
            >
              {expandedToolbar}
            </div>
            <button
              type="button"
              onClick={() => setExpandedChart(false)}
              className="fixed z-[10000] inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-950/80 text-slate-200 shadow hover:border-indigo-400/50 hover:text-white"
              style={
                expandedOverlayBox
                  ? {
                      left: expandedOverlayBox.closeLeft,
                      top: expandedOverlayBox.closeTop,
                    }
                  : { right: 32, top: 32 }
              }
              aria-label="Exit full-window chart"
              title="Exit full-window chart"
            >
              <Minimize2 size={17} />
            </button>
          </>,
          document.body
        )
      : null;

  useEffect(() => {
    if (!expandedChart) {
      setExpandedOverlayBox(null);
      return;
    }

    let frame = 0;
    const updateOverlayBox = () => {
      const rect = chartWrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, rect.left + 12);
      const top = Math.max(8, rect.top + 12);
      setExpandedOverlayBox({
        left,
        top,
        closeLeft: Math.max(8, rect.right - 48),
        closeTop: top,
        maxWidth: Math.max(280, rect.width - 72),
      });
    };

    updateOverlayBox();
    frame = requestAnimationFrame(updateOverlayBox);
    window.addEventListener("resize", updateOverlayBox);
    window.addEventListener("scroll", updateOverlayBox, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateOverlayBox);
      window.removeEventListener("scroll", updateOverlayBox, true);
    };
  }, [expandedChart]);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  const requestMoreHistoryIfNeeded = useCallback((range: LogicalRange | null) => {
    if (!range || loadMoreLockRef.current || !onLoadMoreRef.current) return;
    if (range.from < HISTORY_LOAD_MORE_THRESHOLD) {
      loadMoreLockRef.current = true;
      onLoadMoreRef.current();
    }
  }, []);

  const setHistoryHoverTipIfChanged = useCallback(
    (next: { x: number; y: number; pick: HistoryCandlePick } | null) => {
      setHistoryHoverTip((prev) => {
        if (prev === null && next === null) return prev;
        if (prev !== null && next !== null) {
          const a = prev.pick;
          const b = next.pick;
          if (
            prev.x === next.x &&
            prev.y === next.y &&
            a.timeSec === b.timeSec &&
            a.open === b.open &&
            a.high === b.high &&
            a.low === b.low &&
            a.close === b.close &&
            a.volume === b.volume
          ) {
            return prev;
          }
        }
        return next;
      });
    },
    []
  );

  const [vol, setVol] = useState<number>(1);
  const [leverage, setLeverage] = useState<number>(1);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [position, setPosition] = useState<{
    side: PositionSide;
    qty: number;
    avgPrice: number;
    leverage?: number;
  }>({ side: "flat", qty: 0, avgPrice: 0 });
  const positionRef = useRef(position);
  const positionSyncedFromApiRef = useRef(false);

  useEffect(() => {
    historyInteractionRef.current = historyInteraction;
  }, [historyInteraction]);

  useEffect(() => {
    if (!expandedChart) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedChart(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expandedChart]);

  useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    if (!chart || !el) return;

    const syncExpandedSize = () => {
      chart.applyOptions({
        width: Math.max(1, Math.floor(el.clientWidth)),
        height: Math.max(200, Math.floor(el.clientHeight)),
      });
    };

    const frame = requestAnimationFrame(syncExpandedSize);
    const secondFrame = requestAnimationFrame(() => requestAnimationFrame(syncExpandedSize));
    const timeout = window.setTimeout(syncExpandedSize, 120);

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeout);
    };
  }, [expandedChart]);

  useEffect(() => {
    historyDrawnRectsPropRef.current = historyDrawnRects;
  }, [historyDrawnRects]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    shouldFitTimeScaleRef.current = true;
    previousDataFirstTimeRef.current = null;
    tradesRef.current = [];
    markersRef.current = [];
    ticketIdsRef.current = [];
    closedTicketIdsRef.current = new Set();
    const flat = { side: "flat" as const, qty: 0, avgPrice: 0 };
    positionRef.current = flat;
    setPosition(flat);
    positionSyncedFromApiRef.current = false;
  }, [symbol]);

  const markTicketsClosing = useCallback((ids: string[]) => {
    for (const id of ids) {
      if (id) closedTicketIdsRef.current.add(id);
    }
  }, []);

  const pruneClosedTicketIds = useCallback((apiPositions: Array<{ id: string }>) => {
    const apiIds = new Set(apiPositions.map((p) => p.id));
    for (const id of [...closedTicketIdsRef.current]) {
      if (!apiIds.has(id)) closedTicketIdsRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (historyInteraction?.drawMode || !historyInteraction?.showHoverDetail) {
      setHistoryHoverTipIfChanged(null);
    }
  }, [historyInteraction?.drawMode, historyInteraction?.showHoverDetail, setHistoryHoverTipIfChanged]);

  useEffect(() => {
    if (!historyInteraction?.drawMode) setRectDrag(null);
  }, [historyInteraction?.drawMode]);

  const [historyCommittedRectStyles, setHistoryCommittedRectStyles] = useState<
    Array<{ key: string; left: number; top: number; width: number; height: number }>
  >([]);

  useEffect(() => {
    const rects = historyDrawnRects ?? NO_HISTORY_DRAWN_RECTS;
    if (!rects.length) {
      setHistoryCommittedRectStyles([]);
      return;
    }

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const chart = chartRef.current;
        const ser = seriesRef.current;
        if (!chart || !ser) return;
        const ts = chart.timeScale();
        const next: Array<{
          key: string;
          left: number;
          top: number;
          width: number;
          height: number;
        }> = [];
        rects.forEach((r, i) => {
          const x0 = ts.timeToCoordinate(r.timeFrom as Time);
          const x1 = ts.timeToCoordinate(r.timeTo as Time);
          const yHi = ser.priceToCoordinate(r.priceHigh);
          const yLo = ser.priceToCoordinate(r.priceLow);
          if (x0 === null || x1 === null || yHi === null || yLo === null) return;
          const left = Math.min(x0, x1);
          const width = Math.max(1, Math.abs(x1 - x0));
          const top = Math.min(yHi, yLo);
          const height = Math.max(1, Math.abs(yLo - yHi));
          next.push({ key: `${r.timeFrom}-${r.timeTo}-${i}`, left, top, width, height });
        });
        setHistoryCommittedRectStyles(next);
      });
    };

    update();
    const afterChart = window.setTimeout(update, 0);
    const chart = chartRef.current;
    chart?.timeScale().subscribeVisibleLogicalRangeChange(update);
    const el = containerRef.current;
    const ro =
      el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    el && ro?.observe(el);

    return () => {
      window.clearTimeout(afterChart);
      cancelAnimationFrame(raf);
      chart?.timeScale().unsubscribeVisibleLogicalRangeChange(update);
      ro?.disconnect();
    };
  }, [historyDrawnRects, symbol, data]);

  const { enqueueCreate, enqueueClose } = useTradeApiQueue({
    onTicketCreated: (ticketId, volume) => {
      if (!ticketIdsRef.current.some((t) => t.id === ticketId)) {
        ticketIdsRef.current = [...ticketIdsRef.current, { id: ticketId, volume }];
      }
      tradesRef.current = [];
      setTradeError(null);
    },
    onTicketChanged: () => window.dispatchEvent(new CustomEvent("ticket-changed")),
    onCreateFailed: () => {
      setTradeError("Order could not be saved. Sign in and try again.");
    },
  });

  useEffect(() => {
    const raw = positionsForSymbol ?? [];
    pruneClosedTicketIds(raw);
    const open = raw.filter((p) => p.id && !closedTicketIdsRef.current.has(p.id));

    if (!open.length) {
      ticketIdsRef.current = ticketIdsRef.current.filter((t) => !closedTicketIdsRef.current.has(t.id));
      if (positionSyncedFromApiRef.current) {
        const flat = { side: "flat" as const, qty: 0, avgPrice: 0 };
        positionRef.current = flat;
        setPosition(flat);
        positionSyncedFromApiRef.current = false;
      }
      return;
    }

    const buyTickets = open.filter((p) => (p.type || "").toLowerCase() === "buy");
    const sellTickets = open.filter((p) => (p.type || "").toLowerCase() === "sell");
    const buyVol = buyTickets.reduce((s, t) => s + Number(t.volume || 0), 0);
    const sellVol = sellTickets.reduce((s, t) => s + Number(t.volume || 0), 0);
    const net = buyVol - sellVol;
    const nextTicketIds = open.map((t) => ({
      id: t.id,
      volume: Number(t.volume || 0),
    }));
    ticketIdsRef.current = nextTicketIds;
    if (open.length > 0) tradesRef.current = [];
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
  }, [positionsForSymbol, pruneClosedTicketIds]);

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

    const pickFromClickParam = (param: any): HistoryCandlePick | null => {
      const t = param?.time as Time | undefined;
      const sec = timeParamToSec(t);
      if (sec == null) return null;
      const seriesData = param.seriesData?.get?.(candleSeries);
      if (!seriesData) return null;
      const o = typeof seriesData.open === "number" ? seriesData.open : null;
      const h = typeof seriesData.high === "number" ? seriesData.high : null;
      const l = typeof seriesData.low === "number" ? seriesData.low : null;
      const c =
        (typeof seriesData.close === "number" && seriesData.close) ||
        (typeof seriesData.value === "number" && seriesData.value) ||
        null;
      if (o == null || h == null || l == null || c == null) return null;
      const fromMap = displayMapRef.current.get(sec);
      const v =
        fromMap && typeof fromMap.volume === "number" ? (fromMap.volume as number) : null;
      return { timeSec: sec, open: o, high: h, low: l, close: c, volume: v };
    };

    const crosshairMove = (param: any) => {
      const hi = historyInteractionRef.current;
      if (hi?.enabled && hi.showHoverDetail && !hi.drawMode) {
        if (!param?.point || param.time === undefined || param.time === null) {
          setHistoryHoverTipIfChanged(null);
        } else {
          const pick = pickFromClickParam(param);
          const px = param.point.x;
          const py = param.point.y;
          if (
            pick &&
            typeof px === "number" &&
            typeof py === "number" &&
            Number.isFinite(px) &&
            Number.isFinite(py)
          ) {
            setHistoryHoverTipIfChanged({ x: px, y: py, pick });
          } else {
            setHistoryHoverTipIfChanged(null);
          }
        }
      } else {
        setHistoryHoverTipIfChanged(null);
      }

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

      setHover((prev) =>
        prev.time === time &&
        prev.o === o &&
        prev.h === h &&
        prev.l === l &&
        prev.c === c &&
        prev.v === v
          ? prev
          : { time, o, h, l, c, v }
      );
    };

    chart.subscribeCrosshairMove(crosshairMove);

    const handleChartClick = (param: any) => {
      const hi = historyInteractionRef.current;
      if (!hi?.enabled || hi.drawMode) return;
      const pick = pickFromClickParam(param);
      if (!pick) return;
      const now = Date.now();
      const prev = clickLastRef.current;
      if (prev && prev.timeSec === pick.timeSec && now - prev.at < 420) {
        if (clickSingleTimerRef.current) {
          clearTimeout(clickSingleTimerRef.current);
          clickSingleTimerRef.current = null;
        }
        clickLastRef.current = null;
        hi.onCandleDoubleClick?.(pick);
        return;
      }
      clickLastRef.current = { timeSec: pick.timeSec, at: now };
      if (clickSingleTimerRef.current) {
        clearTimeout(clickSingleTimerRef.current);
      }
      clickSingleTimerRef.current = setTimeout(() => {
        clickSingleTimerRef.current = null;
        clickLastRef.current = null;
        if (hi.onCandleClick) hi.onCandleClick(pick);
      }, 300);
    };

    chart.subscribeClick(handleChartClick);

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
      chart.unsubscribeClick(handleChartClick);
      if (clickSingleTimerRef.current) {
        clearTimeout(clickSingleTimerRef.current);
        clickSingleTimerRef.current = null;
      }
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
  }, [setHistoryHoverTipIfChanged]);

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

  /** Bar times on the chart series (historical + live realtime bucket). */
  const chartBarTimes = useMemo(() => {
    const times = new Set<number>();
    mergedCandleData.forEach((c) => times.add(Number(c.time)));
    const rt = normalizeToSec(realtimeCandle?.time);
    if (rt != null) times.add(rt);
    return Array.from(times).sort((a, b) => a - b);
  }, [mergedCandleData, realtimeCandle]);

  const latestBarTime = useMemo((): Time | null => {
    if (!chartBarTimes.length) return null;
    return chartBarTimes[chartBarTimes.length - 1] as Time;
  }, [chartBarTimes]);

  // Always execute trades at the latest price (not crosshair price)
  const marketContext = useMemo(() => {
    const t =
      normalizeToSec(realtimeCandle?.time) ??
      (latestBarTime as number | undefined) ??
      (lastCandle?.time as number | undefined);
    const time = (t ? (t as Time) : (latestBarTime ?? (lastCandle?.time as Time | undefined))) ?? null;
    const price =
      (realtimeCandle && typeof realtimeCandle.close === "number"
        ? (realtimeCandle.close as number)
        : null) ??
      (typeof lastCandle?.close === "number" ? (lastCandle.close as number) : null);
    return { time, price };
  }, [lastCandle, latestBarTime, realtimeCandle]);

  const emitPaperSnapshot = useCallback(() => {
    if (!onPaperTradingChange) return;
    const p = positionRef.current;
    const snapshot: PaperTradingSnapshot = {
      position: { ...p },
      trades: tradesRef.current.map((t) => {
        let timeSec = 0;
        if (typeof t.time === "number") {
          timeSec = t.time < 10_000_000_000 ? t.time : Math.floor(t.time / 1000);
        } else {
          const ms = new Date(String(t.time)).getTime();
          timeSec = Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
        }
        return {
          id: t.id,
          timeSec,
          price: t.price,
          side: t.side,
          volume: t.volume,
          leverage: t.leverage,
        };
      }),
      marketPrice: marketContext.price ?? null,
      unrealizedPnl:
        p.side === "flat" || marketContext.price == null || !p.avgPrice
          ? 0
          : (() => {
              const dir = p.side === "long" ? 1 : -1;
              const lev = p.leverage ?? 1;
              const factor = (p.qty * lev) / p.avgPrice;
              return dir * ((marketContext.price as number) - p.avgPrice) * factor;
            })(),
    };
    onPaperTradingChange(snapshot);
  }, [onPaperTradingChange, marketContext.price]);

  useEffect(() => {
    emitPaperSnapshot();
  }, [emitPaperSnapshot, position]);

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

  const formatMarkerPrice = (px: number) =>
    Number.isFinite(px) ? px.toFixed(px >= 1 ? 2 : 4) : "--";

  const markTradesOnChart = useCallback(() => {
    const seriesMarkers = seriesMarkersRef.current;
    if (!seriesMarkers?.setMarkers) return;

    const openApiPositions = (positionsForSymbol ?? []).filter(
      (p) => p.id && !closedTicketIdsRef.current.has(p.id)
    );
    const barTimes = chartBarTimes;
    const fallbackTime = latestBarTime ?? (marketContext.time as Time | undefined) ?? null;
    const livePaperTrading = showTrading;

    /** Session trades only while API tickets are not loaded yet (avoids double markers). */
    const tradeMarkers: Marker[] =
      openApiPositions.length > 0
        ? []
        : tradesRef.current
            .map((t) => {
              const sec = typeof t.time === "number" ? (t.time as number) : null;
              const time = entryMarkerBarTime(sec, barTimes, fallbackTime, livePaperTrading);
              if (time == null) return null;
              return {
                time,
                position: (t.side === "buy" ? "belowBar" : "aboveBar") as Marker["position"],
                color: t.side === "buy" ? "#26A69A" : "#EF5350",
                shape: (t.side === "buy" ? "arrowUp" : "arrowDown") as Marker["shape"],
                text: `${t.side.toUpperCase()} ${t.volume}×${t.leverage} @ ${formatMarkerPrice(t.price)}`,
              } as Marker;
            })
            .filter((m): m is Marker => m != null);

    const positionMarkers = openApiPositions
      .map((p) => {
        const isBuy = (p.type || "").toLowerCase() === "buy";
        const rawTime = p.open || p.created_at;
        const sec = rawTime ? normalizeToSec(rawTime) : null;
        const time = entryMarkerBarTime(sec, barTimes, fallbackTime, livePaperTrading);
        if (time == null) return null;
        const lev = p.leverage ?? 1;
        const vol = Number(p.volume) || 0;
        const px = Number(p.price) || 0;
        return {
          time,
          position: (isBuy ? "belowBar" : "aboveBar") as Marker["position"],
          color: isBuy ? "#26A69A" : "#EF5350",
          shape: (isBuy ? "arrowUp" : "arrowDown") as Marker["shape"],
          text: `${isBuy ? "BUY" : "SELL"} ${vol}×${lev} @ ${formatMarkerPrice(px)}`,
        };
      })
      .filter((m) => m != null) as Marker[];

    const historyMarkers: Marker[] =
      !showTrading && historyOrderMarkers?.length
        ? historyOrderMarkers.map((m) => ({
            time: m.timeSec as Time,
            position: (m.side === "buy" ? "belowBar" : "aboveBar") as Marker["position"],
            color: m.side === "buy" ? "#26A69A" : "#EF5350",
            shape: (m.side === "buy" ? "arrowUp" : "arrowDown") as Marker["shape"],
            text: `${m.side === "buy" ? "ACC" : "RED"} ${m.qty}×${m.leverage}`,
          }))
        : [];

    const pnlMarkers: Marker[] = showTrading
      ? markersRef.current
          .map((m) => {
            const time = snapTimeToBars(Number(m.time), barTimes, latestBarTime);
            if (time == null) return null;
            return { ...m, time };
          })
          .filter((m): m is Marker => m != null)
      : [];

    const markers: Marker[] = [...tradeMarkers, ...positionMarkers, ...historyMarkers, ...pnlMarkers];

    try {
      seriesMarkers.setMarkers(markers);
    } catch (e) {
      console.warn("setMarkers failed:", e);
    }
  }, [
    showTrading,
    historyOrderMarkers,
    positionsForSymbol,
    latestBarTime,
    marketContext.time,
    chartBarTimes,
    realtimeCandle,
  ]);

  useEffect(() => {
    markTradesOnChart();
  }, [markTradesOnChart]);

  const processHistoryContextMenu = useCallback((e: React.MouseEvent) => {
    const hi = historyInteractionRef.current;
    if (!hi?.enabled) return;
    const chart = chartRef.current;
    const ser = seriesRef.current;
    const container = containerRef.current;
    if (!chart || !ser || !container) return;

    const o = pointerOffsetInChartContainer(e.nativeEvent, container);
    if (!o) return;
    const tRaw = chart.timeScale().coordinateToTime(o.x);
    const sec = timeParamToSec(tRaw as Time);
    const price = ser.coordinateToPrice(o.y);
    if (sec == null || price == null) return;
    const nPrice = Number(price);
    if (!Number.isFinite(nPrice)) return;

    for (const r of historyDrawnRectsPropRef.current ?? []) {
      const tMin = Math.min(r.timeFrom, r.timeTo);
      const tMax = Math.max(r.timeFrom, r.timeTo);
      const pMin = Math.min(r.priceLow, r.priceHigh);
      const pMax = Math.max(r.priceLow, r.priceHigh);
      if (sec >= tMin && sec <= tMax && nPrice >= pMin && nPrice <= pMax) {
        e.preventDefault();
        e.stopPropagation();
        hi.onRemoveDrawnRect?.(r);
        return;
      }
    }

    if (hi.drawMode) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const row = displayMapRef.current.get(sec);
    if (!row) return;
    const pick: HistoryCandlePick = {
      timeSec: sec,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume ?? null,
    };
    e.preventDefault();
    e.stopPropagation();
    hi.onCandleContextMenu?.(pick, { clientX: e.clientX, clientY: e.clientY });
  }, []);

  const tradeActionLockRef = useRef(false);

  const addTrade = useCallback(
    (side: TradeSide, overrideVol?: number) => {
      const { time, price } = marketContext;
      if (!time || price == null) return;
      if (tradeActionLockRef.current) return;
      tradeActionLockRef.current = true;
      window.setTimeout(() => {
        tradeActionLockRef.current = false;
      }, 400);
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
        const toCloseItems = ticketIdsRef.current.filter((t) => !closedTicketIdsRef.current.has(t.id));
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
            symbol: symbol.toUpperCase(),
            volume: createVol,
            price,
            leverage: lev,
          },
          createVol
        );
      }
      if (toClose.length > 0) {
        markTicketsClosing(toClose);
        enqueueClose(toClose, price);
      }

      markTradesOnChart();
      emitPaperSnapshot();
    },
    [markTradesOnChart, marketContext, vol, leverage, market, symbol, enqueueCreate, enqueueClose, markTicketsClosing, emitPaperSnapshot]
  );

  const closePosition = useCallback(() => {
    if (position.side === "flat") return;
    const idsFromApi = (positionsForSymbol || [])
      .map((p) => p.id)
      .filter((id): id is string => Boolean(id) && !closedTicketIdsRef.current.has(id));
    const idsFromLocal = ticketIdsRef.current.map((t) => t.id).filter((id) => !closedTicketIdsRef.current.has(id));
    const allIds = [...new Set([...idsFromApi, ...idsFromLocal])];
    if (allIds.length === 0) return;

    markTicketsClosing(allIds);

    // Optimistic: update UI immediately
    ticketIdsRef.current = [];
    const flat = { side: "flat" as const, qty: 0, avgPrice: 0 };
    positionRef.current = flat;
    setPosition(flat);
    positionSyncedFromApiRef.current = false;
    emitPaperSnapshot();

    const price = marketContext.price ?? undefined;
    Promise.all(allIds.map((id) => TradingServices.closeTicket(id, price)))
      .then(() => window.dispatchEvent(new CustomEvent("ticket-changed")))
      .catch((e) => console.error("Close position failed:", e));
  }, [position.side, positionsForSymbol, marketContext.price, emitPaperSnapshot, markTicketsClosing]);

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

    const chart = chartRef.current;
    const previousVisibleRange = chart?.timeScale().getVisibleLogicalRange() ?? null;
    const previousFirstTime = previousDataFirstTimeRef.current;
    const firstTime = Number(sortedData[0]?.time);
    const previousFirstIndex =
      previousFirstTime == null
        ? -1
        : sortedData.findIndex((item) => Number(item.time) === previousFirstTime);
    const prependedBars =
      previousFirstTime != null &&
      previousFirstIndex > 0 &&
      Number.isFinite(firstTime) &&
      firstTime < previousFirstTime
        ? previousFirstIndex
        : 0;
    const shouldRestoreVisibleRange =
      prependedBars > 0 && previousVisibleRange !== null && !shouldFitTimeScaleRef.current;
    const shouldRecheckHistoryLoad = loadMoreLockRef.current;

    try {
      seriesRef.current.setData(sortedData);
    } catch (e) {
      console.error("Candle setData error:", e);
    }

    previousDataFirstTimeRef.current = Number.isFinite(firstTime) ? firstTime : null;

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

    if (chart && shouldRestoreVisibleRange) {
      const restoredRange: LogicalRange = {
        from: (previousVisibleRange.from + prependedBars) as Logical,
        to: (previousVisibleRange.to + prependedBars) as Logical,
      };

      requestAnimationFrame(() => {
        try {
          chart.timeScale().setVisibleLogicalRange(restoredRange);
        } catch {
          /* ignore */
        }

        if (shouldRecheckHistoryLoad) {
          requestAnimationFrame(() => {
            loadMoreLockRef.current = false;
            requestMoreHistoryIfNeeded(chart.timeScale().getVisibleLogicalRange());
          });
        }
      });
    } else if (shouldRecheckHistoryLoad) {
      requestAnimationFrame(() => {
        loadMoreLockRef.current = false;
        requestMoreHistoryIfNeeded(chart?.timeScale().getVisibleLogicalRange() ?? null);
      });
    } else {
      loadMoreLockRef.current = false;
    }

    // re-apply markers after any full setData()
    markTradesOnChart();
  }, [mergedCandleData, realtimeCandle, markTradesOnChart, requestMoreHistoryIfNeeded]);

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
        const ema20 = calcEMA(sortedData, 20);
        const ema100 = calcEMA(sortedData, 100);

        const ema20Series = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.ema20,
          lineWidth: 2,
          title: "EMA20",
          priceLineVisible: false,
          lastValueVisible: true,
        });

        const ema100Series = chart.addSeries(LineSeries, {
          color: INDICATOR_COLORS.ema100,
          lineWidth: 2,
          title: "EMA100",
          priceLineVisible: false,
          lastValueVisible: true,
        });

        ema20Series.setData(ema20 as any);
        ema100Series.setData(ema100 as any);

        indicatorSeriesRef.current.push(ema20Series, ema100Series);
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
      requestMoreHistoryIfNeeded(range);
    };

    chartRef.current
      .timeScale()
      .subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chartRef.current
        ?.timeScale()
        .unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    };
  }, [onLoadMore, requestMoreHistoryIfNeeded]);

  const chartWrapperClass = expandedChart
    ? "fixed inset-4 z-50 flex min-w-0 overflow-hidden rounded-xl border border-indigo-500/40 bg-[#0B1220] shadow-2xl shadow-black/60"
    : "relative flex w-full min-w-0 min-h-0 flex-1 overflow-hidden";

  return (
    <div className="flex h-full min-h-[260px] w-full min-w-0 flex-col gap-3">
      {expandedChart ? (
        <button
          type="button"
          className="fixed inset-0 z-40 cursor-default bg-black/60"
          onClick={() => setExpandedChart(false)}
          aria-label="Exit full-window chart"
        />
      ) : null}
      {expandedToolbarPortal}
      <div
        ref={chartWrapperRef}
        className={chartWrapperClass}
        onContextMenu={(e) => {
          if (!historyInteraction?.enabled) return;
          if (historyInteraction.drawMode) return;
          processHistoryContextMenu(e);
        }}
      >
        <button
          type="button"
          onClick={() => setExpandedChart((v) => !v)}
          className={`absolute right-3 z-[36] inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-950/70 text-slate-300 shadow hover:border-indigo-400/50 hover:text-indigo-200 ${
            expandedChart ? "top-3" : "top-14"
          }`}
          aria-label={expandedChart ? "Exit full-window chart" : "Expand chart to full window"}
          title={expandedChart ? "Exit full-window chart" : "Expand chart"}
        >
          {expandedChart ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <div ref={containerRef} className="relative h-full min-h-[220px] w-full flex-1" />
        {historyCommittedRectStyles.map((s) => (
          <div
            key={s.key}
            className="pointer-events-none absolute z-[22] border border-amber-400/50 bg-amber-400/10"
            style={{
              left: s.left,
              top: s.top,
              width: s.width,
              height: s.height,
            }}
          />
        ))}
        {historyInteraction?.enabled && historyInteraction.drawMode ? (
          <div
            className="absolute inset-0 z-[28] cursor-crosshair touch-none"
            onContextMenu={(e) => {
              if (rectDrag?.active) {
                e.preventDefault();
                return;
              }
              processHistoryContextMenu(e);
            }}
            onPointerDown={(e) => {
              const o = pointerOffsetInChartContainer(e, containerRef.current);
              if (!o) return;
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
              setRectDrag({
                active: true,
                x0: o.x,
                y0: o.y,
                x1: o.x,
                y1: o.y,
              });
            }}
            onPointerMove={(e) => {
              const o = pointerOffsetInChartContainer(e, containerRef.current);
              if (!o) return;
              setRectDrag((d) => (d?.active ? { ...d, x1: o.x, y1: o.y } : d));
            }}
            onPointerUp={(e) => {
              let rectToEmit: HistoryRectPick | null = null;
              setRectDrag((d) => {
                if (!d?.active) return null;
                try {
                  (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
                } catch {
                  /* ignore */
                }
                const c = chartRef.current;
                const s = seriesRef.current;
                const hi = historyInteractionRef.current;
                if (c && s && hi?.onDrawRect) {
                  const x0 = Math.min(d.x0, d.x1);
                  const x1 = Math.max(d.x0, d.x1);
                  const y0 = Math.min(d.y0, d.y1);
                  const y1 = Math.max(d.y0, d.y1);
                  if (x1 - x0 >= 4 && y1 - y0 >= 4) {
                    const tRaw0 = c.timeScale().coordinateToTime(x0);
                    const tRaw1 = c.timeScale().coordinateToTime(x1);
                    const sec0 = timeParamToSec(tRaw0 as Time);
                    const sec1 = timeParamToSec(tRaw1 as Time);
                    const p0 = s.coordinateToPrice(y0);
                    const p1 = s.coordinateToPrice(y1);
                    if (sec0 != null && sec1 != null && p0 != null && p1 != null) {
                      const n0 = Number(p0);
                      const n1 = Number(p1);
                      rectToEmit = {
                        timeFrom: Math.min(sec0, sec1),
                        timeTo: Math.max(sec0, sec1),
                        priceLow: Math.min(n0, n1),
                        priceHigh: Math.max(n0, n1),
                      };
                    }
                  }
                }
                return null;
              });
              if (rectToEmit) {
                const payload = rectToEmit;
                queueMicrotask(() => {
                  historyInteractionRef.current?.onDrawRect?.(payload);
                });
              }
            }}
            onPointerCancel={() => setRectDrag(null)}
            aria-hidden
          />
        ) : null}
        {rectDrag ? (
          <div
            className="pointer-events-none absolute z-[32] border border-amber-400/80 bg-amber-400/15"
            style={{
              left: Math.min(rectDrag.x0, rectDrag.x1),
              top: Math.min(rectDrag.y0, rectDrag.y1),
              width: Math.max(1, Math.abs(rectDrag.x1 - rectDrag.x0)),
              height: Math.max(1, Math.abs(rectDrag.y1 - rectDrag.y0)),
            }}
          />
        ) : null}
        {historyHoverTip && historyInteraction?.showHoverDetail && !historyInteraction.drawMode ? (
          <HistorySimulatorHoverTip
            tip={historyHoverTip}
            symbol={symbol}
            historyAdviceByCandleDay={historyAdviceByCandleDay}
          />
        ) : null}
      </div>

      {showTrading && (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur px-3 py-2 text-slate-100 text-xs shadow">
        <div className="flex items-center gap-2">
          <div className="font-semibold">Paper trading</div>
          <div className="text-slate-300">
            market @ {marketContext.price != null ? marketContext.price.toFixed(4) : "--"}
          </div>
        </div>
        {tradeError ? (
          <p className="mt-1.5 text-[11px] font-medium text-rose-400">{tradeError}</p>
        ) : null}

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
        </div>
      </div>
      )}
    </div>
  );
}
