/* eslint-disable react-hooks/static-components */
"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Globe } from "lucide-react";

// đặt ảnh vào: /public/hero.jpg
import heroBg from '../../../assets/images/hero.jpg';

export default function LandingPage() {
  function MiniChart({ title, value, change, color }: { title: string; value: string; change: string; color: string }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 h-40 flex flex-col justify-between">
        <div>
          <p className="text-xs text-white/60 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{value}</span>
            <span className={`text-[10px] ${color}`}>{change}</span>
          </div>
        </div>
        <div className="h-12 w-full bg-white/5 rounded"></div> {/* Placeholder chart */}
      </div>
    );
  }

  function IndexRow({ name, symbol, value, change, isDown = false }: { name: string; symbol: string; value: string; change: string; isDown?: boolean }) {
    return (
      <div className="flex items-center justify-between group cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
            {symbol.substring(0, 2)}
          </div>
          <div>
            <p className="text-sm font-semibold group-hover:text-blue-400 transition">{name}</p>
            <p className="text-[10px] text-white/40 uppercase">{symbol}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono">{value}</p>
          <p className={`text-[10px] ${isDown ? 'text-red-400' : 'text-green-400'}`}>{change}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      {/* ===== Topbar ===== */}
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0B1220]/70 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="text-lg font-extrabold tracking-wide">
            DSA
          </Link>

          <div className="hidden md:flex flex-1 items-center">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input
                className="w-full rounded-full border border-white/10 bg-white/5 px-10 py-2 text-sm text-white placeholder:text-white/40
                           focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="Search (Ctrl+K)"
              />
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 text-sm text-white/70">
            {["Products", "Community", "Markets", "Brokers", "More"].map((x) => (
              <button
                key={x}
                className="rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white transition"
              >
                {x}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button className="hidden md:inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition">
              <Globe size={16} className="text-white/60" />
              EN
            </button>

            <Link
              href="/auth?mode=register"
              className="rounded-xl bg-gradient-to-r from-blue-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative min-h-screen overflow-hidden">
        <Image
          src={heroBg}
          alt="Landing background"
          fill
          priority
          className="object-cover object-center"
        />

        {/* overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/40 to-[#0B1220]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.20),transparent_45%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.20),transparent_45%)]" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl items-center px-4 pt-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-sm text-white/80">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Real-time market insights
            </div>

            <h1 className="mt-6 text-5xl md:text-7xl font-extrabold leading-tight">
              Look first / Then leap.
            </h1>

            <p className="mt-5 text-lg md:text-2xl text-white/80">
              The best trades require research, then commitment.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/auth?mode=register"
                className="rounded-2xl bg-white px-7 py-3 font-semibold text-black hover:bg-white/90 transition"
              >
                Get started for free
              </Link>

              <Link
                href="/news"
                className="rounded-2xl border border-white/25 px-7 py-3 font-semibold text-white hover:bg-white/10 transition"
              >
                Explore news
              </Link>
            </div>

            <div className="mt-4 text-sm text-white/60">
              $0 forever, no credit card needed
            </div>
          </div>
        </div>
      </section>
      {/* ===== Market Overview Section ===== */}
      <section className="bg-[#0B1220] py-12 px-4">
        <div className="mx-auto max-w-7xl">
          {/* Layout Grid chính */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Cột trái & giữa: Biểu đồ lớn (S&P 500) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 h-[500px] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-red-500 text-white text-[10px] font-bold px-1 rounded">500</span>
                      <h3 className="text-xl font-bold">S&P 500 <span className="text-white/40 font-normal ml-1 text-sm uppercase">SPX</span></h3>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-bold">6,915.62</span>
                      <span className="text-sm text-green-400">+0.03%</span>
                    </div>
                  </div>
                </div>
                {/* Chỗ này bạn có thể nhúng Iframe TradingView hoặc Chart.js */}
                <div className="flex-1 w-full bg-gradient-to-t from-green-500/10 to-transparent rounded-lg border-b border-green-500/30 relative overflow-hidden">
                  {/* Giả lập đường line chart */}
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    <path d="M0 80 Q 100 20 200 60 T 400 30 T 600 80 T 800 40 T 1000 60" fill="none" stroke="#22c55e" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              {/* 3 Biểu đồ nhỏ phía dưới */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MiniChart title="Crypto market cap" value="2.99 T" change="+1.98%" color="text-green-400" />
                <MiniChart title="US Dollar index" value="97.456" change="-0.44%" color="text-red-400" />
                <MiniChart title="US 10-year yield" value="4.242%" change="+1.71%" color="text-green-400" />
              </div>
            </div>

            {/* Cột phải: Danh sách Major Indices */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-bold mb-6">Major indices</h3>
              <div className="space-y-6">
                <IndexRow name="Nasdaq 100" symbol="NDX" value="25,605.47" change="+0.34%" />
                <IndexRow name="Japan 225" symbol="NI225" value="53,846.82" change="+0.29%" />
                <IndexRow name="SSE Composite" symbol="000001" value="4,136.16" change="+0.33%" />
                <IndexRow name="FTSE 100" symbol="UKX" value="10,143.44" change="-0.07%" isDown />
                <IndexRow name="DAX" symbol="DAX" value="24,900.71" change="+0.18%" />
              </div>
              <button className="mt-8 text-blue-400 text-sm font-medium hover:underline">
                See all major indices &gt;
              </button>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
