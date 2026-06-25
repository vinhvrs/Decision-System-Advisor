"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FundamentalSection } from "@/src/components/investing/FundamentalSection";

type Props = {
  params: Promise<{ symbol: string }>;
};

export default function FundamentalsSymbolPage({ params }: Props) {
  const { symbol: raw } = use(params);
  const symbol = decodeURIComponent(raw || "").trim().toUpperCase();

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 phone:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/fundamentals"
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-white/80 hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" />
            All symbols
          </Link>
          <Link
            href={`/companies/profile/${encodeURIComponent(symbol.toLowerCase())}`}
            className="rounded-lg border border-[#3861fb]/40 px-3 py-1.5 text-[#7b9cff] hover:bg-[#3861fb]/10"
          >
            Full company profile (chart + market stack)
          </Link>
          <Link
            href={`/companies/profile/${encodeURIComponent(symbol.toLowerCase())}?tab=fundamentals`}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-white/70 hover:bg-white/5"
          >
            Same fundamentals in profile layout
          </Link>
        </div>

        <h1 className="text-2xl font-bold">
          <span className="font-mono text-[#7b9cff]">{symbol}</span>{" "}
          <span className="text-lg font-semibold text-white/80">fundamentals</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-white/60">
          Data from SEC EDGAR company facts (XBRL). Run the ingest pipeline after migrations to populate charts and
          scores.
        </p>

        <div className="mt-8">
          <FundamentalSection symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
