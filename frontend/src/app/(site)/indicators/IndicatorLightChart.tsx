'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type SeriesMarker,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { SampleBar } from './indicatorCalculations';
import {
  createAttributeStackPaneView,
  type AttributeStackBarData,
} from './attributeStackCustomSeries';

const TIME_BASE = 1704067200 as UTCTimestamp;

function seriesLineWidth(w?: number): 1 | 2 | 3 | 4 {
  const n = w ?? 2;
  if (n <= 1) return 1;
  if (n >= 4) return 4;
  if (n === 2) return 2;
  return 3;
}

export function dayToTime(day: number): UTCTimestamp {
  return (TIME_BASE + (day - 1) * 86400) as UTCTimestamp;
}

export type OverlayLineSpec = {
  id?: string;
  label?: string;
  color: string;
  lineWidth?: number;
  data: { time: UTCTimestamp; value: number }[];
};

export type SubPaneLineSpec = OverlayLineSpec & {
  /** Second scale on the sub-pane (e.g. liquidity vs 0–100 score) */
  priceScaleId?: string;
  /** Fixed 0–100 range for oscillators */
  lockZeroToHundred?: boolean;
};

/** Scale id shared by stacked board attributes + F&amp;G line in strategy “6 + F&amp;G” mode */
export const BOARD_ATTR_STACK_SCALE_ID = 'board-attr-stack';

export type SubPaneAttributeStackSpec = {
  /** Defaults to {@link BOARD_ATTR_STACK_SCALE_ID} */
  priceScaleId?: string;
  colors: readonly [string, string, string, string, string, string];
  data: AttributeStackBarData[];
};

export type SubPaneSpec = {
  /** MACD-style columns */
  histogram?: { time: UTCTimestamp; value: number; color?: string }[];
  /** Isolate histogram on its own price scale (e.g. hybrid MACD vs 0–100 oscillators) */
  histogramPriceScaleId?: string;
  /**
   * Stacked 0–100 column per bar (six segments). Uses a custom series; keep on a dedicated
   * {@link SubPaneAttributeStackSpec.priceScaleId} when combined with other oscillators.
   */
  attributeStack?: SubPaneAttributeStackSpec;
  lines: SubPaneLineSpec[];
};

/** Board stack + oscillator lines on pane 0 (e.g. strategy “6 + F&amp;G” with no lower pane). */
export type MainPaneBoardSpec = {
  attributeStack: SubPaneAttributeStackSpec;
  lines: SubPaneLineSpec[];
};

type Props = {
  className?: string;
  /** Total chart height in px (includes sub-pane when present) */
  height?: number;
  bars: SampleBar[];
  /** Price-scale lines on main pane (SMA, EMA, Bollinger) */
  overlays?: OverlayLineSpec[];
  /** Second pane (oscillators, MACD, ADX, vol proxy, LS score, …) */
  subPane?: SubPaneSpec | null;
  /** Stacked six attributes + lines on main chart (separate 0–100 price scale). */
  mainPaneBoard?: MainPaneBoardSpec | null;
  /** Buy/sell markers on candles (e.g. playbook signal hints). */
  tradeMarkers?: SeriesMarker<UTCTimestamp>[];
};

export function IndicatorLightChart({
  className = '',
  height = 480,
  bars,
  overlays = [],
  subPane,
  mainPaneBoard = null,
  tradeMarkers = [],
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || bars.length === 0) return;

    const chart = createChart(el, {
      height,
      layout: {
        attributionLogo: true,
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#9ca3af',
        fontSize: 11,
        panes: {
          separatorColor: '#374151',
          separatorHoverColor: '#6366f1',
          enableResize: true,
        },
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: { color: '#6b7280', width: 1 as const, style: LineStyle.Dashed, labelBackgroundColor: '#374151' },
        horzLine: { color: '#6b7280', width: 1 as const, style: LineStyle.Dashed, labelBackgroundColor: '#374151' },
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
        fixRightEdge: true,
        barSpacing: 6,
      },
      rightPriceScale: {
        borderColor: '#374151',
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
    });

    const candleData = bars.map((b) => ({
      time: dayToTime(b.day),
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }));

    const volData = bars.map((b) => ({
      time: dayToTime(b.day),
      value: b.v,
      color: b.c >= b.o ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)',
    }));

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      },
      0
    );

    const volSeries = chart.addSeries(
      HistogramSeries,
      {
        priceScaleId: '',
        priceFormat: { type: 'volume' },
        color: '#6366f1',
      },
      0
    );

    candleSeries.setData(candleData);
    volSeries.setData(volData);

    if (mainPaneBoard?.attributeStack?.data?.length) {
      candleSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.06, bottom: 0.4 },
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });
    } else {
      candleSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.06, bottom: 0.22 },
      });
      volSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.78, bottom: 0 },
      });
    }

    overlays.forEach((o) => {
      const line = chart.addSeries(
        LineSeries,
        {
          color: o.color,
          lineWidth: seriesLineWidth(o.lineWidth),
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
        },
        0
      );
      if (o.data.length) line.setData(o.data);
    });

    if (mainPaneBoard?.attributeStack?.data?.length) {
      const stack = mainPaneBoard.attributeStack;
      const scaleId = stack.priceScaleId ?? BOARD_ATTR_STACK_SCALE_ID;
      const stackSeries = chart.addCustomSeries(createAttributeStackPaneView(stack.colors), {
        priceScaleId: scaleId,
        autoscaleInfoProvider: () => ({
          priceRange: { minValue: 0, maxValue: 100 },
          margins: { above: 6, below: 6 },
        }),
      }, 0);
      stackSeries.setData(stack.data);

      mainPaneBoard.lines.forEach((l) => {
        const line = chart.addSeries(
          LineSeries,
          {
            color: l.color,
            lineWidth: seriesLineWidth(l.lineWidth),
            priceLineVisible: false,
            lastValueVisible: true,
            ...(l.priceScaleId != null && l.priceScaleId !== '' ? { priceScaleId: l.priceScaleId } : {}),
            ...(l.lockZeroToHundred
              ? {
                  autoscaleInfoProvider: () => ({
                    priceRange: { minValue: 0, maxValue: 100 },
                    margins: { above: 6, below: 6 },
                  }),
                }
              : {}),
          },
          0
        );
        if (l.data.length) line.setData(l.data);
      });

      chart.priceScale(scaleId, 0).applyOptions({
        scaleMargins: { top: 0.58, bottom: 0.2 },
        borderColor: '#374151',
      });
    }

    if (tradeMarkers.length > 0) {
      createSeriesMarkers(candleSeries, tradeMarkers);
    }

    const attrStack = subPane?.attributeStack;
    const hasSubPane =
      subPane &&
      (subPane.lines.length > 0 ||
        (subPane.histogram?.length ?? 0) > 0 ||
        (attrStack?.data?.length ?? 0) > 0);

    if (hasSubPane && subPane) {
      chart.addPane(false);
      chart.panes()[0].setStretchFactor(2.6);
      chart.panes()[1].setStretchFactor(1);

      if (subPane.histogram?.length) {
        const hist = chart.addSeries(
          HistogramSeries,
          {
            priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
            priceLineVisible: false,
            base: 0,
            ...(subPane.histogramPriceScaleId
              ? { priceScaleId: subPane.histogramPriceScaleId }
              : {}),
          },
          1
        );
        hist.setData(subPane.histogram);
      }

      if (attrStack?.data?.length) {
        const scaleId = attrStack.priceScaleId ?? BOARD_ATTR_STACK_SCALE_ID;
        const stackSeries = chart.addCustomSeries(createAttributeStackPaneView(attrStack.colors), {
          priceScaleId: scaleId,
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
            margins: { above: 8, below: 8 },
          }),
        }, 1);
        stackSeries.setData(attrStack.data);
      }

      subPane.lines.forEach((l) => {
        const line = chart.addSeries(
          LineSeries,
          {
            color: l.color,
            lineWidth: seriesLineWidth(l.lineWidth),
            priceLineVisible: false,
            lastValueVisible: true,
            ...(l.priceScaleId != null && l.priceScaleId !== '' ? { priceScaleId: l.priceScaleId } : {}),
            ...(l.lockZeroToHundred
              ? {
                  autoscaleInfoProvider: () => ({
                    priceRange: { minValue: 0, maxValue: 100 },
                    margins: { above: 8, below: 8 },
                  }),
                }
              : {}),
          },
          1
        );
        if (l.data.length) line.setData(l.data);
      });
    }

    chart.timeScale().fitContent();

    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, height, overlays, subPane, mainPaneBoard, tradeMarkers]);

  return <div ref={containerRef} className={`w-full overflow-hidden rounded-lg ${className}`} />;
}
