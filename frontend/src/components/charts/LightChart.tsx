// /* eslint-disable @typescript-eslint/no-explicit-any */
// "use client";

// import { useEffect, useRef } from "react";
// import {
//   createChart,
//   ColorType,
//   CandlestickSeries,
//   LineSeries,
//   HistogramSeries,
//   ISeriesApi,
//   IChartApi,
//   Time,
//   LogicalRange,
// } from "lightweight-charts";

// type TF = "daily" | "weekly" | "monthly" | "yearly";

// interface Props {
//   symbol: string;
//   data: any[];
//   realtimeCandle?: any;
//   period: TF;
//   onLoadMore?: () => void;
//   indicators?: string[];
// }

// const INDICATOR_COLORS: Record<string, string> = {
//   ema20: "#2962FF",
//   ema50: "#FF9800",
//   ema100: "#F44336",
//   sma20: "#4CAF50",
//   sma50: "#9C27B0",
//   bollinger_upper: "#90A4AE",
//   bollinger_middle: "#78909C",
//   bollinger_lower: "#90A4AE",
//   rsi: "#FFD54F",
//   macd: "#26C6DA",
//   macd_signal: "#FF7043",
//   stochastic_k: "#66BB6A",
//   stochastic_d: "#AB47BC",
// };

// function normalizeToSec(t: any): number | null {
//   const ms = Number(t);
//   if (!ms || Number.isNaN(ms)) return null;
//   if (ms < 10_000_000_000) return ms;
//   return Math.floor(ms / 1000);
// }

// function toNumber(v: any): number {
//   const n = Number(v);
//   return Number.isFinite(n) ? n : 0;
// }

// function calcEMA(data: any[], period: number) {
//   if (!data.length) return [];
//   const k = 2 / (period + 1);
//   let ema = toNumber(data[0].close);

//   return data.map((d, i) => {
//     const close = toNumber(d.close);
//     ema = i === 0 ? close : (close - ema) * k + ema;
//     return { time: d.time, value: ema };
//   });
// }

// function calcSMA(data: any[], period: number) {
//   const results: { time: any; value: number }[] = [];
//   for (let i = 0; i < data.length; i++) {
//     if (i < period - 1) continue;
//     const slice = data.slice(i - period + 1, i + 1);
//     const sum = slice.reduce((acc, item) => acc + toNumber(item.close), 0);
//     results.push({ time: data[i].time, value: sum / period });
//   }
//   return results;
// }

// function calcStdDev(values: number[]) {
//   const mean = values.reduce((a, b) => a + b, 0) / values.length;
//   const variance =
//     values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
//   return Math.sqrt(variance);
// }

// function calcBollingerBands(data: any[], period = 20, multiplier = 2) {
//   const upper: { time: any; value: number }[] = [];
//   const middle: { time: any; value: number }[] = [];
//   const lower: { time: any; value: number }[] = [];

//   for (let i = 0; i < data.length; i++) {
//     if (i < period - 1) continue;
//     const slice = data.slice(i - period + 1, i + 1).map((d) => toNumber(d.close));
//     const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
//     const std = calcStdDev(slice);

//     middle.push({ time: data[i].time, value: sma });
//     upper.push({ time: data[i].time, value: sma + multiplier * std });
//     lower.push({ time: data[i].time, value: sma - multiplier * std });
//   }

//   return { upper, middle, lower };
// }

// function calcRSI(data: any[], period = 14) {
//   const results: { time: any; value: number }[] = [];
//   if (data.length <= period) return results;

//   let gains = 0;
//   let losses = 0;

//   for (let i = 1; i <= period; i++) {
//     const diff = toNumber(data[i].close) - toNumber(data[i - 1].close);
//     if (diff >= 0) gains += diff;
//     else losses += Math.abs(diff);
//   }

//   let avgGain = gains / period;
//   let avgLoss = losses / period;

//   let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
//   results.push({
//     time: data[period].time,
//     value: 100 - 100 / (1 + rs),
//   });

//   for (let i = period + 1; i < data.length; i++) {
//     const diff = toNumber(data[i].close) - toNumber(data[i - 1].close);
//     const gain = diff > 0 ? diff : 0;
//     const loss = diff < 0 ? Math.abs(diff) : 0;

//     avgGain = (avgGain * (period - 1) + gain) / period;
//     avgLoss = (avgLoss * (period - 1) + loss) / period;

//     rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
//     results.push({
//       time: data[i].time,
//       value: 100 - 100 / (1 + rs),
//     });
//   }

//   return results;
// }

// function calcMACD(data: any[], fast = 12, slow = 26, signalPeriod = 9) {
//   const emaFast = calcEMA(data, fast);
//   const emaSlow = calcEMA(data, slow);

//   const macdLine = emaFast
//     .map((f, i) => {
//       const s = emaSlow[i];
//       if (!f || !s) return null;
//       return {
//         time: f.time,
//         value: f.value - s.value,
//       };
//     })
//     .filter(Boolean) as { time: any; value: number }[];

//   const signalLine = calcEMA(
//     macdLine.map((m) => ({ ...m, close: m.value })),
//     signalPeriod
//   );

//   const histogram = macdLine
//     .map((m, i) => {
//       const s = signalLine[i];
//       if (!s) return null;
//       return {
//         time: m.time,
//         value: m.value - s.value,
//       };
//     })
//     .filter(Boolean) as { time: any; value: number }[];

//   return { macdLine, signalLine, histogram };
// }

// function calcStochastic(data: any[], period = 14, smoothK = 3, smoothD = 3) {
//   const rawK: { time: any; value: number }[] = [];

//   for (let i = 0; i < data.length; i++) {
//     if (i < period - 1) continue;

//     const slice = data.slice(i - period + 1, i + 1);
//     const highestHigh = Math.max(...slice.map((d) => toNumber(d.high)));
//     const lowestLow = Math.min(...slice.map((d) => toNumber(d.low)));
//     const close = toNumber(data[i].close);

//     const value =
//       highestHigh === lowestLow
//         ? 0
//         : ((close - lowestLow) / (highestHigh - lowestLow)) * 100;

//     rawK.push({ time: data[i].time, value });
//   }

//   const kSmoothed = calcSMA(
//     rawK.map((d) => ({ ...d, close: d.value })),
//     smoothK
//   );

//   const dLine = calcSMA(
//     kSmoothed.map((d) => ({ ...d, close: d.value })),
//     smoothD
//   );

//   return {
//     k: kSmoothed,
//     d: dLine,
//   };
// }

// export default function LightChart({
//   symbol,
//   data,
//   realtimeCandle,
//   onLoadMore,
//   period,
//   indicators = [],
// }: Props) {
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const chartRef = useRef<IChartApi | null>(null);
//   const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

//   const indicatorSeriesRef = useRef<ISeriesApi<any>[]>([]);
//   const displayMapRef = useRef<Map<number, any>>(new Map());
//   const loadMoreLockRef = useRef(false);

//   useEffect(() => {
//     if (!containerRef.current) return;

//     const chart = createChart(containerRef.current, {
//       width: containerRef.current.clientWidth,
//       height: 500,
//       layout: {
//         background: { type: ColorType.Solid, color: "#0B1220" },
//         textColor: "#DDD",
//       },
//       grid: {
//         vertLines: { color: "#1E222D" },
//         horzLines: { color: "#1E222D" },
//       },
//       timeScale: {
//         borderColor: "#334155",
//         timeVisible: true,
//       },
//       rightPriceScale: {
//         borderColor: "#334155",
//       },
//     });

//     const candleSeries = chart.addSeries(CandlestickSeries, {
//       upColor: "#26a69a",
//       downColor: "#ef5350",
//       borderUpColor: "#26a69a",
//       borderDownColor: "#ef5350",
//       wickUpColor: "#26a69a",
//       wickDownColor: "#ef5350",
//     });

//     chartRef.current = chart;
//     seriesRef.current = candleSeries;

//     const handleResize = () => {
//       if (containerRef.current) {
//         chart.applyOptions({ width: containerRef.current.clientWidth });
//       }
//     };

//     window.addEventListener("resize", handleResize);

//     return () => {
//       window.removeEventListener("resize", handleResize);
//       chart.remove();
//     };
//   }, []);

//   useEffect(() => {
//     displayMapRef.current.clear();
//   }, [symbol, period]);

//   useEffect(() => {
//     if (!seriesRef.current || !chartRef.current || !data) return;

//     const chart = chartRef.current;
//     const candleSeries = seriesRef.current;

//     const formatted = data
//       .map((d) => {
//         const t = normalizeToSec(d.time);
//         if (t === null) return null;

//         return {
//           time: t as Time,
//           open: toNumber(d.open),
//           high: toNumber(d.high),
//           low: toNumber(d.low),
//           close: toNumber(d.close),
//         };
//       })
//       .filter((item): item is any => item !== null);

//     formatted.forEach((c) => displayMapRef.current.set(c.time as number, c));

//     const sortedData = Array.from(displayMapRef.current.values())
//       .filter((item) => item !== null && item !== undefined)
//       .sort((a, b) => (a.time as number) - (b.time as number));

//     if (sortedData.length === 0) return;

//     try {
//       candleSeries.setData(sortedData);
//     } catch (e) {
//       console.error("Chart setData error:", e);
//     }

//     indicatorSeriesRef.current.forEach((s) => {
//       try {
//         chart.removeSeries(s);
//       } catch {}
//     });
//     indicatorSeriesRef.current = [];

//     indicators.forEach((id) => {
//       if (id.startsWith("ema")) {
//         const p = parseInt(id.replace("ema", ""), 10);
//         if (!Number.isFinite(p)) return;

//         const lineData = calcEMA(sortedData, p);
//         const lineSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS[id] || "#FFFFFF",
//           lineWidth: 2,
//           title: id.toUpperCase(),
//           priceLineVisible: false,
//           lastValueVisible: true,
//         });
//         lineSeries.setData(lineData as any);
//         indicatorSeriesRef.current.push(lineSeries);
//         return;
//       }

//       if (id.startsWith("sma")) {
//         const p = parseInt(id.replace("sma", ""), 10);
//         if (!Number.isFinite(p)) return;

//         const lineData = calcSMA(sortedData, p);
//         const lineSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS[id] || "#FFFFFF",
//           lineWidth: 2,
//           title: id.toUpperCase(),
//           priceLineVisible: false,
//           lastValueVisible: true,
//         });
//         lineSeries.setData(lineData as any);
//         indicatorSeriesRef.current.push(lineSeries);
//         return;
//       }

//       if (id === "bollinger") {
//         const { upper, middle, lower } = calcBollingerBands(sortedData, 20, 2);

//         const upperSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.bollinger_upper,
//           lineWidth: 1,
//           lineStyle: 2,
//           title: "BB Upper",
//           priceLineVisible: false,
//         });

//         const middleSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.bollinger_middle,
//           lineWidth: 2,
//           title: "BB Middle",
//           priceLineVisible: false,
//         });

//         const lowerSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.bollinger_lower,
//           lineWidth: 1,
//           lineStyle: 2,
//           title: "BB Lower",
//           priceLineVisible: false,
//         });

//         upperSeries.setData(upper as any);
//         middleSeries.setData(middle as any);
//         lowerSeries.setData(lower as any);

//         indicatorSeriesRef.current.push(upperSeries, middleSeries, lowerSeries);
//         return;
//       }

//       if (id === "rsi") {
//         const rsiData = calcRSI(sortedData, 14);

//         const rsiSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.rsi,
//           lineWidth: 2,
//           title: "RSI 14",
//           priceLineVisible: false,
//           lastValueVisible: true,
//         });

//         rsiSeries.setData(rsiData as any);
//         indicatorSeriesRef.current.push(rsiSeries);

//         const rsi70 = chart.addSeries(LineSeries, {
//           color: "#EF5350",
//           lineWidth: 1,
//           lineStyle: 2,
//           title: "RSI 70",
//           priceLineVisible: false,
//           lastValueVisible: false,
//         });

//         const rsi30 = chart.addSeries(LineSeries, {
//           color: "#26A69A",
//           lineWidth: 1,
//           lineStyle: 2,
//           title: "RSI 30",
//           priceLineVisible: false,
//           lastValueVisible: false,
//         });

//         rsi70.setData(rsiData.map((d) => ({ time: d.time, value: 70 })) as any);
//         rsi30.setData(rsiData.map((d) => ({ time: d.time, value: 30 })) as any);

//         indicatorSeriesRef.current.push(rsi70, rsi30);
//         return;
//       }

//       if (id === "macd") {
//         const { macdLine, signalLine, histogram } = calcMACD(sortedData, 12, 26, 9);

//         const histSeries = chart.addSeries(HistogramSeries, {
//           title: "MACD Hist",
//           priceLineVisible: false,
//           lastValueVisible: false,
//         });

//         histSeries.setData(
//           histogram.map((d) => ({
//             time: d.time,
//             value: d.value,
//             color: d.value >= 0 ? "#26A69A" : "#EF5350",
//           })) as any
//         );

//         const macdSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.macd,
//           lineWidth: 2,
//           title: "MACD",
//           priceLineVisible: false,
//         });

//         const signalSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.macd_signal,
//           lineWidth: 2,
//           title: "Signal",
//           priceLineVisible: false,
//         });

//         macdSeries.setData(macdLine as any);
//         signalSeries.setData(signalLine as any);

//         indicatorSeriesRef.current.push(histSeries, macdSeries, signalSeries);
//         return;
//       }

//       if (id === "stochastic") {
//         const { k, d } = calcStochastic(sortedData, 14, 3, 3);

//         const kSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.stochastic_k,
//           lineWidth: 2,
//           title: "%K",
//           priceLineVisible: false,
//         });

//         const dSeries = chart.addSeries(LineSeries, {
//           color: INDICATOR_COLORS.stochastic_d,
//           lineWidth: 2,
//           title: "%D",
//           priceLineVisible: false,
//         });

//         kSeries.setData(k as any);
//         dSeries.setData(d as any);

//         indicatorSeriesRef.current.push(kSeries, dSeries);

//         const overbought = chart.addSeries(LineSeries, {
//           color: "#EF5350",
//           lineWidth: 1,
//           lineStyle: 2,
//           title: "80",
//           priceLineVisible: false,
//           lastValueVisible: false,
//         });

//         const oversold = chart.addSeries(LineSeries, {
//           color: "#26A69A",
//           lineWidth: 1,
//           lineStyle: 2,
//           title: "20",
//           priceLineVisible: false,
//           lastValueVisible: false,
//         });

//         overbought.setData(k.map((item) => ({ time: item.time, value: 80 })) as any);
//         oversold.setData(k.map((item) => ({ time: item.time, value: 20 })) as any);

//         indicatorSeriesRef.current.push(overbought, oversold);
//       }
//     });

//     loadMoreLockRef.current = false;
//   }, [data, indicators, symbol, period]);

//   useEffect(() => {
//     if (!seriesRef.current || !realtimeCandle) return;

//     const t = normalizeToSec(realtimeCandle.time);
//     if (!t) return;

//     const updateData = {
//       time: t as Time,
//       open: toNumber(realtimeCandle.open),
//       high: toNumber(realtimeCandle.high),
//       low: toNumber(realtimeCandle.low),
//       close: toNumber(realtimeCandle.close),
//     };

//     try {
//       seriesRef.current.update(updateData);
//       displayMapRef.current.set(t as number, updateData);
//     } catch (e) {
//       console.warn("Realtime update skip:", e);
//     }
//   }, [realtimeCandle]);

//   useEffect(() => {
//     if (!chartRef.current || !onLoadMore) return;

//     const handleVisibleRangeChange = (range: LogicalRange | null) => {
//       if (!range || loadMoreLockRef.current) return;

//       if (range.from < 10) {
//         loadMoreLockRef.current = true;
//         onLoadMore();
//       }
//     };

//     chartRef.current
//       .timeScale()
//       .subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

//     return () => {
//       chartRef.current
//         ?.timeScale()
//         .unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
//     };
//   }, [onLoadMore]);

//   return (
//     <div className="w-full h-full relative min-h-[500px]">
//       <div ref={containerRef} className="absolute inset-0" />
//     </div>
//   );
// }

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
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
  indicators?: string[];
}

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
  data,
  realtimeCandle,
  onLoadMore,
  indicators = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRef = useRef<ISeriesApi<any>[]>([]);
  const displayMapRef = useRef<Map<number, any>>(new Map());
  const loadMoreLockRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 500,
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

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      indicatorSeriesRef.current = [];
      displayMapRef.current.clear();
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
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );
  }, [data]);

  useEffect(() => {
    if (!seriesRef.current) return;

    displayMapRef.current.clear();
    mergedCandleData.forEach((item) => {
      displayMapRef.current.set(item.time as number, item);
    });

    const sortedData = Array.from(displayMapRef.current.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    if (!sortedData.length) return;

    try {
      seriesRef.current.setData(sortedData);
    } catch (e) {
      console.error("Candle setData error:", e);
    }

    loadMoreLockRef.current = false;
  }, [mergedCandleData]);

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
    if (!seriesRef.current || !realtimeCandle) return;

    const t = normalizeToSec(realtimeCandle.time);
    if (!t) return;

    const updateData = {
      time: t as Time,
      open: toNumber(realtimeCandle.open),
      high: toNumber(realtimeCandle.high),
      low: toNumber(realtimeCandle.low),
      close: toNumber(realtimeCandle.close),
    };

    try {
      seriesRef.current.update(updateData);
      displayMapRef.current.set(t, updateData);
    } catch (e) {
      console.warn("Realtime update skip:", e);
    }
  }, [realtimeCandle]);

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
    <div className="w-full h-full relative min-h-[500px]">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}