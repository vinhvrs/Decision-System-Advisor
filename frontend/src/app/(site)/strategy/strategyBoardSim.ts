import type { SampleBar } from '../indicators/indicatorCalculations';

export type BoardSimPoint = {
  day: number;
  /** Same shape as beginner hover strip: round(clamp(50 + 3.25 × r, 0, 100)), r = close-to-close % */
  fearGreed: number;
  /** Maps beginner radar axes to 0–100 for the lower pane */
  reputation: number;
  pricePeriod: number;
  candleChange: number;
  volume: number;
  liquidity: number;
  peopleCare: number;
};

function clamp100(x: number): number {
  return Math.max(0, Math.min(100, x));
}

function rankPercentile(values: number[], x: number): number {
  if (!values.length) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  let le = 0;
  for (const v of sorted) {
    if (v <= x) le++;
  }
  return Math.round((le / sorted.length) * 100);
}

/**
 * Synthetic “beginner board” style series on the fixed simulator candles (not live API).
 * Feeds the strategy chart’s “6 attributes + F&G” pane.
 */
export function computeBoardSimSeries(bars: SampleBar[]): BoardSimPoint[] {
  const n = bars.length;
  const out: BoardSimPoint[] = [];
  const win = 20;
  let prevClose = bars[0]?.c ?? 1;

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const dayRetPct = i === 0 ? 0 : ((b.c - prevClose) / prevClose) * 100;
    prevClose = b.c;
    const fearGreed = clamp100(Math.round(50 + 3.25 * dayRetPct));

    const from = Math.max(0, i - win + 1);
    const slice = bars.slice(from, i + 1);
    const vols = slice.map((x) => x.v);
    const liqs = slice.map((x) => x.c * x.v);
    const volume = rankPercentile(vols, b.v);
    const liquidity = rankPercentile(liqs, b.c * b.v);

    const bodyPct = b.o !== 0 ? (Math.abs(b.c - b.o) / b.o) * 100 : 0;
    const candleChange = clamp100(45 + bodyPct * 3);

    const p = Math.min(i + 1, 10);
    const sm = slice.reduce((s, x) => s + x.c, 0) / p;
    const pricePeriod = clamp100(50 + ((b.c - sm) / (sm || 1)) * 180);

    const w15 = bars.slice(Math.max(0, i - 14), i + 1);
    const greens = w15.filter((x) => x.c >= x.o).length / w15.length;
    const reputation = Math.round(greens * 100);

    const peopleCare = clamp100(volume * 0.65 + (b.c >= b.o ? 18 : 8));

    out.push({
      day: b.day,
      fearGreed,
      reputation,
      pricePeriod,
      candleChange,
      volume,
      liquidity,
      peopleCare: Math.round(peopleCare),
    });
  }
  return out;
}
