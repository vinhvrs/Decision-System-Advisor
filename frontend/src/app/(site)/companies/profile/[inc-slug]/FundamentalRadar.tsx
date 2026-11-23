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
  /** Symbol-backed radar using the same validated 40-row comparison scope as Market View. */
  symbol?: string;
  poolLimit?: number;
  compact?: boolean;
  showFearGreed?: boolean;
  /**
   * Kept for backward compatibility with older callers.
   * DSA no longer fabricates a radar from profile metadata when symbol data is absent.
   */
  details?: unknown;
};

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

      const timer = window.setTimeout(() => {
        if (cancelled) return;
        if (!sym) {
          setFormal(null);
          setDashboardRow(null);
          setLoading(false);
          return;
        }
        setDashboardRow(readCachedDashboardRadarRow(sym));
        setLoading(true);
      }, 0);

      if (!sym) {
        return () => {
          cancelled = true;
          window.clearTimeout(timer);
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
            (candidate) => String(candidate.symbol || "").trim().toUpperCase() === sym,
          );
          if (row) setDashboardRow(row);
        })
        .catch(() => {
          /* Keep cached/formal fallback. */
        });

      BeginnerService.getFormalRadar(sym, poolLimit)
        .then((data) => {
          if (!cancelled) setFormal(data);
        })
        .catch(() => {
          if (!cancelled) setFormal(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }, [symbol, poolLimit]);

    const sym = symbol?.trim().toUpperCase();

    if (!sym) {
      return (
        <p
          className={`text-center text-[var(--dsa-text-muted)] ${
            compact ? "py-5 text-[10px]" : "py-8 text-sm"
          }`}
        >
          Symbol-backed radar unavailable. No heuristic score is generated from profile metadata.
        </p>
      );
    }

    const rowEligible =
      dashboardRow &&
      dashboardRow.analysis_eligible !== false &&
      dashboardRow.data_state !== "missing" &&
      dashboardRow.data_state !== "partial" &&
      dashboardRow.data_state !== "synthetic" &&
      Array.isArray(dashboardRow.radar) &&
      dashboardRow.radar.length > 0;

    if (rowEligible) {
      return (
        <BeginnerRadarChart
          data={dashboardRow.radar!}
          fearGreed={
            showFearGreed && !dashboardRow.missing_fields?.includes("change_pct")
              ? fearGreedFromChangePct(dashboardRow.change_pct_snapshot)
              : null
          }
          variant={compact ? "compact" : "default"}
        />
      );
    }

    const formalEligible =
      formal &&
      formal.analysis_eligible !== false &&
      Array.isArray(formal.radar) &&
      formal.radar.length > 0;

    if (formalEligible) {
      return (
        <BeginnerRadarChart
          data={formal.radar}
          fearGreed={
            showFearGreed && !formal.missing_fields?.includes("change_pct")
              ? fearGreedFromChangePct(formal.change_pct_snapshot)
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
            compact ? "py-5 text-[10px]" : "py-8 text-sm"
          }`}
        >
          Loading validated radar…
        </p>
      );
    }

    return (
      <div className={`text-center ${compact ? "py-5" : "py-8"}`}>
        <p className={compact ? "text-[10px]" : "text-sm"} style={{ color: "var(--dsa-text-muted)" }}>
          Not Rated — validated radar inputs are unavailable or incomplete.
        </p>
      </div>
    );
  },
);

FundamentalRadar.displayName = "FundamentalRadar";

export default FundamentalRadar;
