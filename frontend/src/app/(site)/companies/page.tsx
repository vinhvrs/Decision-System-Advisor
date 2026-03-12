/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/purity */
"use client";

import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useRouter } from 'next/navigation';
import { CompanyService } from '../../../services/Company.service';
import ScoreChart from '../../../sections/ScoreChart'; // Đảm bảo file này nằm cùng thư mục

// --- Component Table Row (Tối ưu render) ---
const StockRow = memo(({ stock, index, onHover, onClick }: any) => (
  <tr 
    className="hover:bg-[#1e222d] cursor-pointer border-b border-gray-800/50 transition-all duration-150 group"
    onMouseEnter={() => onHover(stock)}
    onMouseLeave={() => onHover(null)}
    onClick={() => onClick(stock.symbol)}
  >
    <td className="px-6 py-4 tabular-nums text-gray-500 text-sm">#{index + 1}</td>
    <td className="px-6 py-4">
      <div className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase">
        {stock.symbol}
      </div>
      <div className="text-[10px] text-gray-500 truncate max-w-[120px]">
        {stock.company_name || "N/A"}
      </div>
    </td>
    <td className="px-6 py-4 text-right tabular-nums text-sm text-gray-200">
      ${typeof stock.price === 'number' ? stock.price.toLocaleString() : stock.price}
    </td>
    <td className={`px-6 py-4 text-right tabular-nums text-sm font-bold ${
      parseFloat(stock.change_pct) >= 0 ? 'text-green-400' : 'text-red-400'
    }`}>
      {parseFloat(stock.change_pct) > 0 ? '+' : ''}{stock.change_pct}%
    </td>
    <td className="px-6 py-4 text-right text-blue-400 tabular-nums text-sm font-semibold">
      {stock.liquidity}
    </td>
    <td className="px-6 py-4 text-right text-gray-400 tabular-nums text-sm">
      {stock.market_cap}
    </td>
  </tr>
));

StockRow.displayName = 'StockRow';

// --- Main Page ---
const StockRankingPage = () => {
  const router = useRouter();
  const [stocks, setStocks] = useState<any[]>([]);
  const [hoveredStock, setHoveredStock] = useState<any>(null);
  
  const tooltipRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    CompanyService.topCompanies(20, "liquidity").then(setStocks);
  }, []);

  // DI CHUYỂN TOOLTIP SIÊU TỐC (Zero React Render)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tooltipRef.current && hoveredStock) {
      const x = e.clientX;
      const y = e.clientY;
      
      cancelAnimationFrame(requestRef.current!);
      requestRef.current = requestAnimationFrame(() => {
        if (tooltipRef.current) {
          // Tính toán để tooltip không tràn khỏi màn hình
          const offsetX = x + 20;
          const offsetY = y - 180;
          tooltipRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        }
      });
    }
  }, [hoveredStock]);

  const handleRowClick = useCallback((symbol: string) => {
    router.push(`/companies/profile/${symbol.toLowerCase()}`);
  }, [router]);

  return (
    <div 
      className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 md:p-8 relative selection:bg-blue-500/30" 
      onMouseMove={handleMouseMove}
    >
      
      {/* TOOLTIP: Fix hoàn toàn bằng ScoreChart component */}
      {hoveredStock && (
        <div 
          ref={tooltipRef}
          className="fixed top-0 left-0 z-[100] pointer-events-none bg-[#1c212d]/95 backdrop-blur-md border border-blue-500/40 rounded-2xl p-4 w-64 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          style={{ willChange: 'transform' }}
        >
          <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
            <span className="text-white font-black tracking-widest uppercase">{hoveredStock.symbol}</span>
            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">AI ANALYSIS</span>
          </div>

          <ScoreChart 
            price={hoveredStock.price}
            change_pct={hoveredStock.change_pct}
            liquidity={hoveredStock.liquidity}
            volume={hoveredStock.volume || 100}
            market_cap={hoveredStock.market_cap}
          />
          
          <div className="mt-2 flex justify-between text-[10px] text-gray-500 font-mono italic">
             <span>Data: Live 24h</span>
             <span>Rel: 98%</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
            TOP MARKET <span className="text-blue-500 italic">COMPANIES</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium">Top 20 most liquid assets updated in real-time</p>
          <div className="h-1 w-20 bg-blue-600 mt-4 rounded-full"></div>
        </header>
        
        <div className="bg-[#131722] border border-gray-800/50 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#1c212d]/80 text-gray-500 text-[10px] uppercase tracking-[0.15em] font-bold">
                <tr>
                  <th className="px-6 py-6">Rank</th>
                  <th className="px-6 py-6">Asset</th>
                  <th className="px-6 py-6 text-right">Price</th>
                  <th className="px-6 py-6 text-right">24h Change</th>
                  <th className="px-6 py-6 text-right">Liquidity</th>
                  <th className="px-6 py-6 text-right">Market Cap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/30">
                {stocks.length > 0 ? (
                  stocks.map((stock, index) => (
                    <StockRow 
                      key={stock.symbol} 
                      stock={stock} 
                      index={index} 
                      onHover={setHoveredStock} 
                      onClick={handleRowClick} 
                    />
                  ))
                ) : (
                  // Skeleton loader đơn giản
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8 bg-gray-800/10"></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockRankingPage;