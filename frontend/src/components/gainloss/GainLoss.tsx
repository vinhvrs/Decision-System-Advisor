/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from "react";

// The Gain/Loss Logo Component
const GainLossLogo = () => (
  <svg 
    width="28" 
    height="24" 
    viewBox="0 0 28 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="overflow-visible"
  >
    {/* Split Green Up Arrow (Left) */}
    <path 
      d="M4 11L8 7L12 11M8 7V17" 
      stroke="#22c55e" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="drop-shadow-[0_0_5px_rgba(34,197,94,0.7)]"
    />
    {/* Split Red Down Arrow (Right) */}
    <path 
      d="M16 13L20 17L24 13M20 17V7" 
      stroke="#ef4444" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="drop-shadow-[0_0_5px_rgba(239,68,68,0.7)]"
    />
  </svg>
);

export default function GainLoss() {
  return (
    <section className="px-6 py-16 bg-[#0b1220] border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        {/* Section Header with Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 shadow-inner">
            <GainLossLogo />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Market Movers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Gainers - Styled to match Hot Market News cards */}
          <div className="rounded-[2rem] bg-[#161D2C]/80 border border-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <h3 className="font-black uppercase tracking-widest text-xs text-green-400">Top Gainers</h3>
            </div>
            <ul className="space-y-4">
              {[
                { symbol: "NVDA", change: "+4.32%", status: "High Vol" },
                { symbol: "AAPL", change: "+2.15%", status: "Bullish" },
                { symbol: "TSLA", change: "+1.89%", status: "Active" },
                { symbol: "MSFT", change: "+0.95%", status: "Stable" }
              ].map((stock) => (
                <li key={stock.symbol} className="flex justify-between items-center group cursor-pointer border-b border-white/5 pb-3 last:border-0 transition-all hover:translate-x-1">
                  <span className="font-bold text-white/90 group-hover:text-blue-400 transition-colors">{stock.symbol}</span>
                  <div className="text-right">
                    <span className="block font-mono font-bold text-green-400">{stock.change}</span>
                    <span className="text-[10px] text-white/30 uppercase font-bold">{stock.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Top Losers */}
          <div className="rounded-[2rem] bg-[#161D2C]/80 border border-white/10 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
              <h3 className="font-black uppercase tracking-widest text-xs text-red-400">Top Losers</h3>
            </div>
            <ul className="space-y-4">
              {[
                { symbol: "META", change: "-3.18%", status: "Bearish" },
                { symbol: "NFLX", change: "-2.45%", status: "Selling" },
                { symbol: "BABA", change: "-1.92%", status: "Weak" },
                { symbol: "AMD", change: "-1.10%", status: "Correction" }
              ].map((stock) => (
                <li key={stock.symbol} className="flex justify-between items-center group cursor-pointer border-b border-white/5 pb-3 last:border-0 transition-all hover:translate-x-1">
                  <span className="font-bold text-white/90 group-hover:text-blue-400 transition-colors">{stock.symbol}</span>
                  <div className="text-right">
                    <span className="block font-mono font-bold text-red-400">{stock.change}</span>
                    <span className="text-[10px] text-white/30 uppercase font-bold">{stock.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}