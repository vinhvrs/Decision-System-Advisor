'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { IndicatorLightChart } from './IndicatorLightChart';
import { INDICATOR_DEFAULTS } from './indicatorDefaults';
import { buildIndicatorLightModel } from './indicatorLightModel';
import type { SimulatorIndicatorId } from './indicatorTypes';
import { InstrumentService } from '@/src/services/Instrument.service';
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
  mapInstrumentDataToSampleBars,
  scaleVolumes,
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

const MARKET_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META', 'AMZN', 'TSLA', 'AMD', 'IBM', 'ORCL'] as const;

const PERIOD_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
] as const;

type MarketPeriod = (typeof PERIOD_OPTIONS)[number]['id'];

const FETCH_LIMIT = 400;
const DISPLAY_MAX_BARS = 200;

type LineToggleConfig = {
  id: string;
  label: string;
  color: string;
};

const SUBTITLES: Record<SimulatorIndicatorId, string> = {
  ls: 'Liquidity Score — real OHLCV',
  vol: 'Volatility proxy — rolling vol on real closes',
  adx: 'Trend strength (ADX)',
  mfi: 'Money Flow Index (MFI)',
  sma: 'Simple moving average on close',
  ema: 'Exponential moving average on close',
  rsi: 'Relative Strength Index (Wilder)',
  macd: 'MACD basis — fast / slow EMA overlays on candles',
  bb: 'Middle band (SMA) ± k·σ',
  stoch: 'Fast stochastic oscillator',
};

export function IndicatorPlayground({ indicatorId, onIndicatorChange, onClose }: Props) {
  const [symbol, setSymbol] = useState<string>('AAPL');
  const [period, setPeriod] = useState<MarketPeriod>('daily');
  const [marketBars, setMarketBars] = useState<SampleBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hiddenLineIds, setHiddenLineIds] = useState<string[]>([]);
  const [expandedChart, setExpandedChart] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(720);

  const [volMult, setVolMult] = useState(INDICATOR_DEFAULTS.volumeScale);
  const [lsSmooth, setLsSmooth] = React.useState(INDICATOR_DEFAULTS.liquiditySmoothingPeriod);
  const [volWindow, setVolWindow] = React.useState(INDICATOR_DEFAULTS.volatilityWindow);
  const [adxPeriod, setAdxPeriod] = React.useState(INDICATOR_DEFAULTS.adxPeriod);
  const [mfiPeriod, setMfiPeriod] = React.useState(INDICATOR_DEFAULTS.mfiPeriod);

  const [smaPeriod, setSmaPeriod] = React.useState(INDICATOR_DEFAULTS.smaPeriod);
  const [emaPeriod, setEmaPeriod] = React.useState(INDICATOR_DEFAULTS.emaPeriod);
  const [rsiPeriod, setRsiPeriod] = React.useState(INDICATOR_DEFAULTS.rsiPeriod);
  const [macdFast, setMacdFast] = useState(INDICATOR_DEFAULTS.macdFastPeriod);
  const [macdSlow, setMacdSlow] = useState(INDICATOR_DEFAULTS.macdSlowPeriod);
  const [macdSignal, setMacdSignal] = useState(INDICATOR_DEFAULTS.macdSignalPeriod);
  const [bbPeriod, setBbPeriod] = useState(INDICATOR_DEFAULTS.bollingerPeriod);
  const [bbK, setBbK] = useState(INDICATOR_DEFAULTS.bollingerStdDevMultiplier);
  const [stochK, setStochK] = useState(INDICATOR_DEFAULTS.stochasticKPeriod);
  const [stochD, setStochD] = useState(INDICATOR_DEFAULTS.stochasticDPeriod);

  useEffect(() => {
    const updateViewportHeight = () => setViewportHeight(window.innerHeight);
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);
    return () => window.removeEventListener('resize', updateViewportHeight);
  }, []);

  useEffect(() => {
    if (!expandedChart) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedChart(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedChart]);

  useEffect(() => {
    let cancelled = false;
    const sym = symbol.trim().toUpperCase();

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setLoading(true);
      setFetchError(null);

      InstrumentService.getInstrumentData(sym, period, FETCH_LIMIT, 1)
        .then((raw) => {
          if (cancelled) return;
          const mapped = mapInstrumentDataToSampleBars(raw || []).slice(-DISPLAY_MAX_BARS);
          setMarketBars(mapped);
          if (!mapped.length) {
            setFetchError(`No ${period} candles for ${sym}. Sync instrument data or try another symbol.`);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMarketBars([]);
            setFetchError(`Could not load ${sym} (${period}). Check API / database.`);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [symbol, period]);

  const bars: SampleBar[] = useMemo(() => {
    if (indicatorId === 'ls') return scaleVolumes(marketBars, volMult);
    return marketBars;
  }, [marketBars, indicatorId, volMult]);

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
  const macdFastEmaSeries = useMemo(
    () => (indicatorId === 'macd' ? computeEMASeries(bars, macdFast) : []),
    [bars, indicatorId, macdFast]
  );
  const macdSlowEmaSeries = useMemo(
    () => (indicatorId === 'macd' ? computeEMASeries(bars, macdSlow) : []),
    [bars, indicatorId, macdSlow]
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
        macdFastEmaSeries,
        macdSlowEmaSeries,
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
      macdFastEmaSeries,
      macdSlowEmaSeries,
      bbSeries,
      stochSeries,
    ]
  );

  const toggleLine = (id: string) => {
    setHiddenLineIds((prev) => (prev.includes(id) ? prev.filter((lineId) => lineId !== id) : [...prev, id]));
  };

  const isLineVisible = (id: string) => !hiddenLineIds.includes(id);

  const visibleLightModel = useMemo(
    () => ({
      overlays: lightModel.overlays.filter((line) => !line.id || !hiddenLineIds.includes(line.id)),
      subPane: lightModel.subPane
        ? {
            ...lightModel.subPane,
            lines: lightModel.subPane.lines.filter((line) => !line.id || !hiddenLineIds.includes(line.id)),
          }
        : null,
    }),
    [hiddenLineIds, lightModel]
  );

  const chartHeight = expandedChart ? Math.max(420, viewportHeight - 170) : 340;
  const chartPanelClass = expandedChart
    ? 'fixed inset-4 z-50 flex min-w-0 flex-col rounded-xl border border-indigo-500/40 bg-[#0b0e14] p-4 shadow-2xl shadow-black/60'
    : 'min-w-0 rounded-xl border border-gray-800 bg-[#0b0e14] p-4';

  const lastPlaygroundValue = (() => {
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
  })();

  return (
    <div
      id="indicator-sim"
      className="mt-10 scroll-mt-24 rounded-2xl border border-indigo-500/20 bg-[#12151c] p-6 shadow-lg shadow-indigo-950/20"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-white">Indicator simulation</h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            Real OHLCV from your database (last {DISPLAY_MAX_BARS} bars). MACD defaults{" "}
            {INDICATOR_DEFAULTS.macdFastPeriod} / {INDICATOR_DEFAULTS.macdSlowPeriod} /{" "}
            {INDICATOR_DEFAULTS.macdSignalPeriod}; periods adjustable 1–300.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:gap-2">
            <span className="whitespace-nowrap font-medium text-gray-500">Symbol</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="min-w-[100px] rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {MARKET_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:gap-2">
            <span className="whitespace-nowrap font-medium text-gray-500">Period</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as MarketPeriod)}
              className="min-w-[100px] rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
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
              <Slider
                label="Volume scale"
                min={0.3}
                max={2.5}
                step={0.05}
                value={volMult}
                onChange={setVolMult}
                fmt={(v) => `${v.toFixed(2)}×`}
                lineToggles={[{ id: 'ls-liquidity', label: 'Liquidity', color: '#6366f1' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
              <Slider
                label="Score smoothing (EMA period)"
                min={1}
                max={24}
                step={1}
                value={lsSmooth}
                onChange={setLsSmooth}
                fmt={String}
                lineToggles={[{ id: 'ls-score', label: 'Score', color: '#facc15' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
            </>
          )}
          {indicatorId === 'vol' && (
            <Slider
              label="Rolling window (bars)"
              min={5}
              max={40}
              step={1}
              value={volWindow}
              onChange={setVolWindow}
              fmt={String}
              lineToggles={[{ id: 'vol-rolling', label: 'Rolling vol', color: '#38bdf8' }]}
              isLineVisible={isLineVisible}
              onToggleLine={toggleLine}
            />
          )}
          {indicatorId === 'adx' && (
            <Slider
              label="ADX period"
              min={5}
              max={28}
              step={1}
              value={adxPeriod}
              onChange={setAdxPeriod}
              fmt={String}
              lineToggles={[
                { id: 'adx-main', label: 'ADX', color: '#4ade80' },
                { id: 'adx-plus-di', label: '+DI', color: '#22d3ee' },
                { id: 'adx-minus-di', label: '-DI', color: '#f472b6' },
              ]}
              isLineVisible={isLineVisible}
              onToggleLine={toggleLine}
            />
          )}
          {indicatorId === 'mfi' && (
            <Slider
              label="MFI period"
              min={5}
              max={28}
              step={1}
              value={mfiPeriod}
              onChange={setMfiPeriod}
              fmt={String}
              lineToggles={[{ id: 'mfi-main', label: 'MFI', color: '#a78bfa' }]}
              isLineVisible={isLineVisible}
              onToggleLine={toggleLine}
            />
          )}
          {indicatorId === 'sma' && (
            <Slider
              label="SMA period"
              min={2}
              max={60}
              step={1}
              value={smaPeriod}
              onChange={setSmaPeriod}
              fmt={String}
              lineToggles={[{ id: 'sma-main', label: 'SMA', color: '#facc15' }]}
              isLineVisible={isLineVisible}
              onToggleLine={toggleLine}
            />
          )}
          {indicatorId === 'ema' && (
            <Slider
              label="EMA period"
              min={2}
              max={60}
              step={1}
              value={emaPeriod}
              onChange={setEmaPeriod}
              fmt={String}
              lineToggles={[{ id: 'ema-main', label: 'EMA', color: '#22d3ee' }]}
              isLineVisible={isLineVisible}
              onToggleLine={toggleLine}
            />
          )}
          {indicatorId === 'rsi' && (
            <Slider
              label="RSI period"
              min={2}
              max={28}
              step={1}
              value={rsiPeriod}
              onChange={setRsiPeriod}
              fmt={String}
              lineToggles={[{ id: 'rsi-main', label: 'RSI', color: '#fb923c' }]}
              isLineVisible={isLineVisible}
              onToggleLine={toggleLine}
            />
          )}
          {indicatorId === 'macd' && (
            <>
              <Slider
                label="Fast EMA"
                min={1}
                max={Math.min(299, macdSlow - 1)}
                step={1}
                value={macdFast}
                onChange={(v) => {
                  setMacdFast(v);
                  if (v >= macdSlow) setMacdSlow(Math.min(300, v + 1));
                }}
                fmt={String}
                lineToggles={[{ id: 'macd-fast-ema', label: 'Fast', color: '#38bdf8' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
              <Slider
                label="Slow EMA"
                min={macdFast + 1}
                max={300}
                step={1}
                value={macdSlow}
                onChange={(v) => {
                  setMacdSlow(v);
                  if (v <= macdFast) setMacdFast(Math.max(1, v - 1));
                }}
                fmt={String}
                lineToggles={[{ id: 'macd-slow-ema', label: 'Slow', color: '#f472b6' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
              <Slider
                label="Signal EMA"
                min={1}
                max={300}
                step={1}
                value={macdSignal}
                onChange={setMacdSignal}
                fmt={String}
              />
            </>
          )}
          {indicatorId === 'bb' && (
            <>
              <Slider
                label="SMA / σ window"
                min={5}
                max={50}
                step={1}
                value={bbPeriod}
                onChange={setBbPeriod}
                fmt={String}
                lineToggles={[{ id: 'bb-mid', label: 'Mid', color: '#facc15' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
              <Slider
                label="Std dev multiplier k"
                min={0.5}
                max={3.5}
                step={0.1}
                value={bbK}
                onChange={setBbK}
                fmt={(v) => v.toFixed(1)}
                lineToggles={[
                  { id: 'bb-upper', label: 'Upper', color: '#cbd5e1' },
                  { id: 'bb-lower', label: 'Lower', color: '#64748b' },
                ]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
            </>
          )}
          {indicatorId === 'stoch' && (
            <>
              <Slider
                label="%K lookback"
                min={3}
                max={28}
                step={1}
                value={stochK}
                onChange={setStochK}
                fmt={String}
                lineToggles={[{ id: 'stoch-k', label: '%K', color: '#a78bfa' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
              <Slider
                label="%D smoothing"
                min={1}
                max={10}
                step={1}
                value={stochD}
                onChange={setStochD}
                fmt={String}
                lineToggles={[{ id: 'stoch-d', label: '%D', color: '#22d3ee' }]}
                isLineVisible={isLineVisible}
                onToggleLine={toggleLine}
              />
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

        {expandedChart && (
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/60"
            onClick={() => setExpandedChart(false)}
            aria-label="Exit full-window chart"
          />
        )}
        <div className={chartPanelClass}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-[10px] text-gray-600">
              {symbol} · {period} · {bars.length} bars
            </p>
            <button
              type="button"
              onClick={() => setExpandedChart((v) => !v)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:border-indigo-400/50 hover:text-indigo-200"
              aria-label={expandedChart ? 'Exit full-window chart' : 'Expand chart to full window'}
              title={expandedChart ? 'Exit full-window chart' : 'Expand chart'}
            >
              {expandedChart ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400" style={{ height: chartHeight }}>
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading {symbol} ({period})…
            </div>
          ) : fetchError ? (
            <div
              className="flex items-center justify-center px-4 text-center text-sm text-amber-200/90"
              style={{ height: chartHeight }}
            >
              {fetchError}
            </div>
          ) : bars.length === 0 ? (
            <div className="flex items-center justify-center text-sm text-gray-500" style={{ height: chartHeight }}>
              No bars to chart.
            </div>
          ) : (
            <div className="min-h-0 w-full flex-1">
              <IndicatorLightChart
                height={chartHeight}
                bars={bars}
                overlays={visibleLightModel.overlays}
                subPane={visibleLightModel.subPane}
              />
            </div>
          )}
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
  lineToggles = [],
  isLineVisible,
  onToggleLine,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  fmt: (v: number) => string;
  lineToggles?: LineToggleConfig[];
  isLineVisible?: (id: string) => boolean;
  onToggleLine?: (id: string) => void;
}) {
  return (
    <div className="block text-xs text-gray-400">
      <span className="flex items-center justify-between gap-2">
        <span>{label}</span>
        {lineToggles.length > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            {lineToggles.map((line) => {
              const visible = isLineVisible ? isLineVisible(line.id) : true;
              return (
                <button
                  key={line.id}
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    onToggleLine?.(line.id);
                  }}
                  className={`h-4 min-w-6 rounded-sm border transition-opacity ${
                    visible ? 'border-white/40 opacity-100' : 'border-gray-600 opacity-35'
                  }`}
                  style={{ backgroundColor: line.color }}
                  aria-pressed={visible}
                  aria-label={`${visible ? 'Hide' : 'Show'} ${line.label}`}
                  title={`${visible ? 'Hide' : 'Show'} ${line.label}`}
                />
              );
            })}
          </span>
        )}
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-indigo-500"
      />
      <span className="font-mono text-white">{fmt(value)}</span>
    </div>
  );
}
