/* eslint-disable @typescript-eslint/no-explicit-any */
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
  History
} from 'lucide-react';

export default function StrategyPage() {
  const [activeTab, setActiveTab] = useState('All');

  const strategies = [
    {
      id: 1,
      name: 'Liquidity Breakout',
      description: 'Executes trades when Liquidity Score (LS) surges above 80 with price confirmation.',
      risk: 'Medium',
      winRate: '68%',
      profit: '+12.5%',
      tags: ['Trend', 'Momentum'],
      icon: <Zap className="text-yellow-400" size={24} />
    },
    {
      id: 2,
      name: 'Conservative Growth',
      description: 'Focuses on low-volatility assets with steady money flow index (MFI) growth.',
      risk: 'Low',
      winRate: '75%',
      profit: '+4.2%',
      tags: ['Stable', 'Long-term'],
      icon: <ShieldCheck className="text-green-400" size={24} />
    },
    {
      id: 3,
      name: 'Aggressive Scalping',
      description: 'High-frequency strategy capturing small price gaps during peak market hours.',
      risk: 'High',
      winRate: '54%',
      profit: '+28.1%',
      tags: ['Fast', 'Scalp'],
      icon: <Target className="text-red-400" size={24} />
    },
    {
      id: 4,
      name: 'Mean Reversion',
      description: 'Identifies overbought/oversold conditions using RSI and Bollinger Bands alignment.',
      risk: 'Medium',
      winRate: '62%',
      profit: '+8.9%',
      tags: ['Oscillator', 'Reversion'],
      icon: <BarChart3 className="text-indigo-400" size={24} />
    }
  ];

  const filteredStrategies = activeTab === 'All' 
    ? strategies 
    : strategies.filter(s => s.risk === activeTab);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Trading Strategies</h1>
            <p className="text-gray-400">Backtested algorithmic models optimized for current market liquidity.</p>
          </div>
          
          <div className="flex bg-[#161a21] p-1 rounded-xl border border-gray-800">
            {['All', 'Low', 'Medium', 'High'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredStrategies.map((strat) => (
            <div 
              key={strat.id} 
              className="group relative bg-[#161a21] border border-gray-800 hover:border-indigo-500/40 rounded-3xl p-8 transition-all duration-300 overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-600/5 rounded-full blur-3xl group-hover:bg-indigo-600/10 transition-all"></div>

              <div className="relative flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {strat.icon}
                  </div>
                </div>

                <div className="flex-grow">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h3 className="text-xl font-bold text-white">{strat.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                      strat.risk === 'Low' ? 'border-green-500/30 text-green-400 bg-green-500/5' :
                      strat.risk === 'Medium' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/5' :
                      'border-red-500/30 text-red-400 bg-red-500/5'
                    }`}>
                      {strat.risk} Risk
                    </span>
                  </div>

                  <p className="text-sm text-gray-400 leading-relaxed mb-6">
                    {strat.description}
                  </p>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-3 rounded-2xl bg-[#0b0e14] border border-gray-800/50">
                      <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-bold mb-1">
                        <Trophy size={12} /> Win Rate
                      </div>
                      <div className="text-lg font-bold text-white">{strat.winRate}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#0b0e14] border border-gray-800/50">
                      <div className="flex items-center gap-1.5 text-gray-500 text-[10px] uppercase font-bold mb-1">
                        <History size={12} /> Avg. Profit
                      </div>
                      <div className="text-lg font-bold text-green-400">{strat.profit}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#0b0e14] border border-gray-800/50 flex flex-col justify-center">
                      <div className="flex flex-wrap gap-1">
                        {strat.tags.map(tag => (
                          <span key={tag} className="text-[9px] text-indigo-400 font-medium">#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button className="flex-grow md:flex-grow-0 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all flex items-center justify-center gap-2">
                      <PlayCircle size={18} />
                      Run Backtest
                    </button>
                    <button className="px-4 py-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 transition-all">
                      Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-16 bg-[#161a21] border border-gray-800 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <ArrowRight size={24} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-white">Custom Strategy?</h4>
              <p className="text-sm text-gray-400">Our team can help you code and backtest your proprietary logic.</p>
            </div>
          </div>
          <button className="w-full md:w-auto px-8 py-3 rounded-xl border border-indigo-500 text-indigo-500 font-bold hover:bg-indigo-500 hover:text-white transition-all">
            Contact Expert
          </button>
        </div>

      </div>
    </div>
  );
}