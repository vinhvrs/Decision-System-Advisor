/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { use, useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, TrendingUp, Users, 
  Building2, Calendar, Newspaper, 
  ChevronRight, Globe, Loader2,
  Layers
} from 'lucide-react';

import LightChart from '@/src/components/charts/LightChart';
import AddToWatchlistButton from '@/src/components/watchlist/AddToWatchlistButton'; 
import FundamentalRadar from './FundamentalRadar';
import { InstrumentService } from "@/src/services/Instrument.service";
import { CompanyService } from "@/src/services/Company.service"; 
// Thay thế Echo bằng SimpleSocket
import { SimpleSocket } from "@/src/libs/socket"; 

interface Props {
  params: Promise<{ "inc-slug": string }>;
}

const normalizeCandles = (list: any[], period: string) => {
  const uniqueMap = new Map<number, any>();
  list.filter((d: any) => d.timestamp || d.timestamps).forEach((d: any) => {
    const ts = d.timestamp || d.timestamps;
    const date = new Date(ts.replace(" ", "T") + "Z");
    if (period === "daily") date.setUTCHours(0, 0, 0, 0);
    const time = date.getTime();
    if (!uniqueMap.has(time)) {
      uniqueMap.set(time, {
        time,
        open: parseFloat(d.open),
        high: parseFloat(d.high),
        low: parseFloat(d.low),
        close: parseFloat(d.close),
      });
    }
  });
  return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
};

const StockProfile = ({ params }: Props) => {
  const resolvedParams = use(params);
  const slug = resolvedParams["inc-slug"];

  const [instrument, setInstrument] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [candles, setCandles] = useState<any[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 1. Khởi tạo dữ liệu cơ bản
  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const all = await InstrumentService.getInstruments(3000);
        const current = all.find((i: any) => 
          i.slug === slug || i.symbol?.toLowerCase() === slug?.toLowerCase()
        );
        
        if (current) {
          setInstrument(current);
          const symbol = current.symbol;

          const [companyInfo, companyNews, similarCompanies, pList] = await Promise.all([
            CompanyService.getCompanyInfo(symbol),
            CompanyService.getCompanyNews(symbol),
            CompanyService.getSimilarCompanies(symbol),
            InstrumentService.getPeriodsById(current.id)
          ]);

          setDetails(companyInfo);
          setNews(companyNews.slice(0, 5)); 
          setSimilar(similarCompanies.slice(0, 6));
          setPeriods(pList);
          setSelectedPeriod(pList.find((p: any) => p.period === 'daily') || pList[0]);
        }
      } catch (error) {
        console.error("Terminal initialization failed:", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [slug]);

  // 2. Fetch nến lịch sử
  const fetchCandles = useCallback(async (pId: string, page: number, pType: string) => {
    try {
      const raw = await InstrumentService.getInstrumentDataByPeriod(pId, 1000, page);
      setCandles(normalizeCandles(raw, pType));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (selectedPeriod) fetchCandles(selectedPeriod.id, 1, selectedPeriod.period);
  }, [selectedPeriod, fetchCandles]);

  /** * 3. REALTIME WEBSOCKET (FASTAPI IMPLEMENTATION)
   * Thay thế hoàn toàn Echo bằng SimpleSocket
   */
  useEffect(() => {
    if (!instrument || !selectedPeriod) return;

    // Khởi tạo kết nối tới server FastAPI (Cổng 8000)
    const socket = new SimpleSocket((data: any) => {
      // Logic xử lý dữ liệu nhận được từ server Python
      if (data.type === "quote" && data.symbol === instrument.symbol) {
        setRealtimeCandle({
          time: data.ts,        // Timestamp từ Python server
          open: data.price,     // Đưa giá hiện tại vào cấu trúc nến
          high: data.price,
          low: data.price,
          close: data.price,
        });
      }
    });

    socket.connect();

    // Subscribe mã cổ phiếu hiện tại
    const timer = setTimeout(() => {
      socket.send({
        type: "subscribe",
        symbols: [instrument.symbol]
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      socket.disconnect();
      setRealtimeCandle(null);
    };
  }, [instrument?.symbol, selectedPeriod?.id]);

  if (loading) return (
    <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center text-blue-500 font-mono">
      <Loader2 className="animate-spin mb-4" size={40} />
      <span className="uppercase tracking-[0.3em] text-sm animate-pulse">Syncing Market Data...</span>
    </div>
  );

  return (
    <div className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 phone:p-5 tablet:p-6 laptop:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="flex flex-col tablet:flex-row justify-between mb-6 tablet:mb-8 border-b border-gray-800 pb-6 tablet:pb-8 gap-4 tablet:gap-6 items-start tablet:items-center">
          <div className="flex items-center gap-6">
            <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
               <img src={details?.image || instrument?.image} className="relative w-12 h-12 phone:w-14 phone:h-14 tablet:w-16 tablet:h-16 bg-white rounded-xl p-2 object-contain" alt={instrument?.symbol} />
            </div>
            <div>
              <div className="flex items-center gap-2 tablet:gap-3">
                <h1 className="text-xl phone:text-2xl tablet:text-3xl font-black text-white tracking-tight uppercase">{details?.company_name || instrument?.name}</h1>
                <ShieldCheck className="text-blue-500" size={20} />
              </div>
              <div className="flex gap-4 mt-1 text-xs font-bold items-center uppercase tracking-wider text-gray-500">
                <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase">{details?.exchangeShortName || 'NASDAQ'}: {instrument?.symbol}</span>
                <span>|</span>
                <span className="flex items-center gap-1.5"><Globe size={14}/> {details?.industry || 'Technology'}</span>
              </div>
            </div>
          </div>

          <div className="text-right bg-[#131722] px-6 py-3 rounded-xl border border-gray-800 shadow-xl">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Live Value</div>
            <div className="text-2xl font-mono font-bold text-white tabular-nums">
              ${candles.length > 0 ? (realtimeCandle?.close || candles[candles.length - 1].close).toFixed(2) : "0.00"}
            </div>
            <div className="text-green-400 text-[10px] font-black flex items-center justify-end gap-1 mt-0.5 uppercase tracking-tighter">
              FastAPI Stream <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping ml-1"></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 laptop:grid-cols-12 gap-6 tablet:gap-8">
          <div className="laptop:col-span-8 space-y-6 tablet:space-y-8">
            {/* CHART */}
            <section className="bg-[#131722] border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-black/20">
                <h2 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp className="text-blue-500" size={16} /> Technical Chart
                </h2>
                <div className="flex items-center gap-3">
                  <AddToWatchlistButton symbol={instrument?.symbol || ''} />
                  <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-gray-800">
                  {periods.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => setSelectedPeriod(p)}
                      className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all uppercase ${selectedPeriod?.id === p.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {p.period}
                    </button>
                  ))}
                  </div>
                </div>
              </div>
              <div className="h-[280px] phone:h-[350px] tablet:h-[400px] laptop:h-[450px] w-full p-2">
                <LightChart 
                  symbol={instrument?.symbol}
                  data={candles}
                  realtimeCandle={realtimeCandle}
                  period={selectedPeriod?.period as any}
                />
              </div>
            </section>

            {/* NEWS */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-4 border-l-4 border-blue-600 pl-4">
                <Newspaper className="text-blue-600" size={20} />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Market Intelligence</h2>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {news.map((item, idx) => (
                  <a key={idx} href={item.url} target="_blank" className="bg-[#131722] p-5 rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-all group flex gap-5">
                    {item.image && (
                      <div className="w-24 h-24 shrink-0 rounded-xl overflow-hidden border border-gray-800">
                        <img src={item.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt="news" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/5 px-2 py-0.5 rounded border border-blue-500/10">{item.site || "Financial News"}</span>
                        <span className="text-[10px] text-gray-600 font-mono italic">{new Date(item.publishedDate).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-white font-bold group-hover:text-blue-400 transition-colors mb-2 line-clamp-1 text-sm">{item.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed font-light">{item.text}</p>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </div>

          {/* SIDEBAR */}
          <div className="laptop:col-span-4 space-y-4 tablet:space-y-6">
            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800 shadow-2xl">
               <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-6 text-center italic">Fundamental Analysis</h2>
               <FundamentalRadar details={details} />
            </section>

            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                <Layers size={14} className="text-blue-500" /> Industry Peers
              </h3>
              <div className="grid grid-cols-3 gap-2 tablet:gap-3">
                {similar.map((comp: any, idx: number) => (
                  <a key={idx} href={`/stock-profile/${comp.symbol}`} className="flex flex-col items-center p-3 rounded-xl bg-black/20 border border-gray-800/50 hover:border-blue-500/50 transition-all group">
                    <div className="w-10 h-10 bg-white rounded-lg p-1.5 mb-2">
                      <img src={`https://images.financialmodelingprep.com/symbol/${comp.symbol}.png`} alt={comp.symbol} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] font-black text-white tracking-tighter uppercase">{comp.symbol}</span>
                  </a>
                ))}
              </div>
            </section>

            <aside className="bg-[#131722] p-6 rounded-2xl border border-gray-800 space-y-4">
               {[
                  { label: 'Market Cap', value: details?.mktCap ? `$${(details.mktCap / 1e12).toFixed(2)}T` : 'N/A' },
                  { label: 'P/E Ratio', value: details?.pe?.toFixed(2) || 'N/A', color: 'text-blue-400' },
                  { label: 'Avg Vol', value: details?.volAvg ? (details.volAvg / 1e6).toFixed(1) + 'M' : 'N/A' },
                ].map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-800/50 last:border-0">
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">{stat.label}</span>
                    <span className={`text-sm font-mono font-bold ${stat.color || 'text-white'}`}>{stat.value}</span>
                  </div>
                ))}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockProfile;