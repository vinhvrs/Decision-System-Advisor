"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HEATMAP_DISPLAY_TILE_MAX,
  fetchHeatmapRowsWithMeta,
  formatHeatmapChangePct,
  heatmapTreemapColor,
  mergeHeatmapRows,
  type HeatmapListRow,
  type HeatmapLoadSource,
} from "@/src/libs/heatmapTreemap";
import HeatmapTreemapSvg from "@/src/components/analyze/HeatmapTreemapSvg";

export type HeatmapPageProps = {
  /** After dedupe, keep only the top N names by liquidity / size proxy. */
  maxTiles?: number;
};

function sourceLabel(source: HeatmapLoadSource): string {
  switch (source) {
    case "heatmap-daily:technology":
      return "Heatmap daily · Technology";
    case "heatmap-daily:all":
      return "Heatmap daily · Broad market";
    case "dashboard-daily":
      return "Dashboard daily fallback";
    default:
      return "Source unavailable";
  }
}

const LEGEND = [-5, -2, 0, 2, 5] as const;

export default function HeatmapPage({
  maxTiles = HEATMAP_DISPLAY_TILE_MAX,
}: HeatmapPageProps) {
  const router = useRouter();
  const [raw, setRaw] = useState<HeatmapListRow[]>([]);
  const [source, setSource] = useState<HeatmapLoadSource>("unavailable");
  const [loading, setLoading] = useState(true);

  const data = useMemo(
    () => mergeHeatmapRows(raw).slice(0, maxTiles),
    [raw, maxTiles],
  );

  const validChangeCount = useMemo(
    () =>
      data.filter(
        (row) =>
          row.change_pct != null &&
          Number.isFinite(Number(row.change_pct)),
      ).length,
    [data],
  );

  useEffect(() => {
    let cancelled = false;

    void fetchHeatmapRowsWithMeta()
      .then((result) => {
        if (cancelled) return;
        setRaw(result.rows);
        setSource(result.source);
      })
      .catch(() => {
        if (cancelled) return;
        setRaw([]);
        setSource("unavailable");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const goProfile = useCallback(
    (sym: string) => {
      const s = String(sym || "").trim();
      if (!s) return;
      router.push(`/companies/profile/${s.toLowerCase()}`);
    },
    [router],
  );

  return (
    <section className="overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
      <header className="flex flex-col gap-2 border-b border-[var(--dsa-border)] px-3 py-2 tablet:flex-row tablet:items-center tablet:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-xs font-semibold text-white">
            {data.length} symbols
          </span>
          <span className="text-[10px] text-[var(--dsa-text-muted)]">
            {validChangeCount}/{data.length || 0} with session change
          </span>
          <span className="text-[10px] text-[var(--dsa-text-muted)]">
            {sourceLabel(source)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-[var(--dsa-text-muted)]">
          {LEGEND.map((value) => (
            <span key={value} className="inline-flex items-center gap-1">
              <span
                className="h-2.5 w-4 border border-black/30"
                style={{ backgroundColor: heatmapTreemapColor(value) }}
              />
              {formatHeatmapChangePct(value)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span
              className="h-2.5 w-4 border border-black/30"
              style={{ backgroundColor: heatmapTreemapColor(null) }}
            />
            N/A
          </span>
        </div>
      </header>

      <div className="relative min-h-[320px] w-full aspect-square tablet:aspect-[4/3] laptop:aspect-[16/9] pc:aspect-[2/1]">
        {loading ? (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-xs text-[var(--dsa-text-muted)]">
            Loading heatmap…
          </p>
        ) : data.length === 0 ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center">
            <p className="text-sm font-medium text-[var(--dsa-text-secondary)]">
              Heatmap data unavailable
            </p>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-[var(--dsa-text-muted)]">
              No eligible heatmap or dashboard rows were returned. Missing market change is not represented as 0%.
            </p>
          </div>
        ) : (
          <HeatmapTreemapSvg
            data={data}
            className="h-full w-full"
            ariaLabel={`Market heatmap by liquidity and session change. Source: ${sourceLabel(source)}`}
            onTileClick={goProfile}
          />
        )}
      </div>
    </section>
  );
}
