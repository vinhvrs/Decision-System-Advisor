/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { memo, useMemo } from "react";
import dynamic from "next/dynamic";

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

      return function Chart({ data }: { data: any[] }) {
        return (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="78%" data={data}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#9ca3af", fontSize: 10 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "#6b7280", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                  borderRadius: "10px",
                  color: "#e5e7eb",
                }}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.45}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        );
      };
    }),
  { ssr: false }
);

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromEmployees(employees: number) {
  if (!employees || employees <= 0) return 40;
  if (employees >= 200000) return 98;
  if (employees >= 100000) return 94;
  if (employees >= 50000) return 88;
  if (employees >= 20000) return 80;
  if (employees >= 10000) return 74;
  if (employees >= 5000) return 66;
  if (employees >= 1000) return 58;
  return 48;
}

function scoreFromIpoDate(ipoDate?: string | null) {
  if (!ipoDate) return 45;
  const year = new Date(ipoDate).getFullYear();
  if (!year || Number.isNaN(year)) return 45;

  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  if (age >= 40) return 95;
  if (age >= 25) return 88;
  if (age >= 15) return 78;
  if (age >= 8) return 68;
  if (age >= 3) return 58;
  return 48;
}

function scoreGrowth(industry?: string, sector?: string) {
  const text = `${industry || ""} ${sector || ""}`.toLowerCase();

  if (
    text.includes("semiconductor") ||
    text.includes("artificial intelligence") ||
    text.includes("software") ||
    text.includes("cloud")
  ) {
    return 92;
  }

  if (
    text.includes("technology") ||
    text.includes("communication") ||
    text.includes("cybersecurity")
  ) {
    return 84;
  }

  if (
    text.includes("healthcare") ||
    text.includes("consumer") ||
    text.includes("industrial")
  ) {
    return 72;
  }

  return 60;
}

function scoreLeadership(details: any) {
  let score = 35;

  if (details?.ceo) score += 20;
  if (details?.website) score += 15;
  if (details?.description) score += 15;
  if (details?.country) score += 5;
  if (details?.company_name) score += 10;

  return clamp(score);
}

function scoreMarketPresence(details: any) {
  let score = 40;

  const exchange = String(details?.exchange || "").toUpperCase();
  if (exchange.includes("NASDAQ") || exchange.includes("NYSE")) score += 25;
  else if (exchange) score += 15;

  if (details?.country === "US") score += 15;
  else if (details?.country) score += 10;

  if (details?.image) score += 8;
  if (details?.symbol) score += 6;

  return clamp(score);
}

function scoreTransparency(details: any) {
  const fields = [
    details?.company_name,
    details?.symbol,
    details?.exchange,
    details?.industry,
    details?.sector,
    details?.website,
    details?.description,
    details?.ceo,
    details?.country,
    details?.image,
    details?.full_time_employees,
    details?.ipo_date,
  ];

  const filled = fields.filter((v) => v !== null && v !== undefined && v !== "").length;
  return clamp((filled / fields.length) * 100);
}

const FundamentalRadar = memo(({ details }: { details: any }) => {
  const chartData = useMemo(() => {
    const employees = Number(details?.full_time_employees || 0);

    return [
      {
        subject: "Growth",
        value: scoreGrowth(details?.industry, details?.sector),
      },
      {
        subject: "Scale",
        value: scoreFromEmployees(employees),
      },
      {
        subject: "Leadership",
        value: scoreLeadership(details),
      },
      {
        subject: "Maturity",
        value: scoreFromIpoDate(details?.ipo_date),
      },
      {
        subject: "Presence",
        value: scoreMarketPresence(details),
      },
      {
        subject: "Transparency",
        value: scoreTransparency(details),
      },
    ];
  }, [details]);

  return (
    <div className="h-[280px] w-full">
      <RadarChartClient data={chartData} />
    </div>
  );
});

FundamentalRadar.displayName = "FundamentalRadar";

export default FundamentalRadar;