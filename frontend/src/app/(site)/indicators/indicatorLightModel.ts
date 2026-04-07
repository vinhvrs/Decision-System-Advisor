import type { UTCTimestamp } from 'lightweight-charts';
import { dayToTime, type OverlayLineSpec, type SubPaneSpec } from './IndicatorLightChart';
import type { SimulatorIndicatorId } from './indicatorTypes';
import type { BollingerPoint, MacdPoint } from './indicatorCalculations';

export function pointsFrom<R>(
  rows: R[],
  getDay: (r: R) => number,
  getVal: (r: R) => number | null | undefined
): { time: UTCTimestamp; value: number }[] {
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (const r of rows) {
    const v = getVal(r);
    if (v != null && Number.isFinite(v)) out.push({ time: dayToTime(getDay(r)), value: v });
  }
  return out;
}

export type IndicatorSeriesBundle = {
  lsSeries: { day: number; liquidity: number; score: number }[];
  volSeries: { day: number; vol: number | null }[];
  adxSeries: { day: number; adx: number | null; plusDi: number | null; minusDi: number | null }[];
  mfiSeries: { day: number; mfi: number | null }[];
  smaSeries: { day: number; sma: number | null; close: number }[];
  emaSeries: { day: number; ema: number | null; close: number }[];
  rsiSeries: { day: number; rsi: number | null }[];
  macdSeries: MacdPoint[];
  bbSeries: BollingerPoint[];
  stochSeries: { day: number; k: number | null; d: number | null }[];
};

export function buildIndicatorLightModel(
  indicatorId: SimulatorIndicatorId,
  b: IndicatorSeriesBundle
): { overlays: OverlayLineSpec[]; subPane: SubPaneSpec | null } {
  switch (indicatorId) {
    case 'ls':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              color: '#facc15',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.lsSeries, (r) => r.day, (r) => r.score),
            },
            {
              color: '#6366f1',
              lineWidth: 1,
              priceScaleId: 'ls-liq',
              data: pointsFrom(b.lsSeries, (r) => r.day, (r) => r.liquidity),
            },
          ],
        },
      };
    case 'vol':
      return {
        overlays: [],
        subPane: {
          lines: [
            { color: '#38bdf8', lineWidth: 2, data: pointsFrom(b.volSeries, (r) => r.day, (r) => r.vol) },
          ],
        },
      };
    case 'adx':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              color: '#4ade80',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.adxSeries, (r) => r.day, (r) => r.adx),
            },
            { color: '#22d3ee', lineWidth: 1, data: pointsFrom(b.adxSeries, (r) => r.day, (r) => r.plusDi) },
            { color: '#f472b6', lineWidth: 1, data: pointsFrom(b.adxSeries, (r) => r.day, (r) => r.minusDi) },
          ],
        },
      };
    case 'mfi':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              color: '#a78bfa',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.mfiSeries, (r) => r.day, (r) => r.mfi),
            },
          ],
        },
      };
    case 'sma':
      return {
        overlays: [{ color: '#facc15', lineWidth: 2, data: pointsFrom(b.smaSeries, (r) => r.day, (r) => r.sma) }],
        subPane: null,
      };
    case 'ema':
      return {
        overlays: [{ color: '#22d3ee', lineWidth: 2, data: pointsFrom(b.emaSeries, (r) => r.day, (r) => r.ema) }],
        subPane: null,
      };
    case 'rsi':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              color: '#fb923c',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.rsiSeries, (r) => r.day, (r) => r.rsi),
            },
          ],
        },
      };
    case 'macd': {
      const hist = b.macdSeries
        .filter((d) => d.histogram != null && Number.isFinite(d.histogram))
        .map((d) => ({
          time: dayToTime(d.day),
          value: d.histogram!,
          color: d.histogram! >= 0 ? 'rgba(99,102,241,0.8)' : 'rgba(244,114,182,0.8)',
        }));
      return {
        overlays: [],
        subPane: {
          histogram: hist,
          lines: [
            { color: '#38bdf8', lineWidth: 2, data: pointsFrom(b.macdSeries, (r) => r.day, (r) => r.macd) },
            { color: '#f472b6', lineWidth: 2, data: pointsFrom(b.macdSeries, (r) => r.day, (r) => r.signal) },
          ],
        },
      };
    }
    case 'bb':
      return {
        overlays: [
          { color: '#94a3b8', lineWidth: 1, data: pointsFrom(b.bbSeries, (r) => r.day, (r) => r.upper) },
          { color: '#facc15', lineWidth: 2, data: pointsFrom(b.bbSeries, (r) => r.day, (r) => r.mid) },
          { color: '#94a3b8', lineWidth: 1, data: pointsFrom(b.bbSeries, (r) => r.day, (r) => r.lower) },
        ],
        subPane: null,
      };
    case 'stoch':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              color: '#a78bfa',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.stochSeries, (r) => r.day, (r) => r.k),
            },
            { color: '#22d3ee', lineWidth: 2, data: pointsFrom(b.stochSeries, (r) => r.day, (r) => r.d) },
          ],
        },
      };
    default:
      return { overlays: [], subPane: null };
  }
}
