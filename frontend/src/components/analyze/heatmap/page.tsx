/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import heatmapService from "@/src/services/Heatmap.service";

const DEFAULT_MAX_TILES = 42;
const FETCH_LIMIT = 80;
/** Inset inside SVG so tiles don’t touch the rounded card edge. */
const SVG_INSET = 6;
const INNER_PAD = 3;

export type HeatmapPageProps = {
  /** After dedupe, keep only the top N names by liquidity (fewer slivers). */
  maxTiles?: number;
};

function mergeHeatmapRows(rows: any[]): Array<{ symbol: string; liquidity: number; change_pct: number }> {
  const bySym = new Map<string, { symbol: string; liquidity: number; change_pct: number }>();
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
        liquidity: prev.liquidity + liquidity,
        change_pct: prev.change_pct,
      });
    }
  }
  return [...bySym.values()].sort((a, b) => b.liquidity - a.liquidity);
}

function getColor(change: number) {
  const absChange = Math.abs(change);
  if (change > 0) {
    if (absChange > 3) return "#15803d";
    if (absChange > 1) return "#16a34a";
    return "#22c55e";
  }
  if (change < 0) {
    if (absChange > 3) return "#b91c1c";
    if (absChange > 1) return "#dc2626";
    return "#ef4444";
  }
  return "#334155";
}

function formatChangePct(change: number): string {
  const n = Number(change);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function HeatmapPage({ maxTiles = DEFAULT_MAX_TILES }: HeatmapPageProps) {
  const router = useRouter();
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 420 });

  const data = useMemo(() => mergeHeatmapRows(raw).slice(0, maxTiles), [raw, maxTiles]);

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w > 0 && h > 0) {
      setDimensions({ width: w, height: h });
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    heatmapService
      .getHeatmapData({ limit: FETCH_LIMIT })
      .then((rows) => {
        setRaw(Array.isArray(rows) ? rows : []);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        setRaw([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tick = () => requestAnimationFrame(measure);
    tick();
    const el = containerRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(tick) : null;
    if (el) ro?.observe(el);
    window.addEventListener("resize", tick);
    return () => {
      if (el) ro?.unobserve(el);
      ro?.disconnect();
      window.removeEventListener("resize", tick);
    };
  }, [measure]);

  useEffect(() => {
    requestAnimationFrame(measure);
  }, [measure, data.length, loading]);

  const root = useMemo(() => {
    return hierarchy({ children: data } as any)
      .sum((d: any) => (d && typeof d.liquidity === "number" ? Math.max(d.liquidity, 1) : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data]);

  const innerW = Math.max(1, dimensions.width - SVG_INSET * 2);
  const innerH = Math.max(1, dimensions.height - SVG_INSET * 2);

  const layout = useMemo(() => {
    if (!data.length) return null;
    return treemap<any>()
      .size([innerW, innerH])
      .round(true)
      .paddingInner(INNER_PAD)
      .paddingOuter(2)
      .tile(treemapSquarify.ratio(1))(root);
  }, [root, innerW, innerH, data.length]);

  const goProfile = useCallback(
    (sym: string) => {
      const s = String(sym || "").trim();
      if (!s) return;
      router.push(`/companies/profile/${s.toLowerCase()}`);
    },
    [router],
  );

  return (
    <div className="flex w-full flex-col min-h-[360px] h-[min(56vh,580px)]">
      <div
        ref={containerRef}
        className="flex-1 min-h-[300px] rounded-xl border border-white/10 bg-black/25 relative overflow-hidden"
      >
        {loadError && (
          <p className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-sm text-white/50">
            Could not load heatmap. Check rankings sync / API.
          </p>
        )}
        {!loadError && loading && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/40">
            Loading heatmap…
          </p>
        )}
        {!loadError && !loading && !data.length && raw.length > 0 && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-white/40">
            No heatmap rows returned.
          </p>
        )}
        {layout && dimensions.width > 2 && dimensions.height > 2 && (
          <svg
            width={dimensions.width}
            height={dimensions.height}
            className="block max-h-full"
            role="img"
            aria-label="Market heatmap by liquidity and daily change"
          >
            <g transform={`translate(${SVG_INSET},${SVG_INSET})`}>
              {layout.leaves().map((leaf: any) => {
                const w = leaf.x1 - leaf.x0;
                const h = leaf.y1 - leaf.y0;
                const sym = leaf.data.symbol as string;
                const ch = Number(leaf.data.change_pct);
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
                    className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    role="link"
                    tabIndex={0}
                    onClick={() => goProfile(sym)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        goProfile(sym);
                      }
                    }}
                  >
                    <rect
                      width={w}
                      height={h}
                      rx={1}
                      ry={1}
                      fill={getColor(ch)}
                      className="transition-[filter] duration-200 hover:brightness-110"
                      stroke="#0b1220"
                      strokeWidth={1}
                    />
                    {showSymbol && (
                      <text
                        textAnchor="middle"
                        fill="#ffffff"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        <tspan x={w / 2} y={h / 2 + (showPct ? -symFs * 0.15 : symFs * 0.28)} fontSize={symFs} fontWeight="800">
                          {sym.length > 6 ? `${sym.slice(0, 5)}…` : sym}
                        </tspan>
                        {showPct && (
                          <tspan
                            x={w / 2}
                            y={h / 2 + pctFs * 1.15}
                            fontSize={pctFs}
                            fontWeight="600"
                            opacity={0.92}
                          >
                            {formatChangePct(ch)}
                          </tspan>
                        )}
                      </text>
                    )}
                    <title>{`${sym}: ${formatChangePct(ch)} · liquidity-weighted tile`}</title>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
