/** Deterministic pseudo-random for reproducible sample series */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SampleBar = {
  day: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export function generateSampleBars(
  count: number,
  seed = 42,
  opts?: { driftPerBar?: number; basePrice?: number; baseVolume?: number }
): SampleBar[] {
  const rand = mulberry32(seed);
  const drift = opts?.driftPerBar ?? 0.0008;
  const baseP = opts?.basePrice ?? 100;
  const baseV = opts?.baseVolume ?? 1_000_000;
  const bars: SampleBar[] = [];
  let c = baseP;
  for (let i = 0; i < count; i++) {
    const noise = (rand() - 0.5) * 0.028;
    const open = c;
    c = Math.max(0.01, open * (1 + drift + noise));
    const range = Math.abs(c - open) + rand() * open * 0.015;
    const h = Math.max(open, c) + range * rand();
    const l = Math.min(open, c) - range * rand();
    const v = Math.max(1, baseV * (0.4 + rand() * 1.4) * (1 + Math.abs(noise) * 8));
    bars.push({ day: i + 1, o: open, h, l, c, v });
  }
  return bars;
}

/**
 * Educational OHLCV: visible red/green candles, gentle net uptrend, no crash/sideways zones.
 * MACD formula unchanged — drift is steady enough that momentum broadly follows price.
 */
export function generateEducationalSimulationBars(
  count: number,
  seed = 42,
  opts?: { startPrice?: number; endPrice?: number; baseVolume?: number }
): SampleBar[] {
  const rand = mulberry32(seed);
  const n = Math.max(2, Math.round(count));
  const startP = opts?.startPrice ?? 100;
  const endP = opts?.endPrice ?? 132;
  const baseV = opts?.baseVolume ?? 1_200_000;
  const logRatio = Math.log(endP / startP);

  const bars: SampleBar[] = [];
  let prevClose = startP;

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const idealClose = startP * Math.exp(logRatio * t);
    const bullBias = 0.52 + t * 0.1;

    let o =
      i === 0
        ? startP
        : prevClose * (1 + (rand() - 0.5) * 0.005);

    const isGreen = rand() < bullBias;
    const bodyPct = 0.003 + rand() * 0.008;
    let c = isGreen ? o * (1 + bodyPct) : o * (1 - bodyPct);

    c = c * 0.5 + idealClose * 0.5;
    c = Math.max(c, idealClose * 0.91);
    c = Math.min(c, idealClose * 1.07);
    c = Math.max(c, prevClose * 0.991);
    c = Math.min(c, prevClose * 1.014);

    if (isGreen && c < o) {
      o = c - idealClose * 0.0035;
    }
    if (!isGreen && c >= o) {
      o = c + idealClose * 0.0035;
    }

    const minBody = idealClose * 0.0032;
    if (Math.abs(c - o) < minBody) {
      c = isGreen ? o + minBody : o - minBody;
    }

    const top = Math.max(o, c);
    const bot = Math.min(o, c);
    const h = top + idealClose * (0.0018 + rand() * 0.0045);
    const l = bot - idealClose * (0.0018 + rand() * 0.0035);

    const volPhase = (i / n) * Math.PI * 2.4;
    const v = baseV * (0.65 + 0.25 * Math.sin(volPhase) + rand() * 0.35);

    bars.push({ day: i + 1, o, h, l, c, v: Math.max(1, v) });
    prevClose = c;
  }

  return bars;
}

/** Fixed 200-bar OHLCV series for the indicators simulator (deterministic, seed 42). */
export const SIMULATION_CANDLES = 200;
export const SIMULATION_SEED = 42;
export const FIXED_SIMULATION_BARS: SampleBar[] = generateEducationalSimulationBars(
  SIMULATION_CANDLES,
  SIMULATION_SEED
);

/** Map API OHLCV rows to simulator bars (oldest first, sequential `day` index). */
export function mapInstrumentDataToSampleBars(
  rows: {
    timestamp?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
  }[]
): SampleBar[] {
  const sorted = [...(rows || [])]
    .filter((r) => Number.isFinite(Number(r.close)) && Number(r.close) > 0)
    .sort((a, b) => {
      const ta = Date.parse(String(a.timestamp ?? '')) || 0;
      const tb = Date.parse(String(b.timestamp ?? '')) || 0;
      return ta - tb;
    });

  return sorted.map((r, i) => {
    const c = Number(r.close);
    const o = Number(r.open);
    const h = Number(r.high);
    const l = Number(r.low);
    return {
      day: i + 1,
      o: Number.isFinite(o) ? o : c,
      h: Number.isFinite(h) ? h : c,
      l: Number.isFinite(l) ? l : c,
      c,
      v: Math.max(0, Number(r.volume) || 0),
    };
  });
}

export function scaleVolumes(bars: SampleBar[], multiplier: number): SampleBar[] {
  const m = Math.max(0.1, multiplier);
  return bars.map((b) => ({ ...b, v: b.v * m }));
}

/** Liquidity = price × volume; score 0–100 vs percentile of series */
export function computeLiquiditySeries(
  bars: SampleBar[],
  smoothing: number
): { day: number; liquidity: number; score: number }[] {
  const raw = bars.map((b) => b.c * b.v);
  const ema = (arr: number[], period: number) => {
    if (period <= 1) return arr;
    const k = 2 / (period + 1);
    const out: number[] = [];
    let prev = arr[0];
    for (let i = 0; i < arr.length; i++) {
      prev = i === 0 ? arr[0] : arr[i] * k + prev * (1 - k);
      out.push(prev);
    }
    return out;
  };
  const smoothed = ema(raw, Math.max(1, Math.round(smoothing)));
  const sorted = [...smoothed].sort((a, b) => a - b);
  const rankScore = (x: number) => {
    const idx = sorted.findIndex((v) => v >= x);
    const r = idx < 0 ? sorted.length - 1 : idx;
    return (r / Math.max(1, sorted.length - 1)) * 100;
  };
  return bars.map((b, i) => ({
    day: b.day,
    liquidity: raw[i],
    score: rankScore(smoothed[i]),
  }));
}

/** Log-return rolling stdev (sample vol proxy), scaled for chart */
export function computeRollingVolatility(
  bars: SampleBar[],
  window: number
): { day: number; vol: number | null }[] {
  const w = Math.max(2, Math.round(window));
  const out: { day: number; vol: number | null }[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < w) {
      out.push({ day: bars[i].day, vol: null });
      continue;
    }
    let sum = 0;
    let sumSq = 0;
    const n = w;
    for (let j = i - w + 1; j <= i; j++) {
      const prev = bars[j - 1].c;
      const cur = bars[j].c;
      const r = Math.log(cur / prev);
      sum += r;
      sumSq += r * r;
    }
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    const dailyStd = Math.sqrt(variance);
    const annualizedLike = dailyStd * Math.sqrt(252) * 100;
    out.push({ day: bars[i].day, vol: Math.round(annualizedLike * 10) / 10 });
  }
  return out;
}

/** Wilder smoothing: first value = sum(series[1..period]); then each next adds series[i] for i > period */
function wilderSequence(
  series: number[],
  period: number
): { values: number[]; barIndexStart: number } {
  const p = period;
  const n = series.length;
  if (n <= p) return { values: [], barIndexStart: p };
  let sum = 0;
  for (let i = 1; i <= p; i++) sum += series[i];
  const out: number[] = [sum];
  let prev = sum;
  for (let i = p + 1; i < n; i++) {
    prev = prev - prev / p + series[i];
    out.push(prev);
  }
  return { values: out, barIndexStart: p };
}

/** Wilder ADX (+DI, -DI, ADX) on sample OHLC */
export function computeADX(
  bars: SampleBar[],
  period: number
): { day: number; adx: number | null; plusDi: number | null; minusDi: number | null }[] {
  const p = Math.max(2, Math.round(period));
  const n = bars.length;
  const empty = () => bars.map((b) => ({ day: b.day, adx: null, plusDi: null, minusDi: null }));
  if (n < p + 3) return empty();

  const tr = new Array(n).fill(0);
  const plusDm = new Array(n).fill(0);
  const minusDm = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const h = bars[i].h;
    const l = bars[i].l;
    const c = bars[i].c;
    const hp = bars[i - 1].h;
    const lp = bars[i - 1].l;
    const cp = bars[i - 1].c;
    const up = h - hp;
    const down = lp - l;
    plusDm[i] = up > down && up > 0 ? up : 0;
    minusDm[i] = down > up && down > 0 ? down : 0;
    tr[i] = Math.max(h - l, Math.abs(h - cp), Math.abs(l - cp));
  }

  const atrSeq = wilderSequence(tr, p);
  const plusSeq = wilderSequence(plusDm, p);
  const minusSeq = wilderSequence(minusDm, p);
  const len = Math.min(atrSeq.values.length, plusSeq.values.length, minusSeq.values.length);

  const diPlus: (number | null)[] = bars.map(() => null);
  const diMinus: (number | null)[] = bars.map(() => null);
  const dx: number[] = [];

  for (let k = 0; k < len; k++) {
    const i = atrSeq.barIndexStart + k;
    if (i >= n) break;
    const atr = atrSeq.values[k];
    const pD = plusSeq.values[k];
    const mD = minusSeq.values[k];
    if (atr <= 0) {
      dx.push(0);
      continue;
    }
    const dpi = (100 * pD) / atr;
    const dmi = (100 * mD) / atr;
    diPlus[i] = Math.round(dpi * 10) / 10;
    diMinus[i] = Math.round(dmi * 10) / 10;
    const denom = dpi + dmi;
    dx.push(denom === 0 ? 0 : (100 * Math.abs(dpi - dmi)) / denom);
  }

  const adxOut: (number | null)[] = bars.map(() => null);
  if (dx.length >= p) {
    let adxPrev = 0;
    for (let j = 0; j < p; j++) adxPrev += dx[j];
    adxPrev /= p;
    const firstAdxBar = atrSeq.barIndexStart + (p - 1);
    if (firstAdxBar < n) {
      adxOut[firstAdxBar] = Math.round(adxPrev * 10) / 10;
      for (let j = p; j < dx.length; j++) {
        const barIdx = atrSeq.barIndexStart + j;
        if (barIdx >= n) break;
        adxPrev = (adxPrev * (p - 1) + dx[j]) / p;
        adxOut[barIdx] = Math.round(adxPrev * 10) / 10;
      }
    }
  }

  return bars.map((b, i) => ({
    day: b.day,
    adx: adxOut[i],
    plusDi: diPlus[i],
    minusDi: diMinus[i],
  }));
}

/** Classic Money Flow Index */
export function computeMFI(
  bars: SampleBar[],
  period: number
): { day: number; mfi: number | null }[] {
  const p = Math.max(2, Math.round(period));
  const tp = bars.map((b) => (b.h + b.l + b.c) / 3);
  const raw = bars.map((b, i) => tp[i] * b.v);

  const out: { day: number; mfi: number | null }[] = bars.map((b) => ({ day: b.day, mfi: null }));

  for (let i = p; i < bars.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - p + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) pos += raw[j];
      else if (tp[j] < tp[j - 1]) neg += raw[j];
    }
    if (neg === 0) out[i] = { day: bars[i].day, mfi: 100 };
    else {
      const ratio = pos / neg;
      const mfi = 100 - 100 / (1 + ratio);
      out[i] = { day: bars[i].day, mfi: Math.round(mfi * 10) / 10 };
    }
  }
  return out;
}

/** EMA on close; first value at index period−1 uses SMA(period) seed */
function emaClose(closes: number[], period: number): (number | null)[] {
  const p = Math.max(1, Math.round(period));
  const k = 2 / (p + 1);
  const out: (number | null)[] = closes.map(() => null);
  if (closes.length < p) return out;
  let sum = 0;
  for (let i = 0; i < p; i++) sum += closes[i];
  let ema = sum / p;
  out[p - 1] = ema;
  for (let i = p; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/** SMA on close */
export function computeSMASeries(
  bars: SampleBar[],
  period: number
): { day: number; close: number; sma: number | null }[] {
  const p = Math.max(1, Math.round(period));
  const c = bars.map((b) => b.c);
  return bars.map((b, i) => {
    if (i < p - 1) return { day: b.day, close: b.c, sma: null };
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += c[j];
    return { day: b.day, close: b.c, sma: Math.round((s / p) * 1000) / 1000 };
  });
}

/** EMA on close (SMA seed) */
export function computeEMASeries(
  bars: SampleBar[],
  period: number
): { day: number; close: number; ema: number | null }[] {
  const c = bars.map((b) => b.c);
  const e = emaClose(c, period);
  return bars.map((b, i) => ({
    day: b.day,
    close: b.c,
    ema: e[i] != null ? Math.round(e[i]! * 1000) / 1000 : null,
  }));
}

/** RSI (Wilder smoothing) on close */
export function computeRSISeries(
  bars: SampleBar[],
  period: number
): { day: number; rsi: number | null }[] {
  const n = Math.max(2, Math.round(period));
  const c = bars.map((b) => b.c);
  const out: (number | null)[] = c.map(() => null);
  if (c.length < n + 1) return bars.map((b) => ({ day: b.day, rsi: null }));

  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    gains.push(Math.max(d, 0));
    losses.push(Math.max(-d, 0));
  }

  let avgG = 0;
  let avgL = 0;
  for (let i = 1; i <= n; i++) {
    avgG += gains[i];
    avgL += losses[i];
  }
  avgG /= n;
  avgL /= n;

  const rs0 = avgL === 0 ? Infinity : avgG / avgL;
  out[n] = Math.round((100 - 100 / (1 + rs0)) * 10) / 10;

  for (let i = n + 1; i < c.length; i++) {
    avgG = (avgG * (n - 1) + gains[i]) / n;
    avgL = (avgL * (n - 1) + losses[i]) / n;
    const RS = avgL === 0 ? Infinity : avgG / avgL;
    out[i] = Math.round((100 - 100 / (1 + RS)) * 10) / 10;
  }

  return bars.map((b, i) => ({ day: b.day, rsi: out[i] }));
}

export type MacdPoint = {
  day: number;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
};

/** MACD = EMA(fast) − EMA(slow); signal = EMA(macd, signalPeriod); hist = macd − signal */
export function computeMACDSeries(
  bars: SampleBar[],
  fast: number,
  slow: number,
  signalP: number
): MacdPoint[] {
  const f = Math.max(1, Math.round(fast));
  const s = Math.max(1, Math.round(slow));
  const sig = Math.max(1, Math.round(signalP));
  const c = bars.map((b) => b.c);
  const emaF = emaClose(c, f);
  const emaS = emaClose(c, s);
  const macdRaw: (number | null)[] = c.map((_, i) =>
    emaF[i] != null && emaS[i] != null ? emaF[i]! - emaS[i]! : null
  );

  const macdCompact: number[] = [];
  const macdBarIdx: number[] = [];
  for (let i = 0; i < macdRaw.length; i++) {
    if (macdRaw[i] != null) {
      macdCompact.push(macdRaw[i]!);
      macdBarIdx.push(i);
    }
  }

  const signalAtBar: (number | null)[] = bars.map(() => null);
  if (macdCompact.length >= sig) {
    const sigEma = emaClose(macdCompact, sig);
    for (let j = sig - 1; j < macdCompact.length; j++) {
      const bi = macdBarIdx[j];
      if (sigEma[j] != null) signalAtBar[bi] = sigEma[j];
    }
  }

  return bars.map((b, i) => {
    const m = macdRaw[i];
    const sLine = signalAtBar[i];
    if (m == null || sLine == null) return { day: b.day, macd: null, signal: null, histogram: null };
    const h = m - sLine;
    return {
      day: b.day,
      macd: Math.round(m * 1000) / 1000,
      signal: Math.round(sLine * 1000) / 1000,
      histogram: Math.round(h * 1000) / 1000,
    };
  });
}

/**
 * Hybrid MACD: line = SMA(close, fast) − EMA(close, slow) — “fast SMA vs slow EMA” spread;
 * signal = EMA(macdLine, signalPeriod); histogram = line − signal.
 */
export function computeMACDFastSmaMinusSlowEma(
  bars: SampleBar[],
  fastSmaPeriod: number,
  slowEmaPeriod: number,
  signalPeriod: number
): MacdPoint[] {
  const f = Math.max(2, Math.round(fastSmaPeriod));
  const s = Math.max(2, Math.round(slowEmaPeriod));
  const sig = Math.max(1, Math.round(signalPeriod));
  const smaRows = computeSMASeries(bars, f);
  const emaRows = computeEMASeries(bars, s);
  const macdRaw: (number | null)[] = bars.map((_, i) => {
    const sm = smaRows[i].sma;
    const em = emaRows[i].ema;
    if (sm == null || em == null) return null;
    return sm - em;
  });

  const macdCompact: number[] = [];
  const macdBarIdx: number[] = [];
  for (let i = 0; i < macdRaw.length; i++) {
    if (macdRaw[i] != null) {
      macdCompact.push(macdRaw[i]!);
      macdBarIdx.push(i);
    }
  }

  const signalAtBar: (number | null)[] = bars.map(() => null);
  if (macdCompact.length >= sig) {
    const sigEma = emaClose(macdCompact, sig);
    for (let j = sig - 1; j < macdCompact.length; j++) {
      const bi = macdBarIdx[j];
      if (sigEma[j] != null) signalAtBar[bi] = sigEma[j];
    }
  }

  return bars.map((b, i) => {
    const m = macdRaw[i];
    const sLine = signalAtBar[i];
    if (m == null || sLine == null) return { day: b.day, macd: null, signal: null, histogram: null };
    const h = m - sLine;
    return {
      day: b.day,
      macd: Math.round(m * 1000) / 1000,
      signal: Math.round(sLine * 1000) / 1000,
      histogram: Math.round(h * 1000) / 1000,
    };
  });
}

export type BollingerPoint = {
  day: number;
  close: number;
  mid: number | null;
  upper: number | null;
  lower: number | null;
};

/** Bollinger: mid = SMA(n); bands = mid ± k·σ (population σ over window) */
export function computeBollingerSeries(
  bars: SampleBar[],
  period: number,
  kMult: number
): BollingerPoint[] {
  const p = Math.max(2, Math.round(period));
  const k = Math.max(0.1, kMult);
  const c = bars.map((b) => b.c);
  return bars.map((b, i) => {
    if (i < p - 1) return { day: b.day, close: b.c, mid: null, upper: null, lower: null };
    let sum = 0;
    for (let j = i - p + 1; j <= i; j++) sum += c[j];
    const mid = sum / p;
    let v = 0;
    for (let j = i - p + 1; j <= i; j++) {
      const d = c[j] - mid;
      v += d * d;
    }
    const sigma = Math.sqrt(v / p);
    const upper = mid + k * sigma;
    const lower = mid - k * sigma;
    return {
      day: b.day,
      close: b.c,
      mid: Math.round(mid * 1000) / 1000,
      upper: Math.round(upper * 1000) / 1000,
      lower: Math.round(lower * 1000) / 1000,
    };
  });
}

export type StochasticPoint = { day: number; k: number | null; d: number | null };

/** Fast Stochastic: %K from high/low range over kP; %D = SMA(%K, dP) */
export function computeStochasticSeries(
  bars: SampleBar[],
  kPeriod: number,
  dPeriod: number
): StochasticPoint[] {
  const kP = Math.max(2, Math.round(kPeriod));
  const dP = Math.max(1, Math.round(dPeriod));
  const kRaw: (number | null)[] = bars.map(() => null);

  for (let i = kP - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kP + 1; j <= i; j++) {
      hh = Math.max(hh, bars[j].h);
      ll = Math.min(ll, bars[j].l);
    }
    const r = hh - ll;
    kRaw[i] = r <= 0 ? 50 : (100 * (bars[i].c - ll)) / r;
  }

  const dOut: (number | null)[] = bars.map(() => null);
  for (let i = kP - 1 + dP - 1; i < bars.length; i++) {
    let s = 0;
    let cnt = 0;
    for (let j = i - dP + 1; j <= i; j++) {
      if (kRaw[j] != null) {
        s += kRaw[j]!;
        cnt++;
      }
    }
    if (cnt === dP) dOut[i] = s / dP;
  }

  return bars.map((b, i) => ({
    day: b.day,
    k: kRaw[i] != null ? Math.round(kRaw[i]! * 10) / 10 : null,
    d: dOut[i] != null ? Math.round(dOut[i]! * 10) / 10 : null,
  }));
}
