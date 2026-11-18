"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Newspaper, Activity, LayoutGrid, ExternalLink } from "lucide-react";
import HeatmapTreemapSvg from "@/src/components/analyze/HeatmapTreemapSvg";
import newsService from "@/src/services/News.service";
import type { News } from "@/src/types/News";
import { BeginnerService, type BeginnerBoardRow, type TopByVolumeRow } from "@/src/services/Beginner.service";
import { stripParentheticals, symbolLogoUrl } from "@/src/libs/displayString";
import { MARKET_MOVERS_LIST_LIMIT } from "@/src/libs/marketViewConstants";
import {
  boardRowsToHeatmap,
  fetchHeatmapRowsFromApi,
  type HeatmapListRow,
} from "@/src/libs/heatmapTreemap";

const C = {
  card: "bg-[var(--dsa-surface-1)] border border-[var(--dsa-border)]",
  text: "text-[var(--dsa-text)]",
  muted: "text-[var(--dsa-text-muted)]",
  line: "border-[var(--dsa-border)]",
  green: "text-[var(--dsa-positive)]",
  red: "text-[var(--dsa-negative)]",
};

const UI_LOCALE = "en-US";
const UI_TIMEZONE = "UTC";
const compactVolFormatter = new Intl.NumberFormat(UI_LOCALE, { notation: "compact", maximumFractionDigits: 2 });
const newsDateFormatter = new Intl.DateTimeFormat(UI_LOCALE, { month: "short", day: "numeric", timeZone: UI_TIMEZONE });
const updatedAtFormatter = new Intl.DateTimeFormat(UI_LOCALE, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: UI_TIMEZONE,
});

function formatNewsDate(iso?: string | Date | null): string {
  if (!iso) return "Time unavailable";
  try {
    const d = iso instanceof Date ? iso : new Date(iso);
    return Number.isNaN(d.getTime()) ? "Time unavailable" : newsDateFormatter.format(d);
  } catch {
    return "Time unavailable";
  }
}

function formatDashboardTime(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return updatedAtFormatter.format(date);
}

function formatCompactVol(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return compactVolFormatter.format(n);
}

function VolumeListLogo({ symbol, url }: { symbol: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  const src = symbolLogoUrl(symbol, url);
  if (!broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-7 w-7 shrink-0 rounded-[var(--dsa-radius-sm)] object-cover ring-1 ring-[var(--dsa-border)]"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-surface-3)] text-[10px] font-semibold text-white ring-1 ring-[var(--dsa-border)]">
      {symbol.slice(0, 1)}
    </span>
  );
}

function CompactHeatmap({ data, ariaLabel }: { data: HeatmapListRow[]; ariaLabel: string }) {
  const router = useRouter();

  const go = useCallback(
    (sym: string) => {
      const s = String(sym || "").trim().toLowerCase();
      if (s) router.push(`/companies/profile/${s}`);
    },
    [router],
  );

  if (!data?.length) {
    return (
      <div className={`flex min-h-[200px] flex-1 items-center justify-center text-xs ${C.muted}`}>
        Heatmap data is currently unavailable.
      </div>
    );
  }

  return (
    <div className="relative min-h-[300px] w-full flex-1">
      <HeatmapTreemapSvg
        data={data}
        className="absolute inset-0 h-full w-full"
        ariaLabel={ariaLabel}
        onTileClick={go}
      />
    </div>
  );
}

function boardRowToVolumeMover(r: BeginnerBoardRow): TopByVolumeRow {
  return {
    symbol: r.symbol,
    company_name: r.company_name,
    logo_url: r.logo_url ?? null,
    volume: r.volume,
    change_pct: r.change_pct_snapshot,
    price: r.price,
    liquidity: r.liquidity,
  };
}

/** Gainers / losers from the same rows as Redis ``dashboard:daily``. */
function deriveMoversFromDashboardRows(rows: BeginnerBoardRow[], moversLimit = MARKET_MOVERS_LIST_LIMIT) {
  const finiteChg = rows.filter(
    (r) =>
      !r.missing_fields?.includes("change_pct") &&
      Number.isFinite(Number(r.change_pct_snapshot)),
  );
  const gainers = [...finiteChg]
    .sort((a, b) => b.change_pct_snapshot - a.change_pct_snapshot)
    .slice(0, moversLimit)
    .map(boardRowToVolumeMover);
  const losers = [...finiteChg]
    .sort((a, b) => a.change_pct_snapshot - b.change_pct_snapshot)
    .slice(0, moversLimit)
    .map(boardRowToVolumeMover);
  return { gainers, losers };
}

type BeginnerTestMarketExtrasProps = {
  /** When true, movers + heatmap come from ``dashboardRows`` (Redis daily board), not separate ranking APIs. */
  dashboardDailyMode?: boolean;
  dashboardRows?: BeginnerBoardRow[];
  boardLoading?: boolean;
  dashboardUpdatedAt?: string | null;
};

export default function BeginnerTestMarketExtras({
  dashboardDailyMode = false,
  dashboardRows = [],
  boardLoading = false,
  dashboardUpdatedAt = null,
}: BeginnerTestMarketExtrasProps) {
  const [news, setNews] = useState<News[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [volumeGainers, setVolumeGainers] = useState<TopByVolumeRow[]>([]);
  const [volumeLosers, setVolumeLosers] = useState<TopByVolumeRow[]>([]);
  const [volumeNote, setVolumeNote] = useState<string | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [heatmap, setHeatmap] = useState<HeatmapListRow[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    newsService
      .getAllNews({ per_page: 10, page: 1 })
      .then((res) => {
        if (!cancelled) setNews(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setNews([]);
      })
      .finally(() => {
        if (!cancelled) setNewsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (dashboardDailyMode) return;
    let cancelled = false;
    const loadingFrame = window.requestAnimationFrame(() => setVolumeLoading(true));
    BeginnerService.getTopByVolume(MARKET_MOVERS_LIST_LIMIT)
      .then((payload) => {
        if (cancelled) return;
        setVolumeGainers(Array.isArray(payload?.gainers) ? payload.gainers : []);
        setVolumeLosers(Array.isArray(payload?.losers) ? payload.losers : []);
        setVolumeNote(payload?.updated_note ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setVolumeGainers([]);
          setVolumeLosers([]);
          setVolumeNote(null);
        }
      })
      .finally(() => {
        if (!cancelled) setVolumeLoading(false);
      });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(loadingFrame);
    };
  }, [dashboardDailyMode]);

  useEffect(() => {
    if (dashboardDailyMode) return;
    let cancelled = false;
    const loadingFrame = window.requestAnimationFrame(() => setHeatmapLoading(true));

    fetchHeatmapRowsFromApi()
      .then((rows) => {
        if (!cancelled) setHeatmap(rows);
      })
      .catch(() => {
        if (!cancelled) setHeatmap([]);
      })
      .finally(() => {
        if (!cancelled) setHeatmapLoading(false);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(loadingFrame);
    };
  }, [dashboardDailyMode, dashboardUpdatedAt]);

  const fromDashboard = useMemo(() => {
    if (!dashboardDailyMode || !dashboardRows.length) {
      return { gainers: [] as TopByVolumeRow[], losers: [] as TopByVolumeRow[] };
    }
    return deriveMoversFromDashboardRows(dashboardRows, MARKET_MOVERS_LIST_LIMIT);
  }, [dashboardDailyMode, dashboardRows]);

  const displayGainers = dashboardDailyMode ? fromDashboard.gainers : volumeGainers;
  const displayLosers = dashboardDailyMode ? fromDashboard.losers : volumeLosers;
  const dashboardHeatmap = useMemo(
    () => (dashboardDailyMode ? boardRowsToHeatmap(dashboardRows) : []),
    [dashboardDailyMode, dashboardRows],
  );

  const displayHeatmap = dashboardDailyMode ? dashboardHeatmap : heatmap;
  const displayVolumeLoading = dashboardDailyMode ? boardLoading : volumeLoading;
  const displayHeatmapLoading = dashboardDailyMode ? boardLoading : heatmapLoading;
  const heatmapTitle = dashboardDailyMode ? "Market cap heatmap (shown symbols)" : "Liquidity heatmap (Technology)";
  const heatmapAriaLabel = dashboardDailyMode
    ? "Market capitalization heatmap for the symbols currently shown in the market board"
    : "Technology sector liquidity heatmap";

  const dashboardTime = formatDashboardTime(dashboardUpdatedAt);
  const displayVolumeNote = dashboardDailyMode
    ? dashboardTime
      ? `Same symbols as the board above · snapshot ${dashboardTime} UTC · tile size uses market cap; color uses daily % change`
      : `Same symbols as the board above · tile size uses market cap; color uses daily % change`
    : volumeNote;

  return (
    <section className={`mt-5 space-y-3 border-t ${C.line} pt-5`} aria-label="Market extras">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="dsa-section-label">Market context</p>
          <h2 className="dsa-section-title mt-0.5">News, movers &amp; heatmap</h2>
          <p className={`mt-0.5 text-[11px] ${C.muted}`}>
            {dashboardDailyMode ? (
              <>
                Headlines from our feed. Movers and the heatmap follow the same symbol list as the ranking board.
              </>
            ) : (
              <>
                Headlines, top movers by recent volume, and a Technology-sector liquidity map.
              </>
            )}
          </p>
        </div>
        <Link href="/news" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8ab4ff] hover:underline">
          All news <ExternalLink className="h-3 w-3 opacity-80" />
        </Link>
      </div>

      <div className={`w-full rounded-[var(--dsa-radius-md)] ${C.card} p-3`}>
        <div className="mb-3 flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-[#8ab4ff]" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Recent news</h3>
        </div>
        {newsLoading ? (
          <p className={`animate-pulse text-sm ${C.muted}`}>Loading…</p>
        ) : news.length === 0 ? (
          <p className={`text-sm ${C.muted}`}>
            No market headlines are available yet. Check back soon or open the News section.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 phone:grid-cols-2 laptop:grid-cols-3">
            {news.map((n) => (
              <li key={n.id || n.title} className={`border-b border-[var(--dsa-border)] pb-2 phone:border-0 phone:pb-0`}>
                <Link
                  href={n.id ? `/news/${n.id}` : "/news"}
                  className="line-clamp-2 text-sm font-medium text-white transition-colors hover:text-[#8ab4ff]"
                >
                  {n.title || "Untitled"}
                </Link>
                <div className={`mt-0.5 flex flex-wrap gap-x-2 text-[10px] ${C.muted}`}>
                  <span>{formatNewsDate(n.published_at)}</span>
                  {n.source && typeof n.source === "string" && n.source.length < 80 && (
                    <span className="truncate">{n.source}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 laptop:flex-row laptop:items-stretch">
        <div className={`flex min-h-[320px] min-w-0 flex-1 flex-col rounded-[var(--dsa-radius-md)] ${C.card} p-2`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-white">
                {heatmapTitle}
              </h3>
            </div>
            <Link href="/investing" className="text-[10px] font-semibold text-[#8ab4ff] hover:underline">
              Research workspace
            </Link>
          </div>
          {displayHeatmapLoading ? (
            <div
              className={`flex min-h-[300px] flex-1 items-center justify-center text-sm ${C.muted} animate-pulse`}
            >
              Loading map…
            </div>
          ) : (
            <CompactHeatmap data={displayHeatmap} ariaLabel={heatmapAriaLabel} />
          )}
        </div>

        <div className={`flex min-h-[320px] min-w-0 flex-1 flex-col rounded-[var(--dsa-radius-md)] ${C.card} p-3`}>
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#7b9cff]" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Volume movers</h3>
          </div>
          {displayVolumeLoading ? (
            <p className={`animate-pulse text-sm ${C.muted}`}>Loading…</p>
          ) : displayGainers.length === 0 && displayLosers.length === 0 ? (
            <p className={`text-xs ${C.muted}`}>
              {dashboardDailyMode
                ? "Movers will appear once the market board has fresh data."
                : "No snapshot volume data yet."}
            </p>
          ) : (
            <div className="flex flex-1 flex-col gap-5">
              <div className="min-w-0">
                <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${C.green}`}>Top gainers</p>
                  <div
                    className={`mb-2 flex items-center justify-between gap-3 border-b border-[var(--dsa-border)] pb-1.5 text-[9px] font-semibold uppercase tracking-wide ${C.muted}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-5 shrink-0" aria-hidden />
                      <span className="h-8 w-8 shrink-0" aria-hidden />
                      <span className="truncate">Symbol</span>
                    </div>
                    <span className="w-20 shrink-0 text-right">Volume</span>
                    <span className="w-24 shrink-0 text-right">Price change</span>
                  </div>
                  <ul className="space-y-2 font-mono text-sm">
                    {displayGainers.map((r, i) => {
                      const ch = Number(r.change_pct);
                      return (
                        <li key={`g-${r.symbol}`} className="flex items-center justify-between gap-3 py-0.5 tabular-nums">
                          <Link
                            href={`/companies/profile/${r.symbol.toLowerCase()}`}
                            className="flex min-w-0 flex-1 items-center gap-2 text-white hover:text-[#7b9cff]"
                          >
                            <span className={`w-5 shrink-0 text-center text-[10px] ${C.muted}`}>{i + 1}</span>
                            <VolumeListLogo symbol={r.symbol} url={r.logo_url} />
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{r.symbol}</span>
                              {r.company_name && r.company_name !== r.symbol && (
                                <span className={`ml-1 text-[11px] font-normal ${C.muted}`}>
                                  {stripParentheticals(r.company_name)}
                                </span>
                              )}
                            </span>
                          </Link>
                          <span className="w-20 shrink-0 text-right text-xs text-white/90">{formatCompactVol(r.volume)}</span>
                          <span className={`w-24 shrink-0 text-right text-sm ${C.green}`}>
                            {Number.isFinite(ch) ? `+${ch.toFixed(2)}%` : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                {!displayVolumeLoading && displayGainers.length === 0 && (
                  <p className={`mt-1 text-[10px] ${C.muted}`}>No positive movers in the scanned set.</p>
                )}
              </div>
              <div className="min-w-0 border-t border-[var(--dsa-border)] pt-4">
                <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${C.red}`}>Top losers</p>
                  <div
                    className={`mb-2 flex items-center justify-between gap-3 border-b border-[var(--dsa-border)] pb-1.5 text-[9px] font-semibold uppercase tracking-wide ${C.muted}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-5 shrink-0" aria-hidden />
                      <span className="h-8 w-8 shrink-0" aria-hidden />
                      <span className="truncate">Symbol</span>
                    </div>
                    <span className="w-20 shrink-0 text-right">Volume</span>
                    <span className="w-24 shrink-0 text-right">Price change</span>
                  </div>
                  <ul className="space-y-2 font-mono text-sm">
                    {displayLosers.map((r, i) => {
                      const ch = Number(r.change_pct);
                      return (
                        <li key={`l-${r.symbol}`} className="flex items-center justify-between gap-3 py-0.5 tabular-nums">
                          <Link
                            href={`/companies/profile/${r.symbol.toLowerCase()}`}
                            className="flex min-w-0 flex-1 items-center gap-2 text-white hover:text-[#7b9cff]"
                          >
                            <span className={`w-5 shrink-0 text-center text-[10px] ${C.muted}`}>{i + 1}</span>
                            <VolumeListLogo symbol={r.symbol} url={r.logo_url} />
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{r.symbol}</span>
                              {r.company_name && r.company_name !== r.symbol && (
                                <span className={`ml-1 text-[11px] font-normal ${C.muted}`}>
                                  {stripParentheticals(r.company_name)}
                                </span>
                              )}
                            </span>
                          </Link>
                          <span className="w-20 shrink-0 text-right text-xs text-white/90">{formatCompactVol(r.volume)}</span>
                          <span className={`w-24 shrink-0 text-right text-sm ${C.red}`}>
                            {Number.isFinite(ch) ? `${ch.toFixed(2)}%` : "—"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                {!displayVolumeLoading && displayLosers.length === 0 && (
                  <p className={`mt-1 text-[10px] ${C.muted}`}>No negative movers in the scanned set.</p>
                )}
              </div>
            </div>
          )}
          {!displayVolumeLoading && (
            <p className={`mt-2 text-[10px] leading-snug ${C.muted}`}>
              {displayVolumeNote || "Market snapshot rows ranked by volume."}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
