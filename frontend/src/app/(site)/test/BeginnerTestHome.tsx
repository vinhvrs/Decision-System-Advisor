"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { InstrumentService } from "@/src/services/Instrument.service";
import {
  BeginnerService,
  cacheDashboardRadarRows,
  invalidateDashboardDailyCache,
  type BeginnerBoardPayload,
  type BeginnerBoardRow,
  type BeginnerRadarPoint,
} from "@/src/services/Beginner.service";
import { SimpleSocket } from "@/src/libs/socket";
import type { HomeMarketViewVariant } from "@/src/app/(site)/HomeMarketView";
import BeginnerRadarChart from "./BeginnerRadarChart";
import BeginnerTestMarketExtras from "./BeginnerTestMarketExtras";
import SelectDropdown from "@/src/sections/Dropdown";
import { stripParentheticals, symbolLogoUrl } from "@/src/libs/displayString";
import { isDemoDevMode } from "@/src/libs/devMode";
import { fearGreedFromBoardRows, fearGreedFromChangePct } from "@/src/libs/fearGreed";
import { DEV_SYMBOL_SEED, type SymbolDevCompany } from "@/src/libs/symbolDevIdb";
import {
  Heart,
  TrendingUp,
  BarChart3,
  Droplets,
  Users,
  Clock,
  Trophy,
  Home,
  Search,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

type Period = "daily" | "annual";

// Yahoo reports share volume for these US equities. Keep market-wide/futures/FX
// volume semantics intact instead of treating every asset's volume as shares.
const LIVE_BOARD_EQUITY_SYMBOLS = new Set([
  "NVDA", "TSLA", "AAPL", "GOOGL", "AMZN", "MSFT", "META", "AVGO", "ORCL", "IBM",
  "AMD", "ADBE", "CRM", "CSCO", "ASML", "INTU", "QCOM", "NOW", "PANW", "SNOW",
]);

/** Socket / instrument API use `yearly` slug for annual bars. */
function periodToApiSlug(period: Period): "daily" | "yearly" {
  return period === "annual" ? "yearly" : "daily";
}

function periodChangeLabel(period: Period): string {
  return period === "daily" ? "24h %" : "Annual %";
}

function periodChangeTitle(period: Period): string {
  return period === "daily"
    ? "Change vs the previous daily close from the data feed."
    : "Year-over-year change from the latest two annual closes (API).";
}

/** Display % for the selected period (daily snapshot vs annual YoY from closes). */
function periodChangeForRow(row: BeginnerBoardRow, closes: number[], period: Period): number | null {
  if (period === "annual") {
    if (closes.length >= 2) {
      return pctChange(closes[closes.length - 2]!, closes[closes.length - 1]!);
    }
    return null;
  }
  if (row.missing_fields?.includes("change_pct")) return null;
  if (Number.isFinite(row.change_pct_snapshot)) return row.change_pct_snapshot;
  if (closes.length >= 2) {
    return pctChange(closes[closes.length - 2]!, closes[closes.length - 1]!);
  }
  return null;
}

/** Shared research-terminal palette. */
const C = {
  page: "bg-[var(--dsa-bg)]",
  surface: "bg-[var(--dsa-surface-1)]",
  card: "bg-[var(--dsa-surface-1)] border border-[var(--dsa-border)]",
  text: "text-[var(--dsa-text)]",
  muted: "text-[var(--dsa-text-muted)]",
  green: "text-[var(--dsa-positive)]",
  red: "text-[var(--dsa-negative)]",
  line: "border-[var(--dsa-border)]",
};

/** Short list for the beginner board (API + UI). */
const BOARD_LIMIT_PROD = 40;
/** Wider fetch in dev so the fixed demo tickers are likely present in the ranking payload. */
const DEV_BOARD_FETCH_LIMIT = 200;

const DEV_SYMBOL_ORDER = new Map(DEV_SYMBOL_SEED.map((r, i) => [r.symbol.toUpperCase(), i]));

function filterBoardRowsForDevMode(rows: BeginnerBoardRow[]): BeginnerBoardRow[] {
  if (!isDemoDevMode()) return rows;
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

function quintileScoreBySymbol(rows: BeginnerBoardRow[]): Map<string, number> {
  const pairs = rows
    .map((r) => ({
      symbol: r.symbol.toUpperCase(),
      value: Number(r.candle_move_abs_pct),
    }))
    .filter((r) => Number.isFinite(r.value))
    .sort((a, b) => a.value - b.value);
  const out = new Map<string, number>();
  const n = pairs.length;
  if (!n) return out;
  pairs.forEach((r, i) => {
    const pct = (i + 0.5) / n;
    out.set(r.symbol, Math.max(1, Math.min(5, Math.ceil(pct * 5))));
  });
  return out;
}

function strongCountFromScores(scores: BeginnerBoardRow["scores"]): number {
  const values = [
    scores.reputation,
    scores.candle_change,
    scores.volume,
    scores.liquidity,
    scores.people_care,
  ];
  return values.filter((v) => Number(v) >= 4).length;
}

function alignLiveChangeScores(rows: BeginnerBoardRow[]): BeginnerBoardRow[] {
  const changeScores = quintileScoreBySymbol(rows);
  return rows.map((row) => {
    const nextChangeScore = changeScores.get(row.symbol.toUpperCase());
    if (!nextChangeScore || nextChangeScore === row.scores.candle_change) return row;
    const scores = { ...row.scores, candle_change: nextChangeScore };
    return {
      ...row,
      scores,
      radar: radarFromScores(scores),
      strong_count: strongCountFromScores(scores),
    };
  });
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
    analysis_eligible: false,
    data_state: "synthetic",
    analysis_reason: "No validated ranking/radar inputs are available for this symbol.",
    missing_fields: ["price", "volume", "liquidity", "change_pct"],
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
    const formalScoreKeys = [
      "reputation",
      "price_period",
      "candle_change",
      "volume",
      "liquidity",
      "people_care",
    ] as const;
    const formalScoresComplete =
      !!formal &&
      formal.analysis_eligible !== false &&
      Number.isFinite(Number(formal.strong_count)) &&
      formalScoreKeys.every((key) => Number.isFinite(Number(formal.scores?.[key])));

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
      analysis_eligible: formalScoresComplete,
      data_state: formalScoresComplete ? "ok" : "partial",
      analysis_reason: formalScoresComplete
        ? null
        : "Ranking/radar inputs are incomplete; conviction is intentionally withheld.",
      missing_fields: formal?.missing_fields ?? [],
    };
  } catch {
    return null;
  }
}

function devBoardRowIsThin(r: BeginnerBoardRow): boolean {
  const p = Number(r.price);
  return !Number.isFinite(p) || p <= 0;
}

/** Always show all ``DEV_SYMBOL_SEED`` tickers; fill gaps when Redis row missing or has no usable price. */
async function ensureDevBoardRowsComplete(partial: BeginnerBoardRow[]): Promise<BeginnerBoardRow[]> {
  if (!isDemoDevMode()) return partial;
  const bySym = new Map(partial.map((r) => [r.symbol.toUpperCase(), r] as const));
  const missing = DEV_SYMBOL_SEED.filter((s) => {
    const row = bySym.get(s.symbol.toUpperCase());
    return !row || devBoardRowIsThin(row);
  });
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

/** Normalize Redis / socket ``dashboard:daily`` JSON into the board rows shown on this page. */
async function buildRedisDailyBoardState(payload: BeginnerBoardPayload | null) {
  if (!payload) return null;
  let rows =
    Array.isArray(payload.rows) && payload.rows.length > 0
      ? payload.rows
      : (payload as BeginnerBoardPayload & { ranking_board?: BeginnerBoardRow[] }).ranking_board ?? [];
  if (isDemoDevMode()) {
    rows = filterBoardRowsForDevMode(rows);
    rows = await ensureDevBoardRowsComplete(rows);
  }
  // Production must preserve the real Redis/database universe. Never inject
  // DEV_SYMBOL_SEED rows into a public market board.
  rows = rows.slice(0, BOARD_LIMIT_PROD);
  return {
    rows,
    legend: payload.legend ?? null,
    updatedAt: typeof payload.updated_at === "string" ? payload.updated_at : null,
  };
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

/** Stable fallback so `?? []` does not allocate a new array every render (breaks memoized sparklines). */
const EMPTY_SPARKLINE_VALUES: number[] = [];

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

/** Yahoo / python_engine ``quote`` messages: preserve live fields across Redis/HTTP board refreshes. */
function mergeBoardQuotes(rows: BeginnerBoardRow[], previous: BeginnerBoardRow[]): BeginnerBoardRow[] {
  const lastQuotes = new Map(
    previous
      .filter((row) => row.quote_ts && row.price > 0)
      .map((row) => [String(row.symbol).toUpperCase(), row]),
  );

  const merged = rows.map((row) => {
    const quote = lastQuotes.get(String(row.symbol).toUpperCase());
    if (!quote) return row;

    const missing = new Set(row.missing_fields ?? []);
    if (Number.isFinite(quote.price) && quote.price > 0) missing.delete("price");
    if (Number.isFinite(quote.change_pct_snapshot)) missing.delete("change_pct");

    return {
      ...row,
      price: quote.price,
      change_pct_snapshot: quote.change_pct_snapshot,
      candle_move_abs_pct: quote.candle_move_abs_pct,
      day_bias: quote.day_bias,
      quote_ts: quote.quote_ts,
      quote_stale: quote.quote_stale,
      missing_fields: [...missing],
    };
  });

  return alignLiveChangeScores(merged);
}

function parseSocketQuoteNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim().replace("%", "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

type Conviction5 = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell" | "unrated";

function radarScoresAverage(r: BeginnerBoardRow): number {
  const s = r.scores;
  const parts = [s.reputation, s.price_period, s.candle_change, s.volume, s.liquidity, s.people_care]
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x));
  if (!parts.length) return 3;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function isRowEligibleForConviction(r: BeginnerBoardRow): boolean {
  if (r.analysis_eligible === false) return false;
  if (r.data_state === "missing" || r.data_state === "partial" || r.data_state === "synthetic") {
    return false;
  }
  const s = r.scores;
  const scoreValues = [
    s?.reputation,
    s?.price_period,
    s?.candle_change,
    s?.volume,
    s?.liquidity,
    s?.people_care,
  ].map((value) => Number(value));
  const strong = Number(r.strong_count);
  return (
    scoreValues.length === 6 &&
    scoreValues.every((value) => Number.isFinite(value) && value >= 1 && value <= 5) &&
    Number.isFinite(strong) &&
    strong >= 0 &&
    strong <= 5 &&
    Array.isArray(r.radar) &&
    r.radar.length >= 5
  );
}

/** Five-tier research bias from validated Python-engine indicators only (strength + radar averages). */
function convictionFromRow(r: BeginnerBoardRow): Conviction5 {
  if (!isRowEligibleForConviction(r)) return "unrated";
  const st = Math.max(0, Math.min(5, Math.round(Number(r.strong_count)) || 0));
  const avg = radarScoresAverage(r);
  const indicatorTilt = (st - 2.5) * 1.25 + (avg - 3) * 1.1;
  if (indicatorTilt >= 2.2) return "strong_buy";
  if (indicatorTilt >= 0.8) return "buy";
  if (indicatorTilt <= -2.2) return "strong_sell";
  if (indicatorTilt <= -0.8) return "sell";
  return "hold";
}

function convictionSortOrder(c: Conviction5): number {
  switch (c) {
    case "strong_buy":
      return 4;
    case "buy":
      return 3;
    case "hold":
      return 2;
    case "sell":
      return 1;
    case "strong_sell":
      return 0;
    case "unrated":
      return -1;
    default:
      return -1;
  }
}

function convictionLabel(c: Conviction5): string {
  switch (c) {
    case "strong_buy":
      return "Strong Bullish";
    case "buy":
      return "Bullish";
    case "hold":
      return "Neutral";
    case "sell":
      return "Bearish";
    case "strong_sell":
      return "Strong Bearish";
    case "unrated":
      return "Not Rated";
    default:
      return "Not Rated";
  }
}

function convictionInvestingTitle(c: Conviction5): string {
  switch (c) {
    case "strong_buy":
      return "Strong Bullish — the multi-factor indicator composite has a materially positive tilt. Research signal, not investment advice.";
    case "buy":
      return "Bullish — the multi-factor indicator composite has a positive tilt. Research signal, not investment advice.";
    case "hold":
      return "Neutral — the multi-factor indicator composite is balanced or mixed. Research signal, not investment advice.";
    case "sell":
      return "Bearish — the multi-factor indicator composite has a negative tilt. Research signal, not investment advice.";
    case "strong_sell":
      return "Strong Bearish — the multi-factor indicator composite has a materially negative tilt. Research signal, not investment advice.";
    case "unrated":
      return "Not Rated — required ranking/radar inputs are incomplete or synthetic.";
    default:
      return "Not Rated — required ranking/radar inputs are incomplete or synthetic.";
  }
}

function convictionBorderClass(c: Conviction5): string {
  switch (c) {
    case "strong_buy":
      return "border-l-[3px] border-l-[#16c784]";
    case "buy":
      return "border-l-[3px] border-l-[#2ebd85]";
    case "hold":
      return "border-l-[3px] border-l-[#5e6673]";
    case "sell":
      return "border-l-[3px] border-l-[#ea3943]";
    case "strong_sell":
      return "border-l-[3px] border-l-[#c82a35]";
    case "unrated":
      return "border-l-[3px] border-l-[#5e6673]";
    default:
      return "border-l-[3px] border-l-[#5e6673]";
  }
}

function convictionBadgeClass(c: Conviction5): string {
  switch (c) {
    case "strong_buy":
      return "bg-[#16c784]/22 text-[#16c784]";
    case "buy":
      return "bg-[#16c784]/12 text-[#2ebd85]";
    case "hold":
      return `${C.muted} bg-white/[0.06]`;
    case "sell":
      return "bg-[#ea3943]/12 text-[#ea3943]";
    case "strong_sell":
      return "bg-[#ea3943]/22 text-[#ff7a82]";
    case "unrated":
      return `${C.muted} bg-white/[0.06]`;
    default:
      return `${C.muted} bg-white/[0.06]`;
  }
}

function _clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Consensus upside: ((analyst target − current price) / current price) × 100.
 * Missing analyst targets stay missing; DSA does not synthesize a target from radar scores.
 */
function upsideAdvisoryPct(r: BeginnerBoardRow): number {
  const price = Number(r.price);
  if (!Number.isFinite(price) || price <= 0) return Number.NaN;
  const tgt = r.analyst_consensus_target_price;
  if (typeof tgt !== "number" || !Number.isFinite(tgt) || tgt <= 0) return Number.NaN;
  return ((tgt - price) / price) * 100;
}

/**
 * Technical / trend upside: ((recent range high − price) / price) × 100. Range high ≈ loaded daily highs proxy (not true 52W).
 */
function upsideTechnicalPct(r: BeginnerBoardRow, closes: number[]): number {
  const price = Number(r.price);
  if (!Number.isFinite(price) || price <= 0 || closes.length < 2) return Number.NaN;
  const high = Math.max(...closes);
  return ((high - price) / price) * 100;
}

/**
 * Downside risk %: distance to support (swing low vs long-window mean as MA proxy), ((price − support) / price) × 100.
 */
function downsideRiskPct(r: BeginnerBoardRow, closes: number[]): number {
  const price = Number(r.price);
  if (!Number.isFinite(price) || price <= 0 || closes.length < 2) return Number.NaN;
  const lo = Math.min(...closes);
  const ma =
    closes.length >= 15 ? closes.reduce((a, b) => a + b, 0) / closes.length : lo;
  const support = Math.min(lo, ma);
  const raw = ((price - support) / price) * 100;
  return _clamp(raw, 0.15, 85);
}

/** Risk-adjusted: technical upside ÷ downside (advisory-style rule-of-thumb in tooltip). */
function upsideRiskRatio(r: BeginnerBoardRow, closes: number[]): number {
  const up = upsideTechnicalPct(r, closes);
  const down = downsideRiskPct(r, closes);
  if (!Number.isFinite(up) || !Number.isFinite(down) || down <= 0) return Number.NaN;
  return Math.max(up, 0) / down;
}

function upsideTooltipLines(r: BeginnerBoardRow, closes: number[]): string {
  const adv = upsideAdvisoryPct(r);
  const tech = upsideTechnicalPct(r, closes);
  const down = downsideRiskPct(r, closes);
  const ratio = upsideRiskRatio(r, closes);
  const hasRealTarget =
    typeof r.analyst_consensus_target_price === "number" &&
    Number.isFinite(r.analyst_consensus_target_price) &&
    r.analyst_consensus_target_price > 0;
  const advNote = hasRealTarget
    ? "Upside vs analyst consensus target."
    : "Analyst consensus target unavailable; no synthetic target is generated.";
  const lines = [
    advNote,
    Number.isFinite(adv) ? `Consensus upside: ${adv.toFixed(2)}%` : "Consensus upside: —",
    Number.isFinite(tech) ? `Technical room to highs: ${tech.toFixed(2)}%` : "Technical room: —",
    Number.isFinite(down) ? `Downside to support (approx.): ${down.toFixed(2)}%` : "Downside: —",
    Number.isFinite(ratio)
      ? `Reward vs risk (approx.): ${ratio.toFixed(2)}`
      : "Reward vs risk: —",
  ];
  return lines.join("\n");
}

function upsidePotentialToneClass(pct: number): string {
  if (pct >= 14) return "text-[#16c784]";
  if (pct >= 8) return "text-[#2ebd85]";
  if (pct >= 3) return "text-[#f0b90b]";
  if (pct > 0) return "text-[#eaecef]/90";
  return C.muted;
}

const RowAvatar = memo(function RowAvatar({ symbol, logoUrl }: { symbol: string; logoUrl?: string | null }) {
  const [broken, setBroken] = useState(false);
  const src = symbolLogoUrl(symbol, logoUrl);
  if (!broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
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
});

/**
 * Compact line sparkline in each table cell (not candlesticks).
 * Color follows the loaded close series (last vs first) so rows can stay memo-stable while live 24h % ticks.
 */
const TableSparkline = memo(function TableSparkline({ values }: { values: number[] }) {
  const w = 88;
  const h = 28;
  const pad = 1;
  const poly = useMemo(() => {
    if (values.length < 2) return null;
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
    const last = values[values.length - 1];
    const first = values[0];
    let stroke: string;
    if (last > first) stroke = "#16c784";
    else if (last < first) stroke = "#ea3943";
    else stroke = "#848e9c";
    return { pts, stroke };
  }, [values]);

  if (values.length < 2 || !poly) {
    return (
      <div
        className="mx-auto flex h-7 w-[88px] items-center justify-center text-[9px] font-medium text-[var(--dsa-text-muted)]"
        title="Persisted history is unavailable or too short"
      >
        No history
      </div>
    );
  }
  return (
    <svg
      width={88}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="mx-auto block"
      aria-hidden
    >
      <polyline fill="none" stroke={poly.stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={poly.pts} />
    </svg>
  );
});

/**
 * Mean effective % for header tiles: prefer live snapshot when present so WS quotes move the badge
 * without mutating stored daily-close sparklines. Falls back to last step of the close series.
 * (Row Fear & Greed in the radar popover uses snapshot only via {@link fearGreedFromChangePct}.)
 */
function effectiveChangeForFearGreed(
  row: BeginnerBoardRow,
  closes: number[] | undefined,
  period: Period,
): number | null {
  const series = closes ?? [];
  return periodChangeForRow(row, series, period);
}

const PctBadge = memo(function PctBadge({ pct }: { pct: number }) {
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
});

const UpsidePotentialCell = memo(function UpsidePotentialCell({
  r,
  closes,
  sparklinesLoading,
}: {
  r: BeginnerBoardRow;
  closes: number[];
  sparklinesLoading: boolean;
}) {
  const meta = useMemo(() => {
    if (sparklinesLoading || closes.length < 2) return null;
    const tech = upsideTechnicalPct(r, closes);
    const ratio = upsideRiskRatio(r, closes);
    return {
      tech,
      ratio,
      title: upsideTooltipLines(r, closes),
    };
  }, [r, closes, sparklinesLoading]);

  if (sparklinesLoading || !meta || !Number.isFinite(meta.tech)) {
    return <span className={`font-mono text-sm tabular-nums ${C.muted}`}>—</span>;
  }

  return (
    <div className="flex flex-col items-center justify-center gap-0 leading-tight" title={meta.title}>
      <span className={`font-mono text-sm font-semibold tabular-nums ${upsidePotentialToneClass(meta.tech)}`}>
        {meta.tech.toFixed(1)}%
      </span>
      {Number.isFinite(meta.ratio) ? (
        <span className={`text-[9px] font-mono tabular-nums ${C.muted}`}>R·{meta.ratio.toFixed(1)}</span>
      ) : null}
    </div>
  );
});

function profilePathForSymbol(symbol: string): string {
  return `/companies/profile/${encodeURIComponent(symbol.trim().toLowerCase())}`;
}

type BoardRankingTableRowProps = {
  r: BeginnerBoardRow;
  displayRank: number;
  stripe: boolean;
  sparklineValues: number[];
  sparklinesLoading: boolean;
  periodChangePct: number | null;
  onRowEnter: (symbol: string, e: MouseEvent<HTMLTableRowElement>) => void;
  onRowMove: (e: MouseEvent<HTMLTableRowElement>) => void;
  onRowLeave: () => void;
};

const BoardRankingTableRow = memo(function BoardRankingTableRow({
  r,
  displayRank,
  stripe,
  sparklineValues,
  sparklinesLoading,
  periodChangePct,
  onRowEnter,
  onRowMove,
  onRowLeave,
}: BoardRankingTableRowProps) {
  const conviction = convictionFromRow(r);
  const symUp = String(r.symbol).toUpperCase();
  return (
    <tr
      onMouseEnter={(e) => onRowEnter(symUp, e)}
      onMouseMove={onRowMove}
      onMouseLeave={onRowLeave}
      className={`cursor-default border-b border-[var(--dsa-border)]/80 transition hover:bg-white/[0.04] ${
        stripe ? "bg-white/[0.015]" : ""
      } ${convictionBorderClass(conviction)}`}
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
        <span title={r.quote_stale && r.quote_ts ? `Last quote: ${new Date(r.quote_ts).toLocaleString()}. Freshness status is independent of exchange session hours.` : "Quote freshness is independent of exchange session hours."}>
          {formatUsd(r.price)}{r.quote_stale && <span className="ml-1 text-[10px] text-amber-400">stale</span>}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        {sparklinesLoading ? (
          <span className={`text-xs ${C.muted}`}>…</span>
        ) : Number.isFinite(periodChangePct) ? (
          <PctBadge pct={periodChangePct!} />
        ) : (
          <span className={C.muted}>—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span
          className={`inline-block max-w-[7.5rem] rounded px-1.5 py-0.5 text-[10px] font-bold leading-tight sm:max-w-none sm:px-2 sm:text-[11px] ${convictionBadgeClass(conviction)}`}
          title={convictionInvestingTitle(conviction)}
        >
          {convictionLabel(conviction)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center font-mono tabular-nums">
        {isRowEligibleForConviction(r) ? (
          <>
            <span className="font-semibold text-[#3861fb]">{r.strong_count}</span>
            <span className={C.muted}>/5</span>
          </>
        ) : (
          <span className={C.muted} title={r.analysis_reason ?? "Insufficient validated inputs"}>
            —
          </span>
        )}
      </td>
      <td className="px-2 py-2.5 text-center lg:px-3">
        <UpsidePotentialCell r={r} closes={sparklineValues} sparklinesLoading={sparklinesLoading} />
      </td>
      <td className={`hidden px-2 py-2.5 text-right font-mono text-xs tabular-nums sm:table-cell lg:px-3`}>
        {formatUsd(r.liquidity)}
      </td>
      <td className="px-2 py-2.5 text-right font-mono tabular-nums lg:px-3">{r.people_watching}</td>
      <td className="border-l border-[var(--dsa-border)]/60 px-1 py-1.5 align-middle">
        {sparklinesLoading ? (
          <div className="mx-auto h-7 w-[88px] animate-pulse rounded bg-white/[0.06]" />
        ) : (
          <TableSparkline values={sparklineValues} />
        )}
      </td>
    </tr>
  );
});

type BoardRankingMobileCardProps = {
  r: BeginnerBoardRow;
  displayRank: number;
  stripe: boolean;
  sparklineValues: number[];
  sparklinesLoading: boolean;
  periodChangePct: number | null;
  periodLabel: string;
};

const BoardRankingMobileCard = memo(function BoardRankingMobileCard({
  r,
  displayRank,
  stripe,
  sparklineValues,
  sparklinesLoading,
  periodChangePct,
  periodLabel,
}: BoardRankingMobileCardProps) {
  const conviction = convictionFromRow(r);
  return (
    <div
      className={`rounded-xl border border-[var(--dsa-border)]/80 p-3 transition ${
        stripe ? "bg-white/[0.02]" : ""
      } ${convictionBorderClass(conviction)}`}
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
            <TableSparkline values={sparklineValues} />
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs phone:grid-cols-3">
        <div>
          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>Price</p>
          <p className="mt-0.5 font-mono font-medium tabular-nums">{formatUsd(r.price)}{r.quote_stale && <span className="ml-1 text-[10px] text-amber-400">stale</span>}</p>
        </div>
        <div>
          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>{periodLabel}</p>
          <div className="mt-0.5">
            {sparklinesLoading ? (
              <span className={`text-xs ${C.muted}`}>…</span>
            ) : Number.isFinite(periodChangePct) ? (
              <PctBadge pct={periodChangePct!} />
            ) : (
              <span className={C.muted}>—</span>
            )}
          </div>
        </div>
        <div className="col-span-2 phone:col-span-1">
          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>Bias / Strength</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-block max-w-[6.5rem] rounded px-1.5 py-0.5 text-[10px] font-bold leading-tight ${convictionBadgeClass(conviction)}`}
              title={convictionInvestingTitle(conviction)}
            >
              {convictionLabel(conviction)}
            </span>
            <span className="font-mono tabular-nums">
              {isRowEligibleForConviction(r) ? (
                <>
                  <span className="font-semibold text-[#3861fb]">{r.strong_count}</span>
                  <span className={C.muted}>/5</span>
                </>
              ) : (
                <span className={C.muted} title={r.analysis_reason ?? "Insufficient validated inputs"}>
                  —
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="col-span-2 phone:col-span-1">
          <p className={`text-[10px] uppercase tracking-wide ${C.muted}`}>Room to high</p>
          <div className="mt-0.5">
            <UpsidePotentialCell r={r} closes={sparklineValues} sparklinesLoading={sparklinesLoading} />
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
});

/** Prefer embedded Redis ``chart`` closes (daily only); else API batch for the active period. */
function sparklineValuesForRow(
  row: BeginnerBoardRow,
  batchMap: Record<string, number[]>,
  period: Period,
): number[] {
  const cap = period === "daily" ? 48 : 24;
  const persistedPoints =
    Number.isFinite(Number(row.history_points))
      ? Number(row.history_points)
      : Array.isArray(row.chart)
        ? row.chart.length
        : 0;
  const embeddedHistoryUsable =
    persistedPoints >= 2 &&
    row.history_state !== "missing" &&
    Array.isArray(row.chart) &&
    row.chart.length >= 2;
  if (period === "daily" && embeddedHistoryUsable && row.chart && row.chart.length >= 2) {
    return row.chart.length <= cap ? row.chart : row.chart.slice(-cap);
  }
  const sym = row.symbol;
  const arr = batchMap[sym] ?? batchMap[sym.toUpperCase()] ?? [];
  return arr.length <= cap ? arr : arr.slice(-cap);
}

function upsideTechnicalForSort(
  row: BeginnerBoardRow,
  sparkMap: Record<string, number[]>,
  period: Period,
): number {
  const closes = sparklineValuesForRow(row, sparkMap, period);
  return upsideTechnicalPct(row, closes);
}

/** For table sort: last − first close in the same series as the sparkline (NaN if not enough points). */
function trendDeltaForSort(
  row: BeginnerBoardRow,
  sparkMap: Record<string, number[]>,
  period: Period,
): number {
  const v = sparklineValuesForRow(row, sparkMap, period);
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
  return convictionSortOrder(convictionFromRow(row));
}

type BoardSortKey =
  | "rank"
  | "name"
  | "price"
  | "change"
  | "bias"
  | "strong"
  | "upside"
  | "liquidity"
  | "care"
  | "trend";

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
  const active = sort.key === columnKey;
  const nextDir: "asc" | "desc" = active && sort.dir === "asc" ? "desc" : "asc";
  const btn =
    "rounded p-0.5 outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#3861fb]/50";
  const iconOn = "text-[#7b9cff]";
  const iconOff = "text-[#848e9c]/60";

  return (
    <th scope="col" className={className}>
      <div className={`flex items-center gap-1.5 ${flex}`}>
        <span title={title}>{label}</span>
        <button
          type="button"
          className={btn}
          aria-label={`${label}, toggle sort`}
          title={active ? `Sorted ${sort.dir}` : "Not sorted"}
          onClick={() => onSort(columnKey, nextDir)}
        >
          <ArrowUpDown className={`h-3.5 w-3.5 ${active ? iconOn : iconOff}`} strokeWidth={2.3} aria-hidden />
        </button>
      </div>
    </th>
  );
}

type BeginnerTestHomeProps = {
  dataSource?: HomeMarketViewVariant;
  presentation?: "home" | "investing";
};

export default function BeginnerTestHome({ dataSource = "beginner-board" }: BeginnerTestHomeProps) {
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
  const boardRowsRef = useRef<BeginnerBoardRow[]>([]);
  const dashboardWsRef = useRef<SimpleSocket | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRowSparklines({}));
    return () => window.cancelAnimationFrame(frame);
  }, [period]);

  useEffect(() => {
    boardRowsRef.current = boardRows;
  }, [boardRows]);

  useEffect(() => {
    if (!isRedisDaily || boardRows.length === 0) return;
    cacheDashboardRadarRows(boardRows, dashboardUpdatedAt);
  }, [isRedisDaily, boardRows, dashboardUpdatedAt]);

  const dashboardBoardSymKey = useMemo(
    () =>
      isRedisDaily
        ? boardRows
            .map((r) => String(r.symbol || "").toUpperCase())
            .filter(Boolean)
            .sort()
            .join(",")
        : "",
    [isRedisDaily, boardRows],
  );

  /** Stable across live quote row clones so sparkline fetch + loading state do not re-run every tick. */
  const boardSparklineSymKey = useMemo(
    () =>
      boardRows
        .map((r) => String(r.symbol || "").toUpperCase())
        .filter(Boolean)
        .sort()
        .join(","),
    [boardRows],
  );

  const listLimit = useMemo(() => {
    if (isRedisDaily) return boardRows.length > 0 ? boardRows.length : BOARD_LIMIT_PROD;
    if (isDemoDevMode()) return DEV_SYMBOL_SEED.length;
    return BOARD_LIMIT_PROD;
  }, [isRedisDaily, boardRows.length]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPortalReady(true));
    return () => window.cancelAnimationFrame(frame);
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

  const onBoardTableRowEnter = useCallback(
    (symbol: string, e: MouseEvent<HTMLTableRowElement>) => {
      cancelRadarHide();
      const up = symbol.toUpperCase();
      const row = boardRowsRef.current.find((x) => String(x.symbol).toUpperCase() === up);
      if (row) setHoverRadarRow(row);
      scheduleRadarPopoverPosition(e.clientX, e.clientY);
    },
    [cancelRadarHide, scheduleRadarPopoverPosition],
  );
  const onBoardTableRowMove = useCallback(
    (e: MouseEvent<HTMLTableRowElement>) => {
      scheduleRadarPopoverPosition(e.clientX, e.clientY);
    },
    [scheduleRadarPopoverPosition],
  );
  const onBoardTableRowLeave = useCallback(() => {
    scheduleRadarHide();
  }, [scheduleRadarHide]);

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
            const built = await buildRedisDailyBoardState(payload);
            if (cancelled || !built) return;
            setBoardRows((prev) => mergeBoardQuotes(built.rows, prev));
            setBoardLegend(built.legend);
            setDashboardUpdatedAt(built.updatedAt);
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
            setBoardRows((prev) => mergeBoardQuotes(rows, prev));
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

  /** Redis ``dashboard:daily`` snapshot on WS (5m server cadence) + live price / % from Yahoo quotes. */
  useEffect(() => {
    let cancelled = false;

    const sendBoardQuoteSubscriptions = () => {
      const syms = [
        ...new Set(boardRowsRef.current.map((r) => String(r.symbol || "").toUpperCase()).filter(Boolean)),
      ];
      if (!syms.length) return;
      dashboardWsRef.current?.send({ type: "subscribe", symbols: syms, period: periodToApiSlug(period) });
    };

    const socket = new SimpleSocket(
      async (data) => {
        if (cancelled) return;
        const msg = data as {
          type?: string;
          symbol?: string;
          price?: unknown;
          change?: unknown;
          volume?: unknown;
          quote_ts?: number;
          ts?: number;
          quote_stale?: boolean;
          payload?: BeginnerBoardPayload & { ranking_board?: BeginnerBoardRow[] };
        };

        if ((msg.type === "quote" || msg.type === "initial_quote") && msg.symbol) {
          const sym = String(msg.symbol).toUpperCase();
          const price = parseSocketQuoteNumber(msg.price);
          const chg = parseSocketQuoteNumber(msg.change);
          const isShareVolume = LIVE_BOARD_EQUITY_SYMBOLS.has(sym);
          const volume = isShareVolume ? parseSocketQuoteNumber(msg.volume) : null;
          const isInitial = msg.type === "initial_quote";
          // For initial_quote, only quote_ts proves when the market quote was
          // observed. msg.ts is merely the websocket envelope send time.
          const rawQuoteTs = isInitial ? msg.quote_ts : (msg.quote_ts ?? msg.ts);
          const quoteTs = rawQuoteTs == null ? Number.NaN : Number(rawQuoteTs);
          const quoteAge = Number.isFinite(quoteTs) ? Date.now() - quoteTs : Number.NaN;
          if (isInitial && msg.quote_ts != null && (!Number.isFinite(quoteAge) || quoteAge < 0 || quoteAge > 24 * 60 * 60 * 1000)) return;
          if (!isInitial && (!Number.isFinite(quoteAge) || quoteAge < -60_000 || quoteAge > 90_000)) return;
          setBoardRows((prev) => {
            let touched = false;
            const next = prev.map((r) => {
              if (String(r.symbol).toUpperCase() !== sym) return r;
              touched = true;
              const row = { ...r };
              if (price != null && price > 0) {
                row.price = price;
                row.missing_fields = row.missing_fields?.filter((field) => field !== "price");
              }
              if (isShareVolume && volume != null && volume >= 0) {
                row.volume = volume;
                row.liquidity = (price != null && price > 0 ? price : row.price) * volume;
                row.missing_fields = row.missing_fields?.filter((field) => field !== "volume" && field !== "liquidity");
              }
              if (Number.isFinite(quoteTs)) {
                row.quote_stale = isInitial
                  ? msg.quote_stale === true || quoteAge > 90_000
                  : false;
                row.quote_ts = quoteTs;
              }
              if (!isInitial && chg != null && period === "daily") {
                row.change_pct_snapshot = Math.round(chg * 100) / 100;
                row.candle_move_abs_pct = Math.abs(chg);
                row.day_bias = chg > 0 ? "buy" : chg < 0 ? "sell" : "flat";
                row.missing_fields = row.missing_fields?.filter((field) => field !== "change_pct");
              }
              return row;
            });
            return touched ? alignLiveChangeScores(next) : prev;
          });
          // Keep the latest chart point in step with the live quote; the rest of
          // the persisted close history remains unchanged.
          if (!isInitial && price != null && price > 0) {
            setRowSparklines((prev) => {
              const row = boardRowsRef.current.find((item) => String(item.symbol || "").toUpperCase() === sym);
              const values = prev[sym] ?? (row ? sparklineValuesForRow(row, {}, period) : []);
              if (values.length < 2) return prev;
              const next = [...values.slice(0, -1), price];
              if (prev[sym] && prev[sym].length === next.length && prev[sym].at(-1) === price) return prev;
              return { ...prev, [sym]: next };
            });
          }
          return;
        }

        if (msg.type === "dashboard_daily" && msg.payload) {
          invalidateDashboardDailyCache();
          const built = await buildRedisDailyBoardState(msg.payload as BeginnerBoardPayload);
          if (cancelled || !built) return;
          setBoardRows((prev) => mergeBoardQuotes(built.rows, prev));
          setBoardLegend(built.legend);
          setDashboardUpdatedAt(built.updatedAt);
          setBoardLoading(false);
        }
      },
      () => {
        if (cancelled) return;
        if (isRedisDaily) socket.send({ type: "subscribe_dashboard" });
        window.setTimeout(() => sendBoardQuoteSubscriptions(), 200);
      },
    );

    dashboardWsRef.current = socket;
    socket.connect();

    return () => {
      cancelled = true;
      dashboardWsRef.current = null;
      try {
        if (isRedisDaily) socket.send({ type: "unsubscribe_dashboard" });
      } catch {
        /* ignore */
      }
      socket.disconnect();
    };
  }, [isRedisDaily, period]);

  /** Re-subscribe Yahoo stream when board symbols or period change (e.g. after first HTTP load). */
  useEffect(() => {
    if (!dashboardBoardSymKey) return;
    const syms = [
      ...new Set(boardRowsRef.current.map((r) => String(r.symbol || "").toUpperCase()).filter(Boolean)),
    ];
    if (!syms.length) return;
    const t = window.setTimeout(() => {
      dashboardWsRef.current?.send({ type: "subscribe", symbols: syms, period: periodToApiSlug(period) });
    }, 80);
    return () => window.clearTimeout(t);
  }, [dashboardBoardSymKey, period]);

  useEffect(() => {
    if (!boardSparklineSymKey) {
      const frame = window.requestAnimationFrame(() => {
        setRowSparklines({});
        setSparklinesLoading(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    let cancelled = false;

    const loadSparklines = (showSpinner: boolean) => {
      const rows = boardRowsRef.current;
      if (!rows.length) return;

      const syms = rows.map((r) => r.symbol);
      const hasRealEmbeddedHistory = (r: BeginnerBoardRow) => {
        const persistedPoints =
          Number.isFinite(Number(r.history_points))
            ? Number(r.history_points)
            : Array.isArray(r.chart)
              ? r.chart.length
              : 0;
        return (
          persistedPoints >= 2 &&
          r.history_state !== "missing" &&
          Array.isArray(r.chart) &&
          r.chart.length >= 2
        );
      };
      const hasEmbedded =
        period === "daily" && rows.some((r) => hasRealEmbeddedHistory(r));
      const allEmbedded =
        period === "daily" && rows.every((r) => hasRealEmbeddedHistory(r));

      const applyMap = (map: Record<string, number[]>) => {
        if (cancelled) return;
        const latest = boardRowsRef.current;
        const next: Record<string, number[]> = {};
        for (const r of latest) {
          next[r.symbol] = sparklineValuesForRow(r, map, period);
        }
        setRowSparklines(next);
      };

      if (hasEmbedded) {
        applyMap({});
        setSparklinesLoading(false);
      } else if (showSpinner) {
        setSparklinesLoading(true);
      }

      if (allEmbedded) return;

      const sparkLimit = period === "daily" ? 40 : 24;
      InstrumentService.batchDailyCloses(syms, sparkLimit, periodToApiSlug(period))
        .then((map) => {
          applyMap(map);
        })
        .catch(() => {
          // Keep the last known good or embedded history on transient API failure.
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
  }, [boardSparklineSymKey, period]);

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
      const missing = new Set(r.missing_fields ?? []);
      if (!missing.has("price") && Number.isFinite(r.price) && r.price > 0) {
        sumP += r.price;
        np++;
      }
      if (!missing.has("liquidity") && Number.isFinite(r.liquidity)) {
        sumL += r.liquidity;
        nl++;
      }
      if (!missing.has("volume") && Number.isFinite(r.volume)) {
        sumV += r.volume;
        nv++;
      }
      const ch = effectiveChangeForFearGreed(
        r,
        rowSparklines[r.symbol] ?? rowSparklines[r.symbol.toUpperCase()],
        period,
      );
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
  }, [boardRows, rowSparklines, period]);

  const boardProvenance = useMemo(() => {
    const total = boardRows.length;
    let liveQuotes = 0;
    let historyOk = 0;
    let historyShort = 0;
    let historyMissing = 0;
    let notRated = 0;

    for (const row of boardRows) {
      if (Number.isFinite(Number(row.quote_ts)) && row.quote_stale !== true) {
        liveQuotes++;
      }

      const historyState =
        row.history_state ??
        (Array.isArray(row.chart) && row.chart.length >= 2
          ? "ok"
          : Array.isArray(row.chart) && row.chart.length === 1
            ? "short"
            : "missing");

      if (historyState === "ok") historyOk++;
      else if (historyState === "short") historyShort++;
      else historyMissing++;

      if (!isRowEligibleForConviction(row)) notRated++;
    }

    return { total, liveQuotes, historyOk, historyShort, historyMissing, notRated };
  }, [boardRows]);

  const boardSnapshotLabel = useMemo(() => {
    if (!dashboardUpdatedAt) return "Unavailable";
    const parsed = new Date(dashboardUpdatedAt);
    if (Number.isNaN(parsed.getTime())) return "Unavailable";
    return parsed.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [dashboardUpdatedAt]);

  const rowPeriodChanges = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const r of boardRows) {
      const closes = rowSparklines[r.symbol] ?? rowSparklines[r.symbol.toUpperCase()] ?? [];
      out[r.symbol] = periodChangeForRow(r, closes, period);
    }
    return out;
  }, [boardRows, rowSparklines, period]);

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
    if (boardRows.length === 0) return boardRows;
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
          c = cmpFinite(rowPeriodChanges[a.symbol] ?? Number.NaN, rowPeriodChanges[b.symbol] ?? Number.NaN);
          break;
        case "bias":
          c = biasSortOrder(a) - biasSortOrder(b);
          break;
        case "strong":
          c = cmpFinite(a.strong_count, b.strong_count);
          break;
        case "upside":
          c = cmpFinite(
            upsideTechnicalForSort(a, rowSparklines, period),
            upsideTechnicalForSort(b, rowSparklines, period),
          );
          break;
        case "liquidity":
          c = cmpFinite(a.liquidity, b.liquidity);
          break;
        case "care":
          c = cmpFinite(a.people_watching, b.people_watching);
          break;
        case "trend":
          c = cmpFinite(trendDeltaForSort(a, rowSparklines, period), trendDeltaForSort(b, rowSparklines, period));
          break;
        default:
          return 0;
      }
      if (c !== 0) return c * dirM;
      return a.symbol.localeCompare(b.symbol);
    });
    return next;
  }, [boardRows, tableSort, rowSparklines, rowPeriodChanges, period]);

  const fearGreed = useMemo(() => {
    if (period === "daily") {
      return fearGreedFromBoardRows(
        boardRows.filter((row) => !row.missing_fields?.includes("change_pct"))
      );
    }
    return fearGreedFromChangePct(boardAggregates?.avgChangePct);
  }, [boardRows, period, boardAggregates?.avgChangePct]);

  const headerStatsReady = !boardLoading && boardRows.length > 0 && boardAggregates != null;

  return (
    <div className={`min-h-screen ${C.page} ${C.text} font-sans antialiased`}>
      <section className="dsa-terminal-page-head mb-3">
        <div className="min-w-0">
          <p className="dsa-section-label">Market intelligence</p>
          <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
            <h1 className="truncate text-sm font-semibold text-white">Market overview</h1>
            <span className="shrink-0 text-[10px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
              Multi-factor board
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <SelectDropdown
            className="w-[7.25rem] shrink-0"
            options={[
              { id: "daily", label: "Daily" },
              { id: "annual", label: "Annual" },
            ]}
            selected={{
              id: period,
              label: period === "daily" ? "Daily" : "Annual",
            }}
            onSelect={(opt) => setPeriod(opt.id as Period)}
          />
          <Link
            href="/search"
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            <Search className="h-3 w-3" />
            Symbol search
          </Link>
          <Link
            href="/investing"
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            <Home className="h-3 w-3" />
            Workspace
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] px-2 py-4 phone:px-3 sm:px-4 sm:py-5">
        <section
          className="mb-3 grid gap-px overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-5"
          aria-label="Market data provenance"
        >
          <div className="bg-[var(--dsa-surface-1)] px-3 py-2">
            <p className="dsa-section-label">Research snapshot</p>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-[var(--dsa-text-secondary)]">
              {boardSnapshotLabel}
            </p>
          </div>
          <div className="bg-[var(--dsa-surface-1)] px-3 py-2">
            <p className="dsa-section-label">Realtime quotes</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-white">
              {boardProvenance.liveQuotes}/{boardProvenance.total || BOARD_LIMIT_PROD}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">Received and not marked stale</p>
          </div>
          <div className="bg-[var(--dsa-surface-1)] px-3 py-2">
            <p className="dsa-section-label">Persisted history</p>
            <p
              className={`mt-1 font-mono text-xs tabular-nums ${
                boardProvenance.historyMissing || boardProvenance.historyShort
                  ? "text-[var(--dsa-warning)]"
                  : "text-[var(--dsa-positive)]"
              }`}
            >
              {boardProvenance.historyOk}/{boardProvenance.total || BOARD_LIMIT_PROD}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">
              {boardProvenance.historyShort} short · {boardProvenance.historyMissing} missing
            </p>
          </div>
          <div className="bg-[var(--dsa-surface-1)] px-3 py-2">
            <p className="dsa-section-label">Analysis eligibility</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-white">
              {Math.max(0, boardProvenance.total - boardProvenance.notRated)}/{boardProvenance.total || BOARD_LIMIT_PROD}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">{boardProvenance.notRated} Not Rated</p>
          </div>
          <div className="bg-[var(--dsa-surface-1)] px-3 py-2">
            <p className="dsa-section-label">Data model</p>
            <p className="mt-1 text-[10px] font-medium text-[var(--dsa-text-secondary)]">
              Realtime quote ≠ persisted OHLC
            </p>
            <p className="mt-0.5 text-[9px] leading-snug text-[var(--dsa-text-muted)]">
              Missing history stays missing; it is not rebuilt from the latest quote.
            </p>
          </div>
        </section>

        {/* Dense market metric strip */}
        <section className="mb-3 grid gap-px overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-5">
          <div className="bg-[var(--dsa-surface-1)] px-3 py-2.5">
            <p className="dsa-section-label">Average price</p>
            {!headerStatsReady ? (
              <p className="mt-1 h-5 w-20 animate-pulse rounded bg-white/10" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-base font-semibold tabular-nums text-white">
                  {boardAggregates?.avgPrice != null ? formatUsd(boardAggregates.avgPrice) : "—"}
                </span>
                {boardAggregates?.avgChangePct != null ? <PctBadge pct={boardAggregates.avgChangePct} /> : null}
              </div>
            )}
          </div>

          <div className="bg-[var(--dsa-surface-1)] px-3 py-2.5">
            <p className="dsa-section-label">Average dollar volume</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-white">
              {headerStatsReady && boardAggregates?.avgLiquidity != null ? formatUsd(boardAggregates.avgLiquidity) : "—"}
            </p>
          </div>

          <div className="bg-[var(--dsa-surface-1)] px-3 py-2.5">
            <p className="dsa-section-label">Average share volume</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-white">
              {headerStatsReady && boardAggregates?.avgVolume != null ? formatShares(boardAggregates.avgVolume) : "—"}
            </p>
          </div>

          <div className="bg-[var(--dsa-surface-1)] px-3 py-2.5">
            <p className="dsa-section-label">Board dollar volume</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums text-white">{formatUsd(boardLiquiditySum)}</p>
            <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">Σ price × volume · not market cap</p>
          </div>

          <div className="bg-[var(--dsa-surface-1)] px-3 py-2.5">
            <p className="dsa-section-label">Market mood</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-base font-semibold tabular-nums text-white">{fearGreed.value}</span>
              <span className="text-[11px] font-medium text-[var(--dsa-text-secondary)]">{fearGreed.label}</span>
            </div>
            <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">Derived from eligible board moves</p>
          </div>
        </section>

        {/* Chips + toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-[var(--dsa-radius-sm)] border border-[#16c784]/30 bg-[#16c784]/10 px-2 py-1 text-[11px] font-semibold text-[#16c784]"
          >
            Bullish
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-[var(--dsa-radius-sm)] border border-[#ea3943]/30 bg-[#ea3943]/10 px-2 py-1 text-[11px] font-semibold text-[#ea3943]"
          >
            Bearish
          </span>
          <span className={`rounded-[var(--dsa-radius-sm)] border ${C.line} px-2 py-1 text-[11px] ${C.muted}`}>
            Green / red = positive / negative session bias
          </span>
          <span className={`rounded-[var(--dsa-radius-sm)] border border-[#3861fb]/30 bg-[#3861fb]/10 px-2 py-1 text-[11px] font-medium text-[#7b9cff]`}>
            Hover a row for radar
          </span>
          <Link
            href="/search"
            className="inline-flex items-center gap-1 rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-2 py-1 text-[11px] font-semibold text-[#c4a3ff] hover:bg-[#a855f7]/25"
          >
            <Search className="h-3 w-3" />
            Search
          </Link>
          {sparklinesLoading && (
            <span className={`w-full text-right text-[11px] tablet:ml-auto tablet:w-auto ${C.muted}`}>
              Updating trend lines…
            </span>
          )}
        </div>

        {boardLegend?.buy_sell && (
          <p className={`mb-3 text-[11px] leading-relaxed ${C.muted}`}>{boardLegend.buy_sell}</p>
        )}

        {/* Main ranking + radar */}
        <section className={`rounded-[var(--dsa-radius-md)] ${C.card} overflow-hidden`}>
          <div className={`flex flex-col gap-2 border-b ${C.line} px-3 py-3 phone:px-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="flex min-w-0 items-center gap-2">
              <Trophy className="h-5 w-5 shrink-0 text-[#f0b90b]" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white">Multi-factor research ranking</h2>
              </div>
            </div>
            <p className={`min-w-0 text-[11px] ${C.muted} sm:shrink-0`}>
              {boardRows.length ? `${boardRows.length} symbols` : "—"} · trends use recent closes · summary above
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
                {sortedBoardRows.map((r, idx) => (
                  <BoardRankingMobileCard
                    key={r.symbol}
                    r={r}
                    displayRank={idx + 1}
                    stripe={idx % 2 === 1}
                    sparklineValues={
                      rowSparklines[r.symbol] ?? rowSparklines[r.symbol.toUpperCase()] ?? EMPTY_SPARKLINE_VALUES
                    }
                    sparklinesLoading={sparklinesLoading}
                    periodChangePct={rowPeriodChanges[r.symbol] ?? null}
                    periodLabel={periodChangeLabel(period)}
                  />
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-lg border border-[var(--dsa-border)]/80 tablet:block [-webkit-overflow-scrolling:touch]">
                <table className="w-full min-w-[700px] text-left text-sm laptop:min-w-[800px]">
                  <thead>
                    <tr className={`sticky top-0 z-10 ${C.surface} text-[11px] font-semibold uppercase tracking-wide ${C.muted}`}>
                        <th className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}>#</th>
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
                          label={periodChangeLabel(period)}
                          title={periodChangeTitle(period)}
                          columnKey="change"
                          sort={tableSort}
                          onSort={(key, dir) => setTableSort({ key, dir })}
                          align="right"
                          className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                        />
                        <BoardSortHeader
                          label="Bias"
                          title={`Directional research bias from strength + validated multi-factor scores. Shown separately from the ${periodChangeLabel(period)} column.`}
                          columnKey="bias"
                          sort={tableSort}
                          onSort={(key, dir) => setTableSort({ key, dir })}
                          align="center"
                          className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                        />
                        <BoardSortHeader
                          label="Strength"
                          columnKey="strong"
                          sort={tableSort}
                          onSort={(key, dir) => setTableSort({ key, dir })}
                          align="center"
                          className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                        />
                        <BoardSortHeader
                          label="Room to high"
                          title="Technical room to recent highs vs last price. Hover the cell for consensus-target and risk context."
                          columnKey="upside"
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
                          label="Watchers"
                          columnKey="care"
                          sort={tableSort}
                          onSort={(key, dir) => setTableSort({ key, dir })}
                          align="right"
                          className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                        />
                        <BoardSortHeader
                          label="Trend"
                          title="Recent closes; line color follows the move from the first to the last point in the window."
                          columnKey="trend"
                          sort={tableSort}
                          onSort={(key, dir) => setTableSort({ key, dir })}
                          align="center"
                          className={`border-b ${C.line} px-2 py-2.5 lg:px-3`}
                        />
                    </tr>
                  </thead>
                    <tbody>
                      {sortedBoardRows.map((r, idx) => (
                        <BoardRankingTableRow
                          key={r.symbol}
                          r={r}
                          displayRank={idx + 1}
                          stripe={idx % 2 === 1}
                          sparklineValues={
                            rowSparklines[r.symbol] ?? rowSparklines[r.symbol.toUpperCase()] ?? EMPTY_SPARKLINE_VALUES
                          }
                          sparklinesLoading={sparklinesLoading}
                          periodChangePct={rowPeriodChanges[r.symbol] ?? null}
                          onRowEnter={onBoardTableRowEnter}
                          onRowMove={onBoardTableRowMove}
                          onRowLeave={onBoardTableRowLeave}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={`mt-2 text-[10px] ${C.muted}`}>
                  <span className="tablet:hidden">Tap a name for the company profile. Averages are shown in the header.</span>
                  <span className="hidden tablet:inline">
                    Hover a row to preview radar; click the card or the company name to open the full profile. Trend lines
                    follow Daily or Annual; the change column uses live quotes in Daily mode only.
                  </span>
                </p>

                <details className={`mt-3 rounded-lg border ${C.line} bg-black/20 px-3 py-2`}>
                  <summary className={`cursor-pointer text-[11px] font-semibold text-[#7b9cff]`}>
                    Metric guide
                  </summary>
                  <ul className={`mt-2 list-inside list-disc space-y-1.5 text-[10px] leading-relaxed ${C.muted}`}>
                    <li>
                      <strong className="text-white/80">Fear &amp; Greed</strong> maps the list&apos;s average move for
                      the selected period into a 0–100 gauge (extreme fear to greed).
                    </li>
                    <li>
                      <strong className="text-white/80">Trend</strong> uses recent closing prices; color shows whether that
                      window is up or down overall.
                    </li>
                    <li>
                      <strong className="text-white/80">Radar</strong> shows six validated factors.{" "}
                      <strong className="text-white/80">Strength</strong> counts the five configured strong-trait inputs at or above the strong threshold.
                    </li>
                    <li>
                      <strong className="text-white/80">Room to high</strong> compares the last price with recent highs.
                      Analyst consensus targets are shown only when sourced; no synthetic target is generated.
                    </li>
                    <li>
                      <strong className="text-white/80">Bias</strong> summarizes the directional research view; it does not replace
                      the {periodChangeLabel(period)} column.
                    </li>
                  </ul>
                </details>
            </div>
          )}
        </section>

        {/* Detail cards — same content, CMC-style tiles */}
        <div className="mt-6 grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          <div className={`rounded-[var(--dsa-radius-md)] ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-400" />
              <h3 className="text-sm font-semibold">Watchlist saves (list)</h3>
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${C.muted}`}>
              Total watchers across the top {listLimit} names shown — not your personal watchlist.
            </p>
            {headerStatsReady && boardAggregates != null && (
              <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{boardAggregates.sumWatchers}</p>
            )}
          </div>

          <div className={`rounded-[var(--dsa-radius-md)] ${C.card} p-4`}>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#16c784]" />
              <h3 className="text-sm font-semibold">Avg move (list)</h3>
            </div>
            <p className={`mt-2 text-xs ${C.muted}`}>
              Average {period === "daily" ? "daily" : "annual"} move across the list — same basis as the Fear &amp; Greed
              chip above.
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

          <div className={`rounded-[var(--dsa-radius-md)] ${C.card} p-4 tablet:col-span-2 laptop:col-span-1`}>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold">Avg close trajectory</h3>
            </div>
            <p className={`mt-2 text-xs ${C.muted}`}>
              Blended path of recent closes across the list. Use Daily / Annual to change the window.
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

          <div className={`rounded-[var(--dsa-radius-md)] ${C.card} p-4`}>
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

          <div className={`rounded-[var(--dsa-radius-md)] ${C.card} p-4 tablet:col-span-2`}>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-[#3861fb]" />
              <div>
                <h3 className="text-sm font-semibold">Disclaimer</h3>
                <p className={`mt-1 text-xs leading-relaxed ${C.muted}`}>
                  Market data and scores are for education and research. They are not investment advice or an offer to buy
                  or sell securities.
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
          Timestamps reflect when data was processed, not exchange auction clocks.
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
            className={`fixed z-[200] block w-[min(340px,calc(100vw-24px))] cursor-pointer overflow-visible rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] p-3 shadow-2xl shadow-black/70 no-underline outline-none transition-colors pointer-events-auto hover:border-[#3861fb]/45 hover:bg-[#23272e] focus-visible:ring-2 focus-visible:ring-[#3861fb]/50`}
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
              Quick read on signals for {hoverRadarRow.symbol}. Open the profile for charts, filings, and news.{" "}
              <span className="text-[#7b9cff]">Click this card to continue.</span>
            </p>
            {/* Recharts captures clicks; let them pass through so the wrapping Link navigates. */}
            <div className="pointer-events-none">
              <BeginnerRadarChart
                data={hoverRadarRow.radar}
                fearGreed={
                  Number.isFinite(rowPeriodChanges[hoverRadarRow.symbol])
                    ? fearGreedFromChangePct(rowPeriodChanges[hoverRadarRow.symbol]!)
                    : null
                }
              />
            </div>
          </Link>,
          document.body
        )}
    </div>
  );
}
