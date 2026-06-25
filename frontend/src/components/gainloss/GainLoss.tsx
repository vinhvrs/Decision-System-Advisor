/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { CompanyService } from "../../services/Company.service";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { formatCompactVolume, stripParentheticals, symbolLogoUrl } from "@/src/libs/displayString";

function VolumeListLogo({ symbol, url }: { symbol: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  const src = symbolLogoUrl(symbol, url);
  if (!broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white ring-1 ring-white/10">
      {symbol.slice(0, 1)}
    </span>
  );
}

export default function GainLoss() {
  const [gainers, setGainers] = useState<any[]>([]);
  const [losers, setLosers] = useState<any[]>([]);
  const [updatedNote, setUpdatedNote] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketMovers = async () => {
      try {
        setLoading(true);
        const { gainers: g, losers: l, updated_note } = await CompanyService.topVolumeMovers(5);
        setGainers(g);
        setLosers(l);
        setUpdatedNote(updated_note);
      } catch (error) {
        console.error("Failed to fetch market movers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketMovers();
  }, []);

  const StockItem = ({ stock, type }: { stock: any; type: "gainer" | "loser" }) => {
    const ch = Number(stock.change_pct);
    const name = stripParentheticals(stock.company_name);
    const showName = name && name.toUpperCase() !== String(stock.symbol || "").toUpperCase();

    return (
      <li className="border-b border-white/5 py-3 last:border-0">
        <Link
          href={`/companies/profile/${String(stock.symbol || "").toLowerCase()}`}
          className="group flex cursor-pointer items-center gap-3 transition-all hover:translate-x-0.5"
        >
          <VolumeListLogo symbol={String(stock.symbol || "")} url={stock.logo_url} />
          <div className="min-w-0 flex-1">
            <span className="block font-bold text-white/90 transition-colors group-hover:text-blue-400">
              {stock.symbol}
            </span>
            {showName ? (
              <span className="mt-0.5 block truncate text-[11px] font-medium leading-snug text-white/40">
                {name}
              </span>
            ) : null}
          </div>
          <div className="shrink-0 text-right font-mono text-xs tabular-nums text-white/80">
            {formatCompactVolume(Number(stock.volume))}
          </div>
          <div className="w-[4.5rem] shrink-0 text-right">
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                type === "gainer" ? "text-green-400" : "text-red-400"
              }`}
            >
              {type === "gainer" ? "+" : ""}
              {Number.isFinite(ch) ? `${ch.toFixed(2)}%` : "—"}
            </span>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <section className="border-t border-white/5 bg-[#0b1220] px-4 py-10 phone:px-5 tablet:px-6 tablet:py-12 laptop:py-16">
      <div className="mx-auto max-w-7xl">
        {loading ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-4 text-blue-500/50">
            <Loader2 className="animate-spin" size={32} />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Analyzing Market...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 tablet:grid-cols-2 tablet:gap-8">
              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#161D2C]/80 p-5 shadow-2xl backdrop-blur-xl tablet:rounded-[2rem] tablet:p-8">
                <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-green-500/5 blur-3xl transition-all group-hover:bg-green-500/10" />
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-green-400">Top Gainers</h3>
                </div>
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2 text-[9px] font-semibold uppercase tracking-wide text-white/35">
                  <span className="min-w-0 flex-1 pl-12">Symbol</span>
                  <span className="shrink-0">Volume</span>
                  <span className="w-[4.5rem] shrink-0 text-right">Change</span>
                </div>
                <ul className="space-y-0">
                  {gainers.length > 0 ? (
                    gainers.map((stock) => <StockItem key={stock.symbol} stock={stock} type="gainer" />)
                  ) : (
                    <p className="text-xs italic text-gray-600">No gainers found</p>
                  )}
                </ul>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#161D2C]/80 p-5 shadow-2xl backdrop-blur-xl tablet:rounded-[2rem] tablet:p-8">
                <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-red-500/5 blur-3xl transition-all group-hover:bg-red-500/10" />
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                  <h3 className="text-xs font-black uppercase tracking-widest text-red-400">Top Losers</h3>
                </div>
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2 text-[9px] font-semibold uppercase tracking-wide text-white/35">
                  <span className="min-w-0 flex-1 pl-12">Symbol</span>
                  <span className="shrink-0">Volume</span>
                  <span className="w-[4.5rem] shrink-0 text-right">Change</span>
                </div>
                <ul className="space-y-0">
                  {losers.length > 0 ? (
                    losers.map((stock) => <StockItem key={stock.symbol} stock={stock} type="loser" />)
                  ) : (
                    <p className="text-xs italic text-gray-600">No losers found</p>
                  )}
                </ul>
              </div>
            </div>
            {updatedNote ? (
              <p className="mx-auto mt-6 max-w-4xl text-center text-[10px] leading-relaxed text-white/35">
                {updatedNote}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
