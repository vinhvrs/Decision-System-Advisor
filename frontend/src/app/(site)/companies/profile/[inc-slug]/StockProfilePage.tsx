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

/** Dark theme surface tokens for company profile */
const CMC = {
  bg: "bg-[var(--dsa-bg)]",
  card: "bg-[var(--dsa-surface-1)] border border-[var(--dsa-border)]",
  text: "text-[var(--dsa-text)]",
  muted: "text-[var(--dsa-text-muted)]",
  green: "text-[var(--dsa-positive)]",
  red: "text-[var(--dsa-negative)]",
  line: "border-[var(--dsa-border)]",
  tabActive: "border-[var(--dsa-accent)] text-white",
  tabIdle: "border-transparent text-[var(--dsa-text-muted)] hover:text-white",
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
    <div className={`rounded-[var(--dsa-radius-md)] border ${CMC.line} bg-[var(--dsa-surface-2)] p-3`}>
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
      <div className="flex min-h-[55vh] flex-col items-center justify-center bg-[var(--dsa-bg)] text-[var(--dsa-text-muted)]">
        <Loader2 className="mb-3 animate-spin" size={20} />
        <span className="text-xs">Loading company research…</span>
      </div>
    );
  }

  const changeLabel =
    selectedPeriod === "daily"
      ? "24h vs previous daily close"
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

  const chartBlock = (
    <div className={`overflow-hidden rounded-[var(--dsa-radius-md)] ${CMC.card}`}>
      <div
        className={`flex flex-col gap-3 border-b ${CMC.line} px-3 py-3 sm:flex-row sm:items-center sm:justify-between`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-white/[0.08] px-2 py-1 text-[11px] font-semibold text-white">Price</span>
          <span className={`rounded-md px-2 py-1 text-[11px] font-medium ${CMC.muted}`}>Market cap</span>
        </div>
        <SelectDropdown
          className="w-[140px]"
          options={PERIOD_OPTIONS}
          selected={PERIOD_OPTIONS.find((p) => p.id === selectedPeriod) ?? null}
          onSelect={(opt) => setSelectedPeriod(opt.id as TF)}
        />
      </div>
      {candles.length < 2 ? (
        <div className="border-b border-[rgba(216,163,64,0.28)] bg-[rgba(216,163,64,0.08)] px-3 py-2 text-xs text-[#d9bb7a]">
          Persisted {selectedPeriod} history is {candles.length === 1 ? "too short" : "unavailable"} for {symbol}.
          Realtime price may still update, but historical chart data is not synthesized.
        </div>
      ) : (
        <div className="border-b border-[var(--dsa-border)] px-3 py-1.5 text-[10px] text-[var(--dsa-text-muted)]">
          {candles.length.toLocaleString("en-US")} persisted {selectedPeriod} bars loaded.
        </div>
      )}
      <div className="flex h-[min(520px,68vh)] min-h-[300px] w-full flex-col p-2 pb-3">
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
            href="/investing"
            className="shrink-0 rounded-lg border border-[var(--dsa-border)] px-2.5 py-1 font-semibold text-[#7b9cff] transition hover:border-[#3861fb]/50 hover:text-white"
          >
            Investing site
          </Link>
        </nav>

        {/* Three-column shell — left stats | center tabs | right community */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)] xl:items-start xl:gap-5">
          <aside className="order-2 flex flex-col gap-4 xl:sticky xl:top-4 xl:order-1 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
            <div className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-semibold text-white">
                    {stripParentheticals(details?.company_name) || symbol}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[var(--dsa-text-muted)]">{symbol}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleWatchlist}
                  className="dsa-button-secondary min-h-0 shrink-0 px-2.5 py-1 text-[11px]"
                >
                  {watchlisted ? "Watching" : "Watch"}
                </button>
              </div>

              <div className="mt-4 border-t border-[var(--dsa-border)] pt-3">
                <p className="dsa-section-label">Data coverage</p>
                <dl className="mt-2 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--dsa-text-muted)]">Persisted {selectedPeriod} bars</dt>
                    <dd className={`font-mono tabular-nums ${candles.length >= 2 ? "text-white" : "text-[var(--dsa-warning)]"}`}>
                      {candles.length >= 2 ? candles.length.toLocaleString("en-US") : candles.length === 1 ? "1 · short" : "Unavailable"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--dsa-text-muted)]">Realtime quote</dt>
                    <dd className={realtimeCandle ? "text-[var(--dsa-positive)]" : "text-[var(--dsa-text-muted)]"}>
                      {realtimeCandle ? "Received" : "Not received"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--dsa-text-muted)]">Period change</dt>
                    <dd className="font-mono tabular-nums text-white">
                      {changePct != null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : "Unavailable"}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                  Realtime price updates independently from persisted OHLC history. DSA does not fabricate historical bars when coverage is missing.
                </p>
              </div>
            </div>

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
                  className="shrink-0 rounded-md border border-[#3861fb]/30 px-2 py-1 text-[10px] font-bold text-[#7b9cff] transition hover:bg-[#3861fb]/10"
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
                    <div className={`group rounded-lg border ${CMC.line} bg-[var(--dsa-surface-2)] p-3 transition hover:border-[#3861fb]/45 hover:bg-[#111b2a]`}>
                      <div className="flex gap-3">
                        {thumb ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--dsa-border)] bg-black/30">
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#3861fb]/15 text-[#7b9cff]">
                            <Newspaper className="h-4 w-4" aria-hidden />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3861fb]/20 text-[9px] font-bold text-[#9bb4ff]">
                              {sourceBadgeText(label)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-white">
                              {label}
                            </span>
                            <span className={`shrink-0 text-[10px] ${CMC.muted}`}>{formatNewsDate(item)}</span>
                          </div>
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/90">
                            <span className="font-semibold text-[#7b9cff]">${itemSymbol || symbol}</span>{" "}
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
                  <div className={`rounded-lg border ${CMC.line} bg-[var(--dsa-surface-2)] px-4 py-8 text-center`}>
                    <Newspaper className="mx-auto mb-3 h-5 w-5 text-[#7b9cff]" aria-hidden />
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
