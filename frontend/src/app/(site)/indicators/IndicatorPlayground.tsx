'use client';

import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { IndicatorLightChart } from './IndicatorLightChart';
import { buildIndicatorLightModel } from './indicatorLightModel';
import { cardIdToSimulator, type SimulatorIndicatorId } from './indicatorTypes';
import {
  computeADX,
  computeBollingerSeries,
  computeEMASeries,
  computeLiquiditySeries,
  computeMACDSeries,
  computeMFI,
  computeRSISeries,
  computeRollingVolatility,
  computeSMASeries,
  computeStochasticSeries,
  FIXED_SIMULATION_BARS,
  scaleVolumes,
  SIMULATION_CANDLES,
  type SampleBar,
} from './indicatorCalculations';

export type { SimulatorIndicatorId } from './indicatorTypes';
export { cardIdToSimulator } from './indicatorTypes';

type Props = {
  indicatorId: SimulatorIndicatorId;
  onIndicatorChange: (id: SimulatorIndicatorId) => void;
  onClose?: () => void;
};

const INDICATOR_OPTIONS: { id: SimulatorIndicatorId; label: string }[] = [
  { id: 'ls', label: 'Liquidity Score (LS)' },
  { id: 'vol', label: 'Volatility proxy (rolling vol)' },
  { id: 'adx', label: 'Trend strength (ADX)' },
  { id: 'mfi', label: 'Money Flow Index (MFI)' },
  { id: 'sma', label: 'SMA (close)' },
  { id: 'ema', label: 'EMA (close)' },
  { id: 'rsi', label: 'RSI' },
  { id: 'macd', label: 'MACD' },
  { id: 'bb', label: 'Bollinger Bands' },
  { id: 'stoch', label: 'Stochastic (%K / %D)' },
];

const SUBTITLES: Record<SimulatorIndicatorId, string> = {
  ls: 'Liquidity Score — sample playground',
  vol: 'Volatility proxy — sample rolling volatility',
  adx: 'Trend strength — sample ADX',
  mfi: 'Money Flow Index — sample MFI',
  sma: 'Simple moving average on close',
  ema: 'Exponential moving average on close',
  rsi: 'Relative Strength Index (Wilder)',
  macd: 'MACD line, signal, histogram',
  bb: 'Middle band (SMA) ± k·σ',
  stoch: 'Fast stochastic oscillator',
};

export function IndicatorPlayground({ indicatorId, onIndicatorChange, onClose }: Props) {
  const [volMult, setVolMult] = React.useState(1);
  const [lsSmooth, setLsSmooth] = React.useState(8);
  const [volWindow, setVolWindow] = React.useState(14);
  const [adxPeriod, setAdxPeriod] = React.useState(14);
  const [mfiPeriod, setMfiPeriod] = React.useState(14);

  const [smaPeriod, setSmaPeriod] = React.useState(20);
  const [emaPeriod, setEmaPeriod] = React.useState(20);
  const [rsiPeriod, setRsiPeriod] = React.useState(14);
  const [macdFast, setMacdFast] = React.useState(12);
  const [macdSlow, setMacdSlow] = React.useState(26);
  const [macdSignal, setMacdSignal] = React.useState(9);
  const [bbPeriod, setBbPeriod] = React.useState(20);
  const [bbK, setBbK] = React.useState(2);
  const [stochK, setStochK] = React.useState(14);
  const [stochD, setStochD] = React.useState(3);

  const bars: SampleBar[] = useMemo(() => {
    if (indicatorId === 'ls') return scaleVolumes(FIXED_SIMULATION_BARS, volMult);
    return FIXED_SIMULATION_BARS;
  }, [indicatorId, volMult]);

  const lsSeries = useMemo(
    () => (indicatorId === 'ls' ? computeLiquiditySeries(bars, lsSmooth) : []),
    [bars, indicatorId, lsSmooth]
  );
  const volSeries = useMemo(
    () => (indicatorId === 'vol' ? computeRollingVolatility(bars, volWindow) : []),
    [bars, indicatorId, volWindow]
  );
  const adxSeries = useMemo(
    () => (indicatorId === 'adx' ? computeADX(bars, adxPeriod) : []),
    [bars, indicatorId, adxPeriod]
  );
  const mfiSeries = useMemo(
    () => (indicatorId === 'mfi' ? computeMFI(bars, mfiPeriod) : []),
    [bars, indicatorId, mfiPeriod]
  );
  const smaSeries = useMemo(
    () => (indicatorId === 'sma' ? computeSMASeries(bars, smaPeriod) : []),
    [bars, indicatorId, smaPeriod]
  );
  const emaSeries = useMemo(
    () => (indicatorId === 'ema' ? computeEMASeries(bars, emaPeriod) : []),
    [bars, indicatorId, emaPeriod]
  );
  const rsiSeries = useMemo(
    () => (indicatorId === 'rsi' ? computeRSISeries(bars, rsiPeriod) : []),
    [bars, indicatorId, rsiPeriod]
  );
  const macdSeries = useMemo(
    () => (indicatorId === 'macd' ? computeMACDSeries(bars, macdFast, macdSlow, macdSignal) : []),
    [bars, indicatorId, macdFast, macdSlow, macdSignal]
  );
  const bbSeries = useMemo(
    () => (indicatorId === 'bb' ? computeBollingerSeries(bars, bbPeriod, bbK) : []),
    [bars, indicatorId, bbPeriod, bbK]
  );
  const stochSeries = useMemo(
    () => (indicatorId === 'stoch' ? computeStochasticSeries(bars, stochK, stochD) : []),
    [bars, indicatorId, stochK, stochD]
  );

  const lightModel = useMemo(
    () =>
      buildIndicatorLightModel(indicatorId, {
        lsSeries,
        volSeries,
        adxSeries,
        mfiSeries,
        smaSeries,
        emaSeries,
        rsiSeries,
        macdSeries,
        bbSeries,
        stochSeries,
      }),
    [
      indicatorId,
      lsSeries,
      volSeries,
      adxSeries,
      mfiSeries,
      smaSeries,
      emaSeries,
      rsiSeries,
      macdSeries,
      bbSeries,
      stochSeries,
    ]
  );

  const lastPlaygroundValue = useMemo(() => {
    const pick = (label: string, value: string) => ({ label, value });
    if (indicatorId === 'ls' && lsSeries.length) {
      const s = lsSeries[lsSeries.length - 1];
      return pick('Score', s.score.toFixed(1));
    }
    if (indicatorId === 'vol' && volSeries.length) {
      for (let i = volSeries.length - 1; i >= 0; i--) {
        const v = volSeries[i].vol;
        if (v != null) return pick('Vol (ann. %)', String(v));
      }
    }
    if (indicatorId === 'adx' && adxSeries.length) {
      for (let i = adxSeries.length - 1; i >= 0; i--) {
        const a = adxSeries[i].adx;
        if (a != null) return pick('ADX', String(a));
      }
    }
    if (indicatorId === 'mfi' && mfiSeries.length) {
      for (let i = mfiSeries.length - 1; i >= 0; i--) {
        const m = mfiSeries[i].mfi;
        if (m != null) return pick('MFI', String(m));
      }
    }
    if (indicatorId === 'sma' && smaSeries.length) {
      for (let i = smaSeries.length - 1; i >= 0; i--) {
        const x = smaSeries[i].sma;
        if (x != null) return pick('SMA', String(x));
      }
    }
    if (indicatorId === 'ema' && emaSeries.length) {
      for (let i = emaSeries.length - 1; i >= 0; i--) {
        const x = emaSeries[i].ema;
        if (x != null) return pick('EMA', String(x));
      }
    }
    if (indicatorId === 'rsi' && rsiSeries.length) {
      for (let i = rsiSeries.length - 1; i >= 0; i--) {
        const x = rsiSeries[i].rsi;
        if (x != null) return pick('RSI', String(x));
      }
    }
    if (indicatorId === 'macd' && macdSeries.length) {
      for (let i = macdSeries.length - 1; i >= 0; i--) {
        const row = macdSeries[i];
        if (row.macd != null)
          return pick('MACD / Sig / Hist', `${row.macd} / ${row.signal ?? '—'} / ${row.histogram ?? '—'}`);
      }
    }
    if (indicatorId === 'bb' && bbSeries.length) {
      for (let i = bbSeries.length - 1; i >= 0; i--) {
        const row = bbSeries[i];
        if (row.mid != null) return pick('Close / Mid', `${row.close} / ${row.mid}`);
      }
    }
    if (indicatorId === 'stoch' && stochSeries.length) {
      for (let i = stochSeries.length - 1; i >= 0; i--) {
        const row = stochSeries[i];
        if (row.k != null) return pick('%K / %D', `${row.k} / ${row.d ?? '—'}`);
      }
    }
    return null;
  }, [
    indicatorId,
    lsSeries,
    volSeries,
    adxSeries,
    mfiSeries,
    smaSeries,
    emaSeries,
    rsiSeries,
    macdSeries,
    bbSeries,
    stochSeries,
  ]);

  return (
    <div
      id="indicator-sim"
      className="mt-10 scroll-mt-24 rounded-2xl border border-indigo-500/20 bg-[#12151c] p-6 shadow-lg shadow-indigo-950/20"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-white">Indicator simulation</h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            Fixed <strong className="text-gray-400">{SIMULATION_CANDLES}</strong> synthetic candles (same OHLCV every
            session). Choose an indicator and adjust parameters — not live market data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:gap-2">
            <span className="whitespace-nowrap font-medium text-gray-500">Indicator</span>
            <select
              value={indicatorId}
              onChange={(e) => onIndicatorChange(e.target.value as SimulatorIndicatorId)}
              className="min-w-[200px] max-w-[min(100vw-3rem,320px)] rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {INDICATOR_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-700 p-2 text-gray-400 hover:border-red-500/40 hover:text-red-300"
              aria-label="Close simulator"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-600">{SUBTITLES[indicatorId]}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,260px)_1fr]">
        <div className="space-y-4 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Parameters</p>

          {indicatorId === 'ls' && (
            <>
              <Slider label="Volume scale" min={0.3} max={2.5} step={0.05} value={volMult} onChange={setVolMult} fmt={(v) => `${v.toFixed(2)}×`} />
              <Slider label="Score smoothing (EMA period)" min={1} max={24} step={1} value={lsSmooth} onChange={setLsSmooth} fmt={String} />
            </>
          )}
          {indicatorId === 'vol' && (
            <Slider label="Rolling window (bars)" min={5} max={40} step={1} value={volWindow} onChange={setVolWindow} fmt={String} />
          )}
          {indicatorId === 'adx' && (
            <Slider label="ADX period" min={5} max={28} step={1} value={adxPeriod} onChange={setAdxPeriod} fmt={String} />
          )}
          {indicatorId === 'mfi' && (
            <Slider label="MFI period" min={5} max={28} step={1} value={mfiPeriod} onChange={setMfiPeriod} fmt={String} />
          )}
          {indicatorId === 'sma' && (
            <Slider label="SMA period" min={2} max={60} step={1} value={smaPeriod} onChange={setSmaPeriod} fmt={String} />
          )}
          {indicatorId === 'ema' && (
            <Slider label="EMA period" min={2} max={60} step={1} value={emaPeriod} onChange={setEmaPeriod} fmt={String} />
          )}
          {indicatorId === 'rsi' && (
            <Slider label="RSI period" min={2} max={28} step={1} value={rsiPeriod} onChange={setRsiPeriod} fmt={String} />
          )}
          {indicatorId === 'macd' && (
            <>
              <Slider label="Fast EMA" min={2} max={20} step={1} value={macdFast} onChange={setMacdFast} fmt={String} />
              <Slider label="Slow EMA" min={5} max={40} step={1} value={macdSlow} onChange={setMacdSlow} fmt={String} />
              <Slider label="Signal EMA" min={2} max={20} step={1} value={macdSignal} onChange={setMacdSignal} fmt={String} />
            </>
          )}
          {indicatorId === 'bb' && (
            <>
              <Slider label="SMA / σ window" min={5} max={50} step={1} value={bbPeriod} onChange={setBbPeriod} fmt={String} />
              <Slider label="Std dev multiplier k" min={0.5} max={3.5} step={0.1} value={bbK} onChange={setBbK} fmt={(v) => v.toFixed(1)} />
            </>
          )}
          {indicatorId === 'stoch' && (
            <>
              <Slider label="%K lookback" min={3} max={28} step={1} value={stochK} onChange={setStochK} fmt={String} />
              <Slider label="%D smoothing" min={1} max={10} step={1} value={stochD} onChange={setStochD} fmt={String} />
            </>
          )}

          {lastPlaygroundValue && (
            <div className="border-t border-gray-800 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Last candle</p>
              <p className="mt-1 break-words font-mono text-lg font-bold text-indigo-300 sm:text-xl">
                {lastPlaygroundValue.value}
                <span className="ml-2 block text-xs font-normal text-gray-500 sm:inline">
                  {lastPlaygroundValue.label}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
          <div className="mt-1 h-[360px] w-full">
            <IndicatorLightChart
              height={360}
              bars={bars}
              overlays={lightModel.overlays}
              subPane={lightModel.subPane}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <label className="block text-xs text-gray-400">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-indigo-500"
      />
      <span className="font-mono text-white">{fmt(value)}</span>
    </label>
  );
}
