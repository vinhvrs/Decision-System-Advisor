"use client";

import Link from "next/link";
import { BarChart3, ArrowUpRight } from "lucide-react";
import { FundamentalsService } from "@/src/services/Fundamentals.service";
import { useEffect, useState } from "react";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "META", "AMZN", "IBM", "ORCL", "AVGO"] as const;

type ScoreLite = { overall_score?: number | null };

export default function InvestingHomePage() {
  const [scores, setScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number | null> = {};
      await Promise.all(
        SYMBOLS.map(async (sym) => {
          try {
            const res = (await FundamentalsService.score(sym)) as { data?: ScoreLite };
            const v = res?.data?.overall_score;
            next[sym] = v != null && Number.isFinite(Number(v)) ? Number(v) : null;
          } catch {
            next[sym] = null;
          }
        }),
      );
      if (!cancelled) setScores(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#0b1220] via-[#111827] to-[#0b1220]">
        <div className="mx-auto max-w-6xl px-4 py-12 phone:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#7b9cff]">Investing</p>
              <h1 className="mt-2 text-3xl font-bold phone:text-4xl">US tech fundamentals</h1>
              <p className="mt-3 max-w-2xl text-sm text-white/65">
                SEC-based income statement, balance sheet, and cash-flow history for ten large-cap technology names, with
                dashboard-style scores. Open a symbol for charts; use the company profile for the full market stack
                (price, stance, trend, watchlist).
              </p>
            </div>
            <BarChart3 className="h-12 w-12 shrink-0 text-[#3861fb] opacity-90" aria-hidden />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 phone:px-6">
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
          {SYMBOLS.map((sym) => (
            <Link
              key={sym}
              href={`/investing/${sym.toLowerCase()}`}
              className="group rounded-2xl border border-white/10 bg-[#0F172A]/80 p-5 shadow-lg transition hover:border-[#3861fb]/50 hover:shadow-[#3861fb]/10"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-lg font-bold text-white">{sym}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-[#848e9c] transition group-hover:text-[#7b9cff]" />
              </div>
              <p className="mt-2 text-xs text-white/55">Revenue, margins, cash flow, leverage — SEC annual history.</p>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/45">Overall score</span>
                <span className="text-2xl font-bold tabular-nums text-[#7b9cff]">
                  {scores[sym] != null ? scores[sym]!.toFixed(1) : "—"}
                </span>
              </div>
              <p className="mt-3 text-[10px] text-white/40">
                Profile (technical + fundamentals):{" "}
                <span className="text-[#7b9cff] underline-offset-2 group-hover:underline">
                  /companies/profile/{sym.toLowerCase()}
                </span>
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
