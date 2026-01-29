/* eslint-disable @next/next/no-html-link-for-pages */
import Image from "next/image";
import bgImg from "../../assets/images/bg-landingpage.jpg";
import Card from "../../sections/Card";
import TradingChart from "../../components/charts/page";
import ChatBox from "../../components/chatbox/page";
import NewsCard from "../../components/news/NewsCard";
import HotNews from "../../components/news/HotNews";
import GainLoss from "../../components/gainloss/GainLoss";
import Heatmap from "../../components/analyze/heatmap/page";

export default function HomePage() {
  return (
    <main className="text-white">
      {/* ================= HERO ================= */}
      <section className="relative min-h-[105vh] flex items-end overflow-hidden">
        <Image
          src={bgImg}
          alt="Background"
          fill
          priority
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/10" />

        <div className="relative z-10 w-full px-6 pb-24">
          <div className="max-w-5xl mx-6">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Decision Stocks Advisor
            </h1>
            <p className="mt-4 text-lg md:text-2xl text-white/80">
              All information you need — chart, indicators, and news in one place.
            </p>

            <div className="mt-8 flex gap-3">
              <a
                href="#dashboard"
                className="px-5 py-2 rounded bg-white text-black font-semibold"
              >
                View Dashboard
              </a>
              <a
                href="/news"
                className="px-5 py-2 rounded border border-white/60 text-white"
              >
                Explore News
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= DASHBOARD ================= */}
      <section id="dashboard" className="px-6 py-10 bg-[#0b1220]">
        <div className="max-w-screen-xl mx-auto space-y-8">

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold">Stock Dashboard</h2>
            <p className="text-white/70 mt-1">
              Real-time market chart and assistant.
            </p>
          </div>

          {/* ===== ROW 1: CHART (2 ô) + CARD ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Chart */}
            <Card className="lg:col-span-8 h-[650px] overflow-hidden">
              <div className="h-full w-full">
                <TradingChart />
              </div>
            </Card>

            {/* Major Indices Card */}
            <div className="lg:col-span-4">
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
            </div>
          </div>

          {/* ===== ROW 2: 3 CARDS ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

            <Card title="Crypto market cap" rightSlot={<span className="text-green-400">+0.01%</span>}>
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

          {/* ===== CHAT ===== */}
          {/* <Card title="AI Analyst">
            <ChatBox />
          </Card> */}

        </div>
      </section>

      <ChatBox />

      {/* ================= Hot News ================= */}
      <section className="px-6 py-16 bg-[#0b1220]">
        <HotNews />
      </section>

      {/* ================= Gain / Loss ================= */}
      <section className="px-6 py-16 bg-[#0b1220]">
        <GainLoss />
      </section>

      {/* ================= Heatmap ================= */}
      <section className="px-6 py-16 bg-[#0b1220]">
        <Heatmap />
      </section>

    </main>
  );
}
