/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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

import TradingChart, {
  type TradingChartCandle,
  type TradingChartMarketData,
  type TradingChartPeriod,
} from "@/src/components/charts/page";
import SelectDropdown from "@/src/sections/Dropdown";
import ProfilePaperTradingPanel from "@/src/components/paperTrading/ProfilePaperTradingPanel";
import ProfileChartPositionsLog from "@/src/components/paperTrading/ProfileChartPositionsLog";
import type { PaperTradingSnapshot } from "@/src/components/paperTrading/paperTradingTypes";
import FundamentalRadar from "./FundamentalRadar";
import { FundamentalSection } from "@/src/components/investing/FundamentalSection";
import { CompanyService } from "@/src/services/Company.service";
import { useWatchlist } from "@/src/hooks/useWatchlist";
import { stripParentheticals } from "@/src/libs/displayString";
import {
  newsSourceLabel,
  pickNewsThumbImage,
  resolveNewsHref,
} from "@/src/libs/newsArticle";

type TF = TradingChartPeriod;

type ProfileMainTab = "chart" | "markets" | "news" | "fundamentals" | "about";

const PERIOD_OPTIONS: Array<{ id: TF; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

function toNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

/** Shared research-terminal surface tokens for company profile. */
const CMC = {
  bg: "bg-[var(--dsa-bg)]",
  card: "bg-[var(--dsa-surface-1)] border border-[var(--dsa-border)]",
  text: "text-[var(--dsa-text)]",
  muted: "text-[var(--dsa-text-muted)]",
  green: "text-[var(--dsa-positive)]",
  red: "text-[var(--dsa-negative)]",
  line: "border-[var(--dsa-border)]",
  tabActive: "border-[#4c8dff] text-white bg-[var(--dsa-accent-soft)]",
  tabIdle: "border-transparent text-[var(--dsa-text-muted)] hover:text-white hover:bg-[var(--dsa-surface-2)]",
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
  { id: "markets", label: "Listing" },
  { id: "news", label: "News" },
  { id: "fundamentals", label: "Fundamentals" },
  { id: "about", label: "About" },
];

export function StockProfilePage({ slug }: { slug: string }) {
  const symbol = useMemo(() => normalizeSymbolFromSlug(slug), [slug]);

  const [details, setDetails] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<TF>("daily");

  const [candles, setCandles] = useState<TradingChartCandle[]>([]);
  const [realtimeCandle, setRealtimeCandle] = useState<TradingChartCandle | null>(null);
  const [marketDataMeta, setMarketDataMeta] = useState<{
    realtimeQuoteAt: number | null;
    realtimeQuoteStale: boolean;
    persistedLastBarAt: number | null;
    persistedSources: string[];
    loading: boolean;
    error: string | null;
  }>({
    realtimeQuoteAt: null,
    realtimeQuoteStale: false,
    persistedLastBarAt: null,
    persistedSources: [],
    loading: true,
    error: null,
  });

  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<ProfileMainTab>("chart");
  const [watchlistMutating, setWatchlistMutating] = useState(false);
  const [watchlistActionMessage, setWatchlistActionMessage] = useState<string | null>(null);
  const [paperTrading, setPaperTrading] = useState<PaperTradingSnapshot | null>(null);

  const {
    loading: watchlistLoading,
    add: addToWatchlist,
    remove: removeFromWatchlist,
    isInWatchlist,
  } = useWatchlist();
  const watchlisted = isInWatchlist(symbol);


  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPaperTrading(null);
      setWatchlistActionMessage(null);
      setMarketDataMeta({
        realtimeQuoteAt: null,
        realtimeQuoteStale: false,
        persistedLastBarAt: null,
        persistedSources: [],
        loading: true,
        error: null,
      });
    });
    return () => window.cancelAnimationFrame(frame);
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
    if (!candles.length) return null;

    const latestPersisted = candles[candles.length - 1] ?? null;
    const realtimeClose =
      realtimeCandle?.close != null && Number.isFinite(Number(realtimeCandle.close))
        ? Number(realtimeCandle.close)
        : null;

    if (realtimeClose != null) {
      const sameBucket =
        latestPersisted &&
        realtimeCandle &&
        Number(latestPersisted.time) === Number(realtimeCandle.time);
      const reference = sameBucket
        ? candles[candles.length - 2]?.close
        : latestPersisted?.close;
      const ref = toNumber(reference);
      if (ref > 0) return ((realtimeClose - ref) / ref) * 100;
    }

    if (candles.length < 2) return null;
    const prev = toNumber(candles[candles.length - 2].close);
    const last = toNumber(candles[candles.length - 1].close);
    if (!prev) return null;
    return ((last - prev) / prev) * 100;
  }, [candles, realtimeCandle]);

  const lastCandle = candles.length ? candles[candles.length - 1] : null;
  const currentCandle = realtimeCandle ?? lastCandle;

  const athAtl = useMemo(() => {
    if (!candles.length && !realtimeCandle) {
      return { high: null as number | null, low: null as number | null };
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of candles) {
      hi = Math.max(hi, toNumber(c.high));
      lo = Math.min(lo, toNumber(c.low));
    }
    if (realtimeCandle) {
      hi = Math.max(hi, toNumber(realtimeCandle.high));
      lo = Math.min(lo, toNumber(realtimeCandle.low));
    }
    return {
      high: Number.isFinite(hi) ? hi : null,
      low: Number.isFinite(lo) ? lo : null,
    };
  }, [candles, realtimeCandle]);

  const marketCap = toNumber(details?.market_cap);
  const volShares = currentCandle ? toNumber(currentCandle.volume) : 0;
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

  const handleChartMarketData = useCallback(
    (state: TradingChartMarketData) => {
      if (state.symbol !== symbol || state.period !== selectedPeriod) return;
      setCandles(state.candles);
      setRealtimeCandle(state.realtimeCandle);
      setMarketDataMeta({
        realtimeQuoteAt: state.realtimeQuoteAt,
        realtimeQuoteStale: state.realtimeQuoteStale,
        persistedLastBarAt: state.persistedLastBarAt,
        persistedSources: state.persistedSources,
        loading: state.loading,
        error: state.error,
      });
    },
    [symbol, selectedPeriod],
  );

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
      ? "Daily vs previous close"
      : `Change vs previous ${selectedPeriod} bar`;

  const toggleWatchlist = async () => {
    if (!symbol || watchlistMutating || watchlistLoading) return;

    setWatchlistActionMessage(null);
    setWatchlistMutating(true);

    try {
      if (watchlisted) {
        const removed = await removeFromWatchlist(symbol);
        if (!removed) setWatchlistActionMessage("Could not remove this symbol from your watchlist.");
        return;
      }

      const result = await addToWatchlist(symbol);
      if (!result.ok) {
        setWatchlistActionMessage(result.message ?? "Could not add this symbol to your watchlist.");
      }
    } finally {
      setWatchlistMutating(false);
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
          <span className="rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-accent-soft)] px-2 py-1 text-[11px] font-semibold text-[#c5d9ff]">
            Price history
          </span>
          <span className={`text-[10px] font-medium ${CMC.muted}`}>Persisted OHLC</span>
        </div>
        <SelectDropdown
          className="w-[140px]"
          options={PERIOD_OPTIONS}
          selected={PERIOD_OPTIONS.find((p) => p.id === selectedPeriod) ?? null}
          onSelect={(opt) => setSelectedPeriod(opt.id as TF)}
        />
      </div>
      <div className="grid gap-1 border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-2 text-[10px] text-[var(--dsa-text-muted)] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="dsa-section-label">History</span>
          <p className="mt-0.5 font-mono text-[10px] normal-case tracking-normal text-[var(--dsa-text-secondary)]">
            {candles.length.toLocaleString("en-US")} persisted {selectedPeriod} bars
          </p>
        </div>
        <div>
          <span className="dsa-section-label">Last persisted</span>
          <p className="mt-0.5 font-mono text-[10px] normal-case tracking-normal text-[var(--dsa-text-secondary)]">
            {marketDataMeta.persistedLastBarAt
              ? new Date(marketDataMeta.persistedLastBarAt).toLocaleString()
              : "Unavailable"}
          </p>
        </div>
        <div>
          <span className="dsa-section-label">History source</span>
          <p
            className="mt-0.5 truncate font-mono text-[10px] normal-case tracking-normal text-[var(--dsa-text-secondary)]"
            title={marketDataMeta.persistedSources.join(", ") || "Source unavailable"}
          >
            {marketDataMeta.persistedSources.length
              ? marketDataMeta.persistedSources.join(", ")
              : "Source unavailable"}
          </p>
        </div>
        <div>
          <span className="dsa-section-label">Quote stream</span>
          <p
            className={`mt-0.5 font-mono text-[10px] normal-case tracking-normal ${
              marketDataMeta.realtimeQuoteStale
                ? "text-[var(--dsa-warning)]"
                : marketDataMeta.realtimeQuoteAt
                  ? "text-[var(--dsa-positive)]"
                  : "text-[var(--dsa-text-secondary)]"
            }`}
          >
            {marketDataMeta.realtimeQuoteAt
              ? `${marketDataMeta.realtimeQuoteStale ? "Stale · " : ""}${new Date(
                  marketDataMeta.realtimeQuoteAt,
                ).toLocaleString()}`
              : marketDataMeta.loading
                ? "Waiting for quote"
                : "No live quote received"}
          </p>
        </div>
      </div>
      {candles.length < 2 ? (
        <div className="border-b border-[rgba(216,163,64,0.28)] bg-[rgba(216,163,64,0.08)] px-3 py-2 text-xs text-[#d9bb7a]">
          Persisted {selectedPeriod} history is {candles.length === 1 ? "too short" : "unavailable"} for {symbol}. Realtime price may still update, but historical chart data is not synthesized.
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
            onMarketDataChange={handleChartMarketData}
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
            className="dsa-button-secondary min-h-0 shrink-0 px-2.5 py-1 text-xs"
          >
            Research workspace
          </Link>
        </nav>

        {/* Three-column shell — left stats | center research | right coverage/news */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)] xl:items-start xl:gap-5">
          <aside className="order-2 flex flex-col gap-3 xl:sticky xl:top-[calc(var(--dsa-header-height)_+_1rem)] xl:order-1 xl:max-h-[calc(100vh_-_var(--dsa-header-height)_-_2rem)] xl:overflow-y-auto">
            <div className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
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
                    <span className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-0.5 font-mono text-xs font-semibold text-white">
                      {details?.symbol || symbol}
                    </span>
                    <span className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
                      Equity
                    </span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void toggleWatchlist()}
                        className="rounded-[var(--dsa-radius-sm)] p-2 text-[var(--dsa-text-muted)] transition-colors hover:bg-[var(--dsa-surface-2)] hover:text-[#8ab4ff] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                        title={watchlisted ? "Remove from watchlist" : "Add to watchlist"}
                        disabled={watchlistLoading || watchlistMutating}
                      >
                        <Star className={`h-4 w-4 ${watchlisted ? "fill-[#8ab4ff] text-[#8ab4ff]" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={shareProfile}
                        className="rounded-[var(--dsa-radius-sm)] p-2 text-[var(--dsa-text-muted)] transition-colors hover:bg-[var(--dsa-surface-2)] hover:text-white"
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
                    className={`mt-2 inline-flex items-center gap-1 rounded-[var(--dsa-radius-sm)] px-2 py-1 text-sm font-semibold tabular-nums ${
                      changePct >= 0 ? `bg-[#16c784]/15 ${CMC.green}` : `bg-[#ea3943]/15 ${CMC.red}`
                    }`}
                  >
                    {changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {changePct >= 0 ? "+" : ""}
                    {changePct.toFixed(2)}%{" "}
                    <span className={`font-normal ${CMC.muted}`}>· {changeLabel}</span>
                  </span>
                ) : (
                  <p className={`mt-2 text-sm ${CMC.muted}`}>—</p>
                )}

                <div className="mt-4 border-t border-[#2b3139] pt-3">
                  <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${CMC.muted}`}>
                    Signal radar
                  </p>
                  <FundamentalRadar symbol={symbol} compact />
                </div>

                <p className={`mt-3 flex items-center gap-1.5 text-[10px] ${CMC.muted}`}>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      marketDataMeta.realtimeQuoteAt && !marketDataMeta.realtimeQuoteStale
                        ? "bg-[var(--dsa-positive)]"
                        : marketDataMeta.realtimeQuoteStale
                          ? "bg-[var(--dsa-warning)]"
                          : "bg-[var(--dsa-text-muted)]"
                    }`}
                  />
                  {marketDataMeta.realtimeQuoteAt
                    ? marketDataMeta.realtimeQuoteStale
                      ? "Latest quote is stale · persisted OHLC retained"
                      : "Live quote received · persisted OHLC retained"
                    : candles.length > 0
                      ? "Persisted OHLC loaded · live quote unavailable"
                      : "Persisted OHLC unavailable"}
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
                hintTitle="Selected period: current/recent bar shares × price. This is an estimate, not consolidated full-session exchange volume."
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

            <div className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${CMC.muted}`}>Profile completeness</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-[#8ab4ff]">{profileScore}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#2b3139]">
                <div
                  className="h-full rounded-full bg-[#4c8dff]"
                  style={{ width: `${profileScore}%` }}
                />
              </div>
              <p className={`mt-2 text-[10px] leading-relaxed ${CMC.muted}`}>
                How complete this company record is (name, sector, financials, description, etc.).
              </p>
            </div>

            <ProfilePaperTradingPanel symbol={symbol} state={paperTrading} />

            <div className="flex flex-col gap-2">
              {details?.website ? (
                <a
                  href={details.website}
                  target="_blank"
                  rel="noreferrer"
                  className="dsa-button-secondary w-full"
                >
                  <Globe className="h-4 w-4" />
                  Website
                </a>
              ) : null}
              <Link
                href="/search"
                className="dsa-button-secondary w-full"
              >
                <Building2 className="h-4 w-4" />
                More companies
              </Link>
            </div>

            <div className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
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
            <div className={`mb-3 flex flex-col gap-3 rounded-[var(--dsa-radius-md)] ${CMC.card} px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4`}>
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
              <div className="flex shrink-0 flex-col items-end gap-1 px-1 sm:px-0">
                <button
                  type="button"
                  onClick={() => void toggleWatchlist()}
                  className="dsa-button-primary px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={watchlistLoading || watchlistMutating}
                >
                  {watchlistMutating ? "Updating…" : watchlisted ? "Watching" : "Watch symbol"}
                </button>
                {watchlistActionMessage ? (
                  <span className="max-w-[260px] text-right text-[10px] leading-snug text-[var(--dsa-warning)]">
                    {watchlistActionMessage}
                  </span>
                ) : null}
              </div>
            </div>

            {mainTab === "chart" && (
              <div className="space-y-4">
                {chartBlock}
                <details className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-4`}>
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#7b9cff]">
                    <Info className="h-4 w-4" />
                    How chart stats are read
                  </summary>
                  <ul className={`mt-3 list-inside list-disc space-y-2 text-xs leading-relaxed ${CMC.muted}`}>
                    <li>
                      <strong className="text-white/90">% change</strong> uses the live price versus the previous
                      completed period close when a realtime quote is available; otherwise it compares the latest two
                      persisted bars.
                    </li>
                    <li>
                      <strong className="text-white/90">Estimated dollar volume</strong> is the selected period&apos;s
                      current/recent bar share volume multiplied by the displayed price.
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
                  <span className="rounded-[var(--dsa-radius-sm)] border border-[rgba(76,141,255,0.32)] bg-[var(--dsa-accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#b8d1ff]">
                    Primary listing
                  </span>
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
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Est. $ volume</th>
                        <th className="px-4 py-2 text-[11px] font-semibold uppercase">Est. vol / mkt cap</th>
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
                            className={`rounded-[var(--dsa-radius-sm)] px-2 py-0.5 font-mono text-xs font-semibold ${
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
                  <p className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-8 text-center text-sm ${CMC.muted}`}>
                    No news items for this symbol yet.
                  </p>
                ) : (
                  news.map((item, idx) => {
                    const { kind, href } = resolveNewsHref(item);
                    const label = newsSourceLabel(item);
                    const thumb = pickNewsThumbImage(item);
                    const cardClass = `block rounded-[var(--dsa-radius-md)] ${CMC.card} p-4 transition hover:border-[#3861fb]/45`;
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
                            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
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

                <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-5`}>
                  <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-white">
                    <Activity className="h-4 w-4 text-[#3861fb]" />
                    Signal radar
                  </h3>
                  <p className={`mb-3 text-[11px] leading-snug ${CMC.muted}`}>
                    Validated Market View radar inputs for Signal, Price, Change, Volume, Liquidity, and Watchers, with the
                    daily mood strip shown only when change data is available.
                  </p>
                  <FundamentalRadar symbol={symbol} />
                </section>

                <section className={`rounded-[var(--dsa-radius-md)] ${CMC.card} p-5`}>
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
                        className="flex flex-col items-center rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-3 text-center transition hover:border-[#3861fb]/45"
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

          <aside className="order-3 flex flex-col gap-3 xl:sticky xl:top-[calc(var(--dsa-header-height)_+_1rem)] xl:max-h-[calc(100vh_-_var(--dsa-header-height)_-_2rem)] xl:overflow-y-auto">
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
                  onClick={() => void toggleWatchlist()}
                  className="dsa-button-secondary min-h-0 shrink-0 px-2.5 py-1 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={watchlistLoading || watchlistMutating}
                >
                  {watchlistMutating ? "Updating…" : watchlisted ? "Watching" : "Watch"}
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
                    <div className={`group rounded-lg border ${CMC.line} bg-[#0d1621]/70 p-3 transition hover:border-[#3861fb]/45 hover:bg-[#111b2a]`}>
                      <div className="flex gap-3">
                        {thumb ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
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
                  <div className={`rounded-lg border ${CMC.line} bg-[#0d1621]/70 px-4 py-8 text-center`}>
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
