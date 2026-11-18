import Link from "next/link";
import { ChevronRight } from "lucide-react";
import HomeLiveMarketSection from "@/src/components/home/HomeLiveMarketSection";
import {
  HomeDashboardCharts,
  HomeWatchlistCard,
  HomeHotNews,
  HomeGainLoss,
  HomeHeatmapCard,
} from "../home-sections";

export default function InvestingHomePage() {
  return (
    <div className="-mx-3 bg-[var(--dsa-bg)] phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
      <section className="border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6">
        <div className="dsa-page flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <p className="dsa-section-label">Market research</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl">
              Investing workspace
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--dsa-text-secondary)] tablet:text-[13px]">
              Charts, market movers, watchlist context, news, and heatmaps in a single research flow.
              Directional labels describe market bias and are not trade instructions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a href="#dashboard" className="dsa-button-primary">
              Dashboard
            </a>
            <Link href="/investing/history" className="dsa-button-secondary">
              History simulator
            </Link>
            <a href="#market-news" className="dsa-button-secondary">
              News
            </a>
          </div>
        </div>
      </section>

      <section id="dashboard" className="px-3 py-5 phone:px-4 tablet:px-5 tablet:py-6 laptop:px-6">
        <div className="dsa-page space-y-4">
          <div>
            <p className="dsa-section-label">Dashboard</p>
            <div className="mt-1 flex flex-col gap-1 phone:flex-row phone:items-end phone:justify-between">
              <div>
                <h2 className="dsa-section-title">Market charts & decision context</h2>
                <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
                  Use chart state, source freshness, and supporting indicators together.
                </p>
              </div>
            </div>
          </div>

          <HomeDashboardCharts />
          <HomeLiveMarketSection watchlist={<HomeWatchlistCard />} />
        </div>
      </section>

      <section
        id="market-news"
        className="border-t border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-5 phone:px-4 tablet:px-5 tablet:py-6 laptop:px-6"
      >
        <div className="dsa-page space-y-3">
          <div className="flex flex-col gap-2 phone:flex-row phone:items-end phone:justify-between">
            <div>
              <p className="dsa-section-label">News</p>
              <h2 className="dsa-section-title mt-1">Market headlines</h2>
              <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
                Recent stories that may affect the instruments and themes being monitored.
              </p>
            </div>
            <Link
              href="/news"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#8ab4ff] hover:text-white"
            >
              View all
              <ChevronRight size={13} />
            </Link>
          </div>
          <HomeHotNews />
        </div>
      </section>

      <section className="border-t border-[var(--dsa-border)] px-3 py-5 phone:px-4 tablet:px-5 tablet:py-6 laptop:px-6">
        <div className="dsa-page space-y-3">
          <div>
            <p className="dsa-section-label">Breadth</p>
            <h2 className="dsa-section-title mt-1">Top gainers / losers</h2>
            <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
              Daily movers ordered by positive and negative performance.
            </p>
          </div>
          <HomeGainLoss />
        </div>
      </section>

      <section className="border-t border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-5 phone:px-4 tablet:px-5 tablet:py-6 laptop:px-6">
        <div className="dsa-page space-y-3">
          <div>
            <p className="dsa-section-label">Cross-section</p>
            <h2 className="dsa-section-title mt-1">Market heatmap</h2>
            <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
              Sector and stock performance overview by size and daily change.
            </p>
          </div>
          <HomeHeatmapCard />
        </div>
      </section>
    </div>
  );
}
