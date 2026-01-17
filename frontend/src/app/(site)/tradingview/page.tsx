"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Globe } from "lucide-react";

// đặt ảnh vào: /public/hero.jpg
import heroBg from '../../../assets/images/hero.jpg';

export default function LandingPage() {
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
    </main>
  );
}
