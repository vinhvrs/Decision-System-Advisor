import type { Metadata } from "next";
import HomeHeroBanner from "./HomeHeroBanner";
import HomeMarketView from "./HomeMarketView";

export const metadata: Metadata = {
  title: "Market overview",
  description:
    "Market research workspace with ranked symbols, multi-factor signals, price action, liquidity, and explicit data eligibility.",
};

export default function HomePage() {
  return (
    <div className="-mx-3 min-w-0 phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
      <HomeHeroBanner />
      <HomeMarketView variant="dashboard-daily" />
    </div>
  );
}
