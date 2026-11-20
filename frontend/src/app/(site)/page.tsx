import type { Metadata } from "next";
import HomeMarketView from "./HomeMarketView";

export const metadata: Metadata = {
  title: "Market overview",
  description:
    "Market research workspace with ranked symbols, multi-factor signals, price action, liquidity, and explicit data eligibility.",
};

export default function HomePage() {
  return <HomeMarketView variant="dashboard-daily" />;
}
