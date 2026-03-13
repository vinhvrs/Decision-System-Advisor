/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/purity */
"use client";

import React, { useEffect, useState, useCallback, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import { CompanyService } from "../../../services/Company.service";
import FundamentalRadar from "./profile/[inc-slug]/FundamentalRadar";

// --- Component Table Row (optimized render) ---
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
      ${typeof stock.price === "number" ? stock.price.toLocaleString() : stock.price}
    </td>
    <td
      className={`px-6 py-4 text-right tabular-nums text-sm font-bold ${
        parseFloat(stock.change_pct) >= 0 ? "text-green-400" : "text-red-400"
      }`}
    >
      {parseFloat(stock.change_pct) > 0 ? "+" : ""}
      {stock.change_pct}%
    </td>
    <td className="px-6 py-4 text-right text-blue-400 tabular-nums text-sm font-semibold">
      {stock.liquidity}
    </td>
    <td className="px-6 py-4 text-right text-gray-400 tabular-nums text-sm">
      {stock.market_cap}
    </td>
  </tr>
));

StockRow.displayName = "StockRow";

// --- Main Page ---
const StockRankingPage = () => {
  const router = useRouter();

  const [stocks, setStocks] = useState<any[]>([]);
  const [hoveredStock, setHoveredStock] = useState<any>(null);
  const [hoveredDetails, setHoveredDetails] = useState<any>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  // cache company info by symbol
  const detailsCacheRef = useRef<Record<string, any>>({});
  const hoverFetchIdRef = useRef(0);

  useEffect(() => {
    CompanyService.topCompanies(20, "liquidity").then(setStocks).catch(console.error);
  }, []);

  useEffect(() => {
    if (!hoveredStock?.symbol) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHoveredDetails(null);
      return;
    }

    const symbol = String(hoveredStock.symbol).toUpperCase();

    if (detailsCacheRef.current[symbol]) {
      setHoveredDetails(detailsCacheRef.current[symbol]);
      return;
    }

    const fetchId = ++hoverFetchIdRef.current;

    CompanyService.getCompanyInfo(symbol)
      .then((data) => {
        if (fetchId !== hoverFetchIdRef.current) return;
        detailsCacheRef.current[symbol] = data ?? null;
        setHoveredDetails(data ?? null);
      })
      .catch((error) => {
        console.error("Failed to fetch company info for tooltip:", error);
        if (fetchId !== hoverFetchIdRef.current) return;
        setHoveredDetails(null);
      });
  }, [hoveredStock]);

  // move tooltip without forcing React rerender
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (tooltipRef.current && hoveredStock) {
        const x = e.clientX;
        const y = e.clientY;

        if (requestRef.current) {
          cancelAnimationFrame(requestRef.current);
        }

        requestRef.current = requestAnimationFrame(() => {
          if (!tooltipRef.current) return;

          const tooltipWidth = 300;
          const tooltipHeight = 360;
          const gap = 20;

          let offsetX = x + gap;
          let offsetY = y - tooltipHeight / 2;

          if (offsetX + tooltipWidth > window.innerWidth - 16) {
            offsetX = x - tooltipWidth - gap;
          }

          if (offsetY < 16) {
            offsetY = 16;
          }

          if (offsetY + tooltipHeight > window.innerHeight - 16) {
            offsetY = window.innerHeight - tooltipHeight - 16;
          }

          tooltipRef.current.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        });
      }
    },
    [hoveredStock]
  );

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleRowClick = useCallback(
    (symbol: string) => {
      router.push(`/companies/profile/${symbol.toLowerCase()}`);
    },
    [router]
  );

  return (
    <div
      className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 md:p-8 relative selection:bg-blue-500/30"
      onMouseMove={handleMouseMove}
    >
      {hoveredStock && (
        <div
          ref={tooltipRef}
          className="fixed top-0 left-0 z-[100] pointer-events-none bg-[#1c212d]/95 backdrop-blur-md border border-blue-500/40 rounded-2xl p-4 w-[300px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          style={{ willChange: "transform" }}
        >
          <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2">
            <div>
              <div className="text-white font-black tracking-widest uppercase">
                {hoveredStock.symbol}
              </div>
              <div className="text-[10px] text-gray-500 truncate max-w-[180px]">
                {hoveredDetails?.company_name || hoveredStock.company_name || "Loading company..."}
              </div>
            </div>
            <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">
              FUNDAMENTAL
            </span>
          </div>

          <div className="h-[280px] w-full">
            <FundamentalRadar details={hoveredDetails} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg bg-black/20 border border-gray-800 px-3 py-2">
              <div className="text-gray-500 uppercase">Price</div>
              <div className="text-white font-semibold tabular-nums">
                ${typeof hoveredStock.price === "number"
                  ? hoveredStock.price.toLocaleString()
                  : hoveredStock.price}
              </div>
            </div>

            <div className="rounded-lg bg-black/20 border border-gray-800 px-3 py-2">
              <div className="text-gray-500 uppercase">24H Change</div>
              <div
                className={`font-semibold tabular-nums ${
                  parseFloat(hoveredStock.change_pct) >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {parseFloat(hoveredStock.change_pct) > 0 ? "+" : ""}
                {hoveredStock.change_pct}%
              </div>
            </div>

            <div className="rounded-lg bg-black/20 border border-gray-800 px-3 py-2">
              <div className="text-gray-500 uppercase">Liquidity</div>
              <div className="text-blue-400 font-semibold tabular-nums">
                {hoveredStock.liquidity}
              </div>
            </div>

            <div className="rounded-lg bg-black/20 border border-gray-800 px-3 py-2">
              <div className="text-gray-500 uppercase">Market Cap</div>
              <div className="text-white font-semibold tabular-nums">
                {hoveredStock.market_cap}
              </div>
            </div>
          </div>

          <div className="mt-2 flex justify-between text-[10px] text-gray-500 font-mono italic">
            <span>Profile: API</span>
            <span>{hoveredDetails ? "Loaded" : "Loading..."}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-10">
          <h1 className="text-5xl font-black text-white tracking-tighter mb-2">
            TOP MARKET <span className="text-blue-500 italic">COMPANIES</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium">
            Top 20 most liquid assets updated in real-time
          </p>
          <div className="h-1 w-20 bg-blue-600 mt-4 rounded-full" />
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
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="px-6 py-8 bg-gray-800/10" />
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