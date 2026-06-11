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
  macdFastEmaSeries: { day: number; ema: number | null; close: number }[];
  macdSlowEmaSeries: { day: number; ema: number | null; close: number }[];
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
              id: 'ls-score',
              label: 'Score',
              color: '#facc15',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.lsSeries, (r) => r.day, (r) => r.score),
            },
            {
              id: 'ls-liquidity',
              label: 'Liquidity',
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
            {
              id: 'vol-rolling',
              label: 'Rolling vol',
              color: '#38bdf8',
              lineWidth: 2,
              data: pointsFrom(b.volSeries, (r) => r.day, (r) => r.vol),
            },
          ],
        },
      };
    case 'adx':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              id: 'adx-main',
              label: 'ADX',
              color: '#4ade80',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.adxSeries, (r) => r.day, (r) => r.adx),
            },
            {
              id: 'adx-plus-di',
              label: '+DI',
              color: '#22d3ee',
              lineWidth: 1,
              data: pointsFrom(b.adxSeries, (r) => r.day, (r) => r.plusDi),
            },
            {
              id: 'adx-minus-di',
              label: '-DI',
              color: '#f472b6',
              lineWidth: 1,
              data: pointsFrom(b.adxSeries, (r) => r.day, (r) => r.minusDi),
            },
          ],
        },
      };
    case 'mfi':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              id: 'mfi-main',
              label: 'MFI',
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
        overlays: [
          {
            id: 'sma-main',
            label: 'SMA',
            color: '#facc15',
            lineWidth: 2,
            data: pointsFrom(b.smaSeries, (r) => r.day, (r) => r.sma),
          },
        ],
        subPane: null,
      };
    case 'ema':
      return {
        overlays: [
          {
            id: 'ema-main',
            label: 'EMA',
            color: '#22d3ee',
            lineWidth: 2,
            data: pointsFrom(b.emaSeries, (r) => r.day, (r) => r.ema),
          },
        ],
        subPane: null,
      };
    case 'rsi':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              id: 'rsi-main',
              label: 'RSI',
              color: '#fb923c',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.rsiSeries, (r) => r.day, (r) => r.rsi),
            },
          ],
        },
      };
    case 'macd': {
      return {
        overlays: [
          {
            id: 'macd-fast-ema',
            label: 'Fast EMA',
            color: '#38bdf8',
            lineWidth: 2,
            data: pointsFrom(b.macdFastEmaSeries, (r) => r.day, (r) => r.ema),
          },
          {
            id: 'macd-slow-ema',
            label: 'Slow EMA',
            color: '#f472b6',
            lineWidth: 2,
            data: pointsFrom(b.macdSlowEmaSeries, (r) => r.day, (r) => r.ema),
          },
        ],
        subPane: null,
      };
    }
    case 'bb':
      return {
        overlays: [
          {
            id: 'bb-upper',
            label: 'Upper band',
            color: '#cbd5e1',
            lineWidth: 1,
            data: pointsFrom(b.bbSeries, (r) => r.day, (r) => r.upper),
          },
          {
            id: 'bb-mid',
            label: 'Middle band',
            color: '#facc15',
            lineWidth: 2,
            data: pointsFrom(b.bbSeries, (r) => r.day, (r) => r.mid),
          },
          {
            id: 'bb-lower',
            label: 'Lower band',
            color: '#64748b',
            lineWidth: 1,
            data: pointsFrom(b.bbSeries, (r) => r.day, (r) => r.lower),
          },
        ],
        subPane: null,
      };
    case 'stoch':
      return {
        overlays: [],
        subPane: {
          lines: [
            {
              id: 'stoch-k',
              label: '%K',
              color: '#a78bfa',
              lineWidth: 2,
              lockZeroToHundred: true,
              data: pointsFrom(b.stochSeries, (r) => r.day, (r) => r.k),
            },
            {
              id: 'stoch-d',
              label: '%D',
              color: '#22d3ee',
              lineWidth: 2,
              data: pointsFrom(b.stochSeries, (r) => r.day, (r) => r.d),
            },
          ],
        },
      };
    default:
      return { overlays: [], subPane: null };
  }
}
