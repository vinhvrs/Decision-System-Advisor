"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstrumentService } from "@/src/services/Instrument.service";
import {
  BeginnerService,
  type BeginnerBoardRow,
  type BeginnerRadarPoint,
} from "@/src/services/Beginner.service";
import type { HomeMarketViewVariant } from "@/src/app/(site)/HomeMarketView";
import BeginnerRadarChart from "./BeginnerRadarChart";
import BeginnerTestMarketExtras from "./BeginnerTestMarketExtras";
import { stripParentheticals } from "@/src/libs/displayString";
import { isDemoDevMode } from "@/src/libs/devMode";
import { fearGreedFromBoardRows, fearGreedFromChangePct } from "@/src/libs/fearGreed";
import { DEV_SYMBOL_SEED, type SymbolDevCompany } from "@/src/libs/symbolDevIdb";
import {
  Heart,
  TrendingUp,
  BarChart3,
  Gauge,
  Droplets,
  Users,
  Clock,
  Trophy,
  Home,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type Period = "daily" | "yearly";

/** CMC-like palette */
const C = {
  page: "bg-[#0b0e11]",
  surface: "bg-[#171a1f]",
  card: "bg-[#1e2329] border border-[#2b3139]",
  text: "text-[#eaecef]",
  muted: "text-[#848e9c]",
  green: "text-[#16c784]",
  red: "text-[#ea3943]",
  line: "border-[#2b3139]",
};

/** Short list for the beginner board (API + UI). */
const BOARD_LIMIT_PROD = 10;
/** Wider fetch in dev so the fixed demo tickers are likely present in the ranking payload. */
const DEV_BOARD_FETCH_LIMIT = 200;

const DEV_SYMBOL_ORDER = new Map(DEV_SYMBOL_SEED.map((r, i) => [r.symbol.toUpperCase(), i]));

function filterBoardRowsForDevMode(rows: BeginnerBoardRow[]): BeginnerBoardRow[] {
  const filtered = rows.filter((r) => DEV_SYMBOL_ORDER.has(r.symbol.toUpperCase()));
  filtered.sort((a, b) => {
    const ia = DEV_SYMBOL_ORDER.get(a.symbol.toUpperCase()) ?? 999;
    const ib = DEV_SYMBOL_ORDER.get(b.symbol.toUpperCase()) ?? 999;
    return ia - ib;
  });
  return filtered.map((r, i) => ({ ...r, rank: i + 1 }));
}

function radarFromScores(scores: BeginnerBoardRow["scores"]): BeginnerRadarPoint[] {
  return [
    { subject: "Signal", value: scores.reputation },
    { subject: "Price", value: scores.price_period },
    { subject: "Change", value: scores.candle_change },
    { subject: "Volume", value: scores.volume },
    { subject: "Liquidity", value: scores.liquidity },
    { subject: "Watchers", value: scores.people_care },
  ];
}

function syntheticDevBoardRow(seed: SymbolDevCompany): BeginnerBoardRow {
  const scores: BeginnerBoardRow["scores"] = {
    reputation: 2,
    price_period: 2,
    candle_change: 2,
    volume: 2,
    liquidity: 2,
    people_care: 2,
  };
  return {
    rank: 0,
    symbol: seed.symbol.toUpperCase(),
    company_name: seed.company_name,
    logo_url: null,
    strong_count: 0,
    scores,
    radar: radarFromScores(scores),
    liquidity: 0,
    volume: 0,
    people_watching: 0,
    price: 0,
    candle_move_abs_pct: 0,
    change_pct_snapshot: 0,
    day_bias: "flat",
  };
}

async function hydrateDevBoardRowFromApi(seed: SymbolDevCompany): Promise<BeginnerBoardRow | null> {
  const symbol = seed.symbol.toUpperCase();
  try {
    const [overview, formal] = await Promise.all([
      BeginnerService.getOverview(symbol),
      BeginnerService.getFormalRadar(symbol, 150),
    ]);
    if (!formal && !overview) return null;

    const chg = Number(overview?.change_pct_snapshot ?? formal?.change_pct_snapshot ?? 0);
    const bias: BeginnerBoardRow["day_bias"] =
      chg > 0 ? "buy" : chg < 0 ? "sell" : "flat";
    const sc = (formal?.scores ?? {}) as Record<string, number>;
    const scores: BeginnerBoardRow["scores"] = {
      reputation: Number(sc.reputation ?? 3),
      price_period: Number(sc.price_period ?? 3),
      candle_change: Number(sc.candle_change ?? 3),
      volume: Number(sc.volume ?? 3),
      liquidity: Number(sc.liquidity ?? 3),
      people_care: Number(sc.people_care ?? 3),
    };
    const radar =
      formal?.radar && formal.radar.length > 0 ? formal.radar : radarFromScores(scores);
    const strong = Number.isFinite(Number(formal?.strong_count))
      ? Number(formal!.strong_count)
      : 0;

    return {
      rank: 0,
      symbol,
      company_name: overview?.company_name ?? seed.company_name,
      logo_url: overview?.logo_url ?? null,
      strong_count: strong,
      scores,
      radar,
      liquidity: Number(overview?.liquidity ?? 0),
      volume: Number(overview?.volume ?? 0),
      people_watching: Number(overview?.people_watching ?? 0),
      price: Number(overview?.price ?? 0),
      candle_move_abs_pct: Math.abs(chg),
      change_pct_snapshot: Math.round(chg * 100) / 100,
      day_bias: bias,
    };
  } catch {
    return null;
  }
}

/** Always show all ``DEV_SYMBOL_SEED`` tickers; fetch per-symbol when missing from volume-ranked board. */
async function ensureDevBoardRowsComplete(partial: BeginnerBoardRow[]): Promise<BeginnerBoardRow[]> {
  const bySym = new Map(partial.map((r) => [r.symbol.toUpperCase(), r] as const));
  const missing = DEV_SYMBOL_SEED.filter((s) => !bySym.has(s.symbol.toUpperCase()));
  if (missing.length > 0) {
    const filled = await Promise.all(missing.map((seed) => hydrateDevBoardRowFromApi(seed)));
    missing.forEach((seed, i) => {
      bySym.set(seed.symbol.toUpperCase(), filled[i] ?? syntheticDevBoardRow(seed));
    });
  }
  return DEV_SYMBOL_SEED.map((seed) => {
    const sym = seed.symbol.toUpperCase();
    const row = bySym.get(sym) ?? syntheticDevBoardRow(seed);
    return {
      ...row,
      symbol: sym,
      company_name: seed.company_name,
      rank: 0,
    };
  }).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Anchor the radar popover near the cursor while staying in the viewport. */
function clampRadarPopoverPosition(clientX: number, clientY: number) {
  const panelW = Math.min(340, window.innerWidth - 24);
  const panelH = 520;
  const gap = 14;
  let left = clientX + gap;
  let top = clientY + gap;
  if (left + panelW > window.innerWidth - 8) {
    left = clientX - panelW - gap;
  }
  if (left < 8) left = 8;
  if (top + panelH > window.innerHeight - 8) {
    top = clientY - panelH - gap;
  }
  if (top < 8) top = 8;
  return { top, left };
}

/** Refresh cached beginner board so Fear & Greed and % badges track snapshot updates. */
const BOARD_REFRESH_MS = 150_000;

/** Re-pull daily closes for sparklines / Fear & Greed bar moves. */
const SPARKLINE_REFRESH_MS = 240_000;
const VISIBILITY_REFRESH_MIN_GAP_MS = 20_000;

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatShares(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.round(n));
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

/** Align daily close series from the end and average across symbols (for market-wide sparkline). */
function averageClosesSeries(
  rows: BeginnerBoardRow[],
  closesBySymbol: Record<string, number[]>,
  maxPoints: number
): number[] {
  if (!rows.length) return [];
  const series: number[][] = [];
  for (const r of rows) {
    const raw = closesBySymbol[r.symbol] ?? closesBySymbol[r.symbol.toUpperCase()] ?? [];
    if (raw.length < 2) continue;
    const a = raw.length > maxPoints ? raw.slice(-maxPoints) : raw;
    series.push(a);
  }
  if (!series.length) return [];
  const m = Math.min(...series.map((a) => a.length));
  const out: number[] = [];
  for (let i = 0; i < m; i++) {
    let s = 0;
    let c = 0;
    for (const a of series) {
      const v = a[a.length - m + i];
      if (Number.isFinite(v)) {
        s += v;
        c++;
      }
    }
    if (c) out.push(s / c);
  }
  return out;
}

function dayBiasFromRow(r: BeginnerBoardRow): "buy" | "sell" | "flat" {
  if (r.day_bias === "buy" || r.day_bias === "sell" || r.day_bias === "flat") return r.day_bias;
  const ch = r.change_pct_snapshot;
  if (!Number.isFinite(ch)) return "flat";
  if (ch > 0) return "buy";
  if (ch < 0) return "sell";
  return "flat";
}

function investingBiasLabel(bias: "buy" | "sell" | "flat"): string {
  if (bias === "buy") return "Buy";
  if (bias === "sell") return "Sell";
  return "Hold";
}

function MiniSparkline({
  values,
  className,
  netChangePct,
}: {
  values: number[];
  className?: string;
  /** When set, line color matches the same sign as the dashboard % badge (snapshot / mean). */
  netChangePct?: number | null;
}) {
  const w = 120;
  const h = 36;
  const pad = 2;
  if (values.length < 2) {
    return (
      <div
        className={`h-9 w-full max-w-[120px] rounded bg-white/[0.04] ${className ?? ""}`}
        aria-hidden
      />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  let stroke: string;
  if (netChangePct != null && Number.isFinite(netChangePct)) {
    if (netChangePct > 0) stroke = "#16c784";
    else if (netChangePct < 0) stroke = "#ea3943";
    else stroke = "#848e9c";
  } else {
    stroke = values[values.length - 1] >= values[0] ? "#16c784" : "#ea3943";
  }
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function RowAvatar({ symbol, logoUrl }: { symbol: string; logoUrl?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white">
      {symbol.slice(0, 1)}
    </span>
  );
}

/** Compact line sparkline in each table cell (not candlesticks). */
function TableSparkline({
  values,
  snapshotChangePct,
}: {
  values: number[];
  /** Same field as the 24h % column; keeps line color in sync with the badge. */
  snapshotChangePct?: number | null;
}) {
  const w = 88;
  const h = 28;
  const pad = 1;
  if (values.length < 2) {
    return <div className="mx-auto h-7 w-[88px] rounded bg-white/[0.05]" aria-hidden />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  let stroke: string;
  if (snapshotChangePct != null && Number.isFinite(snapshotChangePct)) {
    if (snapshotChangePct > 0) stroke = "#16c784";
    else if (snapshotChangePct < 0) stroke = "#ea3943";
    else stroke = "#848e9c";
  } else {
    stroke = values[values.length - 1] >= values[0] ? "#16c784" : "#ea3943";
  }
  return (
    <svg
      width={88}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="mx-auto block"
      aria-hidden
    >
      <polyline fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

/**
 * Prefer last two daily closes from the row sparkline (fresh OHLC) when available;
 * otherwise snapshot % from the API. Used for avg-move / header % badges — not for Fear & Greed
 * (F&G uses snapshot % only via {@link fearGreedFromChangePct}).
 */
function effectiveChangeForFearGreed(row: BeginnerBoardRow, closes: number[] | undefined): number | null {
  if (closes && closes.length >= 2) {
    const from = closes[closes.length - 2];
    const to = closes[closes.length - 1];
    const d = pctChange(from, to);
    if (d != null) return d;
  }
  const c = row.change_pct_snapshot;
  return Number.isFinite(c) ? c : null;
}

function FearGreedGauge({ value }: { value: number }) {
  const cx = 60;
  const cy = 58;
  const needleLen = 32;
  const deg = -90 + (value / 100) * 180;
  return (
    <svg viewBox="0 0 120 64" className="w-full max-w-[140px]" aria-hidden>
      <defs>
        <linearGradient id="fgArc" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ea3943" />
          <stop offset="35%" stopColor="#f0b90b" />
          <stop offset="70%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#16c784" />
        </linearGradient>
      </defs>
      <path
        d="M 14 58 A 46 46 0 0 1 106 58"
        fill="none"
        stroke="url(#fgArc)"
        strokeWidth={7}
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - needleLen}
        stroke="#eaecef"
        strokeWidth={2}
        strokeLinecap="round"
        transform={`rotate(${deg} ${cx} ${cy})`}
      />
      <circle cx={cx} cy={cy} r={4} fill="#eaecef" />
    </svg>
  );
}

function PctBadge({ pct }: { pct: number }) {
  const up = pct > 0;
  const down = pct < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  const cls = up ? C.green : down ? C.red : C.muted;
  return (
    <span className={`inline-flex items-center gap-0.5 font-mono text-sm tabular-nums ${cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-90" aria-hidden />
      {up ? "+" : ""}
      {pct.toFixed(2)}%
    </span>
  );
}

function profilePathForSymbol(symbol: string): string {
  return `/companies/profile/${encodeURIComponent(symbol.trim().toLowerCase())}`;
}

/** Prefer embedded Redis ``chart`` closes; else API batch map. */
function sparklineValuesForRow(row: BeginnerBoardRow, batchMap: Record<string, number[]>): number[] {
  if (row.chart && row.chart.length >= 2) {
    const cap = 48;
    return row.chart.length <= cap ? row.chart : row.chart.slice(-cap);
  }
  const sym = row.symbol;
  const arr = batchMap[sym] ?? batchMap[sym.toUpperCase()] ?? [];
  return arr.length <= 28 ? arr : arr.slice(-28);
}

/**
 * Fallback when a symbol has snapshot price but no daily close series.
 * This keeps row sparklines visible (e.g. BE) by deriving a 2-point line
 * from snapshot price and snapshot percent change.
 */
function ensureSparklineValuesForRow(row: BeginnerBoardRow, batchMap: Record<string, number[]>): number[] {
  const values = sparklineValuesForRow(row, batchMap);
  if (values.length >= 2) return values;

  const price = Number(row.price);
  if (!Number.isFinite(price) || price <= 0) return values;

  const ch = Number(row.change_pct_snapshot);
  if (Number.isFinite(ch) && ch > -99.9) {
    const prev = price / (1 + ch / 100);
    if (Number.isFinite(prev) && prev > 0) return [prev, price];
  }

  // Last-resort tiny slope so the row doesn't appear as missing data.
  return [price * 0.995, price];
}

/** For table sort: last − first close in the same series as the sparkline (NaN if not enough points). */
function trendDeltaForSort(row: BeginnerBoardRow, sparkMap: Record<string, number[]>): number {
  const v = sparklineValuesForRow(row, sparkMap);
  if (v.length < 2) return Number.NaN;
  return v[v.length - 1]! - v[0]!;
}

function cmpFinite(a: number, b: number): number {
  const fa = Number.isFinite(a);
  const fb = Number.isFinite(b);
  if (!fa && !fb) return 0;
  if (!fa) return 1;
  if (!fb) return -1;
  return a - b;
}

function biasSortOrder(row: BeginnerBoardRow): number {
  const v = dayBiasFromRow(row);
  if (v === "buy") return 2;
  if (v === "sell") return 0;
  return 1;
}

type BoardSortKey = "rank" | "name" | "price" | "change" | "bias" | "strong" | "liquidity" | "care" | "trend";

type BoardSortHeaderProps = {
  label: string;
  /** Optional native tooltip for column meaning (metrics source). */
  title?: string;
  columnKey: BoardSortKey;
  sort: { key: BoardSortKey; dir: "asc" | "desc" };
  onSort: (key: BoardSortKey, dir: "asc" | "desc") => void;
  align?: "left" | "right" | "center";
  className?: string;
};

function BoardSortHeader({
  label,
  title,
  columnKey,
  sort,
  onSort,
  align = "left",
  className = "",
}: BoardSortHeaderProps) {
  const flex =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  const activeUp = sort.key === columnKey && sort.dir === "asc";
  const activeDown = sort.key === columnKey && sort.dir === "desc";
  const btn =
    "rounded p-0.5 outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#3861fb]/50";
  const iconOn = "text-[#7b9cff]";
  const iconOff = "text-[#848e9c]/60";

  return (
    <th scope="col" className={className}>
      <div className={`flex items-center gap-1 ${flex}`}>
        <span title={title}>{label}</span>
        <span className="inline-flex shrink-0 flex-col leading-none" role="group" aria-label={`Sort by ${label}`}>
          <button
            type="button"
            className={btn}
            aria-label={`${label}, ascending`}
            onClick={() => onSort(columnKey, "asc")}
          >
            <ChevronUp className={`h-3.5 w-3.5 ${activeUp ? iconOn : iconOff}`} strokeWidth={2.5} aria-hidden />
          </button>
          <button
            type="button"
            className={btn}
            aria-label={`${label}, descending`}
            onClick={() => onSort(columnKey, "desc")}
          >
            <ChevronDown className={`h-3.5 w-3.5 ${activeDown ? iconOn : iconOff}`} strokeWidth={2.5} aria-hidden />
          </button>
        </span>
      </div>
    </th>
  );
}

type BeginnerTestHomeProps = {
  dataSource?: HomeMarketViewVariant;
};

export default function BeginnerTestHome({ dataSource = "beginner-board" }: BeginnerTestHomeProps) {
  const pathname = usePathname();
  const isTestRoute = pathname === "/test";

  const isRedisDaily = dataSource === "dashboard-daily";

  const [period, setPeriod] = useState<Period>("daily");
  const [boardRows, setBoardRows] = useState<BeginnerBoardRow[]>([]);
  const [tableSort, setTableSort] = useState<{ key: BoardSortKey; dir: "asc" | "desc" }>({
    key: "rank",
    dir: "asc",
  });
  const [boardLegend, setBoardLegend] = useState<{
    strong_rule?: string;
    tie_break?: string;
    buy_sell?: string;
  } | null>(null);
  const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [hoverRadarRow, setHoverRadarRow] = useState<BeginnerBoardRow | null>(null);
  const [radarPopover, setRadarPopover] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [portalReady, setPortalReady] = useState(false);
  const radarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const radarPopoverRafRef = useRef<number | null>(null);
  const [rowSparklines, setRowSparklines] = useState<Record<string, number[]>>({});
  const [sparklinesLoading, setSparklinesLoading] = useState(false);

  const listLimit = useMemo(() => {
    if (isRedisDaily) return boardRows.length > 0 ? boardRows.length : BOARD_LIMIT_PROD;
    if (isDemoDevMode()) return DEV_SYMBOL_SEED.length;
    return BOARD_LIMIT_PROD;
  }, [isRedisDaily, boardRows.length]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (radarHideTimerRef.current) {
        clearTimeout(radarHideTimerRef.current);
      }
      if (radarPopoverRafRef.current != null) {
        cancelAnimationFrame(radarPopoverRafRef.current);
      }
    };
  }, []);

  const scheduleRadarPopoverPosition = useCallback((clientX: number, clientY: number) => {
    if (typeof window === "undefined") return;
    if (radarPopoverRafRef.current != null) {
      cancelAnimationFrame(radarPopoverRafRef.current);
    }
    radarPopoverRafRef.current = requestAnimationFrame(() => {
      radarPopoverRafRef.current = null;
      setRadarPopover(clampRadarPopoverPosition(clientX, clientY));
    });
  }, []);

  const cancelRadarHide = useCallback(() => {
    if (radarHideTimerRef.current) {
      clearTimeout(radarHideTimerRef.current);
      radarHideTimerRef.current = null;
    }
  }, []);

  const scheduleRadarHide = useCallback(() => {
    cancelRadarHide();
    radarHideTimerRef.current = setTimeout(() => {
      setHoverRadarRow(null);
      radarHideTimerRef.current = null;
    }, 240);
  }, [cancelRadarHide]);

  useEffect(() => {
    let cancelled = false;
    let first = true;
    let lastRefreshMs = 0;

    const refreshBoard = (showSpinner: boolean) => {
      lastRefreshMs = Date.now();
      if (showSpinner) setBoardLoading(true);
      const devMode = isDemoDevMode() && !isRedisDaily;
      const fetchLimit = devMode ? DEV_BOARD_FETCH_LIMIT : BOARD_LIMIT_PROD;

      const chain = isRedisDaily
        ? BeginnerService.getDashboardDaily().then(async (payload) => {
            if (cancelled) return;
            let rows = payload?.rows ?? [];
            // Keep Redis daily board aligned with the fixed demo symbol set/order.
            rows = filterBoardRowsForDevMode(rows);
            rows = await ensureDevBoardRowsComplete(rows);
            rows = rows.slice(0, BOARD_LIMIT_PROD);
            setBoardRows(rows);
            setBoardLegend(payload?.legend ?? null);
            setDashboardUpdatedAt(typeof payload?.updated_at === "string" ? payload.updated_at : null);
          })
        : BeginnerService.getRankingBoard(fetchLimit).then(async (payload) => {
            if (cancelled) return;
            let rows = payload?.rows ?? [];
            if (devMode) {
              rows = filterBoardRowsForDevMode(rows);
              rows = await ensureDevBoardRowsComplete(rows);
              rows = rows.slice(0, BOARD_LIMIT_PROD);
            } else {
              rows = rows.slice(0, BOARD_LIMIT_PROD);
            }
            if (cancelled) return;
            setBoardRows(rows);
            setBoardLegend(payload?.legend ?? null);
            setDashboardUpdatedAt(null);
          });

      chain
        .catch(() => {
          if (!cancelled && first) {
            setBoardRows([]);
            setBoardLegend(null);
            setDashboardUpdatedAt(null);
          }
        })
        .finally(() => {
          if (!cancelled && showSpinner) setBoardLoading(false);
          first = false;
        });
    };

    refreshBoard(true);
    const intervalId = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") refreshBoard(false);
    }, BOARD_REFRESH_MS);

    const onVis = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshMs < VISIBILITY_REFRESH_MIN_GAP_MS) return;
      refreshBoard(false);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isRedisDaily]);

  useEffect(() => {
    if (!boardRows.length) {
      setRowSparklines({});
      setSparklinesLoading(false);
      return;
    }
    let cancelled = false;

    const loadSparklines = (showSpinner: boolean) => {
      if (showSpinner) setSparklinesLoading(true);
      const syms = boardRows.map((r) => r.symbol);
      const allEmbedded = boardRows.every((r) => Array.isArray(r.chart) && r.chart.length >= 2);

      const applyMap = (map: Record<string, number[]>) => {
        if (cancelled) return;
        const next: Record<string, number[]> = {};
        for (const r of boardRows) {
          next[r.symbol] = ensureSparklineValuesForRow(r, map);
        }
        setRowSparklines(next);
      };

      if (allEmbedded) {
        applyMap({});
        if (!cancelled) setSparklinesLoading(false);
        return;
      }

      InstrumentService.batchDailyCloses(syms, 40)
        .then((map) => {
          applyMap(map);
        })
        .catch(() => {
          if (!cancelled && showSpinner) setRowSparklines({});
        })
        .finally(() => {
          if (!cancelled) setSparklinesLoading(false);
        });
    };

    loadSparklines(true);
    const intervalId = window.setInterval(() => {
      if (!cancelled && document.visibilityState === "visible") loadSparklines(false);
    }, SPARKLINE_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [boardRows]);

  const boardAggregates = useMemo(() => {
    if (!boardRows.length) return null;
    let np = 0,
      sumP = 0,
      nl = 0,
      sumL = 0,
      nv = 0,
      sumV = 0,
      nc = 0,
      sumC = 0,
      sumW = 0;
    for (const r of boardRows) {
      if (Number.isFinite(r.price)) {
        sumP += r.price;
        np++;
      }
      if (Number.isFinite(r.liquidity)) {
        sumL += r.liquidity;
        nl++;
      }
      if (Number.isFinite(r.volume)) {
        sumV += r.volume;
        nv++;
      }
      const ch = effectiveChangeForFearGreed(r, rowSparklines[r.symbol] ?? rowSparklines[r.symbol.toUpperCase()]);
      if (ch != null && Number.isFinite(ch)) {
        sumC += ch;
        nc++;
      }
      if (Number.isFinite(r.people_watching)) sumW += r.people_watching;
    }
    return {
      avgPrice: np ? sumP / np : null,
      avgLiquidity: nl ? sumL / nl : null,
      avgVolume: nv ? sumV / nv : null,
      avgChangePct: nc ? sumC / nc : null,
      sumWatchers: sumW,
    };
  }, [boardRows, rowSparklines]);

  const boardAvgSparkline = useMemo(
    () => averageClosesSeries(boardRows, rowSparklines, period === "daily" ? 48 : 24),
    [boardRows, rowSparklines, period]
  );

  const avgMarketCandleInsights = useMemo(() => {
    const s = boardAvgSparkline;
    if (s.length < 2) return null;
    const last = s[s.length - 1];
    const prev = s[s.length - 2];
    return {
      lastClose: last,
      vsPrevClose: pctChange(prev, last),
    };
  }, [boardAvgSparkline]);

  const boardLiquiditySum = useMemo(
    () => boardRows.reduce((s, r) => s + (Number.isFinite(r.liquidity) ? r.liquidity : 0), 0),
    [boardRows]
  );

  const sortedBoardRows = useMemo(() => {
    if (!isTestRoute || boardRows.length === 0) return boardRows;
    const dirM = tableSort.dir === "asc" ? 1 : -1;
    const next = [...boardRows];
    next.sort((a, b) => {
      let c = 0;
      switch (tableSort.key) {
        case "rank":
          c = cmpFinite(a.rank, b.rank);
          break;
        case "name": {
          const na = stripParentheticals(a.company_name) || a.symbol;
          const nb = stripParentheticals(b.company_name) || b.symbol;
          c = na.localeCompare(nb, undefined, { sensitivity: "base" });
          break;
        }
        case "price":
          c = cmpFinite(a.price, b.price);
          break;
        case "change":
          c = cmpFinite(a.change_pct_snapshot, b.change_pct_snapshot);
          break;
        case "bias":
          c = biasSortOrder(a) - biasSortOrder(b);
          break;
        case "strong":
          c = cmpFinite(a.strong_count, b.strong_count);
          break;
        case "liquidity":
          c = cmpFinite(a.liquidity, b.liquidity);
          break;
        case "care":
          c = cmpFinite(a.people_watching, b.people_watching);
          break;
        case "trend":
          c = cmpFinite(trendDeltaForSort(a, rowSparklines), trendDeltaForSort(b, rowSparklines));
          break;
        default:
          return 0;
      }
      if (c !== 0) return c * dirM;
      return a.symbol.localeCompare(b.symbol);
    });
    return next;
  }, [isTestRoute, boardRows, tableSort, rowSparklines]);

  const fearGreed = useMemo(() => fearGreedFromBoardRows(boardRows), [boardRows]);

  const headerStatsReady = !boardLoading && boardRows.length > 0 && boardAggregates != null;

  return (
    <div className={`min-h-screen ${C.page} ${C.text} font-sans antialiased`}>
      {/* Top strip — CMC-style compact header */}
      <header className={`sticky top-0 z-40 border-b ${C.line} ${C.surface}/95 backdrop-blur-md`}>
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3 phone:flex-row phone:flex-wrap phone:items-center sm:px-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2 phone:flex-row phone:items-center phone:gap-4">
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">
                Market view
              </h1>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 phone:w-auto">
            <div className={`inline-flex w-full rounded-lg ${C.card} p-0.5 phone:w-auto`}>
              {(["daily", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition phone:flex-none ${
                    period === p ? "bg-[#3861fb] text-white" : `${C.muted} hover:text-white`
                  }`}
                >
                  {p === "daily" ? "Daily" : "Yearly"}
                </button>
              ))}
            </div>
            <Link
              href="/trading"
              className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg ${C.card} px-3 py-2 text-xs font-medium ${C.muted} transition hover:text-white phone:flex-none`}
            >
              <Home className="h-3.5 w-3.5" />
              Investing site
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-2 py-4 phone:px-3 sm:px-4 sm:py-5">
        {/* Stat widgets — stack on small screens, grid on medium, optional horizontal scroll on very wide */}
        <section className="mb-4 grid grid-cols-1 gap-3 phone:grid-cols-2 tablet:grid-cols-3 laptop:grid-cols-3 xl:grid-cols-5 xl:gap-3">
          <div
            className={`relative min-w-0 overflow-hidden rounded-2xl ${C.card} p-4 xl:min-w-[200px] xl:shrink-0 2xl:min-w-[220px]`}
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 opacity-[0.35]">
              <MiniSparkline values={boardAvgSparkline} netChangePct={boardAggregates?.avgChangePct ?? null} />
            </div>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Avg price</p>
            {!headerStatsReady ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : boardAggregates?.avgPrice != null ? (
              <>
                <p className="relative mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {formatUsd(boardAggregates.avgPrice)}
                </p>
                <div className="relative mt-1">
                  {boardAggregates.avgChangePct != null ? (
                    <PctBadge pct={boardAggregates.avgChangePct} />
                  ) : (
                    <span className={`text-sm ${C.muted}`}>—</span>
                  )}
                </div>
              </>
            ) : (
              <p className={`relative mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-0 rounded-2xl ${C.card} p-4 xl:min-w-[180px] xl:shrink-0 2xl:min-w-[200px]`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Avg Vol $</p>
            {!headerStatsReady ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : boardAggregates?.avgLiquidity != null ? (
              <>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatUsd(boardAggregates.avgLiquidity)}</p>
              </>
            ) : (
              <p className={`mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-0 rounded-2xl ${C.card} p-4 xl:min-w-[160px] xl:shrink-0`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Avg volume</p>
            {!headerStatsReady ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : boardAggregates?.avgVolume != null ? (
              <>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatShares(boardAggregates.avgVolume)}</p>
                <p className={`mt-1 text-[11px] ${C.muted}`}>Mean shares (last snapshot)</p>
              </>
            ) : (
              <p className={`mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-0 rounded-2xl ${C.card} p-4 xl:min-w-[180px] xl:shrink-0`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Board Vol $ (sum)</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatUsd(boardLiquiditySum)}</p>
            <p className={`mt-1 text-[11px] ${C.muted}`}>Sum of price × volume for rows on this list (not market cap)</p>
          </div>

          <div className={`relative flex min-w-0 flex-row items-center gap-3 overflow-hidden rounded-2xl ${C.card} p-3 xl:min-w-[220px] xl:flex-1 xl:shrink-0 2xl:min-w-[260px]`}>
            <div className="shrink-0">
              <FearGreedGauge value={fearGreed.value} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-[#f0b90b]" aria-hidden />
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${C.muted}`}>Fear & Greed</p>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">{fearGreed.value}</p>
              <p className="text-xs font-medium text-[#eaecef]">{fearGreed.label}</p>
            </div>
          </div>
        </section>

        {/* Chips + toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[#16c784]/35 bg-[#16c784]/10 px-3 py-1 text-[11px] font-semibold text-[#16c784]"
          >
            Buy
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ea3943]/35 bg-[#ea3943]/10 px-3 py-1 text-[11px] font-semibold text-[#ea3943]"
          >
            Sell
          </span>
          <span className={`rounded-full border ${C.line} px-3 py-1 text-[11px] ${C.muted}`}>
            = snapshot day up / down (not advice)
          </span>
          <span className={`rounded-full border border-[#3861fb]/30 bg-[#3861fb]/10 px-3 py-1 text-[11px] font-medium text-[#7b9cff]`}>
            Radar: hover row (per-symbol)
          </span>
          <Link
            href="/search"
            className="inline-flex items-center gap-1 rounded-full bg-[#a855f7]/15 px-3 py-1 text-[11px] font-semibold text-[#c4a3ff] hover:bg-[#a855f7]/25"
          >
            <Search className="h-3 w-3" />
            Search
          </Link>
          {sparklinesLoading && (
            <span className={`w-full text-right text-[11px] tablet:ml-auto tablet:w-auto ${C.muted}`}>
              Loading row sparklines…
            </span>
          )}
        </div>

        {boardLegend?.buy_sell && (
          <p className={`mb-3 text-[11px] leading-relaxed ${C.muted}`}>{boardLegend.buy_sell}</p>
        )}

        {/* Main ranking + radar */}
        <section className={`rounded-2xl ${C.card} overflow-hidden`}>
          <div className={`flex flex-col gap-2 border-b ${C.line} px-3 py-3 phone:px-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex min-w-0 items-center gap-2">
              <Trophy className="h-5 w-5 shrink-0 text-[#f0b90b]" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">Ideal Investing Ranking</h2>
              </div>
            </div>
            <p className={`min-w-0 text-[11px] ${C.muted} sm:shrink-0`}>
              {boardRows.length ? `${boardRows.length} symbols` : "—"} · mini lines = daily closes · board-wide metrics in
              header
            </p>
          </div>

          {/* {boardLegend?.strong_rule && (
            <p className={`border-b ${C.line} px-4 py-2 text-[11px] ${C.muted}`}>{boardLegend.strong_rule}</p>
          )}
          {boardLegend?.tie_break && (
            <p className={`border-b ${C.line} px-4 py-2 text-[11px] ${C.muted}`}>{boardLegend.tie_break}</p>
          )} */}

          {boardLoading ? (
            <p className={`py-16 text-center text-sm ${C.muted} animate-pulse`}>Loading rankings…</p>
          ) : boardRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-amber-200/90">No snapshot data to rank yet.</p>
          ) : (
            <div className="p-2 phone:p-3 tablet:p-4">
              <div className="space-y-2 tablet:hidden">
                {sortedBoardRows.map((r, idx) => {
                  const bias = dayBiasFromRow(r);
                  const displayRank = isTestRoute ? idx + 1 : r.rank;
                  return (
                    <div
                      key={r.symbol}
                      className={`rounded-xl border border-[#2b3139]/80 p-3 transition ${
                        idx % 2 === 1 ? "bg-white/[0.02]" : ""
                      } ${
                        bias === "buy"
                          ? "border-l-[3px] border-l-[#16c784]"
                          : bias === "sell"
                            ? "border-l-[3px] border-l-[#ea3943]"
                            : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={profilePathForSymbol(r.symbol)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 -m-1 no-underline outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[#3861fb]/50"
                          aria-label={`Open ${r.symbol} company profile`}
                        >
                          <span className={`shrink-0 font-mono text-xs tabular-nums ${C.muted}`}>{displayRank}</span>
                          <RowAvatar symbol={r.symbol} logoUrl={r.logo_url} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">{stripParentheticals(r.company_name)}</p>
                            <p className={`font-mono text-xs ${C.muted}`}>{r.symbol}</p>
                          </div>
                        </Link>
                        <div className="w-[88px] shrink-0">
                          {sparklinesLoading ? (
                            <div className="mx-auto h-7 w-[88px] animate-pulse rounded bg-white/[0.06]" />
                          ) : (
                            <TableSparkline
                              values={rowSparklines[r.symbol] ?? []}
                              snapshotChangePct={r.change_pct_snapshot}
                            />
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs phone:grid-cols-3">
                        <div>
                          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>Price</p>
                          <p className="mt-0.5 font-mono font-medium tabular-nums">{formatUsd(r.price)}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>24h %</p>
                          <div className="mt-0.5">
                            {Number.isFinite(r.change_pct_snapshot) ? (
                              <PctBadge pct={r.change_pct_snapshot} />
                            ) : (
                              <span className={C.muted}>—</span>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 phone:col-span-1">
                          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>Bias / Str</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                bias === "buy"
                                  ? "bg-[#16c784]/15 text-[#16c784]"
                                  : bias === "sell"
                                    ? "bg-[#ea3943]/15 text-[#ea3943]"
                                    : `${C.muted} bg-white/[0.06]`
                              }`}
                            >
                              {investingBiasLabel(bias)}
                            </span>
                            <span className="font-mono tabular-nums">
                              <span className="font-semibold text-[#3861fb]">{r.strong_count}</span>
                              <span className={C.muted}>/5</span>
                            </span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`} title="Price × share volume (snapshot), not market cap">
                            Vol $
                          </p>
                          <p className="mt-0.5 font-mono text-xs tabular-nums">{formatUsd(r.liquidity)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-[#2b3139]/80 tablet:block [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[640px] text-left text-sm laptop:min-w-[720px]">
                  <thead>
                    <tr className={`sticky top-0 z-10 ${C.surface} text-[11px] font-semibold uppercase tracking-wide ${C.muted}`}>
                      {isTestRoute ? (
                        <>
                          <BoardSortHeader
                            label="#"
                            columnKey="rank"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Name"
                            columnKey="name"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Price"
                            columnKey="price"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="right"
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="24h %"
                            title="Daily snapshot percent change from the data feed (same sign as Buy/Sell bias)."
                            columnKey="change"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="right"
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Bias"
                            columnKey="bias"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="center"
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Str"
                            columnKey="strong"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="center"
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Vol $"
                            title="Dollar trading activity: last snapshot price × share volume (not market capitalization)."
                            columnKey="liquidity"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="right"
                            className={`hidden border-b ${C.line} px-2 py-2.5 sm:table-cell lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Care"
                            columnKey="care"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="right"
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                          <BoardSortHeader
                            label="Trend"
                            title="Recent daily closes; line color matches the 24h % column (same snapshot sign)."
                            columnKey="trend"
                            sort={tableSort}
                            onSort={(key, dir) => setTableSort({ key, dir })}
                            align="center"
                            className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                          />
                        </>
                      ) : (
                        <>
                          <th className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}>#</th>
                          <th className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}>Name</th>
                          <th className={`border-b ${C.line} px-2 py-2.5 text-right lg:px-3`}>Price</th>
                          <th
                            className={`border-b ${C.line} px-2 py-2.5 text-right lg:px-3`}
                            title="Daily snapshot % from the data feed."
                          >
                            24h %
                          </th>
                          <th className={`border-b ${C.line} px-2 py-2.5 text-center lg:px-3`}>Bias</th>
                          <th className={`border-b ${C.line} px-2 py-2.5 text-center lg:px-3`}>Str</th>
                          <th
                            className={`hidden border-b ${C.line} px-2 py-2.5 text-right sm:table-cell lg:px-3`}
                            title="Dollar trading activity (price × volume, snapshot) — not market cap."
                          >
                            Vol $
                          </th>
                          <th className={`border-b ${C.line} px-2 py-2.5 text-right lg:px-3`}>Care</th>
                          <th
                            className={`border-b ${C.line} px-2 py-2.5 text-center lg:px-3`}
                            title="Recent daily closes; color matches 24h % snapshot sign."
                          >
                            Trend
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                    <tbody>
                      {sortedBoardRows.map((r, idx) => {
                        const displayRank = isTestRoute ? idx + 1 : r.rank;
                        const bias = dayBiasFromRow(r);
                        const handleRowEnter = (e: MouseEvent<HTMLTableRowElement>) => {
                          cancelRadarHide();
                          setHoverRadarRow(r);
                          scheduleRadarPopoverPosition(e.clientX, e.clientY);
                        };
                        const handleRowMouseMove = (e: MouseEvent<HTMLTableRowElement>) => {
                          scheduleRadarPopoverPosition(e.clientX, e.clientY);
                        };
                        return (
                          <tr
                            key={r.symbol}
                            onMouseEnter={handleRowEnter}
                            onMouseMove={handleRowMouseMove}
                            onMouseLeave={scheduleRadarHide}
                            className={`cursor-default border-b border-[#2b3139]/80 transition hover:bg-white/[0.04] ${
                              idx % 2 === 1 ? "bg-white/[0.015]" : ""
                            } ${
                              bias === "buy"
                                ? "border-l-[3px] border-l-[#16c784]"
                                : bias === "sell"
                                  ? "border-l-[3px] border-l-[#ea3943]"
                                  : "border-l-[3px] border-l-transparent"
                            }`}
                          >
                            <td className={`px-3 py-2.5 font-mono tabular-nums ${C.muted}`}>{displayRank}</td>
                            <td className="px-3 py-2.5">
                              <Link
                                href={profilePathForSymbol(r.symbol)}
                                className="flex items-center gap-2.5 rounded-lg p-1 -m-1 no-underline outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[#3861fb]/50"
                                aria-label={`Open ${r.symbol} company profile`}
                              >
                                <RowAvatar symbol={r.symbol} logoUrl={r.logo_url} />
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-white">{stripParentheticals(r.company_name)}</p>
                                  <p className={`font-mono text-xs ${C.muted}`}>{r.symbol}</p>
                                </div>
                              </Link>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium">
                              {formatUsd(r.price)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {Number.isFinite(r.change_pct_snapshot) ? (
                                <PctBadge pct={r.change_pct_snapshot} />
                              ) : (
                                <span className={C.muted}>—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  bias === "buy"
                                    ? "bg-[#16c784]/15 text-[#16c784]"
                                    : bias === "sell"
                                      ? "bg-[#ea3943]/15 text-[#ea3943]"
                                      : `${C.muted} bg-white/[0.06]`
                                }`}
                              >
                                {investingBiasLabel(bias)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums">
                              <span className="font-semibold text-[#3861fb]">{r.strong_count}</span>
                              <span className={C.muted}>/5</span>
                            </td>
                            <td className={`hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums sm:table-cell lg:px-3`}>
                              {formatUsd(r.liquidity)}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono tabular-nums lg:px-3">{r.people_watching}</td>
                            <td className="border-l border-[#2b3139]/60 px-1 py-1.5 align-middle">
                              {sparklinesLoading ? (
                                <div className="mx-auto h-7 w-[88px] animate-pulse rounded bg-white/[0.06]" />
                              ) : (
                                <TableSparkline
                                  values={rowSparklines[r.symbol] ?? []}
                                  snapshotChangePct={r.change_pct_snapshot}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={`mt-2 text-[10px] ${C.muted}`}>
                  <span className="tablet:hidden">
                    Tap a company name for profile. Header shows list averages; hover a row (desktop) for radar.
                  </span>
                  <span className="hidden tablet:inline">
                    Hover a row — the radar card follows your cursor (clamped to the viewport). Click the popover or a company
                    name for profile. Trend shows recent daily closes; its color matches the 24h % column.
                  </span>
                </p>

                <details className={`mt-3 rounded-lg border ${C.line} bg-black/20 px-3 py-2`}>
                  <summary className={`cursor-pointer text-[11px] font-semibold text-[#7b9cff]`}>
                    How these metrics are calculated
                  </summary>
                  <ul className={`mt-2 list-inside list-disc space-y-1.5 text-[10px] leading-relaxed ${C.muted}`}>
                    <li>
                      <strong className="text-white/80">Fear &amp; Greed (everywhere):</strong> One mapping:{" "}
                      <code className="text-white/60">F = round(clamp(50 + 3.25·r, 0, 100))</code> with{" "}
                      <code className="text-white/60">r</code> = daily snapshot % (<code className="text-white/60">change_pct_snapshot</code>
                      ). Toolbar applies it to the <em>mean</em> snapshot % across listed symbols; row hover and company profile
                      apply it to that symbol&apos;s snapshot % — same formula as the Laravel beginner-radar API field.
                    </li>
                    <li>
                      <strong className="text-white/80">Row trend line:</strong> Last ~28 daily closes from instrument data;
                      polyline colored green if last ≥ first, else red.
                    </li>
                    <li>
                      <strong className="text-white/80">Radar scores:</strong> From the API beginner board — chart shows five
                      spokes (Price omitted in the UI). <strong className="text-white/80">Str</strong> is{" "}
                      <code className="text-white/60">strong_count</code> from the API (five spokes, score ≥ 4).
                    </li>
                    <li>
                      <strong className="text-white/80">Buy / Hold / Sell badge:</strong> Sign of the same daily snapshot %
                      change as the heatmap snapshot (not trading advice).
                    </li>
                  </ul>
                </details>
            </div>
          )}
        </section>

        {/* Detail cards — same content, CMC-style tiles */}
        <div className="mt-6 grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-semibold">Watchlist saves (list)</h3>
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${C.muted}`}>
              Sum of watchlist counts across the top {listLimit} symbols — not your personal list.
            </p>
            {headerStatsReady && boardAggregates != null && (
              <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{boardAggregates.sumWatchers}</p>
            )}
          </div>

          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#16c784]" />
              <h3 className="text-sm font-semibold">Avg move (list)</h3>
            </div>
            <p className={`mt-2 text-xs ${C.muted}`}>
              Mean effective % change (sparkline last step or snapshot) — same basis as the header badge.
            </p>
            {headerStatsReady && boardAggregates?.avgChangePct != null ? (
              <p
                className={`mt-3 font-mono text-2xl font-semibold tabular-nums ${boardAggregates.avgChangePct >= 0 ? C.green : C.red}`}
              >
                {boardAggregates.avgChangePct >= 0 ? "+" : ""}
                {boardAggregates.avgChangePct.toFixed(2)}%
              </p>
            ) : (
              <p className={`mt-2 text-xs ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`rounded-2xl ${C.card} p-4 tablet:col-span-2 laptop:col-span-1`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Avg close trajectory</h3>
            </div>
            <p className={`mt-2 text-xs ${C.muted}`}>
              Average of daily closes across symbols (aligned from the most recent bar). Toggle Daily / Yearly shortens the
              window.
            </p>
            {avgMarketCandleInsights ? (
              <div className="mt-3 space-y-2 text-xs">
                <p className="font-mono text-lg tabular-nums">{formatUsd(avgMarketCandleInsights.lastClose)}</p>
                <p className={C.muted}>
                  Last vs prev avg:{" "}
                  <span
                    className={
                      avgMarketCandleInsights.vsPrevClose != null && avgMarketCandleInsights.vsPrevClose >= 0 ? C.green : C.red
                    }
                  >
                    {avgMarketCandleInsights.vsPrevClose == null
                      ? "—"
                      : `${avgMarketCandleInsights.vsPrevClose >= 0 ? "+" : ""}${avgMarketCandleInsights.vsPrevClose.toFixed(2)}%`}
                  </span>
                </p>
              </div>
            ) : (
              <p className={`mt-2 text-xs ${C.muted}`}>
                {sparklinesLoading ? "Loading…" : "Need at least two daily closes per symbol."}
              </p>
            )}
          </div>

          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold">Avg liquidity & volume</h3>
            </div>
            {headerStatsReady && boardAggregates != null ? (
              <div className="mt-3 space-y-1 font-mono text-sm tabular-nums">
                <p>{boardAggregates.avgLiquidity != null ? formatUsd(boardAggregates.avgLiquidity) : "—"}</p>
                <p className={C.muted}>
                  {boardAggregates.avgVolume != null ? `${formatShares(boardAggregates.avgVolume)} sh` : "—"}
                </p>
              </div>
            ) : (
              <p className={`mt-2 text-xs ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`rounded-2xl ${C.card} p-4 tablet:col-span-2`}>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-[#3861fb]" />
              <div>
                <h3 className="text-sm font-semibold">Disclaimer</h3>
                <p className={`mt-1 text-xs leading-relaxed ${C.muted}`}>
                  Learning layout only — not financial advice. Explore the rest of the site for deeper tools.
                </p>
              </div>
            </div>
          </div>
        </div>

        <BeginnerTestMarketExtras
          dashboardDailyMode={isRedisDaily}
          dashboardRows={boardRows}
          boardLoading={boardLoading}
          dashboardUpdatedAt={dashboardUpdatedAt}
        />

        <p className={`mt-6 flex items-center justify-center gap-2 pb-8 text-[11px] ${C.muted}`}>
          <Clock className="h-3.5 w-3.5" />
          Server snapshot timing — not live exchange clocks.
        </p>
      </div>

      {portalReady &&
        hoverRadarRow &&
        typeof document !== "undefined" &&
        createPortal(
          <Link
            href={profilePathForSymbol(hoverRadarRow.symbol)}
            role="link"
            aria-label={`Open ${hoverRadarRow.symbol} company profile`}
            style={{ top: radarPopover.top, left: radarPopover.left }}
            className={`fixed z-[200] block w-[min(340px,calc(100vw-24px))] cursor-pointer overflow-visible rounded-xl border border-[#2b3139] bg-[#1e2329] p-3 shadow-2xl shadow-black/70 no-underline outline-none transition-colors pointer-events-auto hover:border-[#3861fb]/45 hover:bg-[#23272e] focus-visible:ring-2 focus-visible:ring-[#3861fb]/50`}
            onMouseEnter={cancelRadarHide}
            onMouseLeave={scheduleRadarHide}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-semibold text-white">{hoverRadarRow.symbol}</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#7b9cff]">
                Profile
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <p className={`mb-2 text-[10px] leading-snug ${C.muted}`}>
              Per-symbol radar and Fear &amp; Greed strip — same{" "}
              <code className="text-white/45">50 + 3.25×r</code> as the company profile, with{" "}
              <code className="text-white/45">r</code> = this row&apos;s snapshot %. The header gauge uses the mean snapshot %
              across the list with the same mapping.{" "}
              <span className="text-[#7b9cff]">Click anywhere to open the company profile.</span>
            </p>
            {/* Recharts captures clicks; let them pass through so the wrapping Link navigates. */}
            <div className="pointer-events-none">
              <BeginnerRadarChart
                data={hoverRadarRow.radar}
                fearGreed={fearGreedFromChangePct(hoverRadarRow.change_pct_snapshot)}
              />
            </div>
          </Link>,
          document.body
        )}
    </div>
  );
}
