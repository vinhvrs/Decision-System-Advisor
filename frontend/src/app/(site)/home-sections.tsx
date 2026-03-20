"use client";

import dynamic from "next/dynamic";
import Card from "@/src/sections/Card";

const skeleton = (className: string) => () => (
  <div className={`animate-pulse rounded-2xl bg-white/5 ${className}`} aria-hidden />
);

const DashboardCharts = dynamic(() => import("@/src/components/dashboard/DashboardCharts"), {
  ssr: false,
  loading: skeleton("min-h-[350px] w-full phone:min-h-[420px] tablet:min-h-[500px]"),
});

const WatchlistCard = dynamic(() => import("@/src/components/watchlist/WatchlistCard"), {
  ssr: false,
  loading: skeleton("min-h-[200px] w-full"),
});

const HotNews = dynamic(() => import("@/src/components/news/HotNews"), {
  ssr: false,
  loading: skeleton("min-h-[240px] w-full"),
});

const GainLoss = dynamic(() => import("@/src/components/gainloss/GainLoss"), {
  ssr: false,
  loading: skeleton("min-h-[200px] w-full"),
});

const Heatmap = dynamic(() => import("@/src/components/analyze/heatmap/page"), {
  ssr: false,
  loading: skeleton("min-h-[400px] w-full"),
});

/** Below-the-fold / heavy client sections for the home page (loaded after first paint). */
export function HomeDashboardCharts() {
  return <DashboardCharts />;
}

export function HomeWatchlistCard() {
  return <WatchlistCard />;
}

export function HomeHotNews() {
  return <HotNews />;
}

export function HomeGainLoss() {
  return <GainLoss />;
}

export function HomeHeatmapCard() {
  return (
    <Card>
      <Heatmap />
    </Card>
  );
}
