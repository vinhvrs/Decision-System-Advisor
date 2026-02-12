/* eslint-disable @typescript-eslint/no-explicit-any */
/** src/app/(site)/heatmap/page.tsx **/
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import heatmapService from "@/src/services/Heatmap.service";

export default function HeatmapPage() {
  const [data, setData] = useState<any[]>([]);
  const width = 1200;
  const height = 600;

  useEffect(() => {
    heatmapService.getHeatmapData().then(setData).catch(console.error);
  }, []);

  const root = useMemo(() => {
    return hierarchy({ children: data })
      .sum((d: any) => d.liquidity || 1) // Size by liquidity from API
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data]);

  const layout = useMemo(() => {
    return treemap<any>()
      .size([width, height])
      .paddingInner(2)
      .tile(treemapSquarify)(root);
  }, [root]);

  const getColor = (change: number) => {
    if (change > 0) return "#16a34a"; // Green for positive
    if (change < 0) return "#dc2626"; // Red for negative
    return "#334155";
  };

  return (
    <section className="p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-white mb-2">Market Heatmap</h2>
        <svg width={width} height={height} className="rounded-xl border border-white/10">
          {layout.leaves().map((leaf: any, i) => (
            <g key={i} transform={`translate(${leaf.x0},${leaf.y0})`}>
              <rect
                width={leaf.x1 - leaf.x0}
                height={leaf.y1 - leaf.y0}
                fill={getColor(leaf.data.change_pct)}
                stroke="#0b0e11"
              />
              <foreignObject width={leaf.x1 - leaf.x0} height={leaf.y1 - leaf.y0}>
                <div className="p-2 text-white text-xs font-bold truncate">
                  {leaf.data.symbol}
                  <div className="text-[10px] opacity-80">{leaf.data.change_pct}%</div>
                </div>
              </foreignObject>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}