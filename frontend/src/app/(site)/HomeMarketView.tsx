"use client";

import BeginnerTestHome from "./test/BeginnerTestHome";

export type HomeMarketViewVariant = "beginner-board" | "dashboard-daily";

type Props = {
  /** Ranking data source: full board vs daily dashboard snapshot. */
  variant?: HomeMarketViewVariant;
};

/** Renders the main market dashboard (home uses the default variant). */
export default function HomeMarketView({ variant = "dashboard-daily" }: Props) {
  return <BeginnerTestHome dataSource={variant} />;
}
