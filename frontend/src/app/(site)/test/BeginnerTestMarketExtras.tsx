"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { Newspaper, Activity, LayoutGrid, ExternalLink } from "lucide-react";
import newsService from "@/src/services/News.service";
import { BeginnerService, type BeginnerBoardRow, type TopByVolumeRow } from "@/src/services/Beginner.service";
import heatmapService from "@/src/services/Heatmap.service";
import { stripParentheticals } from "@/src/libs/displayString";
import { HEATMAP_SECTOR_TECHNOLOGY, MARKET_MOVERS_LIST_LIMIT } from "@/src/libs/marketViewConstants";

const C = {
  card: "bg-[#1e2329] border border-[#2b3139]",
  text: "text-[#eaecef]",
  muted: "text-[#848e9c]",
  line: "border-[#2b3139]",
  green: "text-[#16c784]",
  red: "text-[#ea3943]",
};

type NewsRow = {
  id?: string;
  title?: string;
  published_at?: string;
  source?: string;
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

function formatNewsDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : newsDateFormatter.format(d);
  } catch {
    return "";
  }
}

function formatCompactVol(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return compactVolFormatter.format(n);
}

function VolumeListLogo({ symbol, url }: { symbol: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white">
      {symbol.slice(0, 1)}
    </span>
  );
}

function treemapColor(change: number) {
  const a = Math.abs(change);
  if (change > 0) {
    if (a > 3) return "#15803d";
    if (a > 1) return "#16a34a";
    return "#22c55e";
  }
  if (change < 0) {
    if (a > 3) return "#b91c1c";
    if (a > 1) return "#dc2626";
    return "#ef4444";
  }
  return "#334155";
}

type HeatmapDatum = {
  symbol?: string;
  liquidity?: number;
  change_pct?: number;
  children?: HeatmapDatum[];
};

type HeatmapListRow = { symbol: string; liquidity?: number; change_pct?: number };

function mergeHeatmapRows(rows: HeatmapListRow[]): HeatmapListRow[] {
  const bySym = new Map<string, HeatmapListRow>();
  for (const row of rows || []) {
    const sym = String(row?.symbol ?? "")
      .trim()
      .toUpperCase();
    if (!sym) continue;
    const liq = Number(row?.liquidity);
    const liquidity = Number.isFinite(liq) && liq > 0 ? liq : 1;
    const ch = Number(row?.change_pct);
    const change_pct = Number.isFinite(ch) ? ch : 0;
    const prev = bySym.get(sym);
    if (!prev) {
      bySym.set(sym, { symbol: sym, liquidity, change_pct });
    } else {
      bySym.set(sym, {
        symbol: sym,
        liquidity: (prev.liquidity ?? 1) + liquidity,
        change_pct: prev.change_pct ?? change_pct,
      });
    }
  }
  return [...bySym.values()].sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0));
}

function formatChangePct(change: number): string {
  const n = Number(change);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

const SVG_INSET = 6;
const INNER_PAD = 3;
const HEATMAP_FETCH_LIMIT = 80;
const HEATMAP_DISPLAY_MAX = 42;
const MIN_HEATMAP_TILES = 10;

function dashboardRowsToHeatmap(rows: BeginnerBoardRow[]): HeatmapListRow[] {
  return rows.map((r) => ({
    symbol: r.symbol,
    liquidity:
      Number.isFinite(r.liquidity) && r.liquidity > 0
        ? r.liquidity
        : Number.isFinite(r.volume) && r.volume > 0
          ? r.volume
          : 1,
    change_pct: Number.isFinite(r.change_pct_snapshot) ? r.change_pct_snapshot : 0,
  }));
}

function CompactHeatmap({ data }: { data: HeatmapListRow[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 600, height: 360 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w > 0 && h > 0) {
      setDims({ width: w, height: h });
    }
  }, []);

  useEffect(() => {
    const tick = () => requestAnimationFrame(measure);
    tick();
    const el = ref.current;
    const obs = typeof ResizeObserver !== "undefined" ? new ResizeObserver(tick) : null;
    if (el) obs?.observe(el);
    window.addEventListener("resize", tick);
    return () => {
      if (el) obs?.unobserve(el);
      obs?.disconnect();
      window.removeEventListener("resize", tick);
    };
  }, [measure]);

  useEffect(() => {
    requestAnimationFrame(measure);
  }, [measure, data.length]);

  const root = useMemo(() => {
    return hierarchy<HeatmapDatum>({ children: data || [] } as HeatmapDatum)
      .sum((d) =>
        d && typeof d.liquidity === "number" ? Math.max(d.liquidity, 1) : 0
      )
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data]);

  const innerW = Math.max(1, dims.width - SVG_INSET * 2);
  const innerH = Math.max(1, dims.height - SVG_INSET * 2);

  const layout = useMemo(() => {
    if (!data.length) return null;
    return treemap<HeatmapDatum>()
      .size([innerW, innerH])
      .round(true)
      .paddingInner(INNER_PAD)
      .paddingOuter(2)
      .tile(treemapSquarify.ratio(1))(root);
  }, [root, innerW, innerH, data.length]);

  const go = useCallback(
    (sym: string) => {
      const s = String(sym || "").trim().toLowerCase();
      if (s) router.push(`/companies/profile/${s}`);
    },
    [router]
  );

  if (!data?.length) {
    return (
      <div className={`flex h-[220px] items-center justify-center rounded-lg border ${C.line} text-xs ${C.muted}`}>
        No heatmap data yet (run ranking sync / snapshot).
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="relative h-[min(42vh,400px)] min-h-[280px] w-full overflow-hidden rounded-lg border border-[#2b3139] bg-black/25"
    >
      {!layout ? (
        <div className={`flex h-full items-center justify-center text-xs ${C.muted}`}>
          Preparing map…
        </div>
      ) : (
      <svg
        width={dims.width}
        height={dims.height}
        className="block max-h-full max-w-full"
        role="img"
        aria-label="Technology sector liquidity heatmap"
      >
        <g transform={`translate(${SVG_INSET},${SVG_INSET})`}>
        {layout.leaves().map((leaf: { x0: number; x1: number; y0: number; y1: number; data: { symbol?: string; change_pct?: number } }) => {
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          const sym = String(leaf.data.symbol || "").toUpperCase();
          const ch = Number(leaf.data.change_pct) || 0;
          const minEdge = Math.min(w, h);
          const area = w * h;
          const showSymbol = minEdge >= 22 && area >= 280;
          const showPct = minEdge >= 30 && area >= 900;
          const symFs = Math.max(8, Math.min(15, minEdge * 0.42));
          const pctFs = Math.max(7, Math.min(12, symFs * 0.72));
          return (
            <g
              key={sym}
              transform={`translate(${leaf.x0},${leaf.y0})`}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              onClick={() => go(sym)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  go(sym);
                }
              }}
            >
              <rect
                width={w}
                height={h}
                fill={treemapColor(ch)}
                stroke="#0b1220"
                strokeWidth={1}
                className="transition-[filter] hover:brightness-110"
              />
              {showSymbol && (
                <text textAnchor="middle" fill="#ffffff" style={{ pointerEvents: "none", userSelect: "none" }}>
                  <tspan
                    x={w / 2}
                    y={h / 2 + (showPct ? -symFs * 0.15 : symFs * 0.28)}
                    fontSize={symFs}
                    fontWeight="800"
                  >
                    {sym.length > 6 ? `${sym.slice(0, 5)}…` : sym}
                  </tspan>
                  {showPct && (
                    <tspan x={w / 2} y={h / 2 + pctFs * 1.15} fontSize={pctFs} fontWeight="600" opacity={0.92}>
                      {formatChangePct(ch)}
                    </tspan>
                  )}
                </text>
              )}
              <title>{`${sym}: ${formatChangePct(ch)}`}</title>
            </g>
          );
        })}
        </g>
      </svg>
      )}
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

/** Gainers / losers from the same rows as Redis ``dashboard:daily`` (heatmap uses API + sector filter). */
function deriveMoversFromDashboardRows(rows: BeginnerBoardRow[], moversLimit = MARKET_MOVERS_LIST_LIMIT) {
  const finiteChg = rows.filter((r) => Number.isFinite(r.change_pct_snapshot));
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
  const [news, setNews] = useState<NewsRow[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [volumeGainers, setVolumeGainers] = useState<TopByVolumeRow[]>([]);
  const [volumeLosers, setVolumeLosers] = useState<TopByVolumeRow[]>([]);
  const [volumeNote, setVolumeNote] = useState<string | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [heatmap, setHeatmap] = useState<HeatmapListRow[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  useEffect(() => {
    if (!dashboardDailyMode) return;
    setVolumeLoading(false);
  }, [dashboardDailyMode]);

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
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
    setVolumeLoading(true);
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
    };
  }, [dashboardDailyMode]);

  useEffect(() => {
    let cancelled = false;
    setHeatmapLoading(true);

    (async () => {
      try {
        let sectorRows = await heatmapService.getHeatmapData({
          limit: HEATMAP_FETCH_LIMIT,
          sector: HEATMAP_SECTOR_TECHNOLOGY,
        });
        let merged = mergeHeatmapRows(Array.isArray(sectorRows) ? sectorRows : []);

        if (merged.length < MIN_HEATMAP_TILES) {
          const broadRows = await heatmapService.getHeatmapData({ limit: HEATMAP_FETCH_LIMIT });
          const broadMerged = mergeHeatmapRows(Array.isArray(broadRows) ? broadRows : []);
          const seen = new Set(merged.map((r) => r.symbol));
          for (const row of broadMerged) {
            if (merged.length >= HEATMAP_DISPLAY_MAX) break;
            if (!seen.has(row.symbol)) {
              merged.push(row);
              seen.add(row.symbol);
            }
          }
          merged = mergeHeatmapRows(merged);
        }

        if (!cancelled) setHeatmap(merged);
      } catch {
        if (!cancelled) setHeatmap([]);
      } finally {
        if (!cancelled) setHeatmapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const fromDashboard = useMemo(() => {
    if (!dashboardDailyMode || !dashboardRows.length) {
      return { gainers: [] as TopByVolumeRow[], losers: [] as TopByVolumeRow[] };
    }
    return deriveMoversFromDashboardRows(dashboardRows, MARKET_MOVERS_LIST_LIMIT);
  }, [dashboardDailyMode, dashboardRows]);

  const displayGainers = dashboardDailyMode ? fromDashboard.gainers : volumeGainers;
  const displayLosers = dashboardDailyMode ? fromDashboard.losers : volumeLosers;
  const displayHeatmap = useMemo(() => {
    let rows = mergeHeatmapRows(heatmap).slice(0, HEATMAP_DISPLAY_MAX);
    if (dashboardDailyMode && rows.length < MIN_HEATMAP_TILES && dashboardRows.length > 0) {
      rows = mergeHeatmapRows([...rows, ...dashboardRowsToHeatmap(dashboardRows)]).slice(
        0,
        HEATMAP_DISPLAY_MAX
      );
    }
    return rows;
  }, [heatmap, dashboardDailyMode, dashboardRows]);
  const displayVolumeLoading = dashboardDailyMode ? boardLoading : volumeLoading;
  const displayHeatmapLoading = heatmapLoading;

  const displayVolumeNote = dashboardDailyMode
    ? dashboardUpdatedAt
      ? `Same symbols as the board above · snapshot ${updatedAtFormatter.format(new Date(dashboardUpdatedAt))} UTC · Technology sector heatmap`
      : `Same symbols as the board above · Technology sector heatmap`
    : volumeNote;

  return (
    <section className={`mt-8 space-y-4 border-t ${C.line} pt-8`} aria-label="Market extras">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className={`text-sm font-semibold text-white`}>News &amp; market map</h2>
          <p className={`mt-0.5 text-[11px] ${C.muted}`}>
            {dashboardDailyMode ? (
              <>
                Headlines from our feed. Movers follow the same symbol list as the ranking board. The treemap highlights
                Technology-sector liquidity.
              </>
            ) : (
              <>
                Headlines, top movers by recent volume, and a Technology-sector liquidity map.
              </>
            )}
          </p>
        </div>
        <Link href="/news" className={`inline-flex items-center gap-1 text-[11px] font-semibold text-[#7b9cff] hover:underline`}>
          All news <ExternalLink className="h-3 w-3 opacity-80" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 laptop:grid-cols-12">
        <div className={`rounded-2xl ${C.card} p-4 laptop:col-span-7`}>
          <div className="mb-3 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-[#7b9cff]" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Recent news</h3>
          </div>
          {newsLoading ? (
            <p className={`animate-pulse text-sm ${C.muted}`}>Loading…</p>
          ) : news.length === 0 ? (
            <p className={`text-sm ${C.muted}`}>
              No market headlines are available yet. Check back soon or open the News section.
            </p>
          ) : (
            <ul className="space-y-2">
              {news.map((n) => (
                <li key={n.id || n.title} className={`border-b border-[#2b3139]/80 pb-2 last:border-0 last:pb-0`}>
                  <Link
                    href={n.id ? `/news/${n.id}` : "/news"}
                    className="line-clamp-2 text-sm font-medium text-white transition hover:text-[#7b9cff]"
                  >
                    {n.title || "Untitled"}
                  </Link>
                  <div className={`mt-0.5 flex flex-wrap gap-x-2 text-[10px] ${C.muted}`}>
                    {formatNewsDate(n.published_at) && <span>{formatNewsDate(n.published_at)}</span>}
                    {n.source && typeof n.source === "string" && n.source.length < 80 && (
                      <span className="truncate">{n.source}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 laptop:col-span-5">
          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="mb-3 flex items-center gap-2">
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
              <div className="space-y-6">
                <div>
                  <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${C.green}`}>Top gainers</p>
                  <div
                    className={`mb-1.5 flex items-center justify-between gap-2 border-b border-[#2b3139]/80 pb-1 text-[9px] font-semibold uppercase tracking-wide ${C.muted}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-5 shrink-0" aria-hidden />
                      <span className="h-7 w-7 shrink-0" aria-hidden />
                      <span className="truncate">Symbol</span>
                    </div>
                    <span className="shrink-0">Volume</span>
                    <span className="w-[4.75rem] shrink-0 text-right">Price change</span>
                  </div>
                  <ul className="max-h-[min(280px,45vh)] space-y-1.5 overflow-y-auto pr-1 font-mono text-sm">
                    {displayGainers.map((r, i) => {
                      const ch = Number(r.change_pct);
                      return (
                        <li key={`g-${r.symbol}`} className="flex items-center justify-between gap-2 tabular-nums">
                          <Link
                            href={`/companies/profile/${r.symbol.toLowerCase()}`}
                            className="flex min-w-0 flex-1 items-center gap-2 text-white hover:text-[#7b9cff]"
                          >
                            <span className={`w-5 shrink-0 text-center text-[10px] ${C.muted}`}>{i + 1}</span>
                            <VolumeListLogo symbol={r.symbol} url={r.logo_url} />
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{r.symbol}</span>
                              {r.company_name && r.company_name !== r.symbol && (
                                <span className={`ml-1 hidden text-[11px] font-normal ${C.muted} sm:inline`}>
                                  {stripParentheticals(r.company_name)}
                                </span>
                              )}
                            </span>
                          </Link>
                          <span className="shrink-0 text-[11px] text-white/90">{formatCompactVol(r.volume)}</span>
                          <span className={`w-[4.75rem] shrink-0 text-right text-xs ${C.green}`}>
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
                <div>
                  <p className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${C.red}`}>Top losers</p>
                  <div
                    className={`mb-1.5 flex items-center justify-between gap-2 border-b border-[#2b3139]/80 pb-1 text-[9px] font-semibold uppercase tracking-wide ${C.muted}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="w-5 shrink-0" aria-hidden />
                      <span className="h-7 w-7 shrink-0" aria-hidden />
                      <span className="truncate">Symbol</span>
                    </div>
                    <span className="shrink-0">Volume</span>
                    <span className="w-[4.75rem] shrink-0 text-right">Price change</span>
                  </div>
                  <ul className="max-h-[min(280px,45vh)] space-y-1.5 overflow-y-auto pr-1 font-mono text-sm">
                    {displayLosers.map((r, i) => {
                      const ch = Number(r.change_pct);
                      return (
                        <li key={`l-${r.symbol}`} className="flex items-center justify-between gap-2 tabular-nums">
                          <Link
                            href={`/companies/profile/${r.symbol.toLowerCase()}`}
                            className="flex min-w-0 flex-1 items-center gap-2 text-white hover:text-[#7b9cff]"
                          >
                            <span className={`w-5 shrink-0 text-center text-[10px] ${C.muted}`}>{i + 1}</span>
                            <VolumeListLogo symbol={r.symbol} url={r.logo_url} />
                            <span className="min-w-0 truncate">
                              <span className="font-semibold">{r.symbol}</span>
                              {r.company_name && r.company_name !== r.symbol && (
                                <span className={`ml-1 hidden text-[11px] font-normal ${C.muted} sm:inline`}>
                                  {stripParentheticals(r.company_name)}
                                </span>
                              )}
                            </span>
                          </Link>
                          <span className="shrink-0 text-[11px] text-white/90">{formatCompactVol(r.volume)}</span>
                          <span className={`w-[4.75rem] shrink-0 text-right text-xs ${C.red}`}>
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
              <p className={`mt-3 text-[10px] leading-snug ${C.muted}`}>
                {displayVolumeNote ||
                  "From instrument_snapshot ranked by volume; server cache up to 3 hours."}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl ${C.card} p-4`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white">Liquidity heatmap (Technology)</h3>
          </div>
          <Link href="/trading" className={`text-[10px] font-semibold text-[#7b9cff] hover:underline`}>
            Heatmap on trading
          </Link>
        </div>
        {displayHeatmapLoading ? (
          <div className={`flex h-[min(42vh,400px)] min-h-[280px] items-center justify-center text-sm ${C.muted} animate-pulse`}>Loading map…</div>
        ) : (
          <CompactHeatmap data={displayHeatmap} />
        )}
      </div>
    </section>
  );
}
