import type { Metadata } from "next";
import HomeHeroBanner from "../HomeHeroBanner";
import HomeMarketView from "../HomeMarketView";

export const metadata: Metadata = {
  title: "Market overview | DSA",
  description: "Live ranking dashboard with charts, movers, and watch tools — same experience as the home page.",
};

/** Internal route that mirrors the homepage market layout (used for QA). */
export default function TestHomeClonePage() {
  return (
    <>
      <HomeHeroBanner />
      <HomeMarketView variant="dashboard-daily" />
    </>
  );
}
