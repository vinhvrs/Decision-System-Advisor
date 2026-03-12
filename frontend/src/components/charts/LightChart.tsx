/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  ISeriesApi,
  IChartApi,
  Time,
  LogicalRange,
} from "lightweight-charts";

type TF = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  symbol: string;
  data: any[];
  realtimeCandle?: any;
  period: TF;
  onLoadMore?: () => void;
}

/** ===== time normalize: seconds/ms/micro + “double timestamp” heuristic ===== */
function normalizeTimeMs(t: any) {
  let ms = Number(t);
  if (!ms || Number.isNaN(ms)) return null;

  if (ms < 10_000_000_000) ms *= 1000; // sec -> ms
  if (ms > 10_000_000_000_000) ms = Math.floor(ms / 1000); // micro -> ms

  const now = Date.now();
  if (ms > now * 1.2 && ms < now * 3) ms = Math.floor(ms / 2);

  return ms;
}

/** ===== bucket start (UTC) theo TF -> seconds ===== */
function bucketStartSecUTC(timeMs: number, tf: TF) {
  const d = new Date(timeMs);

  if (tf === "daily") {
    d.setUTCHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  if (tf === "weekly") {
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() - day + 1);
    d.setUTCHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  if (tf === "monthly") {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  d.setUTCMonth(0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function toCandleSecFromHistory(c: any) {
  const ms = normalizeTimeMs(c?.time);
  if (ms === null) return null;

  return {
    time: Math.floor(ms / 1000) as Time,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  };
}

function toCandleSecBucketFromRealtime(c: any, tf: TF) {
  const ms = normalizeTimeMs(c?.time);
  if (ms === null) return null;

  const bucketSec = bucketStartSecUTC(ms, tf);
  return {
    time: bucketSec as Time,
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  };
}

export default function LightChart({
  symbol,
  data,
  realtimeCandle,
  onLoadMore,
  period,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // source of truth
  const displayMapRef = useRef<Map<number, any>>(new Map());

  // track prepend / load more
  const prevFirstTimeRef = useRef<number | null>(null);
  const isFirstRenderRef = useRef(true);
  const loadMoreLockRef = useRef(false);

  /** ================= INIT CHART: chỉ tạo 1 lần ================= */
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 450,
      layout: {
        background: { type: ColorType.Solid, color: "#0B1220" },
        textColor: "rgba(255,255,255,0.85)",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        rightBarStaysOnScroll: true,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = candleSeries;

    const handleResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: containerRef.current.clientWidth,
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      displayMapRef.current.clear();
    };
  }, []);

  /** ================= RESET khi đổi symbol / period ================= */
  useEffect(() => {
    displayMapRef.current.clear();
    prevFirstTimeRef.current = null;
    isFirstRenderRef.current = true;
    loadMoreLockRef.current = false;

    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
  }, [symbol, period]);

  /** ================= APPLY HISTORY ================= */
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    if (!data?.length) {
      displayMapRef.current.clear();
      series.setData([]);
      prevFirstTimeRef.current = null;
      return;
    }

    const normalized = data
      .map(toCandleSecFromHistory)
      .filter(Boolean) as any[];

    if (!normalized.length) return;

    normalized.sort((a, b) => Number(a.time) - Number(b.time));

    const newFirstTime = Number(normalized[0].time);
    const newLastTime = Number(normalized[normalized.length - 1].time);
    const oldFirstTime = prevFirstTimeRef.current;

    const currentLogicalRange = chart.timeScale().getVisibleLogicalRange();
    const barsBefore = normalized.length;

    const isPrepend =
      oldFirstTime !== null &&
      newFirstTime < oldFirstTime &&
      newLastTime >= oldFirstTime;

    const map = displayMapRef.current;

    for (const c of normalized) {
      map.set(Number(c.time), c);
    }

    const mergedArr = Array.from(map.values()).sort(
      (a, b) => Number(a.time) - Number(b.time)
    );

    requestAnimationFrame(() => {
      series.setData(mergedArr as any);
      prevFirstTimeRef.current = Number(mergedArr[0]?.time ?? newFirstTime);

      if (isFirstRenderRef.current) {
        chart.timeScale().fitContent();
        isFirstRenderRef.current = false;
      } else if (isPrepend && currentLogicalRange) {
        const addedBars = mergedArr.length - barsBefore;
        chart.timeScale().setVisibleLogicalRange({
          from: currentLogicalRange.from + addedBars,
          to: currentLogicalRange.to + addedBars,
        });
      }

      loadMoreLockRef.current = false;
    });
  }, [data, symbol, period]);

  /** ================= REALTIME ================= */
  useEffect(() => {
    if (!seriesRef.current || !realtimeCandle) return;
    if (realtimeCandle.symbol && realtimeCandle.symbol !== symbol) return;

    const snap = toCandleSecBucketFromRealtime(realtimeCandle, period);
    if (!snap) return;

    const series = seriesRef.current;
    const map = displayMapRef.current;
    const key = Number(snap.time);

    const lastExisting = map.get(key);

    if (!lastExisting) {
      map.set(key, snap);
      try {
        series.update(snap as any);
      } catch (e) {
        console.warn("Realtime new candle skip:", e);
      }
      return;
    }

    const merged = {
      time: snap.time,
      open: Number(lastExisting.open),
      high: Math.max(Number(lastExisting.high), Number(snap.high)),
      low: Math.min(Number(lastExisting.low), Number(snap.low)),
      close: Number(snap.close),
    };

    map.set(key, merged);

    try {
      series.update(merged as any);
    } catch (e) {
      console.warn("Realtime merge skip:", e);
    }
  }, [realtimeCandle, period, symbol]);

  /** ================= LOAD MORE khi kéo trái ================= */
  useEffect(() => {
    if (!chartRef.current || !onLoadMore) return;

    const chart = chartRef.current;

    const handler = (range: LogicalRange | null) => {
      if (!range || loadMoreLockRef.current) return;

      const keys = Array.from(displayMapRef.current.keys()).sort((a, b) => a - b);
      if (!keys.length) return;

      // kéo gần sát mé trái visible range
      if (range.from < 10) {
        loadMoreLockRef.current = true;
        onLoadMore();
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, [onLoadMore]);

  return <div ref={containerRef} className="w-full" />;
}