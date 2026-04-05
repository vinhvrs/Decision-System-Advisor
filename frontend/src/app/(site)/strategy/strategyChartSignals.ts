import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import { dayToTime } from '../indicators/IndicatorLightChart';
import type { BollingerPoint, MacdPoint, SampleBar, StochasticPoint } from '../indicators/indicatorCalculations';
import type { BoardSimPoint } from './strategyBoardSim';
import type { StrategyId } from './strategyDefinitions';

export type StrategyMarkerContext = {
  strategyId: StrategyId;
  bars: SampleBar[];
  hybridMacd: MacdPoint[];
  lsSeries: { day: number; score: number }[];
  mfiSeries: { day: number; mfi: number | null }[];
  stochSeries: StochasticPoint[];
  bbSeries: BollingerPoint[];
  boardSeries: BoardSimPoint[];
};

function timeAt(bars: SampleBar[], i: number): UTCTimestamp {
  return dayToTime(bars[i].day);
}

/** Illustrative buy/sell arrows when playbook-style rules line up (uses hybrid MACD + linked indicator). */
export function computeStrategyTradeMarkers(ctx: StrategyMarkerContext): SeriesMarker<UTCTimestamp>[] {
  const { strategyId, bars, hybridMacd, lsSeries, mfiSeries, stochSeries, bbSeries, boardSeries } = ctx;
  const markers: SeriesMarker<UTCTimestamp>[] = [];

  const macdXBelow = (i: number) => {
    const m = hybridMacd[i];
    const p = hybridMacd[i - 1];
    if (m.macd == null || m.signal == null || p.macd == null || p.signal == null) return false;
    return m.macd < m.signal && p.macd >= p.signal;
  };

  const histFlipPos = (i: number) => {
    const m = hybridMacd[i];
    const p = hybridMacd[i - 1];
    if (m.histogram == null || p.histogram == null) return false;
    return m.histogram >= 0 && p.histogram < 0;
  };

  for (let i = 1; i < bars.length; i++) {
    let buy = false;
    let sell = false;

    switch (strategyId) {
      case 'liq_break': {
        const sc = lsSeries[i]?.score;
        const psc = lsSeries[i - 1]?.score;
        if (sc == null || psc == null) break;
        buy = (sc > 80 && psc <= 80) || (sc > 75 && histFlipPos(i));
        sell =
          (macdXBelow(i) && sc > 55) ||
          (psc > 72 && sc < psc - 12);
        break;
      }
      case 'conservative': {
        const mfi = mfiSeries[i]?.mfi;
        const pmfi = mfiSeries[i - 1]?.mfi;
        const m = hybridMacd[i];
        if (mfi == null || pmfi == null || m.macd == null || m.signal == null) break;
        buy = pmfi <= 50 && mfi > 50 && mfi < 75 && m.macd > m.signal;
        sell = mfi > 80 && macdXBelow(i);
        break;
      }
      case 'scalp': {
        const k = stochSeries[i]?.k;
        const d = stochSeries[i]?.d;
        const pk = stochSeries[i - 1]?.k;
        const pd = stochSeries[i - 1]?.d;
        const m = hybridMacd[i];
        if (k == null || d == null || pk == null || pd == null || m.histogram == null) break;
        buy = pk <= pd && k > d && pk < 28 && m.histogram >= 0;
        sell = pk >= pd && k < d && pk > 72 && m.histogram < 0;
        break;
      }
      case 'mean_rev': {
        const bb = bbSeries[i];
        const fg = boardSeries[i]?.fearGreed;
        const m = hybridMacd[i];
        const p = hybridMacd[i - 1];
        const c = bars[i].c;
        if (bb.lower == null || bb.upper == null || fg == null || m.histogram == null || p.histogram == null) break;
        buy = c <= bb.lower && fg < 44 && m.histogram > p.histogram && p.histogram < 0;
        sell = c >= bb.upper && fg > 56 && macdXBelow(i);
        break;
      }
      default:
        break;
    }

    if (sell) {
      markers.push({
        time: timeAt(bars, i),
        position: 'aboveBar',
        color: '#f87171',
        shape: 'arrowDown',
      });
    } else if (buy) {
      markers.push({
        time: timeAt(bars, i),
        position: 'belowBar',
        color: '#4ade80',
        shape: 'arrowUp',
      });
    }
  }

  return markers;
}
