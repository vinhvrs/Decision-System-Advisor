/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { use, useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ShieldCheck,
  TrendingUp,
  Loader2,
  Globe,
  Newspaper,
  Layers,
  Building2,
  Users,
  Calendar,
  Briefcase,
  Link as LinkIcon,
  Activity,
} from "lucide-react";

import LightChart from "@/src/components/charts/LightChart";
import FundamentalRadar from "./FundamentalRadar";
import { InstrumentService } from "@/src/services/Instrument.service";
import { CompanyService } from "@/src/services/Company.service";
import { SimpleSocket } from "@/src/libs/socket";

interface Props {
  params: Promise<{ "inc-slug": string }>;
}

type TF = "daily" | "weekly" | "monthly" | "yearly";

const PERIOD_OPTIONS: Array<{ id: TF; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTimestamp(raw: any): number | null {
  if (raw === null || raw === undefined || raw === "") return null;

  if (typeof raw === "number") {
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }

  const str = String(raw).trim();
  if (!str) return null;

  const date = str.includes("T")
    ? new Date(str)
    : new Date(str.replace(" ", "T") + "Z");

  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function normalizeCandles(list: any[], period: TF) {
  const uniqueMap = new Map<number, any>();

  (list || [])
    .filter((d: any) => d?.timestamp || d?.timestamps || d?.time)
    .forEach((d: any) => {
      const rawTs = d.timestamp ?? d.timestamps ?? d.time;
      const parsedMs = normalizeTimestamp(rawTs);
      if (!parsedMs) return;

      const date = new Date(parsedMs);

      if (period === "daily") {
        date.setUTCHours(0, 0, 0, 0);
      } else if (period === "weekly") {
        const day = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() - day + 1);
        date.setUTCHours(0, 0, 0, 0);
      } else if (period === "monthly") {
        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
      } else if (period === "yearly") {
        date.setUTCMonth(0, 1);
        date.setUTCHours(0, 0, 0, 0);
      }

      const time = date.getTime();

      const next = {
        time,
        open: toNumber(d.open),
        high: toNumber(d.high),
        low: toNumber(d.low),
        close: toNumber(d.close),
        volume: toNumber(d.volume),
      };

      if (!uniqueMap.has(time)) {
        uniqueMap.set(time, next);
      } else {
        const prev = uniqueMap.get(time);
        uniqueMap.set(time, {
          time,
          open: toNumber(prev.open),
          high: Math.max(toNumber(prev.high), toNumber(next.high)),
          low: Math.min(toNumber(prev.low), toNumber(next.low)),
          close: toNumber(next.close),
          volume: toNumber(prev.volume) + toNumber(next.volume),
        });
      }
    });

  return Array.from(uniqueMap.values()).sort((a, b) => a.time - b.time);
}

function getWsUrl() {
  if (typeof window === "undefined") return "ws://127.0.0.1:8000/ws/quotes";

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "127.0.0.1";
  return `${protocol}//${host}:8000/ws/quotes`;
}

function normalizeSymbolFromSlug(slug: string) {
  return decodeURIComponent(slug || "").trim().toUpperCase();
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getHostname(url?: string | null) {
  if (!url) return "Source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function truncateText(text: string, max = 220) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

const StockProfile = ({ params }: Props) => {
  const resolvedParams = use(params);
  const slug = resolvedParams["inc-slug"];
  const symbol = useMemo(() => normalizeSymbolFromSlug(slug), [slug]);

  const [details, setDetails] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TF>("daily");

  const [candles, setCandles] = useState<any[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  const candleRequestIdRef = useRef(0);

  const livePrice = useMemo(() => {
    if (realtimeCandle?.close !== undefined && realtimeCandle?.close !== null) {
      return toNumber(realtimeCandle.close);
    }
    if (candles.length > 0) {
      return toNumber(candles[candles.length - 1]?.close);
    }
    return 0;
  }, [realtimeCandle, candles]);

  useEffect(() => {
    let cancelled = false;

    const initData = async () => {
      try {
        setLoading(true);
        setDetails(null);
        setNews([]);
        setSimilar([]);
        setCandles([]);
        setRealtimeCandle(null);
        setSelectedPeriod("daily");

        if (!symbol) {
          setLoading(false);
          return;
        }

        const [companyInfo, companyNews, similarCompanies] = await Promise.all([
          CompanyService.getCompanyInfo(symbol),
          CompanyService.getCompanyNews(symbol),
          CompanyService.getSimilarCompanies(symbol),
        ]);

        if (cancelled) return;

        setDetails(companyInfo || null);
        setNews(Array.isArray(companyNews) ? companyNews.slice(0, 5) : []);
        setSimilar(Array.isArray(similarCompanies) ? similarCompanies.slice(0, 6) : []);
      } catch (error) {
        console.error("Stock profile initialization failed:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initData();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const fetchCandles = useCallback(async (ticker: string, period: TF) => {
    if (!ticker || !period) {
      setCandles([]);
      return;
    }

    const requestId = ++candleRequestIdRef.current;

    try {
      setChartLoading(true);
      setRealtimeCandle(null);

      const raw = await InstrumentService.getInstrumentData(ticker, period, 1000, 1);

      if (requestId !== candleRequestIdRef.current) return;

      const normalized = normalizeCandles(raw || [], period);
      setCandles(normalized);
    } catch (error) {
      if (requestId !== candleRequestIdRef.current) return;
      console.error("Fetch candles failed:", error);
      setCandles([]);
    } finally {
      if (requestId === candleRequestIdRef.current) {
        setChartLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!symbol) return;
    fetchCandles(symbol, selectedPeriod);
  }, [symbol, selectedPeriod, fetchCandles]);

  useEffect(() => {
    if (!symbol) return;

    const socket = new SimpleSocket(getWsUrl(), (data: any) => {
      if (!data || data.type !== "quote") return;
      if (String(data.symbol).toUpperCase() !== symbol) return;

      const price = toNumber(data.price);
      const ts = normalizeTimestamp(data.ts);
      if (!ts) return;

      setRealtimeCandle({
        time: ts,
        open: price,
        high: price,
        low: price,
        close: price,
      });
    });

    socket.connect();

    const timer = setTimeout(() => {
      socket.send({
        type: "subscribe",
        symbols: [symbol],
      });
    }, 500);

    return () => {
      clearTimeout(timer);
      socket.disconnect();
      setRealtimeCandle(null);
    };
  }, [symbol, selectedPeriod]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0e11] flex flex-col items-center justify-center text-blue-500 font-mono">
        <Loader2 className="animate-spin mb-4" size={40} />
        <span className="uppercase tracking-[0.3em] text-sm animate-pulse">
          Syncing Market Data...
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0e11] min-h-screen text-gray-300 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between mb-8 border-b border-gray-800 pb-8 gap-6 items-start md:items-center">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
              <img
                src={details?.image || `https://images.financialmodelingprep.com/symbol/${symbol}.png`}
                className="relative w-16 h-16 bg-white rounded-xl p-2 object-contain"
                alt={symbol || "symbol"}
              />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black text-white tracking-tight uppercase">
                  {details?.company_name || symbol || "Unknown Company"}
                </h1>
                <ShieldCheck className="text-blue-500" size={20} />
              </div>

              <div className="flex flex-wrap gap-3 mt-2 text-xs font-bold items-center uppercase tracking-wider text-gray-500">
                <span className="text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase">
                  {details?.exchange || "MARKET"}: {details?.symbol || symbol}
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe size={14} />
                  {details?.industry || "Unknown Industry"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Building2 size={14} />
                  {details?.sector || "Unknown Sector"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right bg-[#131722] px-6 py-3 rounded-xl border border-gray-800 shadow-xl">
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">
              Live Value
            </div>
            <div className="text-2xl font-mono font-bold text-white tabular-nums">
              ${livePrice.toFixed(2)}
            </div>
            <div className="text-green-400 text-[10px] font-black flex items-center justify-end gap-1 mt-0.5 uppercase tracking-tighter">
              FastAPI Stream
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping ml-1" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-[#131722] border border-gray-800 rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-black/20">
                <h2 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp className="text-blue-500" size={16} />
                  Technical Chart
                </h2>

                <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-gray-800">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPeriod(p.id)}
                      className={`px-3 py-1 text-[10px] rounded-md font-bold transition-all uppercase ${
                        selectedPeriod === p.id
                          ? "bg-blue-600 text-white shadow-lg"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[520px] w-full p-2">
                {chartLoading ? (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Loading chart...
                  </div>
                ) : candles.length > 0 ? (
                  <LightChart
                    symbol={symbol}
                    data={candles}
                    realtimeCandle={realtimeCandle}
                    period={selectedPeriod}
                    indicators={[]}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                    No candle data available
                  </div>
                )}
              </div>
            </section>

            <section className="bg-[#131722] border border-gray-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase className="text-blue-500" size={18} />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Company Overview
                </h2>
              </div>

              <p className="text-sm text-gray-400 leading-7">
                {details?.description || "No company description available."}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="bg-black/20 border border-gray-800 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">
                    CEO
                  </div>
                  <div className="text-sm text-white font-semibold">
                    {details?.ceo || "N/A"}
                  </div>
                </div>

                <div className="bg-black/20 border border-gray-800 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">
                    Country
                  </div>
                  <div className="text-sm text-white font-semibold">
                    {details?.country || "N/A"}
                  </div>
                </div>

                <div className="bg-black/20 border border-gray-800 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">
                    Employees
                  </div>
                  <div className="text-sm text-white font-semibold">
                    {details?.full_time_employees
                      ? Number(details.full_time_employees).toLocaleString("en-US")
                      : "N/A"}
                  </div>
                </div>

                <div className="bg-black/20 border border-gray-800 rounded-xl p-4">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 font-bold">
                    IPO Date
                  </div>
                  <div className="text-sm text-white font-semibold">
                    {formatDate(details?.ipo_date)}
                  </div>
                </div>
              </div>

              {details?.website && (
                <a
                  href={details.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 mt-5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <LinkIcon size={15} />
                  Visit official website
                </a>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 mb-4 border-l-4 border-blue-600 pl-4">
                <Newspaper className="text-blue-600" size={20} />
                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                  Latest News
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {news.map((item, idx) => (
                  <a
                    key={item.id || idx}
                    href={item.source}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#131722] p-5 rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10">
                        {getHostname(item.source)}
                      </span>
                      <span className="text-[10px] text-gray-600 font-mono italic whitespace-nowrap">
                        {formatDate(item.published_at)}
                      </span>
                    </div>

                    <h3 className="text-white font-bold group-hover:text-blue-400 transition-colors mb-2 text-sm leading-6">
                      {item.title}
                    </h3>

                    <p className="text-xs text-gray-500 leading-relaxed font-light">
                      {truncateText(item.content || "", 280)}
                    </p>

                    <div className="mt-3 text-[11px] text-gray-600">
                      Author: {item.author || "Unknown"}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <Activity size={16} className="text-blue-500" />
                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">
                  Fundamental Snapshot
                </h3>
              </div>
              <FundamentalRadar details={details} />
            </section>

            <section className="bg-[#131722] p-6 rounded-2xl border border-gray-800">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                <Layers size={14} className="text-blue-500" />
                Similar Companies
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3">
                {similar.map((comp: any, idx: number) => (
                  <a
                    key={comp.instrument_id || comp.symbol || idx}
                    href={`stock-profile/${String(comp.symbol || "").toLowerCase()}`}
                    className="flex flex-col items-center p-4 rounded-xl bg-black/20 border border-gray-800/50 hover:border-blue-500/50 transition-all group text-center"
                  >
                    <div className="w-12 h-12 bg-white rounded-lg p-1.5 mb-2">
                      <img
                        src={
                          comp.image ||
                          `https://images.financialmodelingprep.com/symbol/${comp.symbol}.png`
                        }
                        alt={comp.symbol}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-black text-white tracking-tighter uppercase">
                      {comp.symbol}
                    </span>
                    <span className="text-[10px] text-gray-500 mt-1 line-clamp-2">
                      {comp.company_name}
                    </span>
                  </a>
                ))}
              </div>
            </section>

            <aside className="bg-[#131722] p-6 rounded-2xl border border-gray-800 space-y-4">
              {[
                {
                  icon: <Building2 size={14} className="text-blue-500" />,
                  label: "Exchange",
                  value: details?.exchange || "N/A",
                },
                {
                  icon: <Globe size={14} className="text-blue-500" />,
                  label: "Industry",
                  value: details?.industry || "N/A",
                },
                {
                  icon: <Briefcase size={14} className="text-blue-500" />,
                  label: "Sector",
                  value: details?.sector || "N/A",
                },
                {
                  icon: <Users size={14} className="text-blue-500" />,
                  label: "Employees",
                  value: details?.full_time_employees
                    ? Number(details.full_time_employees).toLocaleString("en-US")
                    : "N/A",
                },
                {
                  icon: <Calendar size={14} className="text-blue-500" />,
                  label: "IPO Date",
                  value: formatDate(details?.ipo_date),
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-start gap-4 py-2 border-b border-gray-800/50 last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {stat.icon}
                    <span className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">
                      {stat.label}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-bold text-white text-right break-all">
                    {stat.value}
                  </span>
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