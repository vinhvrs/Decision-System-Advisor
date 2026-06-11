'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  BOARD_ATTR_STACK_SCALE_ID,
  dayToTime,
  IndicatorLightChart,
  type MainPaneBoardSpec,
  type OverlayLineSpec,
  type SubPaneSpec,
} from '../indicators/IndicatorLightChart';
import { buildIndicatorLightModel, pointsFrom } from '../indicators/indicatorLightModel';
import type { SimulatorIndicatorId } from '../indicators/indicatorTypes';
import {
  computeADX,
  computeBollingerSeries,
  computeEMASeries,
  computeLiquiditySeries,
  computeMACDFastSmaMinusSlowEma,
  computeMACDSeries,
  computeMFI,
  computeRSISeries,
  computeRollingVolatility,
  computeSMASeries,
  computeStochasticSeries,
  FIXED_SIMULATION_BARS,
  scaleVolumes,
  SIMULATION_CANDLES,
} from '../indicators/indicatorCalculations';
import { computeBoardSimSeries } from './strategyBoardSim';
import { mergeSubPaneWithHybridMacd } from './mergeHybridMacdSubPane';
import { computeStrategyTradeMarkers } from './strategyChartSignals';
import { STRATEGY_DEFINITIONS, type StrategyId } from './strategyDefinitions';

const LINK_LABEL: Record<SimulatorIndicatorId, string> = {
  ls: 'Liquidity Score',
  vol: 'Volatility proxy',
  adx: 'ADX',
  mfi: 'MFI',
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  macd: 'MACD',
  bb: 'Bollinger Bands',
  stoch: 'Stochastic',
};

type ExplainMode = 'indicator' | 'attributes';

type Props = {
  strategyId: StrategyId;
  onStrategyChange: (id: StrategyId) => void;
};

export function StrategyPlayground({ strategyId, onStrategyChange }: Props) {
  const strategy = useMemo(
    () => STRATEGY_DEFINITIONS.find((s) => s.id === strategyId) ?? STRATEGY_DEFINITIONS[0],
    [strategyId]
  );
  const ind = strategy.linkedIndicator;

  const [explainMode, setExplainMode] = useState<ExplainMode>('indicator');
  const [volMult, setVolMult] = useState(1);
  const [lsSmooth, setLsSmooth] = useState(8);
  const [volWindow, setVolWindow] = useState(14);
  const [adxPeriod, setAdxPeriod] = useState(14);
  const [mfiPeriod, setMfiPeriod] = useState(14);
  const [smaPeriod, setSmaPeriod] = useState(20);
  const [emaPeriod, setEmaPeriod] = useState(20);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbK, setBbK] = useState(2);
  const [stochK, setStochK] = useState(14);
  const [stochD, setStochD] = useState(3);
  /** Hybrid MACD: SMA(fast) − EMA(slow), always shown under strategies */
  const [stratMacdFastSma, setStratMacdFastSma] = useState(12);
  const [stratMacdSlowEma, setStratMacdSlowEma] = useState(26);
  const [stratMacdSignal, setStratMacdSignal] = useState(9);

  const bars = useMemo(() => {
    if (ind === 'ls') return scaleVolumes(FIXED_SIMULATION_BARS, volMult);
    return FIXED_SIMULATION_BARS;
  }, [ind, volMult]);

  const lsSeries = useMemo(
    () => (ind === 'ls' ? computeLiquiditySeries(bars, lsSmooth) : []),
    [bars, ind, lsSmooth]
  );
  const volSeries = useMemo(
    () => (ind === 'vol' ? computeRollingVolatility(bars, volWindow) : []),
    [bars, ind, volWindow]
  );
  const adxSeries = useMemo(
    () => (ind === 'adx' ? computeADX(bars, adxPeriod) : []),
    [bars, ind, adxPeriod]
  );
  const mfiSeries = useMemo(
    () => (ind === 'mfi' ? computeMFI(bars, mfiPeriod) : []),
    [bars, ind, mfiPeriod]
  );
  const smaSeries = useMemo(
    () => (ind === 'sma' ? computeSMASeries(bars, smaPeriod) : []),
    [bars, ind, smaPeriod]
  );
  const emaSeries = useMemo(
    () => (ind === 'ema' ? computeEMASeries(bars, emaPeriod) : []),
    [bars, ind, emaPeriod]
  );
  const rsiSeries = useMemo(
    () => (ind === 'rsi' ? computeRSISeries(bars, rsiPeriod) : []),
    [bars, ind, rsiPeriod]
  );
  const macdSeries = useMemo(
    () => (ind === 'macd' ? computeMACDSeries(bars, macdFast, macdSlow, macdSignal) : []),
    [bars, ind, macdFast, macdSlow, macdSignal]
  );
  const macdFastEmaSeries = useMemo(
    () => (ind === 'macd' ? computeEMASeries(bars, macdFast) : []),
    [bars, ind, macdFast]
  );
  const macdSlowEmaSeries = useMemo(
    () => (ind === 'macd' ? computeEMASeries(bars, macdSlow) : []),
    [bars, ind, macdSlow]
  );
  const bbSeries = useMemo(
    () => (ind === 'bb' ? computeBollingerSeries(bars, bbPeriod, bbK) : []),
    [bars, ind, bbPeriod, bbK]
  );
  const stochSeries = useMemo(
    () => (ind === 'stoch' ? computeStochasticSeries(bars, stochK, stochD) : []),
    [bars, ind, stochK, stochD]
  );

  const boardSeries = useMemo(() => computeBoardSimSeries(bars), [bars]);

  const hybridMacdSeries = useMemo(
    () => computeMACDFastSmaMinusSlowEma(bars, stratMacdFastSma, stratMacdSlowEma, stratMacdSignal),
    [bars, stratMacdFastSma, stratMacdSlowEma, stratMacdSignal]
  );

  const bundle = useMemo(
    () => ({
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

  const indicatorModel = useMemo(() => buildIndicatorLightModel(ind, bundle), [ind, bundle]);

  const attributesMainBoard = useMemo((): MainPaneBoardSpec => {
    const stackColors = [
      '#3861fb',
      '#22c55e',
      '#fb923c',
      '#38bdf8',
      '#a78bfa',
      '#f472b6',
    ] as const;
    return {
      attributeStack: {
        priceScaleId: BOARD_ATTR_STACK_SCALE_ID,
        colors: stackColors,
        data: boardSeries.map((r) => ({
          time: dayToTime(r.day),
          values: [r.reputation, r.pricePeriod, r.candleChange, r.volume, r.liquidity, r.peopleCare],
        })),
      },
      lines: [
        {
          color: '#f8fafc',
          lineWidth: 2,
          priceScaleId: BOARD_ATTR_STACK_SCALE_ID,
          lockZeroToHundred: true,
          data: pointsFrom(boardSeries, (r) => r.day, (r) => r.fearGreed),
        },
      ],
    };
  }, [boardSeries]);

  const tradeMarkers = useMemo(
    () =>
      computeStrategyTradeMarkers({
        strategyId: strategy.id,
        bars,
        hybridMacd: hybridMacdSeries,
        lsSeries,
        mfiSeries,
        stochSeries,
        bbSeries,
        boardSeries,
      }),
    [strategy.id, bars, hybridMacdSeries, lsSeries, mfiSeries, stochSeries, bbSeries, boardSeries]
  );

  const lightModel = useMemo(() => {
    if (explainMode === 'attributes') {
      return {
        overlays: [] as OverlayLineSpec[],
        subPane: null as SubPaneSpec | null,
        mainPaneBoard: attributesMainBoard,
      };
    }
    return {
      overlays: indicatorModel.overlays,
      subPane: mergeSubPaneWithHybridMacd(indicatorModel.subPane, hybridMacdSeries),
      mainPaneBoard: null as MainPaneBoardSpec | null,
    };
  }, [explainMode, attributesMainBoard, indicatorModel, hybridMacdSeries]);

  const explainBody =
    explainMode === 'indicator' ? strategy.explainIndicator : strategy.explainAttributes;

  return (
    <div
      id="strategy-sim"
      className="mt-14 scroll-mt-24 rounded-2xl border border-indigo-500/20 bg-[#12151c] p-6 shadow-lg shadow-indigo-950/20"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-white">Strategy walkthrough</h2>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">
            Same <strong className="text-gray-400">{SIMULATION_CANDLES}</strong> synthetic candles as the indicator lab.
            With <strong className="text-gray-400">Explain: indicator</strong>, hybrid{' '}
            <strong className="text-gray-400">MACD</strong> (SMA<sub>fast</sub> − EMA<sub>slow</sub>, signal = EMA of that spread)
            appears in the lower pane. With <strong className="text-gray-400">6 + F&amp;G</strong>, MACD is hidden and board scores
            overlay the main chart; buy/sell arrows still use the same playbook rules (including MACD math behind the scenes). Switch between{' '}
            <strong className="text-gray-400">{LINK_LABEL[ind]}</strong> and{' '}
            <strong className="text-gray-400">six board-style scores (stacked column per day) + Fear &amp; Greed</strong>.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex flex-col gap-1 text-xs text-gray-400 sm:flex-row sm:items-center sm:gap-2">
            <span className="whitespace-nowrap font-medium text-gray-500">Strategy</span>
            <select
              value={strategy.id}
              onChange={(e) => onStrategyChange(e.target.value as StrategyId)}
              className="min-w-[200px] max-w-[min(100vw-3rem,280px)] rounded-lg border border-gray-700 bg-[#0b0e14] px-3 py-2 text-xs font-medium text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              {STRATEGY_DEFINITIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex rounded-lg border border-gray-700 bg-[#0b0e14] p-0.5">
            <button
              type="button"
              onClick={() => setExplainMode('indicator')}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                explainMode === 'indicator' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Explain: indicator
            </button>
            <button
              type="button"
              onClick={() => setExplainMode('attributes')}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                explainMode === 'attributes' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Explain: 6 + F&amp;G
            </button>
          </div>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-gray-600">
        {strategy.name} · {LINK_LABEL[ind]} in indicator mode · MACD strip only in indicator mode · arrows = illustrative signals
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
        <div className="space-y-4 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Parameters</p>
          <p className="text-[10px] leading-relaxed text-gray-600">
            Sliders tune the linked technical series (visible when &quot;Explain: indicator&quot; is on). Board + F&amp;G
            uses the same OHLCV but does not use those periods. Hybrid MACD periods apply in both views.
          </p>

          <div className="rounded-lg border border-indigo-500/20 bg-indigo-950/20 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/90">Hybrid MACD</p>
            <p className="mt-1 text-[10px] text-gray-500">Line = SMA(close, fast) − EMA(close, slow). Histogram = line − signal.</p>
            <div className="mt-2 space-y-2">
              <Slider
                label="Fast SMA period"
                min={2}
                max={24}
                step={1}
                value={stratMacdFastSma}
                onChange={setStratMacdFastSma}
                fmt={String}
              />
              <Slider
                label="Slow EMA period"
                min={5}
                max={40}
                step={1}
                value={stratMacdSlowEma}
                onChange={setStratMacdSlowEma}
                fmt={String}
              />
              <Slider
                label="Signal EMA (on MACD line)"
                min={2}
                max={20}
                step={1}
                value={stratMacdSignal}
                onChange={setStratMacdSignal}
                fmt={String}
              />
            </div>
          </div>

          {ind === 'ls' && (
            <>
              <Slider label="Volume scale" min={0.3} max={2.5} step={0.05} value={volMult} onChange={setVolMult} fmt={(v) => `${v.toFixed(2)}×`} />
              <Slider label="Score smoothing (EMA period)" min={1} max={24} step={1} value={lsSmooth} onChange={setLsSmooth} fmt={String} />
            </>
          )}
          {ind === 'vol' && (
            <Slider label="Rolling window (bars)" min={5} max={40} step={1} value={volWindow} onChange={setVolWindow} fmt={String} />
          )}
          {ind === 'adx' && (
            <Slider label="ADX period" min={5} max={28} step={1} value={adxPeriod} onChange={setAdxPeriod} fmt={String} />
          )}
          {ind === 'mfi' && (
            <Slider label="MFI period" min={5} max={28} step={1} value={mfiPeriod} onChange={setMfiPeriod} fmt={String} />
          )}
          {ind === 'sma' && (
            <Slider label="SMA period" min={2} max={60} step={1} value={smaPeriod} onChange={setSmaPeriod} fmt={String} />
          )}
          {ind === 'ema' && (
            <Slider label="EMA period" min={2} max={60} step={1} value={emaPeriod} onChange={setEmaPeriod} fmt={String} />
          )}
          {ind === 'rsi' && (
            <Slider label="RSI period" min={2} max={28} step={1} value={rsiPeriod} onChange={setRsiPeriod} fmt={String} />
          )}
          {ind === 'macd' && (
            <>
              <Slider label="Fast EMA" min={2} max={20} step={1} value={macdFast} onChange={setMacdFast} fmt={String} />
              <Slider label="Slow EMA" min={5} max={40} step={1} value={macdSlow} onChange={setMacdSlow} fmt={String} />
              <Slider label="Signal EMA" min={2} max={20} step={1} value={macdSignal} onChange={setMacdSignal} fmt={String} />
            </>
          )}
          {ind === 'bb' && (
            <>
              <Slider label="SMA / σ window" min={5} max={50} step={1} value={bbPeriod} onChange={setBbPeriod} fmt={String} />
              <Slider label="Std dev multiplier k" min={0.5} max={3.5} step={0.1} value={bbK} onChange={setBbK} fmt={(v) => v.toFixed(1)} />
            </>
          )}
          {ind === 'stoch' && (
            <>
              <Slider label="%K lookback" min={3} max={28} step={1} value={stochK} onChange={setStochK} fmt={String} />
              <Slider label="%D smoothing" min={1} max={10} step={1} value={stochD} onChange={setStochD} fmt={String} />
            </>
          )}

          <div className="border-t border-gray-800 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {explainMode === 'indicator' ? 'Why this indicator' : 'Why board + F&G'}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">{explainBody}</p>
          </div>
        </div>

        <div className="min-w-0 space-y-3 rounded-xl border border-gray-800 bg-[#0b0e14] p-4">
          <div className="h-[380px] w-full">
            <IndicatorLightChart
              height={380}
              bars={bars}
              overlays={lightModel.overlays}
              subPane={lightModel.subPane}
              mainPaneBoard={lightModel.mainPaneBoard}
              tradeMarkers={tradeMarkers}
            />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">
            {explainMode === 'indicator' ? (
              <>
                <span className="w-full text-[9px] uppercase tracking-wide text-gray-600">Lower pane</span>
                <span>
                  <span className="font-mono text-indigo-300">▮</span> MACD hist
                </span>
                <span>
                  <span className="font-mono text-[#38bdf8]">━━</span> MACD line
                </span>
                <span>
                  <span className="font-mono text-[#f472b6]">━━</span> Signal
                </span>
                <span className="text-gray-600">+ {LINK_LABEL[ind]} (see chart)</span>
                <span className="w-full text-[9px] uppercase tracking-wide text-gray-600">Markers</span>
                <span>
                  <span className="font-mono text-emerald-400">▲</span> Buy hint
                </span>
                <span>
                  <span className="font-mono text-rose-400">▼</span> Sell hint
                </span>
              </>
            ) : (
              <>
                <span className="w-full text-[9px] uppercase tracking-wide text-gray-600">Main chart overlay (0–100)</span>
                <span>
                  <span className="font-mono text-gray-300">━━</span> F&amp;G
                </span>
                <span className="text-gray-600">Stacked column (bottom→top):</span>
                <span>
                  <span className="font-mono text-[#3861fb]">▮</span> Reputation
                </span>
                <span>
                  <span className="font-mono text-[#22c55e]">▮</span> Price period
                </span>
                <span>
                  <span className="font-mono text-[#fb923c]">▮</span> Candle change
                </span>
                <span>
                  <span className="font-mono text-[#38bdf8]">▮</span> Volume
                </span>
                <span>
                  <span className="font-mono text-[#a78bfa]">▮</span> Liquidity
                </span>
                <span>
                  <span className="font-mono text-[#f472b6]">▮</span> People care
                </span>
                <span className="w-full text-[9px] uppercase tracking-wide text-gray-600">Markers</span>
                <span>
                  <span className="font-mono text-emerald-400">▲</span> Buy hint
                </span>
                <span>
                  <span className="font-mono text-rose-400">▼</span> Sell hint
                </span>
              </>
            )}
          </div>

          <div className="border-t border-gray-800 pt-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Illustrative buy / sell ideas</p>
            <p className="mt-1 text-[10px] leading-relaxed text-gray-600">
              Not live signals — narrative checks you can line up with the chart markers
              {explainMode === 'indicator' ? ' and MACD strip' : ''}.
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500">
              <span className="inline-flex items-center gap-1 font-medium text-emerald-400/95">
                <ArrowUp className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                <span>↑ Long / buy-side examples</span>
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-rose-400/95">
                <ArrowDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                <span>↓ Exit / sell-side examples</span>
              </span>
            </p>
            <ul className="mt-3 space-y-2.5 text-[11px] leading-snug text-gray-400">
              {strategy.buyCases.map((c) => (
                <li
                  key={`b-${c.label}`}
                  className="flex gap-2.5 rounded-r-lg border-l-2 border-emerald-500/55 bg-emerald-500/[0.06] py-2 pl-2 pr-2"
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                    title="Buy-side example"
                    aria-label="Buy-side example"
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-emerald-400/95">Buy · </span>
                    <span className="font-medium text-gray-300">{c.label}</span>
                    <span className="text-gray-500">: </span>
                    {c.when}
                  </div>
                </li>
              ))}
              {strategy.sellCases.map((c) => (
                <li
                  key={`s-${c.label}`}
                  className="flex gap-2.5 rounded-r-lg border-l-2 border-rose-500/55 bg-rose-500/[0.06] py-2 pl-2 pr-2"
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30"
                    title="Sell-side example"
                    aria-label="Sell-side example"
                  >
                    <ArrowDown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <span className="font-semibold text-rose-400/95">Sell · </span>
                    <span className="font-medium text-gray-300">{c.label}</span>
                    <span className="text-gray-500">: </span>
                    {c.when}
                  </div>
                </li>
              ))}
            </ul>
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
