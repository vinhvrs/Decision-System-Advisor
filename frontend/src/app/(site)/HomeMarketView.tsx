"use client";

import BeginnerTestHome from "./test/BeginnerTestHome";

export type HomeMarketViewVariant = "beginner-board" | "dashboard-daily";

type Props = {
  /** `dashboard-daily` reads Redis via `/rankings/dashboard-daily` (run python warm_up). */
  variant?: HomeMarketViewVariant;
};

/** Site home (`/`) uses live beginner board; `/test` can pass `dashboard-daily`. */
export default function HomeMarketView({ variant = "dashboard-daily" }: Props) {
  return <BeginnerTestHome dataSource={variant} />;
}
