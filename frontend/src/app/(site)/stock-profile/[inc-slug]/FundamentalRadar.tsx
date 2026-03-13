/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';

const RadarChartClient = dynamic(() => 
  import('recharts').then((mod) => {
    const { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } = mod;
    return function Chart({ data }: { data: any[] }) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#9ca3af', fontSize: 10 }} />
            <Radar name="Score" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      );
    };
  }), { ssr: false }
);

const FundamentalRadar = memo(({ details }: { details: any }) => {
  const chartData = useMemo(() => [
    { subject: 'Growth', value: details?.industry === 'Semiconductors' ? 98 : 85 },
    { subject: 'Value', value: 65 },
    { subject: 'Health', value: details?.full_time_employees > 10000 ? 95 : 75 },
    { subject: 'Dividend', value: 45 },
    { subject: 'Liquidity', value: 98 },
    { subject: 'Sentiment', value: 92 },
  ], [details?.instrument_id]);

  return <div className="h-[280px] w-full"><RadarChartClient data={chartData} /></div>;
});

FundamentalRadar.displayName = 'FundamentalRadar';
export default FundamentalRadar;