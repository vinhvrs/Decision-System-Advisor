/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { use, useState, useEffect, useRef } from 'react';
import { 
  ArrowUpRight, ArrowDownRight, History, BarChart3, 
  Globe, Users, ShieldCheck, Newspaper, ExternalLink, TrendingUp 
} from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RadarLine } from 'recharts';

import LightChart from '@/src/components/charts/LightChart'; 
import { InstrumentService } from "@/src/services/Instrument.service";
import { Instrument } from "@/src/types/Instrument";
import { InstrumentPeriod } from "@/src/types/InstrumentPeriod";
import { createEcho } from "@/src/libs/echo";

interface Props {
  params: Promise<{ "inc-slug": string }>;
}

/* ============================================================
 * HELPERS
 * ============================================================ */
function normalizeCandles(list: any[], period: string) {
  const uniqueMap = new Map<number, any>();
  list
    .filter((d: any) => d.timestamp || d.timestamps)
    .forEach((d: any) => {
      const ts = d.timestamp || d.timestamps;
      const date = new Date(ts.replace(" ", "T") + "Z");

      // Đồng bộ thời gian theo từng khung (Period)
      if (period === "daily") date.setUTCHours(0, 0, 0, 0);
      if (period === "weekly") {
        const day = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() - day + 1);
        date.setUTCHours(0, 0, 0, 0);
      }
      if (period === "monthly") { date.setUTCDate(1); date.setUTCHours(0, 0, 0, 0); }
      if (period === "yearly") { date.setUTCMonth(0, 1); date.setUTCHours(0, 0, 0, 0); }

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
}

const StockProfile = ({ params }: Props) => {
  const resolvedParams = use(params);
  const slug = resolvedParams["inc-slug"];

  // States Dữ liệu
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [periods, setPeriods] = useState<InstrumentPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<InstrumentPeriod | null>(null);
  const [candles, setCandles] = useState<any[]>([]);
  const [candlePage, setCandlePage] = useState(1);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadingMoreCandles = useRef(false);
  const throttleRef = useRef(0);

  /** * 1. Khởi tạo: Lấy Instrument và Periods dựa trên slug 
   * Sửa lỗi i.slug === slug để lấy chính xác ID
   */
  useEffect(() => {
    const initData = async () => {
      try {
        const allInstruments = await InstrumentService.getInstruments(3000);
        // Tìm kiếm linh hoạt theo slug hoặc symbol
        const current = allInstruments.find((i: any) => 
          i.slug === slug || i.symbol?.toLowerCase() === slug?.toLowerCase()
        );
        
        if (current) {
          setInstrument(current);
          const periodList = await InstrumentService.getPeriodsById(current.id);
          setPeriods(periodList);
          // Mặc định chọn khung Daily
          setSelectedPeriod(periodList.find((p: any) => p.period === 'daily') || periodList[0]);
        }
      } catch (error) {
        console.error("Lỗi khởi tạo Profile:", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [slug]);

  /** 2. Fetch dữ liệu nến (Hỗ trợ Lazy Load) */
  async function fetchCandleData(periodId: string, page: number, periodType: string) {
    try {
      const raw = await InstrumentService.getInstrumentDataByPeriod(
        periodId, 1000, page, ["timestamp", "timestamps", "open", "high", "low", "close"]
      );
      const formatted = normalizeCandles(raw, periodType);

      if (page === 1) {
        setCandles(formatted);
      } else {
        setCandles((prev) => {
          const map = new Map();
          prev.forEach(c => map.set(c.time, c));
          formatted.forEach(c => map.set(c.time, c)); // Gộp dữ liệu cũ vào trước
          return Array.from(map.values()).sort((a, b) => a.time - b.time);
        });
      }
    } catch (error) {
      console.error("Lỗi tải nến:", error);
    }
  }

  useEffect(() => {
    if (selectedPeriod) {
      setCandles([]);
      setCandlePage(1);
      fetchCandleData(selectedPeriod.id, 1, selectedPeriod.period);
    }
  }, [selectedPeriod]);

  /** 3. Realtime qua Reverb */
  useEffect(() => {
    if (!instrument || !selectedPeriod) return;
    const echo = createEcho();
    if (!echo) return;

    const symbol = (selectedPeriod.prefix || instrument.symbol).toLowerCase();
    const channelName = `ohlc.${symbol}.${selectedPeriod.period}`;

    echo.channel(channelName).listen(".candle", (e: any) => {
      setRealtimeCandle(e?.candle ?? e);
    });

    return () => { echo.leave(channelName); };
  }, [instrument?.id, selectedPeriod?.id]);

  /** 4. Handler Lazy Load khi cuộn biểu đồ sang trái */
  const loadMoreHistory = () => {
    if (loadingMoreCandles.current || Date.now() - throttleRef.current < 300) return;
    throttleRef.current = Date.now();
    
    if (!selectedPeriod) return;
    loadingMoreCandles.current = true;
    const nextPage = candlePage + 1;
    setCandlePage(nextPage);
    
    fetchCandleData(selectedPeriod.id, nextPage, selectedPeriod.period).finally(() => {
      loadingMoreCandles.current = false;
    });
  };

  if (loading) return <div className="min-h-screen bg-[#0b0e11] flex items-center justify-center text-white italic">Loading Profile...</div>;

  return (
    <div className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 border-b border-gray-800 pb-8 gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl">
              {instrument?.symbol?.[0] || "?"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-4xl font-bold text-white tracking-tight">{instrument?.name || "Unknown"}</h1>
                <ShieldCheck className="text-blue-400" size={24} />
              </div>
              <div className="flex gap-5 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1.5 font-medium"><Globe size={16}/> {instrument?.exchange}</span>
                <span className="font-mono text-blue-400 font-bold uppercase tracking-widest">{instrument?.symbol}</span>
              </div>
            </div>
          </div>
          <div className="text-right bg-[#131722] p-5 rounded-2xl border border-gray-800 min-w-[220px]">
            <div className="text-3xl font-mono font-bold text-white">
              ${candles.length > 0 ? candles[candles.length - 1].close.toFixed(2) : "0.00"}
            </div>
            <div className="text-green-400 font-bold flex items-center justify-end gap-1 mt-1 text-lg">
              +2.15% <ArrowUpRight size={20} />
            </div>
          </div>
        </div>

        {/* PRICE CHART SECTION */}
        <section className="bg-[#131722] border border-gray-800 rounded-3xl p-6 mb-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 italic">
              <TrendingUp className="text-blue-500" size={22} /> Market Price
            </h2>
            <div className="flex gap-2 bg-black/40 p-1.5 rounded-xl border border-gray-800">
              {periods.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-4 py-1.5 text-xs rounded-lg font-bold transition-all uppercase ${selectedPeriod?.id === p.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-gray-800 text-gray-500'}`}
                >
                  {p.period}
                </button>
              ))}
            </div>
          </div>
          <div className="h-[500px] w-full bg-[#0B1220] rounded-2xl overflow-hidden border border-gray-800">
            {candles.length > 0 ? (
              <LightChart 
                symbol={instrument?.symbol || "AAPL"}
                data={candles}
                realtimeCandle={realtimeCandle}
                onLoadMore={loadMoreHistory}
                period={selectedPeriod?.period as any}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500 italic animate-pulse">
                Synchronizing Market Data...
              </div>
            )}
          </div>
        </section>

        {/* BOTTOM CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* CỘT TRÁI: HISTORY & NEWS */}
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2 italic">
                <History className="text-blue-500" size={20} /> Company History
              </h2>
              <p className="leading-relaxed text-gray-400 italic">
                {instrument?.name} là một thực thể hàng đầu trên sàn {instrument?.exchange}. Dữ liệu lịch sử cho thấy sự phát triển ổn định và tính thanh khoản cực cao trong nhóm ngành công nghệ.
              </p>
            </section>

            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800">
              <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2 italic">
                <Newspaper className="text-blue-500" size={20} /> Related News
              </h2>
              <div className="space-y-4">
                {[
                  { id: 1, title: `${instrument?.symbol} công bố báo cáo tài chính mới với doanh thu vượt kỳ vọng.`, time: "2 giờ trước", source: "Bloomberg" },
                  { id: 2, title: "Phân tích sức mạnh của nhóm Big Tech trong quý 1.", time: "5 giờ trước", source: "Reuters" },
                ].map(item => (
                  <div key={item.id} className="group flex justify-between items-start p-4 rounded-xl hover:bg-[#1c212d] transition-colors border border-transparent hover:border-gray-700 cursor-pointer">
                    <div>
                      <h3 className="text-white font-medium group-hover:text-blue-400 transition-colors">{item.title}</h3>
                      <div className="flex gap-3 mt-2 text-xs text-gray-500"><span>{item.source}</span><span>•</span><span>{item.time}</span></div>
                    </div>
                    <ExternalLink size={16} className="text-gray-600 group-hover:text-white" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* CỘT PHẢI: ANALYSIS & STATS */}
          <div className="lg:col-span-4 space-y-8">
            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 text-center">Fundamental Strength</h2>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                    { subject: 'Growth', value: 85 }, { subject: 'Value', value: 65 },
                    { subject: 'Health', value: 90 }, { subject: 'Dividend', value: 45 },
                    { subject: 'Liquidity', value: 95 }, { subject: 'Sentiment', value: 80 },
                  ]}>
                    <PolarGrid stroke="#374151" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <RadarLine name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <aside className="bg-[#131722] p-6 rounded-2xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2 uppercase text-xs tracking-widest text-gray-500">
                <BarChart3 size={16} /> Market Statistics
              </h3>
              <div className="space-y-5">
                {[
                  { label: 'Market Cap', value: '2.84T' },
                  { label: 'P/E Ratio', value: '28.45' },
                  { label: 'Inst. Ownership', value: '64.2%', color: 'text-blue-400' },
                ].map((stat, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-gray-800 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-gray-400">{stat.label}</span>
                    <span className={`font-mono font-bold ${stat.color || 'text-white'}`}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>

        {/* RELATED COMPANIES */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-8">Compare with Related Companies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { ticker: 'MSFT', price: '420.12', change: '+1.2%' },
              { ticker: 'GOOGL', price: '175.45', change: '-0.5%' },
              { ticker: 'NVDA', price: '890.00', change: '+4.3%' },
              { ticker: 'AMZN', price: '180.00', change: '+0.8%' },
            ].map((item) => (
              <div key={item.ticker} className="bg-[#131722] hover:bg-[#1c212d] border border-gray-800 p-6 rounded-2xl transition-all shadow-lg group hover:-translate-y-1 cursor-pointer">
                <div className="flex justify-between items-start mb-5">
                  <span className="text-white font-bold text-xl group-hover:text-blue-400 transition-colors uppercase tracking-widest">{item.ticker}</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${item.change.includes('+') ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                    {item.change}
                  </span>
                </div>
                <div className="text-2xl font-mono font-bold text-white tracking-tighter">${item.price}</div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
};

export default StockProfile;