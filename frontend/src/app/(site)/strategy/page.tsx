'use client';

import React, { useState } from 'react';
import {
  Zap,
  ShieldCheck,
  Target,
  BarChart3,
  ArrowRight,
  PlayCircle,
  Trophy,
  History,
} from 'lucide-react';
import { StrategyPlayground } from './StrategyPlayground';
import { STRATEGY_DEFINITIONS, type StrategyId } from './strategyDefinitions';

const ICONS: Record<StrategyId, React.ReactNode> = {
  liq_break: <Zap className="text-yellow-400" size={24} />,
  conservative: <ShieldCheck className="text-green-400" size={24} />,
  scalp: <Target className="text-red-400" size={24} />,
  mean_rev: <BarChart3 className="text-indigo-400" size={24} />,
};

export default function StrategyPage() {
  const [activeTab, setActiveTab] = useState('All');
  const [activeStrategyId, setActiveStrategyId] = useState<StrategyId>('liq_break');

  const filteredStrategies =
    activeTab === 'All' ? STRATEGY_DEFINITIONS : STRATEGY_DEFINITIONS.filter((s) => s.risk === activeTab);

  const scrollToSimulator = () => {
    requestAnimationFrame(() =>
      document.getElementById('strategy-sim')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] px-6 py-16 text-gray-200">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 text-4xl font-bold text-white">Trading Strategies</h1>
            <p className="text-gray-400">
              Playbooks tied to the same indicator math as the lab, plus how the beginner board’s five radar spokes and
              Fear &amp; Greed fit the story — all on synthetic candles.
            </p>
          </div>

          <div className="flex rounded-xl border border-gray-800 bg-[#161a21] p-1">
            {['All', 'Low', 'Medium', 'High'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-lg px-6 py-2 text-sm font-semibold transition-all ${
                  activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {filteredStrategies.map((strat) => (
            <div
              key={strat.id}
              className="group relative overflow-hidden rounded-3xl border border-gray-800 bg-[#161a21] p-8 transition-all duration-300 hover:border-indigo-500/40"
            >
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/5 blur-3xl transition-all group-hover:bg-indigo-600/10" />

              <div className="relative flex flex-col gap-6 md:flex-row">
                <div className="shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-800 bg-gray-900 transition-transform group-hover:scale-110">
                    {ICONS[strat.id]}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-bold text-white">{strat.name}</h3>
                    <span
                      className={`rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        strat.risk === 'Low'
                          ? 'border-green-500/30 bg-green-500/5 text-green-400'
                          : strat.risk === 'Medium'
                            ? 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400'
                            : 'border-red-500/30 bg-red-500/5 text-red-400'
                      }`}
                    >
                      {strat.risk} Risk
                    </span>
                  </div>

                  <p className="mb-6 text-sm leading-relaxed text-gray-400">{strat.description}</p>

                  <div className="mb-8 grid grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-gray-800/50 bg-[#0b0e14] p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-500">
                        <Trophy size={12} /> Win Rate
                      </div>
                      <div className="text-lg font-bold text-white">{strat.winRate}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-800/50 bg-[#0b0e14] p-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-500">
                        <History size={12} /> Avg. Profit
                      </div>
                      <div className="text-lg font-bold text-green-400">{strat.profit}</div>
                    </div>
                    <div className="flex flex-col justify-center rounded-2xl border border-gray-800/50 bg-[#0b0e14] p-3">
                      <div className="flex flex-wrap gap-1">
                        {strat.tags.map((tag) => (
                          <span key={tag} className="text-[9px] font-medium text-indigo-400">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStrategyId(strat.id);
                        scrollToSimulator();
                      }}
                      className="flex flex-grow items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 md:flex-grow-0"
                    >
                      <PlayCircle size={18} />
                      Open walkthrough
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <StrategyPlayground strategyId={activeStrategyId} onStrategyChange={setActiveStrategyId} />

        <div className="mt-16 flex flex-col items-center justify-between gap-6 rounded-3xl border border-gray-800 bg-[#161a21] p-8 md:flex-row">
          <div className="flex items-center gap-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500">
              <ArrowRight size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Custom Strategy?</h4>
              <p className="text-sm text-gray-400">We can help you encode and backtest proprietary logic.</p>
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-xl border border-indigo-500 px-8 py-3 font-bold text-indigo-500 transition-all hover:bg-indigo-500 hover:text-white md:w-auto"
          >
            Contact Expert
          </button>
        </div>
      </div>
    </div>
  );
}
