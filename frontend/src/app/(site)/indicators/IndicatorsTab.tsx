'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BarChart3,
  ChevronRight,
  Info,
  Search,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  IndicatorPlayground,
  type SimulatorIndicatorId,
} from './IndicatorPlayground';

type IndicatorsTabProps = { embedded?: boolean };

type IndicatorCatalogItem = {
  id: SimulatorIndicatorId;
  name: string;
  category: string;
  input: string;
  description: string;
  icon: React.ReactNode;
};

const INDICATORS: IndicatorCatalogItem[] = [
  {
    id: 'ls',
    name: 'Liquidity Score (LS)',
    category: 'Liquidity',
    input: 'OHLCV',
    description:
      'DSA liquidity-oriented score derived from persisted price and volume history with configurable smoothing.',
    icon: <Zap className="h-4 w-4 text-[#d8a340]" />,
  },
  {
    id: 'vol',
    name: 'Rolling Volatility',
    category: 'Risk',
    input: 'Close',
    description:
      'Rolling realized-volatility proxy computed from persisted closing prices. This is not the CBOE VIX index.',
    icon: <Activity className="h-4 w-4 text-[#8ab4ff]" />,
  },
  {
    id: 'adx',
    name: 'Average Directional Index (ADX)',
    category: 'Trend',
    input: 'OHLC',
    description:
      'Trend-strength measure based on directional movement. ADX measures strength, not bullish or bearish direction.',
    icon: <TrendingUp className="h-4 w-4 text-[var(--dsa-positive)]" />,
  },
  {
    id: 'mfi',
    name: 'Money Flow Index (MFI)',
    category: 'Momentum / Volume',
    input: 'OHLCV',
    description:
      'Price-and-volume oscillator used to study buying and selling pressure over a configurable lookback.',
    icon: <BarChart3 className="h-4 w-4 text-[#a78bfa]" />,
  },
  {
    id: 'sma',
    name: 'Simple Moving Average (SMA)',
    category: 'Trend',
    input: 'Close',
    description:
      'Arithmetic moving average of persisted closing prices over a configurable period.',
    icon: <TrendingUp className="h-4 w-4 text-[#d8a340]" />,
  },
  {
    id: 'ema',
    name: 'Exponential Moving Average (EMA)',
    category: 'Trend',
    input: 'Close',
    description:
      'Exponentially weighted moving average that reacts faster to recent closing-price changes.',
    icon: <TrendingUp className="h-4 w-4 text-[#22d3ee]" />,
  },
  {
    id: 'rsi',
    name: 'Relative Strength Index (RSI)',
    category: 'Momentum',
    input: 'Close',
    description:
      'Wilder-style momentum oscillator calculated from persisted close-to-close gains and losses.',
    icon: <Activity className="h-4 w-4 text-[#fb923c]" />,
  },
  {
    id: 'macd',
    name: 'MACD',
    category: 'Trend / Momentum',
    input: 'Close',
    description:
      'Fast and slow exponential moving-average spread with a configurable signal average.',
    icon: <Activity className="h-4 w-4 text-[#38bdf8]" />,
  },
  {
    id: 'bb',
    name: 'Bollinger Bands',
    category: 'Volatility',
    input: 'Close',
    description:
      'Moving-average envelope using a configurable standard-deviation multiplier around the middle band.',
    icon: <BarChart3 className="h-4 w-4 text-[#cbd5e1]" />,
  },
  {
    id: 'stoch',
    name: 'Stochastic Oscillator',
    category: 'Momentum',
    input: 'OHLC',
    description:
      'Compares the latest close with the recent high-low range using configurable %K and %D periods.',
    icon: <Activity className="h-4 w-4 text-[#a78bfa]" />,
  },
];

export default function IndicatorsTab({ embedded = false }: IndicatorsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [simIndicator, setSimIndicator] = useState<SimulatorIndicatorId>('ls');

  const filteredIndicators = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return INDICATORS;
    return INDICATORS.filter((item) =>
      [item.name, item.category, item.input, item.description]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [searchTerm]);

  const openInLab = (id: SimulatorIndicatorId) => {
    setSimIndicator(id);
    requestAnimationFrame(() =>
      document
        .getElementById('indicator-sim')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    );
  };

  return (
    <div
      className={
        embedded
          ? 'bg-[var(--dsa-bg)] px-3 py-5 text-[var(--dsa-text)] phone:px-4 tablet:px-5 laptop:px-6'
          : 'min-h-screen bg-[var(--dsa-bg)] px-3 py-6 text-[var(--dsa-text)] phone:px-4 tablet:px-5 laptop:px-6'
      }
    >
      <div className="dsa-page">
        <header className="mb-5 flex flex-col gap-3 border-b border-[var(--dsa-border)] pb-4 tablet:flex-row tablet:items-end tablet:justify-between">
          <div className="min-w-0">
            <p className="dsa-section-label">Technical research</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl">
              Indicator library
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
              Catalog cards describe formulas only. Values shown in the lab below are calculated from persisted OHLCV
              for the selected symbol and timeframe; missing history remains unavailable.
            </p>
          </div>

          <div className="relative w-full tablet:w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--dsa-text-muted)]"
              size={15}
            />
            <input
              type="search"
              placeholder="Search indicator or category"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="dsa-control h-9 w-full pl-9 pr-3 text-sm outline-none placeholder:text-[var(--dsa-text-muted)]"
              aria-label="Search indicator catalog"
            />
          </div>
        </header>

        <div className="overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
          <div className="grid grid-cols-[minmax(0,1fr)_8rem_6rem_6rem] border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)] phone:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem]">
            <span>Indicator</span>
            <span className="hidden text-left phone:block">Category</span>
            <span className="hidden text-left phone:block">Input</span>
            <span className="text-right">Research lab</span>
          </div>

          <div className="divide-y divide-[var(--dsa-border)]">
            {filteredIndicators.map((item) => (
              <article
                key={item.id}
                className={[
                  'grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3 px-3 py-3 transition-colors phone:grid-cols-[minmax(0,1fr)_9rem_7rem_7rem]',
                  simIndicator === item.id
                    ? 'bg-[var(--dsa-accent-soft)]'
                    : 'hover:bg-[var(--dsa-surface-2)]',
                ].join(' ')}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold text-white">{item.name}</h2>
                    <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                      {item.description}
                    </p>
                    <div className="mt-1.5 flex gap-2 text-[9px] text-[var(--dsa-text-muted)] phone:hidden">
                      <span>{item.category}</span>
                      <span>·</span>
                      <span>{item.input}</span>
                    </div>
                  </div>
                </div>

                <span className="hidden text-[10px] text-[var(--dsa-text-secondary)] phone:block">
                  {item.category}
                </span>
                <span className="hidden font-mono text-[10px] text-[var(--dsa-text-secondary)] phone:block">
                  {item.input}
                </span>

                <button
                  type="button"
                  onClick={() => openInLab(item.id)}
                  className={[
                    'inline-flex items-center justify-end gap-1 text-right text-[10px] font-semibold transition-colors',
                    simIndicator === item.id
                      ? 'text-[#b8d1ff]'
                      : 'text-[#8ab4ff] hover:text-white',
                  ].join(' ')}
                >
                  {simIndicator === item.id ? 'Selected' : 'Open'}
                  <ChevronRight size={12} />
                </button>
              </article>
            ))}

            {filteredIndicators.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-[var(--dsa-text-muted)]">
                No indicator matches this search.
              </div>
            ) : null}
          </div>
        </div>

        <IndicatorPlayground
          indicatorId={simIndicator}
          onIndicatorChange={setSimIndicator}
        />

        <section className="mt-6 flex flex-col gap-3 rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-4 tablet:flex-row tablet:items-center tablet:justify-between">
          <div className="flex min-w-0 gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8ab4ff]" />
            <div>
              <h2 className="text-xs font-semibold text-white">Methodology and data scope</h2>
              <p className="mt-1 max-w-4xl text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                These indicators are calculated from persisted candle data available to DSA. They are not live exchange
                indices, and the Rolling Volatility tool is not the CBOE VIX. Formula defaults and adjustable parameters
                are documented separately.
              </p>
            </div>
          </div>
          <Link href="/documents#formula" className="dsa-button-secondary shrink-0 text-xs">
            Formula reference
          </Link>
        </section>
      </div>
    </div>
  );
}
