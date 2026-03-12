/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, memo } from 'react';
import dynamic from 'next/dynamic';

// Load Recharts duy nhất tại Client để tránh lỗi Hydration và lag SSR
const RadarChartClient = dynamic(() => 
  import('recharts').then((mod) => {
    const { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } = mod;
    return function Chart({ data }: { data: any[] }) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Radar
              name="Score"
              dataKey="value"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      );
    };
  }), { ssr: false }
);

interface ScoreChartProps {
  price: string | number;
  change_pct: string | number;
  liquidity: string | number;
  volume?: string | number;
  market_cap: string | number;
}

const ScoreChart = memo(({ price, change_pct, liquidity, volume, market_cap }: ScoreChartProps) => {
  // Logic chuẩn hóa dữ liệu về thang điểm 100
  const chartData = useMemo(() => {
    const n = (val: any) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;

    return [
      { subject: 'Price', value: Math.min(100, (n(price) / 1000) * 100) },
      { subject: 'Change', value: Math.min(100, Math.abs(n(change_pct)) * 10) },
      { subject: 'Liquidity', value: Math.min(100, (n(liquidity) / 1000) * 100) },
      { subject: 'Volume', value: Math.min(100, (n(volume || 100) / 1000) * 100) },
      { subject: 'MarketCap', value: Math.min(100, (n(market_cap) / 2000) * 100) },
    ];
  }, [price, change_pct, liquidity, volume, market_cap]);

  return (
    <div className="h-40 w-full flex items-center justify-center">
      <RadarChartClient data={chartData} />
    </div>
  );
});

ScoreChart.displayName = 'ScoreChart';

export default ScoreChart;