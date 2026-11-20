/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Building2, Search } from "lucide-react";
import { CompanyService } from "@/src/services/Company.service";
import FundamentalRadar from "@/src/app/(site)/companies/profile/[inc-slug]/FundamentalRadar";
import { stripParentheticals } from "@/src/libs/displayString";

function asNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[$,%]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmtPrice(value: unknown): string {
  const n = asNumber(value);
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtSignedPct(value: unknown): string {
  const n = asNumber(value);
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

type StockRowProps = {
  stock: any;
  index: number;
  selected: boolean;
  onHover: (stock: any | null) => void;
  onOpen: (symbol: string) => void;
};

const StockRow = memo(function StockRow({ stock, index, selected, onHover, onOpen }: StockRowProps) {
  const change = asNumber(stock.change_pct);
  const positive = change != null && change > 0;
  const negative = change != null && change < 0;
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : null;

  return (
    <tr
      className={`cursor-pointer transition-colors ${selected ? "bg-[var(--dsa-accent-soft)]" : ""}`}
      onMouseEnter={() => onHover(stock)}
      onClick={() => onOpen(stock.symbol)}
    >
      <td className="text-right font-mono tabular-nums text-[var(--dsa-text-muted)]">{index + 1}</td>
      <td>
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-14 shrink-0 font-mono text-xs font-semibold text-[#8ab4ff]">{String(stock.symbol || "—").toUpperCase()}</span>
          <span className="max-w-[260px] truncate text-[11px] text-[var(--dsa-text-secondary)]">
            {stripParentheticals(stock.company_name) || "Company name unavailable"}
          </span>
        </div>
      </td>
      <td className="text-right font-mono tabular-nums text-white">{fmtPrice(stock.price)}</td>
      <td
        className={`text-right font-mono font-semibold tabular-nums ${
          positive ? "text-[var(--dsa-positive)]" : negative ? "text-[var(--dsa-negative)]" : "text-[var(--dsa-text-muted)]"
        }`}
      >
        <span className="inline-flex items-center justify-end gap-0.5">
          {Icon ? <Icon className="h-3 w-3" /> : null}
          {fmtSignedPct(stock.change_pct)}
        </span>
      </td>
      <td className="text-right font-mono tabular-nums text-[var(--dsa-text-secondary)]">{stock.liquidity ?? "—"}</td>
      <td className="text-right font-mono tabular-nums text-[var(--dsa-text-secondary)]">{stock.market_cap ?? "—"}</td>
      <td className="text-right">
        <Link
          href={`/companies/profile/${String(stock.symbol || "").toLowerCase()}`}
          onClick={(event) => event.stopPropagation()}
          className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8ab4ff] hover:text-white"
        >
          Open
        </Link>
      </td>
    </tr>
  );
});

export default function StockRankingPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<any[]>([]);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const detailsCacheRef = useRef<Record<string, any>>({});
  const hoverFetchIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    CompanyService.topCompanies(20, "liquidity")
      .then((rows) => {
        if (cancelled) return;
        const next = Array.isArray(rows) ? rows : [];
        setStocks(next);
        setSelectedStock((current: any) => current ?? next[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setStocks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedStock?.symbol) return;

    const symbol = String(selectedStock.symbol).toUpperCase();
    const fetchId = ++hoverFetchIdRef.current;
    const cached = detailsCacheRef.current[symbol];
    const request = cached
      ? Promise.resolve(cached)
      : CompanyService.getCompanyInfo(symbol);

    request
      .then((data) => {
        if (fetchId !== hoverFetchIdRef.current) return;
        detailsCacheRef.current[symbol] = data ?? null;
        setSelectedDetails(data ?? null);
      })
      .catch(() => {
        if (fetchId === hoverFetchIdRef.current) setSelectedDetails(null);
      });
  }, [selectedStock]);

  const filteredStocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter((stock) => {
      const symbol = String(stock.symbol || "").toLowerCase();
      const name = String(stock.company_name || "").toLowerCase();
      return symbol.includes(q) || name.includes(q);
    });
  }, [stocks, query]);

  const openCompany = useCallback(
    (symbol: string) => router.push(`/companies/profile/${String(symbol).toLowerCase()}`),
    [router]
  );

  const selectedSymbol = String(selectedStock?.symbol || "").toUpperCase();
  const selectedChange = asNumber(selectedStock?.change_pct);

  return (
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
            <Building2 className="h-4 w-4 text-[#8ab4ff]" />
          </div>
          <div className="min-w-0">
            <p className="dsa-section-label">Equity research</p>
            <h1 className="truncate text-sm font-semibold text-white">Company directory</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
          <span>{stocks.length || 20} liquid names</span>
          <span className="text-[var(--dsa-border-strong)]">|</span>
          <span>Rank: liquidity</span>
          <span className="text-[var(--dsa-border-strong)]">|</span>
          <span>Profile radar on hover</span>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Universe shown</p>
          <p className="mt-1 font-mono text-sm font-semibold text-white">{filteredStocks.length}</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Ranking field</p>
          <p className="mt-1 text-xs font-medium text-[var(--dsa-text-secondary)]">Liquidity</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Inspection</p>
          <p className="mt-1 text-xs font-medium text-[var(--dsa-text-secondary)]">Fundamental radar</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Navigation</p>
          <p className="mt-1 text-xs font-medium text-[var(--dsa-text-secondary)]">Click row for full profile</p>
        </div>
      </section>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="dsa-terminal-panel min-w-0 overflow-hidden">
          <div className="dsa-terminal-panel-head">
            <div>
              <p className="text-xs font-semibold text-white">Most liquid companies</p>
              <p className="text-[10px] text-[var(--dsa-text-muted)]">Fast scan of price, session move, liquidity and market cap.</p>
            </div>
            <div className="relative w-[210px] max-w-[48vw]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--dsa-text-muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter symbol / company"
                className="dsa-control h-7 min-h-0 w-full pl-8 pr-2 text-[11px] outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="dsa-terminal-table min-w-[760px]">
              <thead>
                <tr>
                  <th className="text-right">#</th>
                  <th className="text-left">Symbol / Company</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Session %</th>
                  <th className="text-right">Liquidity</th>
                  <th className="text-right">Market cap</th>
                  <th className="text-right">Profile</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 9 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td colSpan={7}><div className="h-3 rounded bg-white/[0.04]" /></td>
                    </tr>
                  ))
                ) : filteredStocks.length ? (
                  filteredStocks.map((stock, index) => (
                    <StockRow
                      key={stock.id ?? `${stock.symbol}-${index}`}
                      stock={stock}
                      index={index}
                      selected={String(stock.symbol).toUpperCase() === selectedSymbol}
                      onHover={setSelectedStock}
                      onOpen={openCompany}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-[var(--dsa-text-muted)]">
                      No companies match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="dsa-terminal-panel min-w-0 overflow-hidden xl:sticky xl:top-[calc(var(--dsa-header-height)_+_12px)] xl:self-start">
          <div className="dsa-terminal-panel-head">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-white">{selectedSymbol || "—"}</p>
              <p className="max-w-[220px] truncate text-[10px] text-[var(--dsa-text-muted)]">
                {stripParentheticals(selectedDetails?.company_name || selectedStock?.company_name) || "Hover a company"}
              </p>
            </div>
            {selectedSymbol ? (
              <Link
                href={`/companies/profile/${selectedSymbol.toLowerCase()}`}
                className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[#8ab4ff] hover:text-white"
              >
                Full profile
              </Link>
            ) : null}
          </div>

          {selectedStock ? (
            <>
              <div className="grid grid-cols-2 gap-px border-b border-[var(--dsa-border)] bg-[var(--dsa-border)]">
                <div className="bg-[var(--dsa-surface-1)] p-3">
                  <p className="dsa-section-label">Price</p>
                  <p className="mt-1 font-mono text-base font-semibold text-white">{fmtPrice(selectedStock.price)}</p>
                </div>
                <div className="bg-[var(--dsa-surface-1)] p-3">
                  <p className="dsa-section-label">Session</p>
                  <p
                    className={`mt-1 font-mono text-base font-semibold ${
                      selectedChange != null && selectedChange > 0
                        ? "text-[var(--dsa-positive)]"
                        : selectedChange != null && selectedChange < 0
                          ? "text-[var(--dsa-negative)]"
                          : "text-[var(--dsa-text-muted)]"
                    }`}
                  >
                    {fmtSignedPct(selectedStock.change_pct)}
                  </p>
                </div>
              </div>

              <div className="p-2">
                <div className="h-[286px] min-h-0">
                  <FundamentalRadar symbol={selectedSymbol} compact />
                </div>
              </div>

              <div className="border-t border-[var(--dsa-border)] px-3 py-2 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
                Radar is a research summary. Open the company profile for chart history, source context, filings and news.
              </div>
            </>
          ) : (
            <div className="px-3 py-10 text-center text-xs text-[var(--dsa-text-muted)]">
              Hover a row to inspect the company.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
