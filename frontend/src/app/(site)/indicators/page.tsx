'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Activity,
  TrendingUp,
  Zap,
  Info,
  ChevronRight,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { IndicatorPlayground, cardIdToSimulator, type SimulatorIndicatorId } from './IndicatorPlayground';

export default function IndicatorsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [simIndicator, setSimIndicator] = useState<SimulatorIndicatorId>('ls');

  const scrollToSimulator = () => {
    requestAnimationFrame(() =>
      document.getElementById('indicator-sim')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  // Flat data danh sách các chỉ số
  const indicators = [
    {
      id: 1,
      name: 'Liquidity Score (LS)',
      description: 'The core indicator of DSA, measuring real-time capital flow and volume stability.',
      value: '84.5',
      change: '+2.4%',
      status: 'High',
      type: 'Primary',
      icon: <Zap className="text-yellow-400" size={24} />
    },
    {
      id: 2,
      name: 'Volatility Index (VIX)',
      description: 'Measures the price fluctuation intensity. High values indicate market uncertainty.',
      value: '18.2',
      change: '-5.1%',
      status: 'Stable',
      type: 'Risk',
      icon: <Activity className="text-blue-400" size={24} />
    },
    {
      id: 3,
      name: 'Trend Strength (ADX)',
      description: 'Quantifies the strength of the current trend regardless of direction.',
      value: '35',
      change: '+12.0%',
      status: 'Strong',
      type: 'Trend',
      icon: <TrendingUp className="text-green-400" size={24} />
    },
    {
      id: 4,
      name: 'Money Flow Index (MFI)',
      description: 'An oscillator that uses both price and volume to measure buying and selling pressure.',
      value: '62.8',
      change: '+0.8%',
      status: 'Bullish',
      type: 'Volume',
      icon: <BarChart3 className="text-indigo-400" size={24} />
    }
  ];

  const filteredIndicators = indicators.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200 py-16 px-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Technical Indicators</h1>
            <p className="text-gray-400">Real-time proprietary metrics for smarter trading decisions.</p>
          </div>

          <div className="relative w-full md:w-80">
            <input 
              type="text"
              placeholder="Search indicators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#161a21] border border-gray-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          </div>
        </div>

        {/* Grid System */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredIndicators.map((item) => (
            <div 
              key={item.id} 
              className="group bg-[#161a21] border border-gray-800/50 rounded-2xl p-6 hover:bg-[#1c212b] transition-all duration-300"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 group-hover:border-indigo-500/30 transition-all">
                  {item.icon}
                </div>
                <div className={`flex items-center gap-1 text-xs font-bold ${item.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {item.change}
                  {item.change.startsWith('+') ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                </div>
              </div>

              <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors mb-1">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed line-clamp-2">
                {item.description}
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <span className="block text-[10px] text-gray-600 uppercase font-black tracking-widest mb-1">Current Value</span>
                  <span className="text-2xl font-mono font-bold text-white tracking-tighter">{item.value}</span>
                </div>
                <div className="px-2 py-1 rounded-md bg-white/5 text-[10px] font-bold text-gray-400 border border-white/5 uppercase">
                  {item.status}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSimIndicator(cardIdToSimulator(item.id));
                  scrollToSimulator();
                }}
                className={`w-full mt-6 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                  simIndicator === cardIdToSimulator(item.id)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:bg-indigo-600 hover:border-indigo-600'
                }`}
              >
                Open in simulator
                <ChevronRight size={14} />
              </button>
            </div>
          ))}
        </div>

        <IndicatorPlayground indicatorId={simIndicator} onIndicatorChange={setSimIndicator} />

        {/* Educational Section */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-indigo-900/20 to-transparent border border-indigo-500/10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="p-4 rounded-2xl bg-indigo-500/20 text-indigo-400">
              <Info size={32} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Understanding our Indicators</h2>
              <p className="text-gray-400 text-sm leading-relaxed max-w-3xl">
                DSA indicators are calculated using high-frequency data from major exchanges. We combine price action with volume flow to provide a unique &quot;Liquidity-First&quot; perspective on market movements.
              </p>
            </div>
            <Link
              href="/documents#formula"
              className="whitespace-nowrap px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all"
            >
              Read Documentation
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}