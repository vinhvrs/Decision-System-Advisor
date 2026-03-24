/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import heatmapService from "@/src/services/Heatmap.service";

export default function HeatmapPage() {
  const router = useRouter();
  const [data, setData] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 });

  // Theo dõi kích thước container để heatmap luôn vừa vặn
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 600,
        });
      }
    };
    
    updateSize();
    window.addEventListener("resize", updateSize);
    heatmapService.getHeatmapData().then(setData).catch(console.error);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const root = useMemo(() => {
    return hierarchy({ children: data })
      .sum((d: any) => d.liquidity || 1)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [data]);

  const layout = useMemo(() => {
    return treemap<any>()
      .size([dimensions.width, dimensions.height])
      .paddingInner(2)
      .paddingOuter(2)
      .tile(treemapSquarify)(root);
  }, [root, dimensions]);

  // Hàm tính màu thông minh (Đậm dần theo % thay đổi)
  const goProfile = useCallback(
    (sym: string) => {
      const s = String(sym || "").trim();
      if (!s) return;
      router.push(`/companies/profile/${s.toLowerCase()}`);
    },
    [router],
  );

  const getColor = (change: number) => {
    const absChange = Math.abs(change);
    if (change > 0) {
      if (absChange > 3) return "#15803d"; // Xanh đậm (>3%)
      if (absChange > 1) return "#16a34a"; // Xanh vừa
      return "#22c55e"; // Xanh nhạt
    }
    if (change < 0) {
      if (absChange > 3) return "#b91c1c"; // Đỏ đậm
      if (absChange > 1) return "#dc2626"; // Đỏ vừa
      return "#ef4444"; // Đỏ nhạt
    }
    return "#334155";
  };

  return (
    <section className="p-4 phone:p-5 tablet:p-6 h-[50vh] phone:h-[60vh] tablet:h-[calc(100vh-120px)] flex flex-col">
      <div className="max-w-[1600px] w-full mx-auto flex-1 flex flex-col">
        {/* <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Market Heatmap</h2>
            <p className="text-sm text-white/40">Sized by Liquidity • Colored by Performance</p>
          </div>
          <div className="flex gap-2 text-[10px] font-bold">
            <span className="px-2 py-1 bg-[#b91c1c] text-white rounded">-3%</span>
            <span className="px-2 py-1 bg-[#334155] text-white rounded">0%</span>
            <span className="px-2 py-1 bg-[#15803d] text-white rounded">+3%</span>
          </div>
        </div> */}

        {/* Container Ref để tính toán kích thước thực tế */}
        <div ref={containerRef} className="flex-1 bg-black/20 rounded-xl overflow-hidden border border-white/10 relative">
          <svg width={dimensions.width} height={dimensions.height}>
            {layout.leaves().map((leaf: any, i) => {
              const w = leaf.x1 - leaf.x0;
              const h = leaf.y1 - leaf.y0;
              const isSmall = w < 40 || h < 40; // Kiểm tra ô quá nhỏ để ẩn text

              return (
                <g
                  key={i}
                  transform={`translate(${leaf.x0},${leaf.y0})`}
                  className="group cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() => goProfile(leaf.data.symbol)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      goProfile(leaf.data.symbol);
                    }
                  }}
                >
                  <rect
                    width={w}
                    height={h}
                    fill={getColor(leaf.data.change_pct)}
                    className="transition-all duration-300 group-hover:brightness-125"
                    stroke="#0b1220"
                    strokeWidth={1}
                  />
                  {!isSmall && (
                    <foreignObject width={w} height={h} className="pointer-events-none">
                      <div className="flex flex-col items-center justify-center h-full w-full text-white overflow-hidden p-1">
                        <span className="font-black text-sm md:text-base leading-none">
                          {leaf.data.symbol}
                        </span>
                        {h > 50 && (
                          <span className="text-[10px] md:text-xs font-medium opacity-90 mt-1">
                            {leaf.data.change_pct > 0 ? "+" : ""}{leaf.data.change_pct}%
                          </span>
                        )}
                      </div>
                    </foreignObject>
                  )}
                  {/* Tooltip đơn giản khi hover */}
                  <title>{`${leaf.data.symbol}: ${leaf.data.change_pct}%`}</title>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </section>
  );
}