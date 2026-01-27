/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Activity, MessageSquare, TrendingUp } from "lucide-react";
import { get, set } from "idb-keyval"; // Import thư viện IndexedDB thay thế localStorage

// Components & Services
import LightChart from "../../../components/charts/LightChart";
import ChatBox from "../../../components/chatbox/page";
import SelectDropdown from "../../../sections/Dropdown";
import { InstrumentService } from "@/src/services/Instrument.service";
import { createEcho } from "@/src/libs/echo";
import { Instrument } from "../../../types/Instrument";
import { InstrumentPeriod } from "../../../types/InstrumentPeriod";

// Assets
import bgImg from "../../../assets/images/bg-landingpage.jpg";

const INSTRUMENTS_IDB_KEY = "market_instruments_idb";

/* ============================================================
 * HELPERS (Logic xử lý nến chuẩn hóa theo timeframe)
 * ============================================================ */
function normalizeCandles(list: any[], period: string) {
  const uniqueMap = new Map<number, any>();
  list.filter((d: any) => d.timestamp || d.timestamps).forEach((d: any) => {
    const ts = d.timestamp || d.timestamps;
    const date = new Date(ts.replace(" ", "T") + "Z");
    
    if (period === "daily") date.setUTCHours(0, 0, 0, 0);
    if (period === "weekly") {
      const day = date.getUTCDay() || 7;
      date.setUTCDate(date.getUTCDate() - day + 1);
      date.setUTCHours(0, 0, 0, 0);
    }
    if (period === "monthly") {
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
    }
    if (period === "yearly") {
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }
    
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

export default function HomePage() {
  // --- States ---
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null);
  const [periods, setPeriods] = useState<InstrumentPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<InstrumentPeriod | null>(null);
  const [candles, setCandles] = useState<any[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);
  const [timeframe, setTimeframe] = useState("daily");

  // --- 1. Load Instruments dùng IndexedDB Cache (Tránh lỗi QuotaExceeded) ---
  useEffect(() => {
    const loadInstruments = async () => {
      try {
        // Thử lấy từ IndexedDB
        const cached = await get(INSTRUMENTS_IDB_KEY);
        
        if (cached && cached.length > 0) {
          console.log("🚀 Loaded instruments from IndexedDB");
          setInstruments(cached);
          const aapl = cached.find((i: Instrument) => i.symbol === "AAPL");
          setSelectedInstrument(aapl || cached[0]);
        } else {
          console.log("📡 Fetching 30,000 instruments from API...");
          const res = await InstrumentService.getInstruments(30000, 1, ["id", "symbol", "name"]);
          setInstruments(res);
          // Lưu vào IndexedDB (Dung lượng cho phép lên đến hàng trăm MB)
          await set(INSTRUMENTS_IDB_KEY, res);
          const aapl = res.find((i: Instrument) => i.symbol === "AAPL");
          setSelectedInstrument(aapl || res[0]);
        }
      } catch (err) {
        console.error("Failed to load instruments:", err);
      }
    };
    loadInstruments();
  }, []);

  // --- 2. Load Periods cho mã đã chọn ---
  useEffect(() => {
    if (!selectedInstrument) return;
    const fetchPeriods = async () => {
      try {
        const res = await InstrumentService.getPeriodsById(selectedInstrument.id);
        setPeriods(res);
        // Default tìm daily, nếu không có lấy mốc đầu tiên
        const daily = res.find(p => p.period === "daily") || res[0];
        setSelectedPeriod(daily);
        setTimeframe(daily?.period || "daily");
      } catch (e) {
        console.error("Period fetch error:", e);
      }
    };
    fetchPeriods();
  }, [selectedInstrument?.id]);

  // --- 3. Fetch History OHLC Data ---
  useEffect(() => {
    if (!selectedPeriod) return;
    async function initFetch() {
      try {
        const raw = await InstrumentService.getInstrumentDataByPeriod(
          (selectedPeriod as any).id,
          500,
          1,
          ["timestamp", "timestamps", "open", "high", "low", "close"]
        );
        const formatted = normalizeCandles(raw, timeframe);
        setCandles(formatted);
      } catch (err) {
        console.error("History data load error:", err);
      }
    }
    initFetch();
  }, [selectedPeriod?.id, timeframe]);

  // --- 4. WebSocket Real-time ---
  useEffect(() => {
    if (!selectedInstrument || !timeframe) return;
    const echo = createEcho();
    if (!echo) return;
    const channelName = `ohlc.${selectedInstrument.symbol.toLowerCase()}.${timeframe}`;
    const channel = echo.channel(channelName);
    channel.listen(".candle", (e: any) => {
      setRealtimeCandle(e?.candle ?? e);
    });
    return () => echo.leave(channelName);
  }, [selectedInstrument?.id, timeframe]);

  return (
    <main className="min-h-screen bg-[#0B1220] text-white selection:bg-blue-500/30">
      
      {/* HERO SECTION */}
      <section className="relative h-[60vh] flex items-center overflow-hidden">
        <Image src={bgImg} alt="BG" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#0B1220]/60 to-[#0B1220]" />
        
        <div className="relative z-10 w-full px-6 max-w-7xl mx-auto text-center md:text-left">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-7xl font-extrabold leading-tight tracking-tight">
              Decision System <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-fuchsia-500"> Advisor. </span>
            </h1>
            <div className="mt-10">
              <a href="#dashboard" className="px-8 py-3.5 rounded-2xl bg-white text-black font-bold hover:scale-105 transition-all inline-block shadow-lg">
                Launch Dashboard
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* DASHBOARD SECTION */}
      <section id="dashboard" className="relative z-20 -mt-16 px-6 pb-24">
        <div className="max-w-7xl mx-auto">
          
          {/* Header & Selectors */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Market Intelligence</h2>
              <p className="text-white/50 flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                Live Feed: {selectedInstrument?.name} ({selectedInstrument?.symbol})
              </p>
            </div>

            <div className="flex gap-4 text-black">
              <SelectDropdown
                options={instruments.map(i => ({ id: i.id, label: `${i.symbol} - ${i.name}` }))}
                selected={selectedInstrument ? { id: selectedInstrument.id, label: selectedInstrument.symbol } : null}
                onSelect={(v) => setSelectedInstrument(instruments.find(i => i.id === v.id) || null)}
                placeholder="Stock"
              />
              <SelectDropdown
                options={periods.map(p => ({ id: p.id, label: p.period.toUpperCase() }))}
                selected={selectedPeriod ? { id: selectedPeriod.id, label: selectedPeriod.period.toUpperCase() } : null}
                onSelect={(v) => {
                  const p = periods.find(item => item.id === v.id);
                  setSelectedPeriod(p || null);
                  setTimeframe(p?.period || "daily");
                }}
                placeholder="Timeframe"
              />
            </div>
          </div>

          {/* Grid Layout: Chart & Chat */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[650px]">
            
            {/* Chart Column (8/12) - Bo góc tròn sâu */}
            <div className="lg:col-span-8 bg-[#161D2C]/80 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden p-6 relative">
              {candles.length > 0 ? (
                <div className="h-full w-full">
                  <LightChart
                    symbol={selectedInstrument?.symbol || "AAPL"}
                    data={candles}
                    realtimeCandle={realtimeCandle}
                    period={timeframe as any}
                  />
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/20 animate-pulse">
                   <Activity size={48} className="mb-4" />
                   <p>Syncing with market data...</p>
                </div>
              )}
            </div>

            {/* Chat Column (4/12) - Tích hợp AI Assistant lấp đầy khung */}
            <div className="lg:col-span-4 flex flex-col h-full overflow-hidden rounded-[2rem] border border-white/10 bg-[#161D2C]/80 backdrop-blur-xl shadow-xl">
              <div className="p-5 border-b border-white/5 flex items-center gap-3 bg-white/5">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-white">AI Analyst</h3>
                  <p className="text-[10px] text-green-400 font-mono uppercase tracking-widest">Active Insight</p>
                </div>
              </div>
              
              <div className="flex-1 overflow-hidden relative">
                <style jsx global>{`
                  /* Override CSS ChatBox để fit hoàn toàn vào container grid */
                  .fixed.bottom-6.right-6.z-\\[9999\\] {
                    position: relative !important;
                    bottom: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    z-index: 1 !important;
                  }
                  .w-80.h-96 {
                    width: 100% !important;
                    height: 100% !important;
                    border: none !important;
                    box-shadow: none !important;
                    position: absolute !important;
                    background: transparent !important;
                  }
                `}</style>
                <ChatBox />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}