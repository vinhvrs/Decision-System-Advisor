// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import { useEffect, useRef } from "react";
// import {
//   createChart,
//   ColorType,
//   CandlestickSeries,
// } from "lightweight-charts";

// interface Props {
//   symbol: string;
//   data: any[];
//   onLoadMore?: () => void;
// }

// export default function LightChart({ symbol, data, onLoadMore }: Props) {
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const chartRef = useRef<any>(null);
//   const seriesRef = useRef<any>(null);

//   /** INIT CHART ONCE */
//   useEffect(() => {
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

//     return () => {
//       chart.remove();
//     };
//   }, []);

//   /** UPDATE DATA WITHOUT JUMPING */
//   useEffect(() => {
//     if (!seriesRef.current || !chartRef.current) return;
//     if (!data.length) return;

//     const chart = chartRef.current;
//     const series = seriesRef.current;

//     const currentRange = chart.timeScale().getVisibleLogicalRange();
//     const scrollPos = chart.timeScale().scrollPosition();

//     const isPrepend = data[0].time < series._data?.[0]?.time;

//     if (isPrepend) {
//       const prevRightBar = chart.timeScale().coordinateToLogical(0);

//       requestAnimationFrame(() => {
//         series.setData(data);
//         chart.timeScale().setVisibleLogicalRange({
//           from: (currentRange?.from ?? 0) + 1000,
//           to: (currentRange?.to ?? 0) + 1000,
//         });
//       });
//     } else {
//       // append
//       requestAnimationFrame(() => series.setData(data));
//     }
//   }, [data]);

//   /** LOAD MORE WHEN SCROLL LEFT */
//   useEffect(() => {
//     if (!chartRef.current) return;

//     const chart = chartRef.current;

//     const handler = () => {
//       const range = chart.timeScale().getVisibleRange();
//       if (!range) return;

//       const leftTime = range.from;
//       const earliest = data[0]?.time;

//       if (earliest && leftTime - earliest < 500) {
//         onLoadMore?.();
//       }
//     };

//     chart.timeScale().subscribeVisibleTimeRangeChange(handler);

//     return () => {
//       chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
//     };
//   }, [data]);

//   return <div ref={containerRef} className="w-full" />;
// }
/* --------------------------------------------------------
   * LOAD CANDLE PAGE
   ---------------------------------------------------------*/
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

interface Props {
  symbol: string;
  data: any[];          // history OHLC (ms time)
  realtimeCandle?: any; // realtime candle từ Reverb (ms time)
  onLoadMore?: () => void;
}

/** =========================================================
 * Normalize candle
 * Backend gửi ms → chart cần seconds
 * ========================================================= */
function normalizeCandle(c: any) {
  const t = Number(c?.time);
  if (!t || Number.isNaN(t)) return null;

  return {
    time: Math.floor(t / 1000),
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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // candle cuối cùng (để update realtime)
  const lastCandleRef = useRef<any>(null);

  // time đầu tiên của history (để detect prepend)
  const prevFirstTimeRef = useRef<number | null>(null);

  /* =========================================================
   * INIT CHART – chạy 1 lần
   * ========================================================= */
  useEffect(() => {

    console.log("📈 Init LightChart", symbol);
    console.log("📈 Initial data points:", data.length);
        if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 450,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#eee" },
        horzLines: { color: "#eee" },
      },
      crosshair: { mode: 1 },
      timeScale: {
        rightBarStaysOnScroll: true,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4caf50",
      downColor: "#f44336",
      borderUpColor: "#4caf50",
      borderDownColor: "#f44336",
      wickUpColor: "#4caf50",
      wickDownColor: "#f44336",
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
    };
  }, []);

  /* =========================================================
   * SET HISTORY DATA (setData) – không jump
   * ========================================================= */
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!data || data.length === 0) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    const normalized = data
      .map(normalizeCandle)
      .filter(Boolean) as any[];

    if (!normalized.length) return;

    const newFirstTime = normalized[0].time;
    const oldFirstTime = prevFirstTimeRef.current;

    const currentRange = chart.timeScale().getVisibleLogicalRange();

    const isPrepend =
      oldFirstTime !== null && newFirstTime < oldFirstTime;

    requestAnimationFrame(() => {
      series.setData(normalized);

      lastCandleRef.current = normalized[normalized.length - 1];
      prevFirstTimeRef.current = newFirstTime;

      // giữ nguyên view khi prepend
      if (isPrepend && currentRange) {
        chart.timeScale().setVisibleLogicalRange(currentRange);
      }
    });
  }, [data]);

  /* =========================================================
   * REALTIME UPDATE (series.update)
   * ========================================================= */
  useEffect(() => {
    if (!seriesRef.current || !realtimeCandle) return;

    const candle = normalizeCandle(realtimeCandle);
    if (!candle) return;

    const series = seriesRef.current;
    const last = lastCandleRef.current;

    // candle mới
    if (!last || candle.time > last.time) {
      series.update(candle as any);
      lastCandleRef.current = candle;
      return;
    }

    // update candle đang chạy
    if (candle.time === last.time) {
      series.update(candle as any);
      lastCandleRef.current = candle;
    }
  }, [realtimeCandle]);

  /* =========================================================
   * LOAD MORE khi scroll trái
   * ========================================================= */
  useEffect(() => {
    if (!chartRef.current || !onLoadMore || !data.length) return;

    const chart = chartRef.current;

    const handler = () => {
      const range = chart.timeScale().getVisibleRange();
      if (!range) return;

      const leftTime = range.from as number;
      const earliest = Math.floor(Number(data[0].time) / 1000);

      if (leftTime - earliest < 10) {
        onLoadMore();
      }
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handler);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
    };
  }, [data, onLoadMore]);

  return <div ref={containerRef} className="w-full" />;
}
