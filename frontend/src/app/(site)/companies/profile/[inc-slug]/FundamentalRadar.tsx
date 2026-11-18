"use client";

import React, { memo, useEffect, useState } from "react";

import BeginnerRadarChart from "@/src/app/(site)/test/BeginnerRadarChart";
import { fearGreedFromChangePct } from "@/src/libs/fearGreed";
import {
  BeginnerService,
  readCachedDashboardRadarRow,
  type BeginnerBoardRow,
  type BeginnerFormalRadarPayload,
} from "@/src/services/Beginner.service";

export type FundamentalRadarProps = {
  /** Symbol analytics use the same 40-row comparison scope as Market View. */
  symbol?: string;
  poolLimit?: number;
  compact?: boolean;
  showFearGreed?: boolean;
  /**
   * Retained only for backwards-compatible callers.
   * Company metadata is never converted into a synthetic market/fundamental radar.
   */
  details?: unknown;
};

function fearGreedFor(
  changePct: number,
  missingFields?: string[],
) {
  if (missingFields?.includes("change_pct")) return null;
  if (!Number.isFinite(Number(changePct))) return null;
  return fearGreedFromChangePct(Number(changePct));
}

const FundamentalRadar = memo(
  ({
    symbol,
    poolLimit = 40,
    compact = false,
    showFearGreed = true,
  }: FundamentalRadarProps) => {
    const [formal, setFormal] = useState<BeginnerFormalRadarPayload | null>(null);
    const [dashboardRow, setDashboardRow] = useState<BeginnerBoardRow | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      const sym = symbol?.trim().toUpperCase();
      let cancelled = false;

      const resetFrame = window.requestAnimationFrame(() => {
        if (cancelled) return;
        setFormal(null);
        setDashboardRow(sym ? readCachedDashboardRadarRow(sym) : null);
        setLoading(Boolean(sym));
      });

      if (!sym) {
        return () => {
          cancelled = true;
          window.cancelAnimationFrame(resetFrame);
        };
      }

      BeginnerService.getDashboardDaily({
        maxAgeMs: 30_000,
        staleWhileRevalidateMs: 10 * 60_000,
      })
        .then((payload) => {
          if (cancelled) return;
          const rows =
            Array.isArray(payload?.rows) && payload.rows.length > 0
              ? payload.rows
              : (payload as (typeof payload & { ranking_board?: BeginnerBoardRow[] }) | null)
                  ?.ranking_board ?? [];
          const row = rows.find(
            (candidate) =>
              String(candidate.symbol || "").trim().toUpperCase() === sym,
          );
          if (row?.analysis_eligible !== false && row?.radar?.length) {
            setDashboardRow(row);
          }
        })
        .catch(() => {
          /* Keep cached/formal fallback. */
        });

      BeginnerService.getFormalRadar(sym, poolLimit)
        .then((data) => {
          if (!cancelled) setFormal(data);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
        window.cancelAnimationFrame(resetFrame);
      };
    }, [symbol, poolLimit]);

    const cachedRadarUsable =
      dashboardRow?.analysis_eligible !== false &&
      Boolean(dashboardRow?.radar?.length);

    if (cachedRadarUsable && dashboardRow) {
      return (
        <BeginnerRadarChart
          data={dashboardRow.radar}
          fearGreed={
            showFearGreed
              ? fearGreedFor(
                  dashboardRow.change_pct_snapshot,
                  dashboardRow.missing_fields,
                )
              : null
          }
          variant={compact ? "compact" : "default"}
        />
      );
    }

    if (loading) {
      return (
        <p
          className={`text-center text-[var(--dsa-text-muted)] ${
            compact ? "py-6 text-[10px]" : "py-10 text-xs"
          }`}
        >
          Loading validated radar…
        </p>
      );
    }

    const formalRadarUsable =
      formal?.analysis_eligible !== false && Boolean(formal?.radar?.length);

    if (formalRadarUsable && formal) {
      return (
        <BeginnerRadarChart
          data={formal.radar}
          fearGreed={
            showFearGreed
              ? fearGreedFor(formal.change_pct_snapshot, formal.missing_fields)
              : null
          }
          variant={compact ? "compact" : "default"}
        />
      );
    }

    return (
      <div
        className={`text-center text-[var(--dsa-text-muted)] ${
          compact ? "py-6 text-[10px]" : "py-10 text-xs"
        }`}
      >
        <p className="font-medium text-[var(--dsa-text-secondary)]">
          Radar unavailable
        </p>
        <p className="mt-1">
          Validated ranking inputs are not available for this symbol.
        </p>
      </div>
    );
  },
);

FundamentalRadar.displayName = "FundamentalRadar";

export default FundamentalRadar;
