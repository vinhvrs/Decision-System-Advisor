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
        className="h-7 w-7 shrink-0 rounded-[var(--dsa-radius-sm)] object-cover ring-1 ring-[var(--dsa-border)]"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-surface-3)] text-[10px] font-semibold text-white ring-1 ring-[var(--dsa-border)]">
      {symbol.slice(0, 1)}
    </span>
  );
}

export default function GainLoss() {
  const [gainers, setGainers] = useState<any[]>([]);
  const [losers, setLosers] = useState<any[]>([]);
  const [updatedNote, setUpdatedNote] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const fetchMarketMovers = async () => {
      try {
        setLoading(true);
        setLoadError(false);
        const { gainers: g, losers: l, updated_note } = await CompanyService.topVolumeMovers(5);
        setGainers(g);
        setLosers(l);
        setUpdatedNote(updated_note);
      } catch (error) {
        console.error("Failed to fetch market movers:", error);
        setGainers([]);
        setLosers([]);
        setUpdatedNote(undefined);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    void fetchMarketMovers();
  }, []);

  const StockItem = ({ stock, type }: { stock: any; type: "gainer" | "loser" }) => {
    const ch = Number(stock.change_pct);
    const name = stripParentheticals(stock.company_name);
    const showName = name && name.toUpperCase() !== String(stock.symbol || "").toUpperCase();

    return (
      <li className="border-b border-[var(--dsa-border)] last:border-0">
        <Link
          href={`/companies/profile/${String(stock.symbol || "").toLowerCase()}`}
          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--dsa-surface-2)]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <VolumeListLogo symbol={String(stock.symbol || "")} url={stock.logo_url} />
            <div className="min-w-0">
              <span className="block font-mono text-xs font-semibold text-white">{stock.symbol}</span>
              {showName ? (
                <span className="mt-0.5 block max-w-[220px] truncate text-[10px] text-[var(--dsa-text-muted)]">
                  {name}
                </span>
              ) : null}
            </div>
          </div>

          <span className="min-w-[5rem] text-right font-mono text-[11px] tabular-nums text-[var(--dsa-text-secondary)]">
            {formatCompactVolume(Number(stock.volume))}
          </span>

          <span
            className={`min-w-[4.75rem] text-right font-mono text-xs font-semibold tabular-nums ${
              Number.isFinite(ch)
                ? ch > 0
                  ? "dsa-data-positive"
                  : ch < 0
                    ? "dsa-data-negative"
                    : "text-[var(--dsa-text-muted)]"
                : "text-[var(--dsa-text-muted)]"
            }`}
          >
            {Number.isFinite(ch) ? `${ch > 0 ? "+" : ""}${ch.toFixed(2)}%` : "—"}
          </span>
        </Link>
      </li>
    );
  };

  if (loading) {
    return (
      <div className="dsa-panel flex h-[180px] items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
        <Loader2 className="animate-spin" size={16} />
        Loading market movers…
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2">
        <section className="dsa-panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-[var(--dsa-border)] px-3 py-2">
            <h3 className="text-xs font-semibold text-[var(--dsa-positive)]">Top gainers</h3>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">Volume-ranked</span>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
            <span>Symbol</span>
            <span className="min-w-[5rem] text-right">Volume</span>
            <span className="min-w-[4.75rem] text-right">Change</span>
          </div>
          <ul>
            {gainers.length > 0 ? (
              gainers.map((stock) => <StockItem key={stock.symbol} stock={stock} type="gainer" />)
            ) : (
              <li className="px-3 py-5 text-center text-xs text-[var(--dsa-text-muted)]">
                {loadError ? "Mover feed unavailable. No positive ranking inferred." : "No positive movers available."}
              </li>
            )}
          </ul>
        </section>

        <section className="dsa-panel overflow-hidden">
          <header className="flex items-center justify-between border-b border-[var(--dsa-border)] px-3 py-2">
            <h3 className="text-xs font-semibold text-[var(--dsa-negative)]">Top losers</h3>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">Volume-ranked</span>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
            <span>Symbol</span>
            <span className="min-w-[5rem] text-right">Volume</span>
            <span className="min-w-[4.75rem] text-right">Change</span>
          </div>
          <ul>
            {losers.length > 0 ? (
              losers.map((stock) => <StockItem key={stock.symbol} stock={stock} type="loser" />)
            ) : (
              <li className="px-3 py-5 text-center text-xs text-[var(--dsa-text-muted)]">
                {loadError ? "Mover feed unavailable. No negative ranking inferred." : "No negative movers available."}
              </li>
            )}
          </ul>
        </section>
      </div>

      {updatedNote ? (
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">{updatedNote}</p>
      ) : null}
    </div>
  );
}
