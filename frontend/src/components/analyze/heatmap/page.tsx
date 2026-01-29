/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";

/* ================= TYPES ================= */
type HeatmapItem = {
  symbol: string;
  name: string;
  marketCap: number; // dùng cho SIZE
  change: number;    // % change dùng cho COLOR
};

const MOCK_DATA: HeatmapItem[] = [
  { symbol: "AAPL", name: "Apple", marketCap: 3000, change: 2.97 },
  { symbol: "MSFT", name: "Microsoft", marketCap: 2800, change: 0.93 },
  { symbol: "NVDA", name: "Nvidia", marketCap: 2200, change: -0.63 },
  { symbol: "GOOGL", name: "Alphabet", marketCap: 1800, change: 1.62 },
  { symbol: "AMZN", name: "Amazon", marketCap: 1600, change: -0.31 },
  { symbol: "TSLA", name: "Tesla", marketCap: 800, change: -3.04 },
  { symbol: "AMD", name: "AMD", marketCap: 300, change: -3.22 },
  { symbol: "NFLX", name: "Netflix", marketCap: 250, change: -0.45 },
  { symbol: "ORCL", name: "Oracle", marketCap: 350, change: 2.98 },
  { symbol: "BAC", name: "Bank of America", marketCap: 290, change: 0.58 },
];

/* ================= COLOR SCALE ================= */
function getColor(change: number) {
  if (change >= 3) return "#16a34a";      // green-600
  if (change > 0) return "#22c55e";       // green-500
  if (change <= -3) return "#dc2626";    // red-600
  if (change < 0) return "#ef4444";       // red-500
  return "#334155";                       // neutral
}

/* ================= COMPONENT ================= */
export default function HeatmapPage() {
  const width = 1200;
  const height = 600;

  const root = useMemo(() => {
    return hierarchy({ children: MOCK_DATA } as any)
      .sum((d: any) => d.marketCap)
      .sort((a, b) => b.value! - a.value!);
  }, []);

  const layout = useMemo(() => {
    return treemap<any>()
      .size([width, height])
      .paddingInner(2)
      .tile(treemapSquarify)(root);
  }, [root]);

  return (
    <section className="px-6 py-12">
      <div className="max-w-7xl mx-auto space-y-4">
        <h2 className="text-2xl font-bold">Market Heatmap</h2>
        <p className="text-sm text-white/50">
          Size = Market Cap · Color = Daily % Change
        </p>

        <div className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            className="rounded-xl border border-white/10 bg-[#0B1220]"
          >
            {layout.leaves().map((leaf, idx) => {
              const d = leaf.data as HeatmapItem;
              return (
                <g key={idx} transform={`translate(${leaf.x0},${leaf.y0})`}>
                  <rect
                    width={leaf.x1 - leaf.x0}
                    height={leaf.y1 - leaf.y0}
                    fill={getColor(d.change)}
                    stroke="#0B1220"
                    rx={6}
                  />
                  <foreignObject
                    width={leaf.x1 - leaf.x0}
                    height={leaf.y1 - leaf.y0}
                  >
                    <div className="h-full w-full p-2 text-white text-xs flex flex-col justify-between">
                      <div className="font-bold truncate">{d.symbol}</div>
                      <div
                        className={`font-semibold ${
                          d.change >= 0 ? "text-white" : "text-white"
                        }`}
                      >
                        {d.change > 0 ? "+" : ""}
                        {d.change.toFixed(2)}%
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}
