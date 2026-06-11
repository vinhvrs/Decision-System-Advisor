"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import {
  HEATMAP_BG,
  HEATMAP_INNER_PAD,
  HEATMAP_OUTER_PAD,
  HEATMAP_SVG_INSET,
  HEATMAP_TILE_STROKE,
  HEATMAP_TILE_STROKE_WIDTH,
  formatHeatmapChangePct,
  HEATMAP_LABEL_FILL,
  HEATMAP_LABEL_STROKE,
  HEATMAP_LABEL_STROKE_WIDTH,
  heatmapTileLabel,
  heatmapTreemapColor,
  type HeatmapListRow,
} from "@/src/libs/heatmapTreemap";

type HeatmapDatum = HeatmapListRow & { children?: HeatmapDatum[] };

type Props = {
  data: HeatmapListRow[];
  className?: string;
  ariaLabel?: string;
  onTileClick?: (symbol: string) => void;
  /** Force 1:1 layout (recommended for homepage). */
  square?: boolean;
  /** Cap square side in px (homepage compact). */
  squareMaxPx?: number;
};

export default function HeatmapTreemapSvg({
  data,
  className = "",
  ariaLabel = "Market heatmap",
  onTileClick,
  square = false,
  squareMaxPx,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 400, height: 400 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w <= 0) return;
    if (square) {
      const cap = squareMaxPx && squareMaxPx > 0 ? squareMaxPx : w;
      const side = Math.floor(Math.min(w, cap));
      setDims({ width: side, height: side });
      return;
    }
    const h = el.clientHeight;
    if (h > 0) setDims({ width: Math.floor(w), height: Math.floor(h) });
  }, [square, squareMaxPx]);

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
      .sum((d) => (d && typeof d.liquidity === "number" ? Math.max(d.liquidity, 1) : 0))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data]);

  const innerW = Math.max(1, dims.width - HEATMAP_SVG_INSET * 2);
  const innerH = Math.max(1, dims.height - HEATMAP_SVG_INSET * 2);

  const layout = useMemo(() => {
    if (!data.length) return null;
    return treemap<HeatmapDatum>()
      .size([innerW, innerH])
      .round(true)
      .paddingInner(HEATMAP_INNER_PAD)
      .paddingOuter(HEATMAP_OUTER_PAD)
      .tile(treemapSquarify.ratio(1))(root);
  }, [root, innerW, innerH, data.length]);

  if (!data?.length) return null;

  return (
    <div
      ref={ref}
      className={["relative h-full w-full min-h-[280px] overflow-hidden", square ? "aspect-square" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: HEATMAP_BG }}
    >
      {!layout ? (
        <div className="flex h-full items-center justify-center text-xs text-white/40">Preparing map…</div>
      ) : (
        <svg
          width={dims.width}
          height={dims.height}
          className="block h-full w-full"
          role="img"
          aria-label={ariaLabel}
        >
          <rect width={dims.width} height={dims.height} fill={HEATMAP_BG} />
          <g transform={`translate(${HEATMAP_SVG_INSET},${HEATMAP_SVG_INSET})`}>
            {layout.leaves().map((leaf, idx) => {
              const w = leaf.x1 - leaf.x0;
              const h = leaf.y1 - leaf.y0;
              const sym = String(leaf.data.symbol || "").toUpperCase();
              const ch = Number(leaf.data.change_pct) || 0;
              const clipId = `hm-${idx}-${sym.replace(/[^A-Z0-9]/g, "")}`;
              const label = heatmapTileLabel(w, h, sym);

              return (
                <g
                  key={`${sym}-${idx}`}
                  transform={`translate(${leaf.x0},${leaf.y0})`}
                  className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  role="link"
                  tabIndex={0}
                  onClick={() => onTileClick?.(sym)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTileClick?.(sym);
                    }
                  }}
                >
                  <defs>
                    <clipPath id={clipId}>
                      <rect x={0} y={0} width={w} height={h} />
                    </clipPath>
                  </defs>
                  <rect
                    width={w}
                    height={h}
                    fill={heatmapTreemapColor(ch)}
                    stroke={HEATMAP_TILE_STROKE}
                    strokeWidth={HEATMAP_TILE_STROKE_WIDTH}
                    className="transition-[filter] duration-150 hover:brightness-110"
                  />
                  {label.showSymbol && (
                    <g clipPath={`url(#${clipId})`}>
                      <text
                        textAnchor="middle"
                        fill={HEATMAP_LABEL_FILL}
                        stroke={HEATMAP_LABEL_STROKE}
                        strokeWidth={HEATMAP_LABEL_STROKE_WIDTH}
                        paintOrder="stroke fill"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        <tspan x={w / 2} y={label.symY} fontSize={label.symFs} fontWeight="800">
                          {label.symbolText}
                        </tspan>
                        {label.showPct && (
                          <tspan x={w / 2} y={label.pctY} fontSize={label.pctFs} fontWeight="700">
                            {formatHeatmapChangePct(ch)}
                          </tspan>
                        )}
                      </text>
                    </g>
                  )}
                  <title>{`${sym}: ${formatHeatmapChangePct(ch)}`}</title>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
