import type { Metadata } from "next";
import HomeHeroBanner from "./HomeHeroBanner";
import HomeMarketView from "./HomeMarketView";

export const metadata: Metadata = {
  title: "Beginner market view | DSA",
  description:
    "Dashboard-style view: ranked symbols, radar scores, snapshot price and change, volume, liquidity, and watchlist interest — explained in plain language.",
};

export default function HomePage() {
  return (
    <>
      <HomeHeroBanner />
      <HomeMarketView variant="dashboard-daily" />
    </>
  );
}
