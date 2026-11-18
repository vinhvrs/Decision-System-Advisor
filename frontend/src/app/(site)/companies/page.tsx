"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CompanyService,
  type TopCompanyRow,
} from "@/src/services/Company.service";
import FundamentalRadar from "@/src/app/(site)/companies/profile/[inc-slug]/FundamentalRadar";
import { stripParentheticals } from "@/src/libs/displayString";

type SortKey =
  | "rank"
  | "symbol"
  | "price"
  | "change_pct"
  | "liquidity"
  | "volume"
  | "market_cap";

type NumericSortKey = Exclude<SortKey, "rank" | "symbol">;

function isMissing(row: TopCompanyRow, field: string): boolean {
  return row.missing_fields?.includes(field) ?? false;
}

function finiteValue(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function compact(value: number, currency = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const prefix = currency ? "$" : "";
  const format = (n: number, suffix: string) => `${sign}${prefix}${n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)}${suffix}`;
  if (abs >= 1e12) return format(abs / 1e12, "T");
  if (abs >= 1e9) return format(abs / 1e9, "B");
  if (abs >= 1e6) return format(abs / 1e6, "M");
  if (abs >= 1e3) return format(abs / 1e3, "K");
  return `${sign}${prefix}${abs.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatPrice(row: TopCompanyRow): string {
  if (isMissing(row, "price")) return "—";
  const value = finiteValue(row.price);
  return value != null && value > 0 ? `$${value.toFixed(2)}` : "—";
}

function formatChange(row: TopCompanyRow): string {
  if (isMissing(row, "change_pct")) return "—";
  const value = finiteValue(row.change_pct);
  return value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatMetric(row: TopCompanyRow, field: "liquidity" | "volume" | "market_cap", currency = false): string {
  if (isMissing(row, field)) return "—";
  const value = finiteValue(row[field]);
  return value != null && value > 0 ? compact(value, currency) : "—";
}

function formatUpdated(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const StockRow = memo(function StockRow({
  stock,
  index,
  onHover,
  onClick,
}: {
  stock: TopCompanyRow;
  index: number;
  onHover: (row: TopCompanyRow | null) => void;
  onClick: (symbol: string) => void;
}) {
  const change = isMissing(stock, "change_pct") ? null : finiteValue(stock.change_pct);

  return (
    <tr
      className="cursor-pointer border-t border-[var(--dsa-border)] transition-colors hover:bg-[var(--dsa-surface-2)]"
      onMouseEnter={() => onHover(stock)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(stock.symbol)}
    >
      <td className="px-2.5 py-2 text-right font-mono text-[10px] tabular-nums text-[var(--dsa-text-muted)]">
        {index + 1}
      </td>
      <td className="px-2.5 py-2">
        <div className="font-mono text-xs font-semibold uppercase text-[#8ab4ff]">{stock.symbol}</div>
        <div className="mt-0.5 max-w-[220px] truncate text-[10px] text-[var(--dsa-text-muted)]">
          {stripParentheticals(stock.company_name) || "Company name unavailable"}
        </div>
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-xs tabular-nums text-white">{formatPrice(stock)}</td>
      <td
        className={`px-2.5 py-2 text-right font-mono text-xs font-semibold tabular-nums ${
          change == null
            ? "text-[var(--dsa-text-muted)]"
            : change > 0
              ? "text-[var(--dsa-positive)]"
              : change < 0
                ? "text-[var(--dsa-negative)]"
                : "text-[var(--dsa-text-secondary)]"
        }`}
      >
        {formatChange(stock)}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-xs tabular-nums text-[var(--dsa-text-secondary)]">
        {formatMetric(stock, "liquidity")}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-xs tabular-nums text-[var(--dsa-text-secondary)]">
        {formatMetric(stock, "volume")}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-xs tabular-nums text-white">
        {formatMetric(stock, "market_cap", true)}
      </td>
      <td className="px-2.5 py-2 text-right font-mono text-[10px] text-[var(--dsa-text-muted)]">
        {formatUpdated(stock.updated_at)}
      </td>
    </tr>
  );
});

export default function CompaniesPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<TopCompanyRow[]>([]);
  const [hoveredStock, setHoveredStock] = useState<TopCompanyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "rank",
    dir: "asc",
  });

  const tooltipRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await CompanyService.topCompanies(40, "liquidity");
      setStocks(rows);
    } catch {
      setError("Company ranking snapshot is temporarily unavailable.");
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const sorted = useMemo(() => {
    if (sort.key === "rank") {
      return sort.dir === "asc" ? stocks : [...stocks].reverse();
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...stocks].sort((a, b) => {
      if (sort.key === "symbol") return a.symbol.localeCompare(b.symbol) * dir;
      const field = sort.key as NumericSortKey;
      const aMissing = isMissing(a, field);
      const bMissing = isMissing(b, field);
      if (aMissing && bMissing) return 0;
      if (aMissing) return 1;
      if (bMissing) return -1;
      return ((finiteValue(a[field]) ?? 0) - (finiteValue(b[field]) ?? 0)) * dir;
    });
  }, [stocks, sort]);

  const latestUpdatedAt = useMemo(() => {
    let latest = 0;
    let label: string | null = null;
    for (const row of stocks) {
      if (!row.updated_at) continue;
      const ms = new Date(row.updated_at).getTime();
      if (Number.isFinite(ms) && ms > latest) {
        latest = ms;
        label = row.updated_at;
      }
    }
    return label;
  }, [stocks]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "symbol" ? "asc" : "desc" },
    );
  };

  const sortLabel = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!tooltipRef.current || !hoveredStock) return;
      const x = e.clientX;
      const y = e.clientY;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      requestRef.current = requestAnimationFrame(() => {
        const node = tooltipRef.current;
        if (!node) return;
        const width = 280;
        const height = 320;
        const gap = 14;
        let left = x + gap;
        let top = y - height / 2;
        if (left + width > window.innerWidth - 8) left = x - width - gap;
        top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
        node.style.transform = `translate3d(${left}px, ${top}px, 0)`;
      });
    },
    [hoveredStock],
  );

  const th = (key: SortKey, label: string, align: "left" | "right" = "right") => (
    <th className={`px-2.5 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`w-full font-semibold text-[var(--dsa-text-muted)] hover:text-white ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        {label}
        {sortLabel(key)}
      </button>
    </th>
  );

  return (
    <div
      className="-mx-3 min-h-screen bg-[var(--dsa-bg)] text-[var(--dsa-text)] phone:-mx-4 tablet:-mx-5 laptop:-mx-6"
      onMouseMove={handleMouseMove}
    >
      {hoveredStock ? (
        <div
          ref={tooltipRef}
          className="pointer-events-none fixed left-0 top-0 z-[100] w-[280px] rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border-strong)] bg-[var(--dsa-surface-2)] p-3 shadow-lg"
          style={{ willChange: "transform" }}
        >
          <div className="flex items-start justify-between gap-2 border-b border-[var(--dsa-border)] pb-2">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold uppercase text-white">{hoveredStock.symbol}</p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--dsa-text-muted)]">
                {stripParentheticals(hoveredStock.company_name) || "Company name unavailable"}
              </p>
            </div>
            <span className="rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#8ab4ff]">
              Radar
            </span>
          </div>
          <div className="h-[210px] w-full">
            <FundamentalRadar symbol={hoveredStock.symbol} compact />
          </div>
          <div className="grid grid-cols-2 gap-1.5 border-t border-[var(--dsa-border)] pt-2 text-[10px]">
            <div><span className="text-[var(--dsa-text-muted)]">Price</span><p className="font-mono text-white">{formatPrice(hoveredStock)}</p></div>
            <div><span className="text-[var(--dsa-text-muted)]">Session</span><p className="font-mono text-white">{formatChange(hoveredStock)}</p></div>
            <div><span className="text-[var(--dsa-text-muted)]">Liquidity</span><p className="font-mono text-white">{formatMetric(hoveredStock, "liquidity")}</p></div>
            <div><span className="text-[var(--dsa-text-muted)]">As of</span><p className="font-mono text-white">{formatUpdated(hoveredStock.updated_at)}</p></div>
          </div>
        </div>
      ) : null}

      <header className="border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6">
        <div className="dsa-page flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <p className="dsa-section-label">Companies</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl">
              Liquidity-ranked market snapshot
            </h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
              Up to 40 symbols ranked by the latest available liquidity snapshot. Missing fields remain unavailable instead of being rendered as zero.
            </p>
          </div>
          <div className="shrink-0 text-left tablet:text-right">
            <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">Latest row update</p>
            <p className="mt-1 font-mono text-[11px] text-[var(--dsa-text-secondary)]">{formatUpdated(latestUpdatedAt)}</p>
          </div>
        </div>
      </header>

      <div className="dsa-page px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6">
        {error ? (
          <div className="dsa-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-[var(--dsa-negative)]">{error}</p>
              <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">No company metric is inferred while the source is unavailable.</p>
            </div>
            <button type="button" onClick={() => void load()} className="dsa-button-secondary">Retry</button>
          </div>
        ) : (
          <section className="dsa-panel overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--dsa-border)] px-3 py-2">
              <p className="text-xs text-[var(--dsa-text-muted)]">
                <span className="font-mono font-semibold text-white">{stocks.length}</span> symbols
              </p>
              <button type="button" onClick={() => void load()} className="dsa-button-secondary min-h-0 px-2.5 py-1 text-xs">
                Refresh
              </button>
            </div>

            <div className="max-h-[calc(100vh_-_var(--dsa-header-height)_-_210px)] overflow-auto">
              <table className="w-full min-w-[940px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--dsa-surface-2)] text-[9px] uppercase tracking-[0.05em]">
                  <tr>
                    {th("rank", "#")}
                    {th("symbol", "Symbol", "left")}
                    {th("price", "Price")}
                    {th("change_pct", "Session %")}
                    {th("liquidity", "Liquidity")}
                    {th("volume", "Volume")}
                    {th("market_cap", "Market cap")}
                    <th className="px-2.5 py-2 text-right font-semibold text-[var(--dsa-text-muted)]">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && stocks.length === 0
                    ? Array.from({ length: 10 }, (_, i) => (
                        <tr key={i} className="border-t border-[var(--dsa-border)]">
                          <td colSpan={8} className="h-9 animate-pulse bg-[rgba(255,255,255,0.012)]" />
                        </tr>
                      ))
                    : sorted.map((stock, index) => (
                        <StockRow
                          key={stock.symbol}
                          stock={stock}
                          index={index}
                          onHover={setHoveredStock}
                          onClick={(symbol) => router.push(`/companies/profile/${symbol.toLowerCase()}`)}
                        />
                      ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
          This table is a ranked snapshot, not a guaranteed realtime feed. Timestamps and field availability can differ by symbol.
        </p>
      </div>
    </div>
  );
}
