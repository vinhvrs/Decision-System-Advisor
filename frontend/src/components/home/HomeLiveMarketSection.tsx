"use client";

import { ReactNode } from "react";
import WatchlistRelatedNews from "@/src/components/home/WatchlistRelatedNews";

type Props = {
  watchlist: ReactNode;
};

export default function HomeLiveMarketSection({ watchlist }: Props) {
  return (
    <div className="space-y-6 tablet:space-y-8">
      <div className="w-full min-w-0">{watchlist}</div>
      <WatchlistRelatedNews />
    </div>
  );
}
