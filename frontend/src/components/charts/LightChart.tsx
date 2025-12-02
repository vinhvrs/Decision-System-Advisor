/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
} from "lightweight-charts";

interface Props {
  symbol: string;
  data: any[];
  onLoadMore?: () => void;
}

export default function LightChart({ symbol, data, onLoadMore }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);

  /** INIT CHART ONCE */
  useEffect(() => {
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

    return () => {
      chart.remove();
    };
  }, []);

  /** UPDATE DATA WITHOUT JUMPING */
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;
    if (!data.length) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    const currentRange = chart.timeScale().getVisibleLogicalRange();
    const scrollPos = chart.timeScale().scrollPosition();

    const isPrepend = data[0].time < series._data?.[0]?.time;

    if (isPrepend) {
      const prevRightBar = chart.timeScale().coordinateToLogical(0);

      requestAnimationFrame(() => {
        series.setData(data);
        chart.timeScale().setVisibleLogicalRange({
          from: (currentRange?.from ?? 0) + 1000,
          to: (currentRange?.to ?? 0) + 1000,
        });
      });
    } else {
      // append
      requestAnimationFrame(() => series.setData(data));
    }
  }, [data]);

  /** LOAD MORE WHEN SCROLL LEFT */
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const handler = () => {
      const range = chart.timeScale().getVisibleRange();
      if (!range) return;

      const leftTime = range.from;
      const earliest = data[0]?.time;

      if (earliest && leftTime - earliest < 500) {
        onLoadMore?.();
      }
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(handler);

    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handler);
    };
  }, [data]);

  return <div ref={containerRef} className="w-full" />;
}
