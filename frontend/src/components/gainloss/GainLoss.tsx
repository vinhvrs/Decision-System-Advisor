/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { CompanyService } from "../../services/Company.service";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const GainLossLogo = () => (
  <svg 
    width="28" 
    height="24" 
    viewBox="0 0 28 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className="overflow-visible"
  >
    <path 
      d="M4 11L8 7L12 11M8 7V17" 
      stroke="#22c55e" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="drop-shadow-[0_0_5px_rgba(34,197,94,0.7)]"
    />
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
  const [gainers, setGainers] = useState<any[]>([]);
  const [losers, setLosers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketMovers = async () => {
      try {
        setLoading(true);
        const [topGainers, topLosers] = await Promise.all([
          CompanyService.topGainers(5),
          CompanyService.topLosers(5)
        ]);

        setGainers(topGainers);
        setLosers(topLosers);
      } catch (error) {
        console.error("Failed to fetch market movers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketMovers();
  }, []);

  const StockItem = ({ stock, type }: { stock: any, type: 'gainer' | 'loser' }) => (
    <Link href={`/companies/profile/${stock.symbol}`}>
      <li className="flex justify-between items-center group cursor-pointer border-b border-white/5 pb-3 last:border-0 transition-all hover:translate-x-1 py-2">
        <div className="flex items-center gap-3">
          {/* <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center overflow-hidden p-1">
             <img 
               src={`https://images.financialmodelingprep.com/symbol/${stock.symbol}.png`} 
               alt={stock.symbol}
               onError={(e: any) => e.target.src = "/fallback-logo.png"} 
             />
          </div> */}
          <div>
            <span className="block font-bold text-white/90 group-hover:text-blue-400 transition-colors">{stock.symbol}</span>
            <span className="text-[10px] text-white/30 uppercase font-bold truncate max-w-[100px] block">
              {stock.symbol}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className={`block font-mono font-bold ${type === 'gainer' ? 'text-green-400' : 'text-red-400'}`}>
            {type === 'gainer' ? '+' : ''}{stock.change_pct?.toFixed(2)}%
          </span>
          {/* <span className="text-[10px] text-white/30 font-mono tracking-tighter">
            ${stock.price?.toFixed(2)}
          </span> */}
        </div>
      </li>
    </Link>
  );

  return (
    <section className="px-4 phone:px-5 tablet:px-6 py-10 tablet:py-12 laptop:py-16 bg-[#0b1220] border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        {/* <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 shadow-inner">
              <GainLossLogo />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Market Movers</h2>
          </div>
          <span className="text-[10px] font-mono text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5 uppercase tracking-widest">
            Live updates
          </span>
        </div> */}

        {loading ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-4 text-blue-500/50">
            <Loader2 className="animate-spin" size={32} />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Analyzing Market...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 tablet:grid-cols-2 gap-6 tablet:gap-8">
            {/* Top Gainers */}
            <div className="rounded-2xl tablet:rounded-[2rem] bg-[#161D2C]/80 border border-white/10 p-5 tablet:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/10 transition-all"></div>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <h3 className="font-black uppercase tracking-widest text-xs text-green-400">Top Gainers</h3>
              </div>
              <ul className="space-y-2">
                {gainers.length > 0 ? gainers.map((stock) => (
                  <StockItem key={stock.symbol} stock={stock} type="gainer" />
                )) : <p className="text-xs text-gray-600 italic">No gainers found</p>}
              </ul>
            </div>

            {/* Top Losers */}
            <div className="rounded-2xl tablet:rounded-[2rem] bg-[#161D2C]/80 border border-white/10 p-5 tablet:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-500/10 transition-all"></div>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                <h3 className="font-black uppercase tracking-widest text-xs text-red-400">Top Losers</h3>
              </div>
              <ul className="space-y-2">
                {losers.length > 0 ? losers.map((stock) => (
                  <StockItem key={stock.symbol} stock={stock} type="loser" />
                )) : <p className="text-xs text-gray-600 italic">No losers found</p>}
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}