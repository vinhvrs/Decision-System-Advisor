/* eslint-disable @next/next/no-html-link-for-pages */
import Image from "next/image";
import bgImg from "@/src/assets/images/bg-landingpage.jpg";
import Card from "@/src/sections/Card";
import WatchlistCard from "@/src/components/watchlist/WatchlistCard";
import DashboardCharts from "@/src/components/dashboard/DashboardCharts";
import ChatBox from "@/src/components/chatbox/page";
import HotNews from "@/src/components/news/HotNews";
import GainLoss from "@/src/components/gainloss/GainLoss";
import Heatmap from "@/src/components/analyze/heatmap/page";
import Footer from "@/src/components/footer/page";
import Link from "next/link";
import { ChevronRight } from "lucide-react"; // Thêm icon Clock cho đẹp

export default function HomePage() {
  
  return (
    <main className="text-white bg-[#0b1220]">
      {/* ================= HERO ================= */}
      <section className="relative min-h-[90vh] phone:min-h-[95vh] tablet:min-h-[100vh] laptop:min-h-[105vh] flex items-end overflow-hidden">
        <Image
          src={bgImg}
          alt="Background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/10" />

        <div className="relative z-10 w-full px-4 pb-16 phone:px-5 tablet:px-6 tablet:pb-20 laptop:pb-24">
          <div className="max-w-5xl mx-0 phone:mx-4 tablet:mx-6">
            <h1 className="text-3xl phone:text-4xl tablet:text-5xl laptop:text-6xl font-bold leading-tight">
              Decision Stocks Advisor
            </h1>
            <p className="mt-3 phone:mt-4 text-base phone:text-lg tablet:text-xl laptop:text-2xl text-white/80">
              All information you need — chart, indicators, news, heatmap, and market movers in one place.
            </p>

            <div className="mt-6 phone:mt-8 flex flex-col phone:flex-row gap-2 phone:gap-3">
              <a
                href="#dashboard"
                className="px-5 py-2 rounded bg-white text-black font-semibold"
              >
                View Dashboard
              </a>
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
      <section id="dashboard" className="px-4 py-6 phone:px-5 tablet:px-6 tablet:py-8 laptop:py-10 bg-[#0b1220]">
        <div className="max-w-screen-xl mx-auto space-y-6 tablet:space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-xl phone:text-2xl font-bold">Stock Dashboard</h2>
            <p className="text-white/70 mt-1 text-sm phone:text-base">
              Real-time market chart and assistant.
            </p>
          </div>

          {/* ===== ROW 1: MAIN CHART + ROW 2: SIDE CHARTS (watchlist-driven) ===== */}
          <div className="space-y-6">
            <DashboardCharts />
          </div>

          {/* ===== ROW 2: SIDE CARDS ===== */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-4 gap-4 tablet:gap-6">
              <Card title="Major indices">
                <ul className="space-y-3 text-sm">
                  <li className="flex justify-between">
                    <span>S&P 500</span>
                    <span className="text-green-400">+0.50%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Nasdaq 100</span>
                    <span className="text-green-400">+0.42%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Japan 225</span>
                    <span className="text-green-400">+0.85%</span>
                  </li>
                  <li className="flex justify-between">
                    <span>DAX</span>
                    <span className="text-red-400">-0.09%</span>
                  </li>
                </ul>
              </Card>

              <WatchlistCard />
            </div>

          {/* ===== ROW 3: MARKET CARDS ===== */}
          <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 gap-4 tablet:gap-6">
            <Card
              title="Crypto market cap"
              rightSlot={<span className="text-green-400">+0.01%</span>}
            >
              <p className="text-2xl font-bold">$2.94T</p>
              <p className="text-xs text-white/50 mt-1">Last 24h</p>
            </Card>

            <Card title="Commodities">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>Crude Oil</span>
                  <span className="text-red-400">-0.16%</span>
                </li>
                <li className="flex justify-between">
                  <span>Gold</span>
                  <span className="text-green-400">+0.05%</span>
                </li>
                <li className="flex justify-between">
                  <span>Natural Gas</span>
                  <span className="text-red-400">-2.94%</span>
                </li>
              </ul>
            </Card>

            <Card title="Macro economy">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span>US 10Y Yield</span>
                  <span>4.22%</span>
                </li>
                <li className="flex justify-between">
                  <span>Inflation</span>
                  <span>3.0%</span>
                </li>
                <li className="flex justify-between">
                  <span>Interest rate</span>
                  <span>3.75%</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* Watchlist Workspace: main + 3 side charts are in DashboardCharts above */}
        </div>
      </section>

      {/* ================= CHATBOX ================= */}
      {/* <ChatBox /> */}

      {/* ================= HOT NEWS ================= */}
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
          <HotNews />
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

          {/* <Card> */}
            <GainLoss />
          {/* </Card> */}
        </div>
      </section>

      {/* ================= HEATMAP ================= */}
      <section className="px-4 py-10 phone:px-5 tablet:px-6 tablet:py-12 laptop:py-16 bg-[#0b1220] border-t border-white/5">
        <div className="max-w-screen-xl mx-auto space-y-4">
          <div>
            <h2 className="text-xl phone:text-2xl font-bold">Market Heatmap</h2>
            <p className="text-white/70 mt-1 text-sm phone:text-base">
              Sector and stock performance overview by size and daily change.
            </p>
          </div>

          <Card>
            <Heatmap />
          </Card>
        </div>
      </section>
          <Footer />
    </main>
  );
}