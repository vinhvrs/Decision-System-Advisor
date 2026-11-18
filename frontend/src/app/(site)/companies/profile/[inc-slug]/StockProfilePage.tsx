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
  Link as LinkIcon,
  Activity,
  ChevronRight,
  Info,
  Star,
  Share2,
} from "lucide-react";

import TradingChart from "@/src/components/charts/page";
import SelectDropdown from "@/src/sections/Dropdown";
import ProfilePaperTradingPanel from "@/src/components/paperTrading/ProfilePaperTradingPanel";
import ProfileChartPositionsLog from "@/src/components/paperTrading/ProfileChartPositionsLog";
import type { PaperTradingSnapshot } from "@/src/components/paperTrading/paperTradingTypes";
import FundamentalRadar from "./FundamentalRadar";
import { FundamentalSection } from "@/src/components/investing/FundamentalSection";
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

type ProfileMainTab = "chart" | "markets" | "news" | "holders" | "fundamentals" | "about";

const PERIOD_OPTIONS: Array<{ id: TF; label: string }> = [
  { id: "daily", label: "Daily" },
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

function formatNewsDate(item: any) {
  return formatDate(item?.published_at || item?.created_at);
}

function newsPublishedMs(item: any): number {
  const raw = item?.published_at || item?.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Newest first for profile feeds. */
function sortNewsByDateDesc(items: any[] | null | undefined): any[] {
  return [...(items || [])].sort((a, b) => newsPublishedMs(b) - newsPublishedMs(a));
}

function truncateText(text: string, max = 220) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function sourceBadgeText(label: string) {
  const letter = label.match(/[A-Za-z]/)?.[0];
  return (letter || "N").toUpperCase();
}

function formatUsdStat(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

/** Shared research-terminal tokens for company profile. */
const CMC = {
  bg: "bg-[var(--dsa-bg)]",
  card: "bg-[var(--dsa-surface-1)] border border-[var(--dsa-border)]",
  text: "text-[var(--dsa-text)]",
  muted: "text-[var(--dsa-text-muted)]",
  green: "text-[var(--dsa-positive)]",
  red: "text-[var(--dsa-negative)]",
  line: "border-[var(--dsa-border)]",
  tabActive: "border-[#4c8dff] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]",
  tabIdle: "border-transparent text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white",
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
    <div className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-2.5">
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
  { id: "fundamentals", label: "Fundamentals" },
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
  const [mainTab, setMainTab] = useState<ProfileMainTab>("chart");
  const [watchlisted, setWatchlisted] = useState(false);
  const [sentimentBull, setSentimentBull] = useState(0);
  const [sentimentBear, setSentimentBear] = useState(0);
  const [paperTrading, setPaperTrading] = useState<PaperTradingSnapshot | null>(null);

  const candleRequestIdRef = useRef(0);

  useEffect(() => {
    setPaperTrading(null);
  }, [symbol]);

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
  const sidebarNews = useMemo(() => sortNewsByDateDesc(news).slice(0, 8), [news]);
  const latestNewsMs = sidebarNews.length ? newsPublishedMs(sidebarNews[0]) : 0;
  const hasRecentSidebarNews =
    latestNewsMs > 0 && Date.now() - latestNewsMs < 1000 * 60 * 60 * 24 * 30;

  const sentimentTotal = sentimentBull + sentimentBear;
  const bullishPct = sentimentTotal > 0 ? Math.round((sentimentBull / sentimentTotal) * 100) : null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "fundamentals") setMainTab("fundamentals");
    else setMainTab("chart");
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
          newsLimit: 40,
          similarLimit: 6,
        });

        if (cancelled) return;

        setDetails(bundle.profile || null);
        setNews(sortNewsByDateDesc(bundle.news));
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

  /** Keep the sidebar + News tab aligned with the newest symbol-linked articles. */
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await CompanyService.getCompanyNews(symbol, 40);
        if (cancelled) return;
        setNews(sortNewsByDateDesc(list));
      } catch {
        /* ignore transient failures */
      }
    };
    const intervalMs = 120_000;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol]);

  const fetchCandles = useCallback(async (ticker: string, period: TF) => {
    if (!ticker || !period) {
      setCandles([]);
      return;
    }

    const requestId = ++candleRequestIdRef.current;

    try {
      setRealtimeCandle(null);

      const raw = await InstrumentService.getInstrumentData(ticker, period, 1000, 1);

      if (requestId !== candleRequestIdRef.current) return;

      const normalized = normalizeCandles(raw || [], period);
      setCandles(normalized);
    } catch (error) {
      if (requestId !== candleRequestIdRef.current) return;
      console.error("Fetch candles failed:", error);
      setCandles([]);
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
      <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[var(--dsa-bg)] text-[var(--dsa-text-muted)]">
        <Loader2 className="mb-3 animate-spin text-[#8ab4ff]" size={22} />
        <span className="text-xs font-medium">Loading company research…</span>
      </div>
    );
  }

  const changeLabel =
    selectedPeriod === "daily"
      ? "vs previous daily close"
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

  const lastBarLabel = lastCandle?.time
    ? new Date(Number(lastCandle.time)).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Unavailable";

  const chartBlock = (
    <div className="overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
      <div className="flex flex-col gap-2 border-b border-[var(--dsa-border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--dsa-text-muted)]">
          <span className="dsa-section-label">Price history</span>
          <span>
            <strong className="font-mono font-semibold text-[var(--dsa-text-secondary)]">{candles.length}</strong> loaded bars
          </span>
          <span>
            Last stored bar: <strong className="font-medium text-[var(--dsa-text-secondary)]">{lastBarLabel}</strong>
          </span>
          <span>{realtimeCandle ? "Realtime quote overlay received" : "Stored bars only"}</span>
        </div>
        <SelectDropdown
          className="w-[132px]"
          options={PERIOD_OPTIONS}
          selected={PERIOD_OPTIONS.find((p) => p.id === selectedPeriod) ?? null}
          onSelect={(opt) => setSelectedPeriod(opt.id as TF)}
        />
      </div>
      <div className="flex h-[min(560px,68vh)] min-h-[320px] w-full flex-col p-1.5 pb-2">
        <div className="min-h-0 flex-1">
          <TradingChart
            defaultSymbol={symbol}
            lockSymbol={symbol}
            controlledPeriod={selectedPeriod}
            hideToolbar
            hidePositionsPanel
            embed
            onPaperTradingChange={setPaperTrading}
          />
        </div>
      </div>
      <ProfileChartPositionsLog symbol={symbol} paperState={paperTrading} />
      <div className="grid gap-2 border-t border-[var(--dsa-border)] px-3 py-2 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium text-[var(--dsa-text-muted)]">Loaded-range high</p>
          <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-white">
            {athAtl.high != null ? `${athAtl.high.toFixed(2)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium text-[var(--dsa-text-muted)]">Loaded-range low</p>
          <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-white">
            {athAtl.low != null ? `${athAtl.low.toFixed(2)}` : "—"}
          </p>
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
            href="/investing"
            className="dsa-button-secondary min-h-0 shrink-0 px-2.5 py-1 text-xs"
          >
            Research workspace
          </Link>
        </nav>

        <section className="mb-3 rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-3">
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={details?.image || `https://images.financialmodelingprep.com/symbol/${symbol}.png`}
                className="h-10 w-10 shrink-0 rounded-[var(--dsa-radius-sm)] bg-white object-contain p-1"
                alt=""
              />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <h1 className="truncate text-base font-semibold text-white tablet:text-lg">
                    {stripParentheticals(details?.company_name) || symbol}
                  </h1>
                  <span className="rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-surface-3)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                    {details?.symbol || symbol}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--dsa-text-muted)]">
                  <span>{details?.exchange || "Exchange unavailable"}</span>
                  <span>·</span>
                  <span>{details?.industry || details?.sector || "Industry unavailable"}</span>
                  <span>·</span>
                  <span>Equity</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 tablet:justify-end">
              <div className="min-w-[10rem]">
                <p className="font-mono text-xl font-semibold tabular-nums text-white">
                  {livePrice > 0
                    ? `${livePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </p>
                {changePct != null ? (
                  <p
                    className={`mt-0.5 flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums ${
                      changePct >= 0 ? CMC.green : CMC.red
                    }`}
                  >
                    {changePct >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%
                    <span className="font-sans font-normal text-[var(--dsa-text-muted)]">· {changeLabel}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-[var(--dsa-text-muted)]">Change unavailable</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={toggleWatchlist}
                  className="dsa-button-secondary min-h-0 px-2.5 py-1.5 text-xs"
                  aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <Star className={`h-3.5 w-3.5 ${watchlisted ? "fill-[#d8a340] text-[#d8a340]" : ""}`} />
                  {watchlisted ? "Watching" : "Watch"}
                </button>
                <button
                  type="button"
                  onClick={shareProfile}
                  className="dsa-button-secondary min-h-0 px-2 py-1.5"
                  aria-label="Share company profile"
                  title="Share"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Three-column research shell — stats | analysis | local context */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)] xl:items-start xl:gap-5">
          <aside className="order-2 flex flex-col gap-4 xl:sticky xl:top-[calc(var(--dsa-header-height)_+_12px)] xl:order-1 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
            <div className="rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="dsa-section-label">Signal radar</p>
                  <p className="mt-0.5 text-[10px] text-[var(--dsa-text-muted)]">Comparative multi-factor research context</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] ${
                    realtimeCandle ? "text-[var(--dsa-positive)]" : "text-[var(--dsa-text-muted)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      realtimeCandle ? "bg-[var(--dsa-positive)]" : "bg-[var(--dsa-text-muted)]"
                    }`}
                  />
                  {realtimeCandle ? "Quote received" : "Stored data"}
                </span>
              </div>
              <div className="mt-2">
                <FundamentalRadar symbol={symbol} compact />
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

            <div className="rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--dsa-text-secondary)]">Profile completeness</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-[#8ab4ff]">{profileScore}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dsa-surface-3)]">
                <div className="h-full bg-[#4c8dff]" style={{ width: `${profileScore}%` }} />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                Field completeness only. This is not an investment score or quality rating.
              </p>
            </div>

            <ProfilePaperTradingPanel symbol={symbol} state={paperTrading} />

            <div className="flex flex-col gap-2">
              {details?.website ? (
                <a
                  href={details.website}
                  target="_blank"
                  rel="noreferrer"
                  className="dsa-button-secondary min-h-0 py-2 text-xs"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              ) : null}
              <Link
                href="/search"
                className="dsa-button-secondary min-h-0 py-2 text-xs"
              >
                <Building2 className="h-4 w-4" />
                More companies
              </Link>
            </div>

            <div className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
              <p className={`mb-2 text-[10px] font-bold uppercase tracking-wider ${CMC.muted}`}>Listing</p>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#8ab4ff]" />
                <span className="text-white">{details?.exchange || "—"}</span>
                <span className={CMC.muted}>·</span>
                <span className={`truncate ${CMC.muted}`}>{details?.industry || "Industry N/A"}</span>
              </div>
            </div>
          </aside>

          <main className="order-1 min-w-0 xl:order-2">
            <div className="sticky top-[var(--dsa-header-height)] z-20 mb-3 flex items-center justify-between gap-2 border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-1.5 py-1">
              <div className="no-scrollbar flex min-w-0 gap-0.5 overflow-x-auto">
                {MAIN_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setMainTab(t.id)}
                    className={`shrink-0 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      mainTab === t.id ? CMC.tabActive : CMC.tabIdle
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

            </div>

            {mainTab === "chart" && (
              <div className="space-y-4">
                {chartBlock}
                <details className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#8ab4ff]">
                    <Info className="h-4 w-4" />
                    How chart stats are read
                  </summary>
                  <ul className={`mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed ${CMC.muted}`}>
                    <li>
                      <strong className="text-white/90">% change</strong> compares the last closed bar on this timeframe
                      to the previous one.
                    </li>
                    <li>
                      <strong className="text-white/90">Estimated dollar volume</strong> is last bar share volume times
                      its closing price.
                    </li>
                    <li>
                      <strong className="text-white/90">Volume vs market cap</strong> divides that estimate by the
                      profile market cap when both are available.
                    </li>
                  </ul>
                </details>
              </div>
            )}

            {mainTab === "markets" && (
              <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} overflow-hidden`}>
                <div className={`flex flex-wrap items-center gap-2 border-b ${CMC.line} px-4 py-3`}>
                  <span className="rounded-md bg-[#3978df] px-2.5 py-1 text-[11px] font-bold text-white">ALL</span>
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
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase">Price</th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase">Volume (est.)</th>
                        <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase">Vol / Mkt cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className={`border-t ${CMC.line} bg-white/[0.02]`}>
                        <td className="px-4 py-3 tabular-nums text-white">1</td>
                        <td className="px-4 py-3 font-medium text-white">{details?.exchange || "—"}</td>
                        <td className="px-4 py-3 font-mono text-[#8ab4ff]">{details?.symbol || symbol}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-white">
                          {livePrice > 0 ? `${livePrice.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-white">{formatUsdStat(volUsdEst)}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                              volToMktPct != null ? "bg-[rgba(44,182,125,0.12)] text-[var(--dsa-positive)]" : `${CMC.muted} bg-[var(--dsa-surface-2)]`
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
                  <p className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-8 text-center text-sm ${CMC.muted}`}>
                    No news items for this symbol yet.
                  </p>
                ) : (
                  news.map((item, idx) => {
                    const { kind, href } = resolveNewsHref(item);
                    const label = newsSourceLabel(item);
                    const thumb = pickNewsThumbImage(item);
                    const cardClass = `block rounded-[var(--dsa-radius-md)] ${CMC.card} p-4 transition hover:border-[rgba(76,141,255,0.45)]`;
                    const inner = (
                      <>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          <span className="rounded border border-[rgba(76,141,255,0.20)] bg-[#3978df]/10 px-2 py-0.5 font-bold uppercase text-[#8ab4ff]">
                            {label}
                          </span>
                          <span className={CMC.muted}>{formatDate(item.published_at)}</span>
                        </div>
                        <div className="flex gap-3">
                          {thumb ? (
                            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--dsa-border)] bg-black/30">
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
              <section className="rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-6 text-center">
                <Layers className="mx-auto mb-3 h-8 w-8 text-[#8ab4ff] opacity-70" />
                <h2 className="text-sm font-semibold text-white">Institutional holdings unavailable</h2>
                <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[var(--dsa-text-muted)]">
                  No verified institutional-ownership or fund-holdings feed is connected for this profile.
                  DSA does not infer holder concentration from unrelated market data.
                </p>
              </section>
            )}

            {mainTab === "fundamentals" && (
              <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-5`}>
                <h2 className="mb-1 text-lg font-bold text-white">Fundamentals (SEC)</h2>
                <p className={`mb-4 text-xs ${CMC.muted}`}>
                  Long-term financial quality and growth derived from SEC XBRL. Technical columns (price, stance, trend,
                  etc.) stay on the Chart tab.
                </p>
                <FundamentalSection symbol={symbol} />
              </section>
            )}

            {mainTab === "about" && (
              <div className="space-y-4">
                <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-5`}>
                  <div className="mb-3 flex items-center gap-2">
                    <Info className="h-5 w-5 text-[#8ab4ff]" />
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
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#8ab4ff] hover:underline"
                    >
                      <LinkIcon className="h-4 w-4" />
                      Official website
                    </a>
                  ) : null}
                </section>

                <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-5`}>
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="h-4 w-4 text-[#8ab4ff]" />
                    Signal radar
                  </h3>
                  <p className={`mb-3 text-[11px] leading-snug ${CMC.muted}`}>
                    Multi-factor research drivers including price action, volume, liquidity, and available ranking inputs. Scores are comparative context, not a trade instruction.
                  </p>
                  <FundamentalRadar symbol={symbol} />
                </section>

                <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-5`}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Layers className="h-4 w-4 text-[#8ab4ff]" />
                      Similar companies
                    </h3>
                    <Link href="/companies" className="text-xs font-semibold text-[#8ab4ff] hover:underline">
                      See more
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {similar.map((comp: any, idx: number) => (
                      <Link
                        key={comp.instrument_id || comp.symbol || idx}
                        href={`/companies/profile/${String(comp.symbol || "").toLowerCase()}`}
                        className="flex flex-col items-center rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-black/20 p-3 text-center transition hover:border-[rgba(76,141,255,0.45)]"
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

          <aside className="order-3 flex flex-col gap-4 xl:sticky xl:top-[calc(var(--dsa-header-height)_+_12px)] xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
            <section className="rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-3">
              <p className="text-xs font-semibold text-white">Local sentiment poll</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                Stored only in this browser for {symbol}. This is not market-wide sentiment data.
              </p>

              {bullishPct == null ? (
                <p className="mt-3 text-xs text-[var(--dsa-text-muted)]">No local votes yet.</p>
              ) : (
                <>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(231,91,100,0.22)]">
                    <div
                      className="h-full bg-[var(--dsa-positive)] transition-[width] duration-300"
                      style={{ width: `${bullishPct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between font-mono text-[10px] font-semibold tabular-nums">
                    <span className={CMC.green}>{bullishPct}% Bullish</span>
                    <span className={CMC.red}>{100 - bullishPct}% Bearish</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[var(--dsa-text-muted)]">{sentimentTotal} local votes</p>
                </>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={voteBullish}
                  className="rounded-[var(--dsa-radius-sm)] border border-[rgba(44,182,125,0.45)] py-2 text-xs font-semibold text-[var(--dsa-positive)] transition-colors hover:bg-[rgba(44,182,125,0.08)]"
                >
                  Bullish
                </button>
                <button
                  type="button"
                  onClick={voteBearish}
                  className="rounded-[var(--dsa-radius-sm)] border border-[rgba(231,91,100,0.45)] py-2 text-xs font-semibold text-[var(--dsa-negative)] transition-colors hover:bg-[rgba(231,91,100,0.08)]"
                >
                  Bearish
                </button>
              </div>
            </section>

            <div className={`rounded-[var(--dsa-radius-md)] ${CMC.card} flex min-h-[280px] flex-1 flex-col overflow-hidden`}>
              <div className={`flex items-center justify-between gap-3 border-b ${CMC.line} px-3 py-3`}>
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-white">Latest</span>
                  <span className={`block truncate text-[10px] ${CMC.muted}`}>
                    {hasRecentSidebarNews ? "Newest first" : "Archived headlines"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMainTab("news")}
                  className="shrink-0 rounded-md border border-[rgba(76,141,255,0.30)] px-2 py-1 text-[10px] font-bold text-[#8ab4ff] transition hover:bg-[#3978df]/10"
                >
                  View all
                </button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {sidebarNews.map((item, idx) => {
                  const { kind, href } = resolveNewsHref(item);
                  const label = newsSourceLabel(item);
                  const thumb = pickNewsThumbImage(item);
                  const itemSymbol = String(item?.symbol || symbol).trim().toUpperCase();
                  const content = (
                    <div className={`group rounded-lg border ${CMC.line} bg-[#0d1621]/70 p-3 transition hover:border-[rgba(76,141,255,0.45)] hover:bg-[#111b2a]`}>
                      <div className="flex gap-3">
                        {thumb ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--dsa-border)] bg-black/30">
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3978df]/15 text-[#8ab4ff]">
                            <Newspaper className="h-4 w-4" aria-hidden />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3978df]/20 text-[9px] font-bold text-[#9bb4ff]">
                              {sourceBadgeText(label)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">
                              {label}
                            </span>
                            <span className={`shrink-0 text-[10px] ${CMC.muted}`}>{formatNewsDate(item)}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/90">
                            <span className="font-semibold text-[#8ab4ff]">${itemSymbol || symbol}</span>{" "}
                            {truncateText(item.title || "", 140)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                  if (kind === "external") {
                    return (
                      <a key={item.id || idx} href={href} target="_blank" rel="noreferrer" className="block">
                        {content}
                      </a>
                    );
                  }
                  return (
                    <Link key={item.id || idx} href={href} className="block">
                      {content}
                    </Link>
                  );
                })}
                {sidebarNews.length === 0 ? (
                  <div className={`rounded-lg border ${CMC.line} bg-[#0d1621]/70 px-4 py-8 text-center`}>
                    <Newspaper className="mx-auto mb-3 h-5 w-5 text-[#8ab4ff]" aria-hidden />
                    <p className={`text-xs ${CMC.muted}`}>No headlines for {symbol} yet.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>

        <p className={`mt-8 text-center text-[10px] ${CMC.muted}`}>
          Information is for reference only and is not investment advice.
        </p>
      </div>
    </div>
  );
}
