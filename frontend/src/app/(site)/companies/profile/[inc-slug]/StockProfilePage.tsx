/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Loader2,
  Globe,
  Newspaper,
  Layers,
  Building2,
  Briefcase,
  Link as LinkIcon,
  Activity,
  ChevronRight,
  Info,
  Star,
  Share2,
  MessageCircle,
  Heart,
} from "lucide-react";

import LightChart from "@/src/components/charts/LightChart";
import FundamentalRadar from "./FundamentalRadar";
import { InstrumentService } from "@/src/services/Instrument.service";
import { CompanyService } from "@/src/services/Company.service";
import { SimpleSocket } from "@/src/libs/socket";
import { stripParentheticals } from "@/src/libs/displayString";
import {
  newsSourceLabel,
  pickNewsThumbImage,
  resolveNewsHref,
} from "@/src/libs/newsArticle";

type TF = "daily" | "weekly" | "monthly" | "yearly";

type ProfileMainTab = "chart" | "markets" | "news" | "holders" | "about";

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

function truncateText(text: string, max = 220) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatUsdStat(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/** CoinMarketCap-inspired surface tokens */
const CMC = {
  bg: "bg-[#0b0e11]",
  card: "bg-[#1e2329] border border-[#2b3139]",
  text: "text-[#eaecef]",
  muted: "text-[#848e9c]",
  green: "text-[#16c784]",
  red: "text-[#ea3943]",
  line: "border-[#2b3139]",
  tabActive: "border-[#3861fb] text-white",
  tabIdle: "border-transparent text-[#848e9c] hover:text-[#eaecef]",
};

function computeProfileScore(d: any): number {
  if (!d || typeof d !== "object") return 0;
  const keys = [
    d.company_name,
    d.symbol,
    d.description,
    d.ceo,
    d.website,
    d.exchange,
    d.sector,
    d.industry,
    d.market_cap,
    d.country,
    d.ipo_date,
    d.full_time_employees,
    d.image,
  ];
  const filled = keys.filter((v) => v !== undefined && v !== null && String(v).trim() !== "").length;
  return Math.round((filled / keys.length) * 100);
}

function sentimentStorageKey(sym: string) {
  return `dsa-profile-sentiment-${sym}`;
}

function StatTile({
  label,
  value,
  hintTitle,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  hintTitle?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${CMC.line} bg-[#0d1621]/90 p-3`}>
      <div className="mb-1 flex items-center gap-1">
        <span className={`text-[11px] font-medium leading-tight ${CMC.muted}`}>{label}</span>
        {hintTitle ? (
          <span title={hintTitle} className="inline-flex cursor-help text-[#848e9c]">
            <Info className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </span>
        ) : null}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-white">{value}</div>
      {sub ? <div className={`mt-1 text-[10px] leading-snug ${CMC.muted}`}>{sub}</div> : null}
    </div>
  );
}

const MAIN_TABS: Array<{ id: ProfileMainTab; label: string }> = [
  { id: "chart", label: "Chart" },
  { id: "markets", label: "Markets" },
  { id: "news", label: "News" },
  { id: "holders", label: "Holders" },
  { id: "about", label: "About" },
];

export function StockProfilePage({ slug }: { slug: string }) {
  const symbol = useMemo(() => normalizeSymbolFromSlug(slug), [slug]);

  const [details, setDetails] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TF>("daily");

  const [candles, setCandles] = useState<any[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [mainTab, setMainTab] = useState<ProfileMainTab>("chart");
  const [watchlisted, setWatchlisted] = useState(false);
  const [sentimentBull, setSentimentBull] = useState(42);
  const [sentimentBear, setSentimentBear] = useState(8);

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

  const changePct = useMemo(() => {
    if (candles.length < 2) return null;
    const prev = toNumber(candles[candles.length - 2].close);
    const last = toNumber(candles[candles.length - 1].close);
    if (!prev) return null;
    return ((last - prev) / prev) * 100;
  }, [candles]);

  const lastCandle = candles.length ? candles[candles.length - 1] : null;

  const athAtl = useMemo(() => {
    if (!candles.length) return { high: null as number | null, low: null as number | null };
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of candles) {
      hi = Math.max(hi, toNumber(c.high));
      lo = Math.min(lo, toNumber(c.low));
    }
    return {
      high: Number.isFinite(hi) ? hi : null,
      low: Number.isFinite(lo) ? lo : null,
    };
  }, [candles]);

  const marketCap = toNumber(details?.market_cap);
  const volShares = lastCandle ? toNumber(lastCandle.volume) : 0;
  const volUsdEst = lastCandle && livePrice ? volShares * livePrice : 0;
  const volToMktPct =
    marketCap > 0 && volUsdEst > 0 ? (volUsdEst / marketCap) * 100 : null;

  const profileScore = useMemo(() => computeProfileScore(details), [details]);

  const sentimentTotal = sentimentBull + sentimentBear;
  const bullishPct = sentimentTotal > 0 ? Math.round((sentimentBull / sentimentTotal) * 100) : 50;

  useEffect(() => {
    setMainTab("chart");
  }, [symbol]);

  useEffect(() => {
    if (typeof window === "undefined" || !symbol) return;
    try {
      setWatchlisted(sessionStorage.getItem(`dsa-watch-${symbol}`) === "1");
    } catch {
      /* ignore */
    }
  }, [symbol]);

  useEffect(() => {
    if (typeof window === "undefined" || !symbol) return;
    try {
      const raw = sessionStorage.getItem(sentimentStorageKey(symbol));
      if (!raw) return;
      const j = JSON.parse(raw) as { bull?: number; bear?: number };
      if (typeof j.bull === "number" && typeof j.bear === "number" && j.bull + j.bear > 0) {
        setSentimentBull(j.bull);
        setSentimentBear(j.bear);
      }
    } catch {
      /* ignore */
    }
  }, [symbol]);

  useEffect(() => {
    if (typeof window === "undefined" || !symbol) return;
    try {
      sessionStorage.setItem(
        sentimentStorageKey(symbol),
        JSON.stringify({ bull: sentimentBull, bear: sentimentBear }),
      );
    } catch {
      /* ignore */
    }
  }, [symbol, sentimentBull, sentimentBear]);

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

        const bundle = await CompanyService.getCompanyProfileBundle(symbol, {
          newsLimit: 25,
          similarLimit: 6,
        });

        if (cancelled) return;

        setDetails(bundle.profile || null);
        setNews(bundle.news.slice(0, 5));
        setSimilar(Array.isArray(bundle.similar) ? bundle.similar.slice(0, 6) : []);
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

    const socket = new SimpleSocket((data: any) => {
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

  const changeLabel =
    selectedPeriod === "daily"
      ? "24h (vs previous daily close)"
      : `Change vs previous ${selectedPeriod} bar`;

  const toggleWatchlist = () => {
    const next = !watchlisted;
    setWatchlisted(next);
    if (typeof window !== "undefined" && symbol) {
      try {
        sessionStorage.setItem(`dsa-watch-${symbol}`, next ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  };

  const shareProfile = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    void (async () => {
      try {
        if (navigator.share) await navigator.share({ title: `${symbol} — DSA`, url });
        else await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
    })();
  };

  const voteBullish = () => setSentimentBull((b) => b + 1);
  const voteBearish = () => setSentimentBear((b) => b + 1);

  const chartBlock = (
    <div className={`overflow-hidden rounded-xl ${CMC.card}`}>
      <div
        className={`flex flex-col gap-3 border-b ${CMC.line} px-3 py-3 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-white/[0.08] px-2 py-1 text-[11px] font-semibold text-white">Price</span>
          <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${CMC.muted}`}>Market cap</span>
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-lg bg-black/30 p-1">
          {PERIOD_OPTIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPeriod(p.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                selectedPeriod === p.id ? "bg-[#3861fb] text-white" : `${CMC.muted} hover:text-white`
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex h-[min(520px,68vh)] min-h-[300px] w-full flex-col p-2 pb-3">
        {chartLoading ? (
          <div className={`flex min-h-[240px] flex-1 items-center justify-center gap-2 ${CMC.muted}`}>
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading chart…
          </div>
        ) : candles.length > 0 ? (
          <div className="min-h-0 flex-1">
            <LightChart
              symbol={symbol}
              data={candles}
              realtimeCandle={realtimeCandle}
              period={selectedPeriod}
              indicators={[]}
            />
          </div>
        ) : (
          <div className={`flex min-h-[240px] flex-1 items-center justify-center text-sm ${CMC.muted}`}>
            No price data for this range.
          </div>
        )}
      </div>
      <div className={`grid gap-3 border-t ${CMC.line} p-4 sm:grid-cols-2`}>
        <div>
          <p className={`text-[11px] font-medium ${CMC.muted}`}>History high (loaded range)</p>
          <p className="mt-0.5 font-mono text-sm text-white">{athAtl.high != null ? `$${athAtl.high.toFixed(2)}` : "—"}</p>
        </div>
        <div>
          <p className={`text-[11px] font-medium ${CMC.muted}`}>History low (loaded range)</p>
          <p className="mt-0.5 font-mono text-sm text-white">{athAtl.low != null ? `$${athAtl.low.toFixed(2)}` : "—"}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${CMC.bg} ${CMC.text} font-sans antialiased`}>
      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 md:py-6 lg:px-6">
        <nav
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 text-xs ${CMC.muted}`}
          aria-label="Breadcrumb"
        >
          <div className="flex flex-wrap items-center gap-1">
            <Link href="/" className="hover:text-white">
              DSA
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <Link href="/companies" className="hover:text-white">
              Companies
            </Link>
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            <span className="text-white">{symbol}</span>
          </div>
          <Link
            href="/trading"
            className="shrink-0 rounded-lg border border-[#2b3139] px-2.5 py-1 font-semibold text-[#7b9cff] transition hover:border-[#3861fb]/50 hover:text-white"
          >
            Trading site
          </Link>
        </nav>

        {/* Three-column shell — left stats | center tabs | right community */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)] xl:items-start xl:gap-5">
          <aside className="order-2 flex flex-col gap-4 xl:sticky xl:top-4 xl:order-1 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
            <div className={`rounded-xl ${CMC.card} p-4`}>
              <div className="flex gap-3">
                <img
                  src={details?.image || `https://images.financialmodelingprep.com/symbol/${symbol}.png`}
                  className="h-12 w-12 shrink-0 rounded-full bg-white object-contain p-1"
                  alt=""
                />
                <div className="min-w-0 flex-1">
                  <h1 className="text-base font-bold leading-snug text-white">
                    {stripParentheticals(details?.company_name) || symbol}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#2b3139] px-2 py-0.5 font-mono text-xs font-semibold text-white">
                      {details?.symbol || symbol}
                    </span>
                    <span className="rounded-md bg-[#f7931a]/20 px-2 py-0.5 text-[11px] font-bold text-[#f0b90b]">EQ</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={toggleWatchlist}
                        className="rounded-lg p-2 text-[#848e9c] transition hover:bg-white/5 hover:text-[#f0b90b]"
                        aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                        title="Watchlist"
                      >
                        <Star className={`h-4 w-4 ${watchlisted ? "fill-[#f0b90b] text-[#f0b90b]" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={shareProfile}
                        className="rounded-lg p-2 text-[#848e9c] transition hover:bg-white/5 hover:text-white"
                        aria-label="Share"
                        title="Share"
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  ${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {changePct != null ? (
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold tabular-nums ${
                      changePct >= 0 ? `bg-[#16c784]/15 ${CMC.green}` : `bg-[#ea3943]/15 ${CMC.red}`
                    }`}
                  >
                    {changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}% <span className={`font-normal ${CMC.muted}`}>({changeLabel})</span>
                  </span>
                ) : (
                  <p className={`mt-2 text-sm ${CMC.muted}`}>—</p>
                )}

                <div className="mt-4 border-t border-[#2b3139] pt-3">
                  <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${CMC.muted}`}>
                    Beginner radar
                  </p>
                  <FundamentalRadar symbol={symbol} compact />
                </div>

                <p className={`mt-3 flex items-center gap-1 text-[10px] ${CMC.muted}`}>
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#16c784]" />
                  Live stream when connected
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile
                label="Market cap"
                value={formatUsdStat(marketCap)}
                hintTitle="From company profile when available."
              />
              <StatTile
                label="Volume (est.)"
                value={formatUsdStat(volUsdEst)}
                hintTitle="Last candle: shares × close. Not full-session exchange volume."
              />
              <StatTile
                label="Vol / Mkt cap"
                value={volToMktPct != null ? `${volToMktPct.toFixed(2)}%` : "—"}
                hintTitle="Estimated dollar volume of last bar ÷ market cap."
              />
              <StatTile label="Last price" value={livePrice > 0 ? `$${livePrice.toFixed(2)}` : "—"} />
              <StatTile
                label="Range high"
                value={athAtl.high != null ? `$${athAtl.high.toFixed(2)}` : "—"}
                hintTitle="Max high in loaded candles for the selected period."
              />
              <StatTile
                label="Range low"
                value={athAtl.low != null ? `$${athAtl.low.toFixed(2)}` : "—"}
                hintTitle="Min low in loaded candles for the selected period."
              />
              <StatTile
                label="Employees"
                value={
                  details?.full_time_employees
                    ? Number(details.full_time_employees).toLocaleString("en-US")
                    : "—"
                }
              />
              <StatTile label="IPO" value={formatDate(details?.ipo_date)} />
            </div>

            <div className={`rounded-xl ${CMC.card} p-4`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${CMC.muted}`}>Profile score</span>
                <span className="text-xs font-bold text-[#f0b90b]">{profileScore}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#2b3139]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#c99400] to-[#f0b90b]"
                  style={{ width: `${profileScore}%` }}
                />
              </div>
              <p className={`mt-2 text-[10px] leading-relaxed ${CMC.muted}`}>
                How complete this company record is (name, sector, financials, description, etc.).
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {details?.website ? (
                <a
                  href={details.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[#2b3139] bg-[#2b3139]/50 py-2.5 text-sm font-semibold text-white transition hover:border-[#3861fb]/50 hover:bg-[#3861fb]/10"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              ) : null}
              <Link
                href="/search"
                className={`flex items-center justify-center gap-2 rounded-xl border ${CMC.line} py-2.5 text-sm font-semibold ${CMC.muted} transition hover:border-[#3861fb]/40 hover:text-white`}
              >
                <Building2 className="h-4 w-4" />
                More companies
              </Link>
            </div>

            <div className={`rounded-xl ${CMC.card} p-4`}>
              <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${CMC.muted}`}>Listing</p>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#3861fb]" />
                <span className="text-white">{details?.exchange || "—"}</span>
                <span className={CMC.muted}>·</span>
                <span className={`truncate ${CMC.muted}`}>{details?.industry || "Industry N/A"}</span>
              </div>
            </div>
          </aside>

          <main className="order-1 min-w-0 xl:order-2">
            <div className={`mb-3 flex flex-col gap-3 rounded-xl ${CMC.card} px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4`}>
              <div className="no-scrollbar flex gap-0 overflow-x-auto border-b border-transparent sm:border-0">
                {MAIN_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMainTab(t.id)}
                    className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
                      mainTab === t.id ? CMC.tabActive : CMC.tabIdle
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-2 px-1 sm:px-0">
                <button
                  type="button"
                  onClick={toggleWatchlist}
                  className="rounded-lg bg-[#3861fb] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#3861fb]/20 transition hover:bg-[#2f56e0]"
                >
                  {watchlisted ? "Watching" : "Track symbol"}
                </button>
                <span
                  className={`hidden rounded-lg border px-3 py-2 text-[11px] font-semibold sm:inline ${CMC.line} ${CMC.muted}`}
                  title="Placeholder — connect alerts in settings"
                >
                  Pro view
                </span>
              </div>
            </div>

            {mainTab === "chart" && (
              <div className="space-y-4">
                {chartBlock}
                <details className={`rounded-xl ${CMC.card} p-4`}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#7b9cff]">
                    <Info className="h-4 w-4" />
                    How these numbers are calculated
                  </summary>
                  <ul className={`mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed ${CMC.muted}`}>
                    <li>
                      <strong className="text-white/90">% change:</strong>{" "}
                      <code className="rounded bg-black/30 px-1 font-mono text-[11px]">
                        (lastClose − previousClose) / previousClose × 100
                      </code>{" "}
                      on the last two candles for the selected timeframe.
                    </li>
                    <li>
                      <strong className="text-white/90">Estimated dollar volume:</strong> last bar share volume × its
                      close.
                    </li>
                    <li>
                      <strong className="text-white/90">Vol / Market cap:</strong> that estimate ÷ profile market cap when
                      both exist.
                    </li>
                  </ul>
                </details>
              </div>
            )}

            {mainTab === "markets" && (
              <section className={`rounded-xl ${CMC.card} overflow-hidden`}>
                <div className={`flex flex-wrap items-center gap-2 border-b ${CMC.line} px-4 py-3`}>
                  <span className="rounded-md bg-[#3861fb] px-2.5 py-1 text-[11px] font-bold text-white">ALL</span>
                  <span className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${CMC.muted}`}>Primary</span>
                </div>
                <h2 className="px-4 pt-4 text-lg font-bold text-white">
                  {stripParentheticals(details?.company_name) || symbol}{" "}
                  <span className={CMC.muted}>markets</span>
                </h2>
                <p className={`px-4 pb-3 text-xs ${CMC.muted}`}>
                  Primary listing for this equity. Depth and multi-venue breakdown can be added when your data source
                  supports it.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className={`border-t ${CMC.line} ${CMC.muted}`}>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">#</th>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Venue</th>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Symbol</th>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Price</th>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Volume (est.)</th>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Vol %</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={`border-t ${CMC.line} bg-white/[0.02]`}>
                        <td className="px-4 py-3 tabular-nums text-white">1</td>
                        <td className="px-4 py-3 font-medium text-white">{details?.exchange || "—"}</td>
                        <td className="px-4 py-3 font-mono text-[#7b9cff]">{details?.symbol || symbol}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-white">
                          {livePrice > 0 ? `$${livePrice.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono tabular-nums text-white">{formatUsdStat(volUsdEst)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                              volToMktPct != null ? "bg-[#16c784]/15 text-[#16c784]" : `${CMC.muted} bg-[#2b3139]`
                            }`}
                          >
                            {volToMktPct != null ? `${volToMktPct.toFixed(1)}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {mainTab === "news" && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-white">
                    {symbol} <span className={CMC.muted}>news</span>
                  </h2>
                  <span className={`rounded-md border ${CMC.line} px-2 py-1 text-[10px] font-bold uppercase ${CMC.muted}`}>
                    Latest
                  </span>
                </div>
                {news.length === 0 ? (
                  <p className={`rounded-xl ${CMC.card} p-8 text-center text-sm ${CMC.muted}`}>
                    No news items for this symbol yet.
                  </p>
                ) : (
                  news.map((item, idx) => {
                    const { kind, href } = resolveNewsHref(item);
                    const label = newsSourceLabel(item);
                    const thumb = pickNewsThumbImage(item);
                    const cardClass = `block rounded-xl ${CMC.card} p-4 transition hover:border-[#3861fb]/45`;
                    const inner = (
                      <>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          <span className="rounded border border-[#3861fb]/20 bg-[#3861fb]/10 px-2 py-0.5 font-bold uppercase text-[#7b9cff]">
                            {label}
                          </span>
                          <span className={CMC.muted}>{formatDate(item.published_at)}</span>
                        </div>
                        <div className="flex gap-3">
                          {thumb ? (
                            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-[#2b3139] bg-black/30">
                              <img src={thumb} alt="" className="h-full w-full object-cover" />
                            </div>
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                            <p className={`mt-2 text-xs leading-relaxed ${CMC.muted}`}>
                              {truncateText(item.content || "", 280)}
                            </p>
                          </div>
                        </div>
                      </>
                    );
                    if (kind === "external") {
                      return (
                        <a
                          key={item.id || idx}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className={cardClass}
                        >
                          {inner}
                        </a>
                      );
                    }
                    return (
                      <Link key={item.id || idx} href={href} className={cardClass}>
                        {inner}
                      </Link>
                    );
                  })
                )}
              </section>
            )}

            {mainTab === "holders" && (
              <section className={`rounded-xl ${CMC.card} p-8 text-center`}>
                <Layers className="mx-auto mb-3 h-10 w-10 text-[#3861fb] opacity-60" />
                <h2 className="text-lg font-bold text-white">Holder distribution</h2>
                <p className={`mx-auto mt-2 max-w-md text-sm ${CMC.muted}`}>
                  Blockchain-style holder lists do not apply to this equity profile. Connect a cap-table or institutional
                  holdings feed to show concentration and top holders here.
                </p>
              </section>
            )}

            {mainTab === "about" && (
              <div className="space-y-4">
                <section className={`rounded-xl ${CMC.card} p-5`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5 text-[#3861fb]" />
                    <h2 className="text-base font-bold text-white">
                      About {stripParentheticals(details?.company_name) || symbol}
                    </h2>
                  </div>
                  <p className={`text-sm leading-relaxed ${CMC.muted}`}>
                    {details?.description || "No company description available."}
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "CEO", value: details?.ceo || "—" },
                      { label: "Country", value: details?.country || "—" },
                      {
                        label: "Employees",
                        value: details?.full_time_employees
                          ? Number(details.full_time_employees).toLocaleString("en-US")
                          : "—",
                      },
                      { label: "IPO", value: formatDate(details?.ipo_date) },
                    ].map((x) => (
                      <div key={x.label} className="rounded-lg bg-black/25 px-3 py-2.5">
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${CMC.muted}`}>{x.label}</p>
                        <p className="mt-0.5 text-sm font-medium text-white">{x.value}</p>
                      </div>
                    ))}
                  </div>
                  {details?.website ? (
                    <a
                      href={details.website}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#3861fb] hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Official website
                    </a>
                  ) : null}
                </section>

                <section className={`rounded-xl ${CMC.card} p-5`}>
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="h-4 w-4 text-[#3861fb]" />
                    Beginner radar
                  </h3>
                  <p className={`mb-3 text-[11px] leading-snug ${CMC.muted}`}>
                    Same chart as the beginner / Test homepage: five spokes — Signal, Change, Volume, Liquidity, and Watchers
                    (scores 1–5 vs a volume-ranked symbol pool), plus the Fear &amp; Greed strip from daily snapshot %.
                  </p>
                  <FundamentalRadar symbol={symbol} />
                </section>

                <section className={`rounded-xl ${CMC.card} p-5`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Layers className="h-4 w-4 text-[#3861fb]" />
                      Similar companies
                    </h3>
                    <Link href="/companies" className="text-xs font-semibold text-[#3861fb] hover:underline">
                      See more
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {similar.map((comp: any, idx: number) => (
                      <Link
                        key={comp.instrument_id || comp.symbol || idx}
                        href={`/companies/profile/${String(comp.symbol || "").toLowerCase()}`}
                        className="flex flex-col items-center rounded-xl border border-[#2b3139] bg-black/20 p-3 text-center transition hover:border-[#3861fb]/45"
                      >
                        <div className="mb-2 h-9 w-9 rounded-lg bg-white p-1">
                          <img
                            src={comp.image || `https://images.financialmodelingprep.com/symbol/${comp.symbol}.png`}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <span className="text-[11px] font-bold text-white">{comp.symbol}</span>
                        <span className={`mt-0.5 line-clamp-2 text-[10px] ${CMC.muted}`}>
                          {stripParentheticals(comp.company_name)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </main>

          <aside className="order-3 flex flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
            <div className={`rounded-xl ${CMC.card} p-4`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-white line-clamp-1">
                    {stripParentheticals(details?.company_name) || symbol}
                  </p>
                  <p className={`text-[11px] ${CMC.muted}`}>{sentimentTotal} local votes · demo sentiment</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg bg-[#3861fb] px-3 py-1.5 text-[11px] font-bold text-white"
                  title="Placeholder"
                >
                  + Follow
                </button>
              </div>
              <p className={`mt-3 text-xs font-semibold ${CMC.muted}`}>Community sentiment</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#ea3943]/40">
                <div
                  className="h-full rounded-full bg-[#16c784] transition-all duration-300"
                  style={{ width: `${bullishPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] font-semibold">
                <span className={CMC.green}>{bullishPct}% Bullish</span>
                <span className={CMC.red}>{100 - bullishPct}% Bearish</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={voteBullish}
                  className={`rounded-xl border-2 border-[#16c784]/50 py-2.5 text-xs font-bold ${CMC.green} transition hover:bg-[#16c784]/10`}
                >
                  Bullish
                </button>
                <button
                  type="button"
                  onClick={voteBearish}
                  className={`rounded-xl border-2 border-[#ea3943]/50 py-2.5 text-xs font-bold ${CMC.red} transition hover:bg-[#ea3943]/10`}
                >
                  Bearish
                </button>
              </div>
            </div>

            <div className={`rounded-xl ${CMC.card} flex min-h-[200px] flex-1 flex-col overflow-hidden`}>
              <div className={`flex border-b ${CMC.line} px-3`}>
                <span className="border-b-2 border-[#3861fb] px-2 py-2 text-xs font-bold text-white">Top</span>
                <span className={`px-2 py-2 text-xs font-semibold ${CMC.muted}`}>Latest</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {news.slice(0, 5).map((item, idx) => (
                  <div key={item.id || idx} className={`rounded-lg border ${CMC.line} bg-black/20 p-3`}>
                    <div className="flex gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3861fb]/20 text-[10px] font-bold text-[#7b9cff]">
                        {(newsSourceLabel(item).slice(0, 1) || "N").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-bold text-white">{newsSourceLabel(item)}</span>
                          <span className={`shrink-0 text-[10px] ${CMC.muted}`}>{formatDate(item.published_at)}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-white/90">
                          <span className="text-[#3861fb]">${symbol}</span> {truncateText(item.title || "", 120)}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[#848e9c]">
                          <span className="inline-flex items-center gap-0.5 text-[10px]">
                            <Heart className="h-3.5 w-3.5" /> —
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[10px]">
                            <MessageCircle className="h-3.5 w-3.5" /> —
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {news.length === 0 ? (
                  <p className={`py-6 text-center text-xs ${CMC.muted}`}>No posts yet — check the News tab.</p>
                ) : null}
              </div>
              <div className={`border-t ${CMC.line} p-3`}>
                <div className="flex gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2b3139] text-[10px] font-bold text-[#848e9c]">
                    You
                  </div>
                  <input
                    type="text"
                    readOnly
                    placeholder={`$${symbol} — Community posts coming soon`}
                    className={`min-w-0 flex-1 rounded-lg border ${CMC.line} bg-[#0b0e11] px-3 py-2 text-xs text-white placeholder:text-[#5e6673]`}
                  />
                  <button
                    type="button"
                    disabled
                    className="shrink-0 rounded-lg bg-[#3861fb]/40 px-3 py-2 text-xs font-bold text-white/70"
                  >
                    Post
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <p className={`mt-8 text-center text-[10px] ${CMC.muted}`}>
          Three-column layout inspired by{" "}
          <a
            href="https://coinmarketcap.com/currencies/coinmarketcap-20-index/"
            className="text-[#3861fb] hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            CoinMarketCap
          </a>
          . DSA uses equities data from your stack, not on-chain token markets.
        </p>
      </div>
    </div>
  );
}