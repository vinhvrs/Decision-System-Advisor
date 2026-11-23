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
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-[9px] text-[var(--dsa-text-muted)]">
            <Link href="/fundamentals" className="inline-flex items-center gap-0.5 hover:text-white">
              <ChevronLeft className="h-3 w-3" />
              Fundamentals
            </Link>
            <span>/</span>
            <span className="font-mono text-[#8ab4ff]">{symbol}</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <h1 className="font-mono text-sm font-semibold text-white">{symbol}</h1>
            <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">Fundamental research</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/companies/profile/${encodeURIComponent(symbol.toLowerCase())}`}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            Company profile
          </Link>
          <Link
            href={`/companies/profile/${encodeURIComponent(symbol.toLowerCase())}?tab=fundamentals`}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            Profile fundamentals
          </Link>
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">SEC fundamental history</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">
              EDGAR company facts · XBRL annual metrics and orientation scores.
            </p>
          </div>
          <span className="text-[9px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
            Source-aligned
          </span>
        </div>
        <div className="p-3 tablet:p-4">
          <FundamentalSection symbol={symbol} />
        </div>
      </section>
    </div>
  );
}
