/* eslint-disable react-hooks/purity */
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation'; // Import hook điều hướng
import { ArrowUpRight, ArrowDownRight, Search, Filter } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const StockRankingPage = () => {
  const router = useRouter(); // Khởi tạo router
  const [hoveredStock, setHoveredStock] = useState<any>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mock data 100 công ty
  const mockData = Array.from({ length: 100 }, (_, i) => ({
    rank: i + 1,
    ticker: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD', 'NFLX', 'ORCL'][i % 10],
    name: ['Apple Inc.', 'Nvidia Corp', 'Tesla, Inc.', 'Microsoft', 'Amazon.com', 'Alphabet Inc.', 'Meta Platforms', 'AMD Inc.', 'Netflix', 'Oracle'][i % 10],
    price: (Math.random() * 500 + 100).toFixed(2),
    change: (Math.random() * 10 - 5).toFixed(2),
    volume: (Math.random() * 50 + 10).toFixed(2) + 'M',
    marketCap: (Math.random() * 3 + 0.5).toFixed(2) + 'T',
    scores: [
      { subject: 'Growth', value: Math.floor(Math.random() * 60) + 40 },
      { subject: 'Value', value: Math.floor(Math.random() * 60) + 40 },
      { subject: 'Health', value: Math.floor(Math.random() * 60) + 40 },
      { subject: 'Dividend', value: Math.floor(Math.random() * 60) + 40 },
      { subject: 'Liquidity', value: Math.floor(Math.random() * 60) + 40 },
      { subject: 'Sentiment', value: Math.floor(Math.random() * 60) + 40 },
    ]
  }));

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Hàm xử lý chuyển hướng
  const handleRowClick = (ticker: string) => {
    router.push(`/stock-profile/${ticker.toLowerCase()}`);
  };

  return (
    <div className="bg-[#0b0e11] min-h-screen text-gray-300 font-sans p-4 md:p-8 relative" onMouseMove={handleMouseMove}>
      
      {/* TOOLTIP CARD (RADAR CHART) */}
      {hoveredStock && (
        <div 
          className="fixed z-50 pointer-events-none bg-[#1c212d] border border-blue-500/40 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-4 w-64 backdrop-blur-md"
          style={{ 
            left: mousePos.x + 20, 
            top: mousePos.y - 100,
          }}
        >
          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
            <span className="text-white font-bold">{hoveredStock.ticker} Analysis</span>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono uppercase">Live Insight</span>
          </div>
          
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={hoveredStock.scores}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-gray-400 text-center">
             <div className="bg-black/30 p-1.5 rounded border border-gray-800">Overall: <span className="text-green-400">Strong Buy</span></div>
             <div className="bg-black/30 p-1.5 rounded border border-gray-800">Risk: <span className="text-yellow-400">Low</span></div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Market Liquidity</h1>
          <p className="text-gray-500 text-sm">Top 100 companies by trading volume. Click to view deep profile.</p>
        </div>
        <div className="flex gap-2">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input placeholder="Search ticker..." className="bg-[#131722] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:border-blue-500 outline-none transition-all" />
            </div>
            <button className="bg-[#131722] border border-gray-800 p-2 rounded-lg hover:bg-[#1e222d]"><Filter size={18}/></button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto bg-[#131722] border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#1c212d] text-gray-400 text-[10px] uppercase tracking-[0.1em] font-bold">
                <th className="px-6 py-5">Rank</th>
                <th className="px-6 py-5">Company / Symbol</th>
                <th className="px-6 py-5 text-right">Last Price</th>
                <th className="px-6 py-5 text-right">24h Change</th>
                <th className="px-6 py-5 text-right text-blue-400">Volume (24h)</th>
                <th className="px-6 py-5 text-right">Market Cap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {mockData.slice(0, 20).map((stock) => (
                <tr 
                  key={stock.rank} 
                  className="hover:bg-[#1e222d] transition-all cursor-pointer group active:scale-[0.995]"
                  onMouseEnter={() => setHoveredStock(stock)}
                  onMouseLeave={() => setHoveredStock(null)}
                  onClick={() => handleRowClick(stock.ticker)}
                >
                  <td className="px-6 py-5 text-gray-500 font-mono text-sm">#{stock.rank}</td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-base group-hover:text-blue-400 transition-colors leading-none">{stock.ticker}</span>
                      <span className="text-[11px] text-gray-500 mt-1">{stock.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-mono text-white font-medium">${stock.price}</td>
                  <td className={`px-6 py-5 text-right font-bold ${parseFloat(stock.change) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    <div className="flex items-center justify-end gap-1">
                      {parseFloat(stock.change) >= 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                      {stock.change}%
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-bold text-gray-200">{stock.volume}</td>
                  <td className="px-6 py-5 text-right text-gray-400 font-mono text-sm">{stock.marketCap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockRankingPage;