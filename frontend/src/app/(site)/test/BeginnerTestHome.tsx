"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompanyService } from "@/src/services/Company.service";
import { InstrumentService } from "@/src/services/Instrument.service";
import { BeginnerService, type BeginnerBoardRow, type BeginnerOverview } from "@/src/services/Beginner.service";
import BeginnerRadarChart from "./BeginnerRadarChart";
import {
  Heart,
  TrendingUp,
  BarChart3,
  Gauge,
  Droplets,
  Users,
  Clock,
  ChevronRight,
  Trophy,
  Home,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

type Period = "daily" | "yearly";

type SymbolOption = { symbol: string; company_name?: string };

type CandleRow = {
  timestamps?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

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
const BOARD_LIMIT = 8;

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

function parseCandleTime(row: CandleRow): number {
  const raw = row.timestamps;
  if (!raw) return 0;
  const s = String(raw);
  const d = s.includes("T") ? new Date(s) : new Date(s.replace(" ", "T") + "Z");
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

function dayBiasFromRow(r: BeginnerBoardRow): "buy" | "sell" | "flat" {
  if (r.day_bias === "buy" || r.day_bias === "sell" || r.day_bias === "flat") return r.day_bias;
  const ch = r.change_pct_snapshot;
  if (!Number.isFinite(ch)) return "flat";
  if (ch > 0) return "buy";
  if (ch < 0) return "sell";
  return "flat";
}

function closesForSparkline(candles: CandleRow[], maxPoints: number): number[] {
  const sorted = [...candles].sort((a, b) => parseCandleTime(a) - parseCandleTime(b));
  const closes = sorted.map((r) => Number(r.close)).filter((n) => Number.isFinite(n));
  if (closes.length <= maxPoints) return closes;
  return closes.slice(-maxPoints);
}

function MiniSparkline({ values, className }: { values: number[]; className?: string }) {
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
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "#16c784" : "#ea3943";
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

/** Compact line sparkline in each table cell (not candlesticks). */
function TableSparkline({ values }: { values: number[] }) {
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
  const up = values[values.length - 1] >= values[0];
  const stroke = up ? "#16c784" : "#ea3943";
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
 * Internal Fear & Greed 0–100 (not Alternative.me).
 * Formula: start at 50, push by average snapshot % change and by share of symbols up.
 */
function computeFearGreedFromBoard(rows: BeginnerBoardRow[]): { value: number; label: string } {
  if (!rows.length) {
    return { value: 50, label: "Neutral" };
  }
  let sum = 0;
  let n = 0;
  let ups = 0;
  for (const r of rows) {
    const c = r.change_pct_snapshot;
    if (!Number.isFinite(c)) continue;
    sum += c;
    n++;
    if (c > 0) ups++;
  }
  const avg = n ? sum / n : 0;
  const breadth = n ? ups / n : 0.5;
  let v = 50 + avg * 3.25 + (breadth - 0.5) * 42;
  v = Math.round(Math.max(0, Math.min(100, v)));
  let label: string;
  if (v <= 24) label = "Extreme Fear";
  else if (v <= 44) label = "Fear";
  else if (v <= 55) label = "Neutral";
  else if (v <= 74) label = "Greed";
  else label = "Extreme Greed";
  return { value: v, label };
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

export default function BeginnerTestHome() {
  const router = useRouter();
  const [symbols, setSymbols] = useState<SymbolOption[]>([]);
  const [symbol, setSymbol] = useState("NVDA");
  const [period, setPeriod] = useState<Period>("daily");
  const [overview, setOverview] = useState<BeginnerOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [candleNote, setCandleNote] = useState<string | null>(null);
  const [boardRows, setBoardRows] = useState<BeginnerBoardRow[]>([]);
  const [boardLegend, setBoardLegend] = useState<{
    strong_rule?: string;
    tie_break?: string;
    buy_sell?: string;
  } | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [hoverRadarRow, setHoverRadarRow] = useState<BeginnerBoardRow | null>(null);
  const [radarPopover, setRadarPopover] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [portalReady, setPortalReady] = useState(false);
  const radarHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rowSparklines, setRowSparklines] = useState<Record<string, number[]>>({});
  const [sparklinesLoading, setSparklinesLoading] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    return () => {
      if (radarHideTimerRef.current) {
        clearTimeout(radarHideTimerRef.current);
      }
    };
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
    CompanyService.topCompanies(50, "liquidity")
      .then((rows) => {
        const list = (rows || []).map((r: { symbol?: string; company_name?: string }) => ({
          symbol: String(r.symbol || "").toUpperCase(),
          company_name: r.company_name,
        }));
        const uniq = Array.from(
          new Map(list.filter((x: SymbolOption) => x.symbol).map((x: SymbolOption) => [x.symbol, x])).values()
        ) as SymbolOption[];
        setSymbols(uniq.length ? uniq : [{ symbol: "NVDA" }, { symbol: "AAPL" }, { symbol: "MSFT" }]);
      })
      .catch(() => setSymbols([{ symbol: "NVDA" }, { symbol: "AAPL" }, { symbol: "MSFT" }]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBoardLoading(true);
    BeginnerService.getRankingBoard(BOARD_LIMIT)
      .then((payload) => {
        if (cancelled) return;
        const rows = (payload?.rows ?? []).slice(0, BOARD_LIMIT);
        setBoardRows(rows);
        setBoardLegend(payload?.legend ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setBoardRows([]);
          setBoardLegend(null);
        }
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!boardRows.length) {
      setRowSparklines({});
      setSparklinesLoading(false);
      return;
    }
    let cancelled = false;
    setSparklinesLoading(true);
    const syms = boardRows.map((r) => r.symbol);
    Promise.all(
      syms.map(async (sym) => {
        try {
          const raw = await InstrumentService.getInstrumentData(sym, "daily", 40, 1);
          const list = (raw || []) as CandleRow[];
          return { sym, closes: closesForSparkline(list, 28) };
        } catch {
          return { sym, closes: [] as number[] };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, number[]> = {};
      for (const { sym, closes } of results) {
        next[sym] = closes;
      }
      setRowSparklines(next);
      setSparklinesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [boardRows]);

  useEffect(() => {
    let cancelled = false;
    setOverviewLoading(true);
    BeginnerService.getOverview(symbol).then((data) => {
      if (!cancelled) {
        setOverview(data);
        setOverviewLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const loadCandles = useCallback(async () => {
    setCandlesLoading(true);
    setCandleNote(null);
    try {
      const limit = period === "daily" ? 400 : 80;
      const raw = await InstrumentService.getInstrumentData(symbol, period, limit, 1);
      const list = (raw || []) as CandleRow[];
      const sorted = [...list].sort((a, b) => parseCandleTime(a) - parseCandleTime(b));
      setCandles(sorted);
      if (sorted.length < 2) {
        setCandleNote(
          period === "yearly"
            ? "We need a bit more yearly history to compare two bars — try daily for now."
            : "Not enough recent bars to compare yet."
        );
      }
    } catch {
      setCandles([]);
      setCandleNote("Could not load price bars for this symbol and period.");
    } finally {
      setCandlesLoading(false);
    }
  }, [symbol, period]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  const candleInsights = useMemo(() => {
    if (candles.length < 1) return null;
    const last = candles[candles.length - 1];
    const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
    const o = Number(last.open);
    const c = Number(last.close);
    const insideBar = pctChange(o, c);
    const vsPrevClose = prev ? pctChange(Number(prev.close), c) : null;
    return {
      lastClose: c,
      insideBar,
      vsPrevClose,
      lastVolume: Number(last.volume) || 0,
    };
  }, [candles]);

  const periodLabel = period === "daily" ? "day" : "year";

  const rowForRadar = useMemo(() => {
    if (!boardRows.length) return null;
    const hit = boardRows.find((r) => r.symbol === symbol);
    return hit ?? boardRows[0];
  }, [boardRows, symbol]);

  const sparkValues = useMemo(() => closesForSparkline(candles, period === "daily" ? 48 : 24), [candles, period]);

  const boardLiquiditySum = useMemo(
    () => boardRows.reduce((s, r) => s + (Number.isFinite(r.liquidity) ? r.liquidity : 0), 0),
    [boardRows]
  );

  const fearGreed = useMemo(() => computeFearGreedFromBoard(boardRows), [boardRows]);

  return (
    <div className={`min-h-screen ${C.page} ${C.text} font-sans antialiased`}>
      {/* Top strip — CMC-style compact header */}
      <header className={`sticky top-0 z-40 border-b ${C.line} ${C.surface}/95 backdrop-blur-md`}>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-white sm:text-base">Beginner market view</h1>
              <p className={`text-[11px] sm:text-xs ${C.muted}`}>
                Snapshot rankings, per-row line trends, and radar on hover.
              </p>
            </div>
            <label className="sr-only" htmlFor="beginner-symbol">
              Symbol
            </label>
            <select
              id="beginner-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className={`max-w-full rounded-lg ${C.card} px-3 py-2 text-sm font-mono font-semibold text-white outline-none ring-[#3861fb] focus:ring-2 sm:min-w-[220px]`}
            >
              {symbols.map((s) => (
                <option key={s.symbol} value={s.symbol} className="bg-[#1e2329]">
                  {s.symbol}
                  {s.company_name ? ` — ${s.company_name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className={`inline-flex rounded-lg ${C.card} p-0.5`}>
              {(["daily", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    period === p ? "bg-[#3861fb] text-white" : `${C.muted} hover:text-white`
                  }`}
                >
                  {p === "daily" ? "Daily" : "Yearly"}
                </button>
              ))}
            </div>
            <Link
              href="/"
              className={`inline-flex items-center gap-1 rounded-lg ${C.card} px-3 py-2 text-xs font-medium ${C.muted} transition hover:text-white`}
            >
              <Home className="h-3.5 w-3.5" />
              Main site
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 py-4 sm:px-4 sm:py-5">
        {/* Stat widgets — horizontal scroll like CMC */}
        <section className="mb-4 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div
            className={`relative min-w-[200px] flex-1 overflow-hidden rounded-2xl ${C.card} p-4 sm:min-w-[220px]`}
          >
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-8 opacity-[0.35]">
              <MiniSparkline values={sparkValues} />
            </div>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Price</p>
            {overviewLoading ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : overview ? (
              <>
                <p className="relative mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {formatUsd(overview.price)}
                </p>
                <div className="relative mt-1">
                  <PctBadge pct={overview.change_pct_snapshot} />
                </div>
              </>
            ) : (
              <p className={`relative mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-[180px] flex-1 rounded-2xl ${C.card} p-4 sm:min-w-[200px]`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Liquidity</p>
            {overviewLoading ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : overview ? (
              <>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatUsd(overview.liquidity)}</p>
                <p className={`mt-1 text-[11px] ${C.muted}`}>Price × volume (snapshot)</p>
              </>
            ) : (
              <p className={`mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-[160px] flex-1 rounded-2xl ${C.card} p-4`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Volume</p>
            {overviewLoading ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : overview ? (
              <>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{formatShares(overview.volume)}</p>
                <p className={`mt-1 text-[11px] ${C.muted}`}>Shares last update</p>
              </>
            ) : (
              <p className={`mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-[160px] flex-1 rounded-2xl ${C.card} p-4`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Watchlist</p>
            {overviewLoading ? (
              <p className="mt-2 h-8 animate-pulse rounded bg-white/10" />
            ) : overview ? (
              <>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums">{overview.people_watching}</p>
                <p className={`mt-1 line-clamp-2 text-[11px] ${C.muted}`}>{overview.reputation_label}</p>
              </>
            ) : (
              <p className={`mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-[160px] flex-1 rounded-2xl ${C.card} p-4`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Radar strength</p>
            {rowForRadar ? (
              <>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#3861fb]">
                  {rowForRadar.strong_count}
                  <span className={`text-sm font-normal ${C.muted}`}>/6</span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[#3861fb]"
                    style={{ width: `${(rowForRadar.strong_count / 6) * 100}%` }}
                  />
                </div>
              </>
            ) : (
              <p className={`mt-2 text-sm ${C.muted}`}>—</p>
            )}
          </div>

          <div className={`min-w-[180px] flex-1 rounded-2xl ${C.card} p-4`}>
            <p className={`text-[11px] font-medium uppercase tracking-wider ${C.muted}`}>Board liquidity (sum)</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatUsd(boardLiquiditySum)}</p>
            <p className={`mt-1 text-[11px] ${C.muted}`}>Top {boardRows.length} on this list</p>
          </div>

          <div className={`relative flex min-w-[220px] flex-1 flex-row items-center gap-3 overflow-hidden rounded-2xl ${C.card} p-3 sm:min-w-[260px]`}>
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
              <p className={`mt-1 text-[9px] leading-snug ${C.muted}`}>
                Internal model from table snapshots — not an external crypto index.
              </p>
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
            Radar: hover row
          </span>
          <Link
            href={`/companies/profile/${symbol.toLowerCase()}`}
            className="inline-flex items-center gap-1 rounded-full bg-[#3861fb]/15 px-3 py-1 text-[11px] font-semibold text-[#7b9cff] hover:bg-[#3861fb]/25"
          >
            Profile <ChevronRight className="h-3 w-3" />
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center gap-1 rounded-full bg-[#a855f7]/15 px-3 py-1 text-[11px] font-semibold text-[#c4a3ff] hover:bg-[#a855f7]/25"
          >
            <Search className="h-3 w-3" />
            Search
          </Link>
          {(candlesLoading || sparklinesLoading) && (
            <span className={`ml-auto text-[11px] ${C.muted}`}>
              {sparklinesLoading ? "Loading row sparklines…" : "Loading bars…"}
            </span>
          )}
        </div>

        {boardLegend?.buy_sell && (
          <p className={`mb-3 text-[11px] leading-relaxed ${C.muted}`}>{boardLegend.buy_sell}</p>
        )}

        {/* Main ranking + radar */}
        <section className={`rounded-2xl ${C.card} overflow-hidden`}>
          <div className={`flex flex-col gap-0 border-b ${C.line} px-4 py-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#f0b90b]" />
              <div>
                <h2 className="text-sm font-semibold text-white">Friendly radar ranking</h2>
                <p className={`text-[11px] ${C.muted}`}>
                  Top {BOARD_LIMIT} by liquidity · scores 1–5 · hover a row for radar (no click)
                </p>
              </div>
            </div>
            <p className={`text-[11px] ${C.muted}`}>
              {boardRows.length ? `${boardRows.length} symbols` : "—"} · mini lines = daily closes ·{" "}
              {overview?.company_name ?? symbol}
            </p>
          </div>

          {boardLegend?.strong_rule && (
            <p className={`border-b ${C.line} px-4 py-2 text-[11px] ${C.muted}`}>{boardLegend.strong_rule}</p>
          )}
          {boardLegend?.tie_break && (
            <p className={`border-b ${C.line} px-4 py-2 text-[11px] ${C.muted}`}>{boardLegend.tie_break}</p>
          )}

          {boardLoading ? (
            <p className={`py-16 text-center text-sm ${C.muted} animate-pulse`}>Loading rankings…</p>
          ) : boardRows.length === 0 ? (
            <p className="py-12 text-center text-sm text-amber-200/90">No snapshot data to rank yet.</p>
          ) : (
            <div className="p-4">
              <div className="overflow-x-auto rounded-lg border border-[#2b3139]/80">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className={`sticky top-0 z-10 ${C.surface} text-[11px] font-semibold uppercase tracking-wide ${C.muted}`}>
                      <th className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}>#</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}>Name</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 text-right lg:px-3`}>Price</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 text-right lg:px-3`}>24h %</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 text-center lg:px-3`}>Bias</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 text-center lg:px-3`}>Str</th>
                      <th className={`hidden border-b ${C.line} px-2 py-2.5 text-right sm:table-cell lg:px-3`}>Liq</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 text-right lg:px-3`}>Care</th>
                      <th className={`border-b ${C.line} px-2 py-2.5 text-center lg:px-3`}>Trend</th>
                    </tr>
                  </thead>
                    <tbody>
                      {boardRows.map((r, idx) => {
                        const bias = dayBiasFromRow(r);
                        const selected = r.symbol === symbol;
                        const handleRowEnter = (e: MouseEvent<HTMLTableRowElement>) => {
                          cancelRadarHide();
                          setHoverRadarRow(r);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const panelW = 300;
                          const panelH = 360;
                          let left = rect.right + 10;
                          if (left + panelW > window.innerWidth - 12) {
                            left = Math.max(12, rect.left - panelW - 10);
                          }
                          let top = rect.top;
                          if (top + panelH > window.innerHeight - 12) {
                            top = Math.max(12, window.innerHeight - panelH - 12);
                          }
                          setRadarPopover({ top, left });
                        };
                        return (
                          <tr
                            key={r.symbol}
                            role="button"
                            tabIndex={0}
                            onClick={() => router.push(`/companies/profile/${r.symbol.toLowerCase()}`)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                router.push(`/companies/profile/${r.symbol.toLowerCase()}`);
                              }
                            }}
                            onMouseEnter={handleRowEnter}
                            onMouseLeave={scheduleRadarHide}
                            className={`cursor-pointer border-b border-[#2b3139]/80 transition hover:bg-white/[0.04] ${
                              idx % 2 === 1 ? "bg-white/[0.015]" : ""
                            } ${selected ? "bg-[#3861fb]/[0.12]" : ""} ${
                              bias === "buy"
                                ? "border-l-[3px] border-l-[#16c784]"
                                : bias === "sell"
                                  ? "border-l-[3px] border-l-[#ea3943]"
                                  : "border-l-[3px] border-l-transparent"
                            }`}
                          >
                            <td className={`px-3 py-2.5 font-mono tabular-nums ${C.muted}`}>{r.rank}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white">
                                  {r.symbol.slice(0, 1)}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-white">{r.company_name}</p>
                                  <p className={`font-mono text-xs ${C.muted}`}>{r.symbol}</p>
                                </div>
                              </div>
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
                                {bias === "buy" ? "Buy" : bias === "sell" ? "Sell" : "Flat"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums">
                              <span className="font-semibold text-[#3861fb]">{r.strong_count}</span>
                              <span className={C.muted}>/6</span>
                            </td>
                            <td className={`hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums sm:table-cell lg:px-3`}>
                              {formatUsd(r.liquidity)}
                            </td>
                            <td className="px-2 py-2.5 text-right font-mono tabular-nums lg:px-3">{r.people_watching}</td>
                            <td className="border-l border-[#2b3139]/60 px-1 py-1.5 align-middle">
                              {sparklinesLoading ? (
                                <div className="mx-auto h-7 w-[88px] animate-pulse rounded bg-white/[0.06]" />
                              ) : (
                                <TableSparkline values={rowSparklines[r.symbol] ?? []} />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={`mt-2 text-[10px] ${C.muted}`}>
                  Click a row to sync detail cards below. Hover a row for the radar popup. Trend = daily close line (not
                  candles).
                </p>

                <details className={`mt-3 rounded-lg border ${C.line} bg-black/20 px-3 py-2`}>
                  <summary className={`cursor-pointer text-[11px] font-semibold text-[#7b9cff]`}>
                    How these metrics are calculated
                  </summary>
                  <ul className={`mt-2 list-inside list-disc space-y-1.5 text-[10px] leading-relaxed ${C.muted}`}>
                    <li>
                      <strong className="text-white/80">Fear &amp; Greed (0–100):</strong> For symbols in the table with a
                      valid snapshot % change, compute average change and fraction of symbols up. Score = round(clamp(50 +
                      avgChange × 3.25 + (upFraction − 0.5) × 42, 0, 100)). Labels follow standard buckets (Extreme Fear →
                      Extreme Greed).
                    </li>
                    <li>
                      <strong className="text-white/80">Row trend line:</strong> Last ~28 daily closing prices from
                      instrument data; polyline colored green if last ≥ first, else red.
                    </li>
                    <li>
                      <strong className="text-white/80">Radar scores:</strong> From the API beginner board — quintiles and
                      reputation tiers as documented in the ranking response.
                    </li>
                    <li>
                      <strong className="text-white/80">Buy / Sell badge:</strong> Sign of the same daily snapshot %
                      change as the heatmap snapshot (not trading advice).
                    </li>
                  </ul>
                </details>
            </div>
          )}
        </section>

        {/* Detail cards — same content, CMC-style tiles */}
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-semibold">Community</h3>
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${C.muted}`}>
              Watchlist saves on DSA — attention, not a recommendation.
            </p>
            {overview && !overviewLoading && (
              <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{overview.people_watching}</p>
            )}
          </div>

          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#16c784]" />
              <h3 className="text-sm font-semibold">Snapshot change</h3>
            </div>
            <p className={`mt-2 text-xs ${C.muted}`}>Versus that day&apos;s open in our data.</p>
            {overview && !overviewLoading && (
              <p className={`mt-3 font-mono text-2xl font-semibold tabular-nums ${overview.change_pct_snapshot >= 0 ? C.green : C.red}`}>
                {overview.change_pct_snapshot >= 0 ? "+" : ""}
                {overview.change_pct_snapshot.toFixed(2)}%
              </p>
            )}
          </div>

          <div className={`rounded-2xl ${C.card} p-4 md:col-span-2 lg:col-span-1`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Last candle ({periodLabel})</h3>
            </div>
            {candleInsights ? (
              <div className="mt-3 space-y-2 text-xs">
                <p className="font-mono text-lg tabular-nums">{formatUsd(candleInsights.lastClose)}</p>
                <p className={C.muted}>
                  Inside:{" "}
                  <span className={candleInsights.insideBar != null && candleInsights.insideBar >= 0 ? C.green : C.red}>
                    {candleInsights.insideBar == null ? "—" : `${candleInsights.insideBar >= 0 ? "+" : ""}${candleInsights.insideBar.toFixed(2)}%`}
                  </span>
                  {" · "}vs prev:{" "}
                  <span className={candleInsights.vsPrevClose != null && candleInsights.vsPrevClose >= 0 ? C.green : C.red}>
                    {candleInsights.vsPrevClose == null ? "—" : `${candleInsights.vsPrevClose >= 0 ? "+" : ""}${candleInsights.vsPrevClose.toFixed(2)}%`}
                  </span>
                </p>
                <p className={`${C.muted} font-mono`}>Vol {formatShares(candleInsights.lastVolume)}</p>
              </div>
            ) : (
              <p className={`mt-2 text-xs ${C.muted}`}>No bars yet.</p>
            )}
            {candleNote && <p className="mt-2 text-[11px] text-amber-200/80">{candleNote}</p>}
          </div>

          <div className={`rounded-2xl ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-semibold">Liquidity & volume</h3>
            </div>
            {overview && !overviewLoading && (
              <div className="mt-3 space-y-1 font-mono text-sm tabular-nums">
                <p>{formatUsd(overview.liquidity)}</p>
                <p className={C.muted}>{formatShares(overview.volume)} sh</p>
              </div>
            )}
          </div>

          {overview?.market_cap != null && overview.market_cap > 0 && (
            <div className={`rounded-2xl ${C.card} p-4`}>
              <h3 className="text-sm font-semibold">Market cap</h3>
              <p className="mt-3 font-mono text-lg font-semibold tabular-nums">{formatUsd(overview.market_cap)}</p>
              <p className={`mt-1 text-[11px] ${C.muted}`}>From company profile</p>
            </div>
          )}

          <div className={`rounded-2xl ${C.card} p-4 md:col-span-2`}>
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

        <p className={`mt-6 flex items-center justify-center gap-2 pb-8 text-[11px] ${C.muted}`}>
          <Clock className="h-3.5 w-3.5" />
          Server snapshot timing — not live exchange clocks.
        </p>
      </div>

      {portalReady &&
        hoverRadarRow &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{ top: radarPopover.top, left: radarPopover.left }}
            className="fixed z-[200] w-[min(300px,calc(100vw-24px))] rounded-xl border border-[#2b3139] bg-[#1e2329] p-3 shadow-2xl shadow-black/70 pointer-events-auto"
            onMouseEnter={cancelRadarHide}
            onMouseLeave={scheduleRadarHide}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="font-mono text-sm font-semibold text-white">{hoverRadarRow.symbol}</span>
              <span className={`text-[10px] ${C.muted}`}>Radar</span>
            </div>
            <p className={`mb-2 text-[10px] leading-snug ${C.muted}`}>
              Hover preview — click a row to open the full company profile.
            </p>
            <div className="h-[240px] w-full">
              <BeginnerRadarChart data={hoverRadarRow.radar} />
            </div>
            <div className={`mt-2 grid grid-cols-2 gap-1 border-t border-[#2b3139] pt-2 text-[10px] ${C.muted}`}>
              <span>
                R{hoverRadarRow.scores.reputation} P{hoverRadarRow.scores.price_period} M{hoverRadarRow.scores.candle_change}
              </span>
              <span>
                V{hoverRadarRow.scores.volume} L{hoverRadarRow.scores.liquidity} C{hoverRadarRow.scores.people_care}
              </span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
