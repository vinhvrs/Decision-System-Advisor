"use client";

import dynamic from "next/dynamic";
import type { BeginnerRadarPoint } from "@/src/services/Beginner.service";

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

      return function Chart({ data }: { data: BeginnerRadarPoint[] }) {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="78%" data={data}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#9ca3af", fontSize: 9 }} />
              <PolarRadiusAxis angle={36} domain={[0, 5]} tickCount={6} tick={{ fill: "#6b7280", fontSize: 9 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "10px",
                  color: "#e5e7eb",
                }}
                formatter={(value) => [`${value ?? "—"} / 5`, "Score"]}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#818cf8"
                fill="#6366f1"
                fillOpacity={0.35}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

export default function BeginnerRadarChart({ data }: { data: BeginnerRadarPoint[] }) {
  if (!data?.length) {
    return <p className="text-sm text-white/45 py-16 text-center">No radar data.</p>;
  }
  return (
    <div className="h-full min-h-[280px] w-full">
      <RadarChartClient data={data} />
    </div>
  );
}
