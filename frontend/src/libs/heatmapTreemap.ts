import heatmapService from "@/src/services/Heatmap.service";
import { BeginnerService, type BeginnerBoardRow } from "@/src/services/Beginner.service";
import { HEATMAP_SECTOR_TECHNOLOGY } from "@/src/libs/marketViewConstants";

/** Finviz-style treemap: tight tiles, white grid lines, scaled two-line labels. */

export const HEATMAP_BG = "#0d0d0d";
export const HEATMAP_TILE_STROKE = "#000000";
export const HEATMAP_TILE_STROKE_WIDTH = 1;

export const HEATMAP_SVG_INSET = 1;
/** Small gap between tiles without oversized margins. */
export const HEATMAP_INNER_PAD = 2;
export const HEATMAP_OUTER_PAD = 2;
/** Dense map like reference screenshots (~40+ names). */
export const HEATMAP_DISPLAY_TILE_MAX = 48;

/** Readable labels on muted green/red tiles. */
export const HEATMAP_LABEL_FILL = "#ffffff";
export const HEATMAP_LABEL_STROKE = "rgba(2,6,23,0.95)";
export const HEATMAP_LABEL_STROKE_WIDTH = 1.6;

/** Graded red / green by |change| % with restrained saturation for label readability. */
export function heatmapTreemapColor(change: number): string {
  const n = Number(change);
  if (!Number.isFinite(n) || n === 0) return "#3f3f46";
  const a = Math.min(Math.abs(n), 12);
  if (n > 0) {
    if (a >= 8) return "#37a86a";
    if (a >= 4) return "#258b55";
    if (a >= 2) return "#1f7a49";
    if (a >= 0.75) return "#17623c";
    return "#12452e";
  }
  if (a >= 8) return "#b84242";
  if (a >= 4) return "#a53232";
  if (a >= 2) return "#8e262a";
  if (a >= 0.75) return "#781f24";
  return "#5f1b20";
}

export function formatHeatmapChangePct(change: number): string {
  const n = Number(change);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export type HeatmapTileLabel = {
  showSymbol: boolean;
  showPct: boolean;
  symFs: number;
  pctFs: number;
  symbolText: string;
  symY: number;
  pctY: number;
};

/** Label scales with tile size; both lines centered when space allows. */
export function heatmapTileLabel(w: number, h: number, symbol: string): HeatmapTileLabel {
  const minEdge = Math.min(w, h);
  const area = w * h;
  const sym = String(symbol || "").toUpperCase();

  const symFs = clamp(minEdge * 0.2, 5, 13);
  const pctFs = clamp(symFs * 0.68, 4, 10);

  const showSymbol = w >= 16 && h >= 12 && area >= 120;
  const showPct = w >= 20 && h >= 18 && area >= 200;

  const maxChars =
    w < 28 ? 3 : w < 40 ? 4 : w < 56 ? 5 : w < 80 ? 6 : 8;
  const symbolText =
    sym.length > maxChars ? `${sym.slice(0, Math.max(2, maxChars - 1))}…` : sym;

  const blockH = showPct ? symFs + pctFs * 1.15 : symFs;
  const topY = h / 2 - blockH / 2;
  const symY = topY + symFs * 0.85;
  const pctY = topY + symFs + pctFs * 0.95;

  return { showSymbol, showPct, symFs, pctFs, symbolText, symY, pctY };
}

export type HeatmapListRow = { symbol: string; liquidity?: number; change_pct?: number };

export function mergeHeatmapRows(rows: HeatmapListRow[]): HeatmapListRow[] {
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

const HEATMAP_API_FETCH_LIMIT = 80;
const HEATMAP_API_MIN_ROWS = 10;

export function boardRowsToHeatmap(rows: BeginnerBoardRow[]): HeatmapListRow[] {
  return rows.map((r) => {
    const changePct = Number.isFinite(r.change_pct_snapshot) ? r.change_pct_snapshot : 0;
    const marketCap = Number(r.market_cap);
    const liquidity = Number(r.liquidity);
    const volume = Number(r.volume);
    return {
      symbol: r.symbol,
      liquidity:
        Number.isFinite(marketCap) && marketCap > 0
          ? marketCap
          : Number.isFinite(liquidity) && liquidity > 0
            ? liquidity
            : Number.isFinite(volume) && volume > 0
              ? volume
              : 1,
      change_pct: changePct,
    };
  });
}

/** Load treemap rows from ranking APIs only (heatmap-daily → dashboard-daily fallback). */
export async function fetchHeatmapRowsFromApi(): Promise<HeatmapListRow[]> {
  try {
    const fromHeatmapEndpoint = async (sector?: string) => {
      const raw = await heatmapService.getHeatmapData({
        limit: HEATMAP_API_FETCH_LIMIT,
        ...(sector ? { sector } : {}),
      });
      return mergeHeatmapRows(Array.isArray(raw) ? raw : []);
    };

    let rows = await fromHeatmapEndpoint(HEATMAP_SECTOR_TECHNOLOGY);
    if (rows.length < HEATMAP_API_MIN_ROWS) {
      rows = await fromHeatmapEndpoint();
    }
    if (rows.length < HEATMAP_API_MIN_ROWS) {
      const daily = await BeginnerService.getDashboardDaily({ maxAgeMs: 15_000 });
      if (daily?.rows?.length) {
        rows = mergeHeatmapRows(boardRowsToHeatmap(daily.rows));
      }
    }

    return rows.slice(0, HEATMAP_DISPLAY_TILE_MAX);
  } catch {
    return [];
  }
}
