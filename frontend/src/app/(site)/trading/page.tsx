/* eslint-disable @next/next/no-html-link-for-pages */
import Image from "next/image";
import bgImg from "@/src/assets/images/bg-landingpage.jpg";
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

export default function TradingHomePage() {
  return (
    <div className="text-white bg-[#0b1220]">
      <section className="relative flex min-h-[200px] max-h-[320px] items-end overflow-hidden phone:min-h-[220px] tablet:min-h-[240px] laptop:min-h-[260px]">
        <Image
          src={bgImg}
          alt="Background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/10" />

        <div className="relative z-10 w-full px-4 pb-8 phone:px-5 tablet:px-6 tablet:pb-10">
          <div className="max-w-5xl mx-0 phone:mx-4 tablet:mx-6">
            <h1 className="text-2xl font-bold leading-tight phone:text-3xl tablet:text-4xl">
              Decision Stocks Advisor
            </h1>
            <p className="mt-2 text-sm text-white/80 phone:mt-3 phone:text-base tablet:text-lg">
              All information you need for investing — chart, indicators, news, heatmap, and market movers in one place.
            </p>

            <div className="mt-4 flex flex-col gap-2 phone:mt-5 phone:flex-row phone:gap-3">
              <a
                href="#dashboard"
                className="px-5 py-2 rounded bg-white text-black font-semibold"
              >
                View Dashboard
              </a>
              <Link
                href="/trading/history"
                className="px-5 py-2 rounded border border-blue-400/70 text-blue-200 hover:bg-blue-500/10"
              >
                Investing History Simulator
              </Link>
              <a
                href="#market-news"
                className="px-5 py-2 rounded border border-white/60 text-white"
              >
                Explore News
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DASHBOARD ================= */}
      <section
        id="dashboard"
        className="-mx-4 bg-[#0b1220] px-0 py-6 phone:-mx-5 tablet:-mx-6 tablet:py-8 laptop:py-10"
      >
        <div className="mx-auto max-w-screen-xl space-y-6 phone:space-y-8">
          <div className="px-4 phone:px-5 tablet:px-6">
            <h2 className="text-xl font-bold phone:text-2xl">Stock investing</h2>
            <p className="mt-1 text-sm text-white/70 phone:text-base">
              Real-time market chart and assistant.
            </p>
          </div>

          <div className="space-y-6 px-2 phone:px-3 tablet:px-4">
            <HomeDashboardCharts />
          </div>

          <HomeLiveMarketSection watchlist={<HomeWatchlistCard />} />
        </div>
      </section>

      <section id="market-news" className="px-4 py-6 phone:px-5 tablet:px-6 tablet:py-10 bg-[#0b1220]">
        <div className="max-w-screen-xl mx-auto space-y-2">
            <div className="flex flex-col phone:flex-row phone:items-start phone:justify-between gap-4">
            <div>
              <h2 className="text-xl phone:text-2xl font-bold">Hot Market News</h2>
              <p className="text-white/70 mt-1 text-sm phone:text-base">
              Highlighted stories affecting the market right now.
              </p>
            </div>
            <Link
              href="/news"
              className="text-sm text-blue-400 hover:underline flex items-center gap-1 group shrink-0"
            >
              View all
              <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            </div>
          <HomeHotNews />
        </div>
      </section>

      {/* ================= TOP GAIN / LOSS ================= */}
      <section className="px-4 py-10 phone:px-5 tablet:px-6 tablet:py-12 laptop:py-16 bg-[#0b1220] border-t border-white/5">
        <div className="max-w-screen-xl mx-auto space-y-2">
          <div>
            <h2 className="text-xl phone:text-2xl font-bold">Top Gainers / Losers</h2>
            <p className="text-white/70 mt-1 text-sm phone:text-base">
              Daily market movers ranked by strongest positive and negative performance.
            </p>
          </div>

          <HomeGainLoss />
        </div>
      </section>

      <section className="px-4 py-10 phone:px-5 tablet:px-6 tablet:py-12 laptop:py-16 bg-[#0b1220] border-t border-white/5">
        <div className="max-w-screen-xl mx-auto space-y-4">
          <div>
            <h2 className="text-xl phone:text-2xl font-bold">Market Heatmap</h2>
            <p className="text-white/70 mt-1 text-sm phone:text-base">
              Sector and stock performance overview by size and daily change.
            </p>
          </div>

          <HomeHeatmapCard />
        </div>
      </section>
    </div>
  );
}
