/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/purity */
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, ArrowDownRight, Search, Filter } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

import liquidityService from "../../../services/Liquidity.service";

const StockRankingPage = () => {

  const router = useRouter();
  const [hoveredStock, setHoveredStock] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [stocks, setStocks] = useState<any[]>([]);

  useEffect(() => {
    liquidityService.fetchLiquidityTop().then(setStocks);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const handleRowClick = (ticker: string) => {
    router.push(`/stock-profile/${ticker.toLowerCase()}`);
  };

  return (
    <div className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 md:p-8 relative"
         onMouseMove={handleMouseMove}>

      {/* TOOLTIP */}
      {hoveredStock && (
        <div 
          className="fixed z-50 pointer-events-none bg-[#1c212d] border border-blue-500/40 rounded-xl p-4 w-64"
          style={{ left: mousePos.x + 20, top: mousePos.y - 100 }}
        >
          <div className="flex justify-between mb-2 border-b border-gray-700 pb-2">
            <span className="text-white font-bold">
              {hoveredStock.ticker} Analysis
            </span>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={hoveredStock.scores}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" />
                <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-8 flex justify-between">
        <div>
          <h1 className="text-4xl font-black text-white">Market Liquidity</h1>
          <p className="text-gray-500 text-sm">Top companies by liquidity</p>
        </div>
      </div>

      {/* TABLE */}
      <div className="max-w-7xl mx-auto bg-[#131722] border border-gray-800 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1c212d] text-gray-400 text-xs uppercase">
              <th className="px-6 py-5">Rank</th>
              <th className="px-6 py-5">Company</th>
              <th className="px-6 py-5 text-right">Price</th>
              <th className="px-6 py-5 text-right">Change</th>
              <th className="px-6 py-5 text-right">Liquidity</th>
              <th className="px-6 py-5 text-right">MarketCap</th>
            </tr>
          </thead>

          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.rank}
                  className="hover:bg-[#1e222d] cursor-pointer"
                  onMouseEnter={() => setHoveredStock(stock)}
                  onMouseLeave={() => setHoveredStock(null)}
                  onClick={() => handleRowClick(stock.ticker)}
              >
                <td className="px-6 py-5">#{stock.rank}</td>

                <td className="px-6 py-5">
                  <span className="text-white font-bold">
                    {stock.ticker}
                  </span>
                </td>

                <td className="px-6 py-5 text-right">
                  ${stock.price}
                </td>

                <td className={`px-6 py-5 text-right ${
                  parseFloat(stock.change) >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {stock.change}%
                </td>

                <td className="px-6 py-5 text-right text-blue-400">
                  {stock.volume}
                </td>

                <td className="px-6 py-5 text-right">
                  {stock.marketCap}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StockRankingPage;
