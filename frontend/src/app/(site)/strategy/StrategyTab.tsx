'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronRight,
  ShieldCheck,
  Target,
  Zap,
} from 'lucide-react';
import { StrategyPlayground } from './StrategyPlayground';
import { STRATEGY_DEFINITIONS, type StrategyId } from './strategyDefinitions';

const ICONS: Record<StrategyId, React.ReactNode> = {
  liq_break: <Zap className="h-4 w-4 text-[#d8a340]" />,
  conservative: <ShieldCheck className="h-4 w-4 text-[var(--dsa-positive)]" />,
  scalp: <Target className="h-4 w-4 text-[var(--dsa-negative)]" />,
  mean_rev: <BarChart3 className="h-4 w-4 text-[#a78bfa]" />,
};

const LINKED_INDICATOR_LABELS = {
  ls: 'Liquidity Score',
  vol: 'Rolling Volatility',
  adx: 'ADX',
  mfi: 'MFI',
  sma: 'SMA',
  ema: 'EMA',
  rsi: 'RSI',
  macd: 'MACD',
  bb: 'Bollinger Bands',
  stoch: 'Stochastic',
} as const;

type StrategyTabProps = { embedded?: boolean };

export default function StrategyTab({ embedded = false }: StrategyTabProps) {
  const [activeRisk, setActiveRisk] = useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [activeStrategyId, setActiveStrategyId] = useState<StrategyId>('liq_break');

  const filteredStrategies = useMemo(
    () =>
      activeRisk === 'All'
        ? STRATEGY_DEFINITIONS
        : STRATEGY_DEFINITIONS.filter((strategy) => strategy.risk === activeRisk),
    [activeRisk],
  );

  const openWalkthrough = (id: StrategyId) => {
    setActiveStrategyId(id);
    requestAnimationFrame(() =>
      document
        .getElementById('strategy-sim')
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
            <p className="dsa-section-label">Educational playbooks</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl">
              Strategy walkthroughs
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
              These playbooks explain how indicator conditions can be combined on a fixed synthetic candle sequence.
              They are not backtest results, live signals, or expected performance.
            </p>
          </div>

          <div className="flex flex-wrap gap-1">
            {(['All', 'Low', 'Medium', 'High'] as const).map((risk) => (
              <button
                key={risk}
                type="button"
                onClick={() => setActiveRisk(risk)}
                className={[
                  'rounded-[var(--dsa-radius-sm)] border px-2.5 py-1.5 text-[10px] font-semibold transition-colors',
                  activeRisk === risk
                    ? 'border-[rgba(76,141,255,0.45)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]'
                    : 'border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white',
                ].join(' ')}
              >
                {risk === 'All' ? 'All risk profiles' : `${risk} risk`}
              </button>
            ))}
          </div>
        </header>

        <section className="overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--dsa-text-muted)] tablet:grid-cols-[minmax(0,1fr)_7rem_10rem_7rem]">
            <span>Playbook</span>
            <span>Risk</span>
            <span className="hidden tablet:block">Linked indicator</span>
            <span className="text-right">Walkthrough</span>
          </div>

          <div className="divide-y divide-[var(--dsa-border)]">
            {filteredStrategies.map((strategy) => (
              <article
                key={strategy.id}
                className={[
                  'grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-3 px-3 py-3 transition-colors tablet:grid-cols-[minmax(0,1fr)_7rem_10rem_7rem]',
                  activeStrategyId === strategy.id
                    ? 'bg-[var(--dsa-accent-soft)]'
                    : 'hover:bg-[var(--dsa-surface-2)]',
                ].join(' ')}
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                    {ICONS[strategy.id]}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold text-white">{strategy.name}</h2>
                    <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                      {strategy.description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 tablet:hidden">
                      <span className="text-[9px] text-[var(--dsa-text-muted)]">
                        {LINKED_INDICATOR_LABELS[strategy.linkedIndicator]}
                      </span>
                      {strategy.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] px-1.5 py-0.5 text-[9px] text-[var(--dsa-text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <span
                  className={[
                    'w-fit rounded-[var(--dsa-radius-sm)] border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.04em]',
                    strategy.risk === 'Low'
                      ? 'border-[rgba(44,182,125,0.3)] text-[var(--dsa-positive)]'
                      : strategy.risk === 'Medium'
                        ? 'border-[rgba(216,163,64,0.3)] text-[#d8a340]'
                        : 'border-[rgba(231,91,100,0.3)] text-[var(--dsa-negative)]',
                  ].join(' ')}
                >
                  {strategy.risk}
                </span>

                <span className="hidden text-[10px] text-[var(--dsa-text-secondary)] tablet:block">
                  {LINKED_INDICATOR_LABELS[strategy.linkedIndicator]}
                </span>

                <button
                  type="button"
                  onClick={() => openWalkthrough(strategy.id)}
                  className={[
                    'inline-flex items-center justify-end gap-1 text-[10px] font-semibold transition-colors',
                    activeStrategyId === strategy.id
                      ? 'text-[#b8d1ff]'
                      : 'text-[#8ab4ff] hover:text-white',
                  ].join(' ')}
                >
                  {activeStrategyId === strategy.id ? 'Selected' : 'Open'}
                  <ChevronRight size={12} />
                </button>
              </article>
            ))}
          </div>
        </section>

        <StrategyPlayground
          strategyId={activeStrategyId}
          onStrategyChange={setActiveStrategyId}
        />

        <section className="mt-6 rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-4">
          <p className="dsa-section-label">Performance disclosure</p>
          <p className="mt-1 max-w-4xl text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
            DSA does not show win rate, average profit, or expected return for these walkthroughs unless those figures
            are produced by a reproducible backtest with a documented universe, period, costs, assumptions, and result artifact.
            The current walkthrough uses synthetic candles for education only.
          </p>
        </section>
      </div>
    </div>
  );
}
