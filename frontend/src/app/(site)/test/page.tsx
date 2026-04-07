import type { Metadata } from "next";
import HomeHeroBanner from "../HomeHeroBanner";
import HomeMarketView from "../HomeMarketView";

export const metadata: Metadata = {
  title: "Test · Redis daily board | DSA",
  description:
    "Same layout as the homepage, fed by precomputed Redis dashboard:daily (python warm_up) — Str-ranked board with extended close series.",
};

/** Clone of `/` but market view reads `/api/.../rankings/dashboard-daily` instead of beginner-board. */
export default function TestHomeClonePage() {
  return (
    <>
      <HomeHeroBanner />
      <HomeMarketView variant="dashboard-daily" />
    </>
  );
}
