import TradingChart from "../../components/charts/page";
import ChatBox from "../../components/chatbox/page";
import Image from "next/image";
import bgImg from "../../assets/images/bg-landingpage.jpg";

export default function HomePage() {
  return (
    <main className="text-white">
      {/* ================= HERO (BG + SLOGAN) ================= */}
      <section className="relative min-h-[55vh] flex items-center overflow-hidden">
        {/* Background image */}
        <Image
          src={bgImg}
          alt="Background"
          fill
          priority
          className="object-cover object-center"
        />

        {/* Overlay (dark/gradient) */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/10" />

        {/* Content on top */}
        <div className="relative z-10 w-full px-6 py-16">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold leading-tight">
              Decision System Advisor
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

      {/* ================= CONTENT (CHART/NEWS/...) ================= */}
      <section id="dashboard" className="px-6 py-10 bg-[#0b1220]">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h2 className="text-2xl font-bold">Trading Dashboard</h2>
            <p className="text-white/70 mt-1">
              Real-time market chart and assistant.
            </p>
          </div>

          <TradingChart />
          <ChatBox />

          {/* Bạn có thể thêm News/Indicators section ở đây */}
          {/* <NewsPreview /> */}
        </div>
      </section>
    </main>
  );
}
