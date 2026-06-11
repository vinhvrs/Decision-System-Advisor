"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import heatmapService from "@/src/services/Heatmap.service";
import { HEATMAP_SECTOR_TECHNOLOGY } from "@/src/libs/marketViewConstants";
import {
  HEATMAP_DISPLAY_TILE_MAX,
  mergeHeatmapRows,
  type HeatmapListRow,
} from "@/src/libs/heatmapTreemap";
import HeatmapTreemapSvg from "@/src/components/analyze/HeatmapTreemapSvg";

const FETCH_LIMIT = 80;

export type HeatmapPageProps = {
  /** After dedupe, keep only the top N names by liquidity. */
  maxTiles?: number;
};

export default function HeatmapPage({ maxTiles = HEATMAP_DISPLAY_TILE_MAX }: HeatmapPageProps) {
  const router = useRouter();
  const [raw, setRaw] = useState<HeatmapListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const data = useMemo(() => mergeHeatmapRows(raw).slice(0, maxTiles), [raw, maxTiles]);

  useEffect(() => {
    setLoading(true);
    heatmapService
      .getHeatmapData({ limit: FETCH_LIMIT, sector: HEATMAP_SECTOR_TECHNOLOGY })
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

  const goProfile = useCallback(
    (sym: string) => {
      const s = String(sym || "").trim();
      if (!s) return;
      router.push(`/companies/profile/${s.toLowerCase()}`);
    },
    [router],
  );

  return (
    <div className="flex w-full flex-col">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg">
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
        {!loadError && !loading && data.length > 0 && (
          <HeatmapTreemapSvg
            data={data}
            square
            className="h-full w-full"
            ariaLabel="Technology sector market heatmap by liquidity and daily change"
            onTileClick={goProfile}
          />
        )}
      </div>
    </div>
  );
}
