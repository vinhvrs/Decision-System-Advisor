// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import { useEffect, useRef } from "react";
// import {
//   createChart,
//   ColorType,
//   CandlestickSeries,
//   ISeriesApi,
//   IChartApi,
// } from "lightweight-charts";

// interface Props {
//   symbol: string;
//   data: any[];          // history OHLC (ms time)
//   realtimeCandle?: any; // realtime candle từ Reverb (ms time)
//   period: "daily" | "weekly" | "monthly" | "yearly";
//   onLoadMore?: () => void;
// }
// type TF = "daily" | "weekly" | "monthly" | "yearly";


// /** =========================================================
//  * Normalize candle
//  * Backend gửi ms → chart cần seconds
//  * ========================================================= */
// function normalizeCandle(c: any) {
//   const t = Number(c?.time);
//   if (!t || Number.isNaN(t)) return null;

//   return {
//     time: Math.floor(t / 1000),
//     open: Number(c.open),
//     high: Number(c.high),
//     low: Number(c.low),
//     close: Number(c.close),
//   };
// }

// function normalizeTimeMs(t: any) {
//   let ms = Number(t);
//   if (!ms || Number.isNaN(ms)) return null;

//   if (ms < 10_000_000_000) ms *= 1000; // seconds -> ms
//   if (ms > 10_000_000_000_000) ms = Math.floor(ms / 1000); // micro -> ms

//   // ✅ FIX: nếu bị nhân đôi (ms ~ 2*Date.now()) thì chia 2
//   const now = Date.now();
//   if (ms > now * 1.2 && ms < now * 3) {
//     ms = Math.floor(ms / 2);
//   }

//   return ms;
// }


// function bucketStartSecUTC(timeMs: number, tf: TF) {
//   const d = new Date(timeMs);

//   if (tf === "daily") {
//     d.setUTCHours(0, 0, 0, 0);
//     return Math.floor(d.getTime() / 1000);
//   }

//   if (tf === "weekly") {
//     const day = d.getUTCDay() || 7; // CN=7
//     d.setUTCDate(d.getUTCDate() - day + 1); // Monday
//     d.setUTCHours(0, 0, 0, 0);
//     return Math.floor(d.getTime() / 1000);
//   }

//   if (tf === "monthly") {
//     d.setUTCDate(1);
//     d.setUTCHours(0, 0, 0, 0);
//     return Math.floor(d.getTime() / 1000);
//   }

//   // yearly
//   d.setUTCMonth(0, 1);
//   d.setUTCHours(0, 0, 0, 0);
//   return Math.floor(d.getTime() / 1000);
// }

// // history: dùng time ms -> seconds (không bucket nữa vì page.tsx đã bucket rồi)
// function normalizeHistoryCandle(c: any) {
//   const ms = normalizeTimeMs(c?.time);
//   if (ms === null) return null;

//   return {
//     time: Math.floor(ms / 1000),
//     open: Number(c.open),
//     high: Number(c.high),
//     low: Number(c.low),
//     close: Number(c.close),
//   };
// }

// // realtime: BUCKET theo period => time = bucketStartSecUTC
// function normalizeRealtimeToBucket(c: any, tf: TF) {
//   const ms = normalizeTimeMs(c?.time);
//   if (ms === null) return null;

//   const bucketSec = bucketStartSecUTC(ms, tf);

//   return {
//     time: bucketSec,
//     open: Number(c.open),
//     high: Number(c.high),
//     low: Number(c.low),
//     close: Number(c.close),
//   };
// }

// export default function LightChart({
//   symbol,
//   data,
//   realtimeCandle,
//   onLoadMore,
//   period,
// }: Props) {
//   const containerRef = useRef<HTMLDivElement | null>(null);

//   const chartRef = useRef<IChartApi | null>(null);
//   const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
//   // candle cuối cùng (để update realtime)
//   const lastCandleRef = useRef<any>(null);

//   // time đầu tiên của history (để detect prepend)
//   const prevFirstTimeRef = useRef<number | null>(null);

//   /* =========================================================
//    * INIT CHART – chạy 1 lần
//    * ========================================================= */
//   useEffect(() => {
//     console.log("📈 Init LightChart", symbol);
//     console.log("📈 Initial data points:", data[data.length - 1]);
//     if (!containerRef.current) return;

//     const chart = createChart(containerRef.current, {
//       width: containerRef.current.clientWidth,
//       height: 450,
//       layout: {
//         background: { type: ColorType.Solid, color: "#ffffff" },
//         textColor: "#333",
//       },
//       grid: {
//         vertLines: { color: "#eee" },
//         horzLines: { color: "#eee" },
//       },
//       crosshair: { mode: 1 },
//       timeScale: {
//         rightBarStaysOnScroll: true,
//       },
//     });

//     const candleSeries = chart.addSeries(CandlestickSeries, {
//       upColor: "#4caf50",
//       downColor: "#f44336",
//       borderUpColor: "#4caf50",
//       borderDownColor: "#f44336",
//       wickUpColor: "#4caf50",
//       wickDownColor: "#f44336",
//     });

//     chartRef.current = chart;
//     seriesRef.current = candleSeries;

//     const handleResize = () => {
//       if (!containerRef.current || !chartRef.current) return;
//       chartRef.current.applyOptions({
//         width: containerRef.current.clientWidth,
//       });
//     };

//     window.addEventListener("resize", handleResize);

//     return () => {
//       window.removeEventListener("resize", handleResize);
//       chart.remove();
//     };
//   }, [symbol]);

//   /* =========================================================
//    * SET HISTORY DATA (setData) – không jump
//    * ========================================================= */
//   useEffect(() => {
//     if (!seriesRef.current || !chartRef.current) return;
//     if (!data || data.length === 0) return;

//     const chart = chartRef.current;
//     const series = seriesRef.current;

//     const normalized = data
//       .map(normalizeHistoryCandle)
//       .filter(Boolean) as any[];


//     if (!normalized.length) return;

//     const newFirstTime = normalized[0].time;
//     const oldFirstTime = prevFirstTimeRef.current;

//     const currentRange = chart.timeScale().getVisibleLogicalRange();

//     const isPrepend = oldFirstTime !== null && newFirstTime < oldFirstTime;

//     requestAnimationFrame(() => {
//       series.setData(normalized);

//       lastCandleRef.current = normalized[normalized.length - 1];
//       prevFirstTimeRef.current = newFirstTime;

//       // giữ nguyên view khi prepend
//       if (isPrepend && currentRange) {
//         chart.timeScale().setVisibleLogicalRange({
//           from: currentRange.from,
//           to: currentRange.to,
//         });
//       }
//     });
//   }, [data]);

//   /* =========================================================
//    * REALTIME UPDATE (series.update)
//    * ========================================================= */
//   useEffect(() => {
//     if (!seriesRef.current || !realtimeCandle) return;

//     const snap = normalizeRealtimeToBucket(realtimeCandle, period);
//     if (!snap) return;

//     const series = seriesRef.current;
//     const last = lastCandleRef.current;

//     // bucket mới -> candle mới
//     if (!last || snap.time > last.time) {
//       series.update(snap as any);
//       lastCandleRef.current = snap;
//       return;
//     }

//     // cùng bucket -> MERGE OHLC
//     if (snap.time === last.time) {
//       const merged = {
//         time: last.time,
//         open: last.open, // giữ open của snapshot đầu tiên trong bucket
//         high: Math.max(last.high, snap.high),
//         low: Math.min(last.low, snap.low),
//         close: snap.close, // close mới nhất
//       };

//       series.update(merged as any);
//       lastCandleRef.current = merged;
//     }
//   }, [realtimeCandle, period]);


//   /* =========================================================
//    * LOAD MORE khi scroll trái
//    * ========================================================= */
//   useEffect(() => {
//     if (!chartRef.current || !onLoadMore || !data.length) return;

//     const chart = chartRef.current;

//     const handler = () => {
//       const range = chart.timeScale().getVisibleRange();
//       if (!range) return;

//       const leftTime = range.from as number;
//       const earliest = Math.floor(Number(data[0].time) / 1000); // ms -> seconds


//       if (leftTime - earliest < 10) {
//         onLoadMore();
//       }
//     };

//     chart.timeScale().subscribeVisibleTimeRangeChange(handler);

//     return () => {
//       chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
//     };
//   }, [data, onLoadMore]);

//   return <div ref={containerRef} className="w-full" />;
// }


/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  ISeriesApi,
  IChartApi,
} from "lightweight-charts";

type TF = "daily" | "weekly" | "monthly" | "yearly";

interface Props {
  symbol: string;
  data: any[];          // history OHLC (ms time)
  realtimeCandle?: any; // realtime candle từ websocket (time có thể ms/seconds/micro)
  period: TF;
  onLoadMore?: () => void;
}

/** ===== time normalize: seconds/ms/micro + “double timestamp” heuristic ===== */
function normalizeTimeMs(t: any) {
  let ms = Number(t);
  if (!ms || Number.isNaN(ms)) return null;

  // seconds -> ms
  if (ms < 10_000_000_000) ms *= 1000;

  // micro -> ms
  if (ms > 10_000_000_000_000) ms = Math.floor(ms / 1000);

  // fix: nếu bị nhân đôi (ms ~ 2*Date.now()) thì chia 2
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
    const day = d.getUTCDay() || 7; // CN=7
    d.setUTCDate(d.getUTCDate() - day + 1); // Monday
    d.setUTCHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  if (tf === "monthly") {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
  }

  // yearly
  d.setUTCMonth(0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function toCandleSecFromHistory(c: any) {
  const ms = normalizeTimeMs(c?.time);
  if (ms === null) return null;

  return {
    time: Math.floor(ms / 1000), // lightweight-charts needs seconds
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
    time: bucketSec,
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

  // ✅ Source-of-truth hiển thị: time(sec) -> candle
  const displayMapRef = useRef<Map<number, any>>(new Map());

  // để giữ view khi prepend
  const prevFirstTimeRef = useRef<number | null>(null);

  /** ================= INIT CHART ================= */
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
      timeScale: { rightBarStaysOnScroll: true },
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
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [symbol]);

  /** ================= APPLY HISTORY (merge vào displayMap) ================= */
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!data?.length) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    const normalized = data
      .map(toCandleSecFromHistory)
      .filter(Boolean) as any[];

    if (!normalized.length) return;

    // detect prepend
    const newFirstTime = normalized[0].time;
    const oldFirstTime = prevFirstTimeRef.current;
    const currentRange = chart.timeScale().getVisibleLogicalRange();
    const isPrepend = oldFirstTime !== null && newFirstTime < oldFirstTime;

    // ✅ merge history vào displayMap (KHÔNG xoá realtime)
    const map = displayMapRef.current;

    // Chỉ update các candle history (các time của history). Nếu trùng time thì dùng history làm baseline.
    for (const c of normalized) {
      map.set(c.time, c);
    }

    // render từ map
    const mergedArr = Array.from(map.values()).sort((a, b) => a.time - b.time);

    requestAnimationFrame(() => {
      series.setData(mergedArr);
      prevFirstTimeRef.current = newFirstTime;

      if (isPrepend && currentRange) {
        chart.timeScale().setVisibleLogicalRange({
          from: currentRange.from,
          to: currentRange.to,
        });
      }
    });
  }, [data]);

  /** ================= REALTIME (merge + update) ================= */
  useEffect(() => {
    if (!seriesRef.current || !realtimeCandle) return;

    const snap = toCandleSecBucketFromRealtime(realtimeCandle, period);
    if (!snap) return;

    const series = seriesRef.current;
    const map = displayMapRef.current;

    const lastExisting = map.get(snap.time);

    // ✅ Nếu bucket chưa có -> candle mới
    if (!lastExisting) {
      map.set(snap.time, snap);
      series.update(snap as any);
      return;
    }

    // ✅ Nếu cùng bucket -> merge OHLC (open giữ của candle đầu tiên)
    const merged = {
      time: snap.time,
      open: Number(lastExisting.open),
      high: Math.max(Number(lastExisting.high), Number(snap.high)),
      low: Math.min(Number(lastExisting.low), Number(snap.low)),
      close: Number(snap.close), // close mới nhất
    };

    map.set(snap.time, merged);
    series.update(merged as any);
  }, [realtimeCandle, period]);

  /** ================= LOAD MORE khi scroll trái ================= */
  useEffect(() => {
    if (!chartRef.current || !onLoadMore || !data?.length) return;

    const chart = chartRef.current;

    const handler = () => {
      const range = chart.timeScale().getVisibleRange();
      if (!range) return;

      const leftSec = range.from as number;

      // data[0].time là ms (ở page.tsx bạn đang set time = date.getTime())
      const earliestSec = Math.floor(Number(data[0].time) / 1000);

      if (leftSec - earliestSec < 10) onLoadMore();
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handler);
    return () => chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
  }, [data, onLoadMore]);

  return <div ref={containerRef} className="w-full" />;
}
