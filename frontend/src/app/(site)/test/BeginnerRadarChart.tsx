"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { BeginnerRadarPoint } from "@/src/services/Beginner.service";

/**
 * Chart shows five attributes; API still sends a Price spoke — drop it for display only.
 */
export function radarChartDataWithoutPrice(data: BeginnerRadarPoint[] | undefined | null): BeginnerRadarPoint[] {
  return (data ?? []).filter((p) => String(p?.subject ?? "").trim().toLowerCase() !== "price");
}

export type FearGreedStripProps = {
  value: number;
  label: string;
  compact?: boolean;
};

/** Fear &amp; Greed gradient + score above radar (not a spoke). */
export function FearGreedSpectrumStrip({ value, label, compact }: FearGreedStripProps) {
  const v = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 50));
  return (
    <div className={`w-full shrink-0 ${compact ? "mb-2" : "mb-3"}`}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`font-semibold uppercase tracking-wide text-[#7b9cff] ${compact ? "text-[9px]" : "text-[10px]"}`}>
          Fear &amp; Greed
        </span>
        <span
          className={`font-mono font-bold leading-none tabular-nums text-white ${compact ? "text-lg" : "text-2xl"}`}
        >
          {v}
        </span>
      </div>
      <p className={`mb-2 text-center font-semibold text-[#eaecef] ${compact ? "text-[11px]" : "text-xs"}`}>{label}</p>
      <div
        className="relative h-3 w-full rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
        style={{
          background: "linear-gradient(90deg, #ea3943 0%, #f0b90b 40%, #a3e635 72%, #16c784 100%)",
        }}
        role="img"
        aria-label={`Fear and greed ${v} of 100, ${label}`}
      >
        <div
          className="pointer-events-none absolute top-1/2 z-10 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white shadow-md ring-1 ring-black/40"
          style={{ left: `${v}%` }}
        />
      </div>
      <p className={`leading-snug text-[#848e9c] ${compact ? "mt-1 text-[8px]" : "mt-1.5 text-[9px]"}`}>
        This row: F = round(clamp(50 + 3.25 × snapshot %, 0, 100)). Header{" "}
        <strong className="font-semibold text-[#aeb4c0]">Fear &amp; Greed</strong> bar uses the full-board formula.
      </p>
    </div>
  );
}

const RadarChartClient = dynamic(
  () =>
    import("recharts").then((mod) => {
      const {
        Radar,
        RadarChart,
        PolarGrid,
        PolarAngleAxis,
        PolarRadiusAxis,
        ResponsiveContainer,
        Tooltip,
      } = mod;

      return function ChartWrapper({
        data,
        compact,
      }: {
        data: BeginnerRadarPoint[];
        compact?: boolean;
      }) {
        const tickSize = compact ? 11 : 13;
        const outer = compact ? "68%" : "72%";
        const margin = compact
          ? { top: 4, right: 14, bottom: 18, left: 14 }
          : { top: 8, right: 22, bottom: 28, left: 22 };
        return (
          <ResponsiveContainer width="100%" height="100%" style={{ overflow: "visible" }}>
            <RadarChart cx="50%" cy="50%" outerRadius={outer} margin={margin} data={data}>
              <PolarGrid stroke="#2b3139" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#d1d5db", fontSize: tickSize, fontWeight: 600 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 5]}
                tickCount={6}
                tick={{ fill: "#6b7280", fontSize: compact ? 9 : 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e2329",
                  border: "1px solid #2b3139",
                  borderRadius: "10px",
                  color: "#eaecef",
                }}
                formatter={(val) => [`${val ?? "—"} / 5`, "Score"]}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#3861fb"
                fill="#3861fb"
                fillOpacity={0.28}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        );
      };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] w-full items-center justify-center rounded-lg bg-white/[0.04] text-xs text-white/35">
        Loading chart…
      </div>
    ),
  }
);

type BeginnerRadarChartProps = {
  data: BeginnerRadarPoint[];
  /** Per-row Fear &amp; Greed strip (same F scale as header bar; formula differs). */
  fearGreed?: FearGreedStripProps | null;
  /** Smaller layout for profile sidebar cards. */
  variant?: "default" | "compact";
};

export default function BeginnerRadarChart({ data, fearGreed, variant = "default" }: BeginnerRadarChartProps) {
  const compact = variant === "compact";
  const chartData = useMemo(() => radarChartDataWithoutPrice(data), [data]);
  if (!chartData.length) {
    return (
      <p className={`text-center text-white/45 ${compact ? "py-6 text-xs" : "py-16 text-sm"}`}>No radar data.</p>
    );
  }
  return (
    <div className="flex w-full flex-col overflow-visible">
      {fearGreed != null ? (
        <FearGreedSpectrumStrip value={fearGreed.value} label={fearGreed.label} compact={compact} />
      ) : null}
      {/* Recharts ResponsiveContainer needs a definite height; min-h/flex-1 alone often yields 0px here. */}
      <div
        className={`w-full shrink-0 overflow-visible ${compact ? "h-[220px]" : "h-[300px] sm:h-[320px]"}`}
      >
        <RadarChartClient data={chartData} compact={compact} />
      </div>
    </div>
  );
}
