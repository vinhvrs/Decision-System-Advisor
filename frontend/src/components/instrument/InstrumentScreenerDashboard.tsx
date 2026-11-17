"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  InstrumentScreenerService,
  SCREENER_TECH_SYMBOLS,
  ScreenerRow,
} from "@/src/services/InstrumentScreener.service";

type SortKey =
  | "symbol"
  | "price"
  | "change_pct"
  | "pe_ratio"
  | "pb_ratio"
  | "debt_equity"
  | "roe"
  | "net_income"
  | "revenue"
  | "overall_score";

function fmtB(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

function fmtPctRatio(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function num(r: ScreenerRow, k: SortKey): number | string {
  if (k === "symbol") return String(r.symbol);
  const v = r[k as keyof ScreenerRow];
  if (v == null || v === "") return NaN;
  return Number(v);
}

function formatAsOf(value: string | null): string {
  if (!value) return "As-of time unavailable";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "As-of time unavailable";
  return `As of ${d.toLocaleString()}`;
}

export function InstrumentScreenerDashboard() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setWarning(null);
    try {
      const data = await InstrumentScreenerService.getTechScreener();
      if (!data?.rows?.length) {
        setErr("Screener data is currently unavailable.");
        setRows([]);
        setUpdatedAt(data?.updated_at ?? null);
        return;
      }

      setRows(data.rows);
      setUpdatedAt(data.updated_at ?? null);

      const hasFundamentals = data.rows.some(
        (r) => r.fiscal_year != null || r.revenue != null || r.net_income != null
      );
      setWarning(
        hasFundamentals
          ? null
          : "Market snapshot is available, but fundamental fields are currently unavailable for this universe."
      );
    } catch {
      setErr("Screener data is temporarily unavailable.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = [...rows];
    list.sort((a, b) => {
      const av = num(a, sortKey);
      const bv = num(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") {
        return av.localeCompare(bv) * dir;
      }
      const an = Number(av);
      const bn = Number(bv);
      if (!Number.isFinite(an) && !Number.isFinite(bn)) return 0;
      if (!Number.isFinite(an)) return 1;
      if (!Number.isFinite(bn)) return -1;
      return (an - bn) * dir;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(k);
      setSortDir(k === "symbol" ? "asc" : "desc");
    }
  };

  const Th = ({
    k,
    children,
    align = k === "symbol" ? "left" : "right",
  }: {
    k: SortKey;
    children: ReactNode;
    align?: "left" | "right";
  }) => (
    <th className={`px-2.5 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex w-full items-center gap-1 font-semibold text-[var(--dsa-text-secondary)] hover:text-white ${
          align === "right" ? "justify-end" : "justify-start"
        }`}
      >
        {children}
        {sortKey === k ? <span className="text-[#8ab4ff]">{sortDir === "desc" ? "↓" : "↑"}</span> : null}
      </button>
    </th>
  );

  if (loading) {
    return (
      <div className="dsa-page px-3 py-12 text-center text-sm text-[var(--dsa-text-muted)] phone:px-4 tablet:px-5">
        Loading screener…
      </div>
    );
  }

  if (err) {
    return (
      <div className="dsa-page px-3 py-10 phone:px-4 tablet:px-5">
        <div className="dsa-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium text-[var(--dsa-negative)]">{err}</p>
            <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
              No ranking or fundamental values are inferred while the source is unavailable.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="dsa-button-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-3 min-h-screen bg-[var(--dsa-bg)] text-white phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
      <header className="border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6">
        <div className="dsa-page flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
          <div className="min-w-0">
            <p className="dsa-section-label">Screener</p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl">
              US technology universe
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-[var(--dsa-text-secondary)]">
              Fixed universe of {SCREENER_TECH_SYMBOLS.length} symbols using market snapshot fields and available SEC fundamentals.
            </p>
            <p className="mt-2 max-w-4xl truncate font-mono text-[10px] text-[var(--dsa-text-muted)]">
              {SCREENER_TECH_SYMBOLS.join(" · ")}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--dsa-text-muted)]">Data timestamp</p>
            <p className="mt-1 font-mono text-[11px] text-[var(--dsa-text-secondary)]">{formatAsOf(updatedAt)}</p>
          </div>
        </div>
      </header>

      <div className="dsa-page px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6">
        <section className="dsa-panel overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--dsa-border)] px-3 py-2">
            <p className="text-xs text-[var(--dsa-text-muted)]">
              <span className="font-mono font-semibold text-white">{sorted.length}</span> symbols
            </p>
            <button type="button" onClick={() => void load()} className="dsa-button-secondary min-h-0 px-2.5 py-1 text-xs">
              Refresh
            </button>
          </div>

          {warning ? (
            <div className="border-b border-[rgba(216,163,64,0.28)] bg-[rgba(216,163,64,0.08)] px-3 py-2 text-xs text-[#d9bb7a]">
              {warning}
            </div>
          ) : null}

          <div className="max-h-[calc(100vh_-_var(--dsa-header-height)_-_230px)] overflow-auto">
            <table className="w-full min-w-[1100px] border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--dsa-surface-2)] text-[10px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
                <tr>
                  <th className="px-2.5 py-2 text-right">#</th>
                  <Th k="symbol">Symbol</Th>
                  <Th k="price">Price</Th>
                  <Th k="change_pct">Session %</Th>
                  <Th k="pe_ratio">P/E</Th>
                  <Th k="pb_ratio">P/B</Th>
                  <Th k="debt_equity">LT D/E</Th>
                  <Th k="roe">ROE</Th>
                  <Th k="revenue">Revenue</Th>
                  <Th k="net_income">Net income</Th>
                  <Th k="overall_score">Score</Th>
                  <th className="px-2.5 py-2 text-right">FY</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const sym = r.symbol.toUpperCase();
                  const chg = r.change_pct != null ? Number(r.change_pct) : null;
                  return (
                    <tr
                      key={sym}
                      className="border-t border-[var(--dsa-border)] odd:bg-[var(--dsa-surface-1)] even:bg-[rgba(255,255,255,0.012)] hover:bg-[var(--dsa-surface-2)]"
                    >
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[var(--dsa-text-muted)]">{i + 1}</td>
                      <td className="px-2.5 py-2">
                        <Link
                          href={`/companies/profile/${encodeURIComponent(sym.toLowerCase())}`}
                          className="font-mono font-semibold text-[#8ab4ff] hover:underline"
                        >
                          {sym}
                        </Link>
                        <div className="max-w-[200px] truncate text-[10px] text-[var(--dsa-text-muted)]">{r.company_name}</div>
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                        {r.price != null ? Number(r.price).toFixed(2) : "—"}
                      </td>
                      <td
                        className={`px-2.5 py-2 text-right font-mono tabular-nums ${
                          chg != null && chg > 0
                            ? "dsa-data-positive"
                            : chg != null && chg < 0
                              ? "dsa-data-negative"
                              : "dsa-data-muted"
                        }`}
                      >
                        {chg != null ? `${chg > 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                        {r.pe_ratio != null ? Number(r.pe_ratio).toFixed(1) : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                        {r.pb_ratio != null ? Number(r.pb_ratio).toFixed(2) : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">
                        {r.debt_equity != null ? Number(r.debt_equity).toFixed(2) : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">{fmtPctRatio(r.roe)}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">{fmtB(r.revenue)}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums">{fmtB(r.net_income)}</td>
                      <td className="px-2.5 py-2 text-right font-mono tabular-nums text-[#8ab4ff]">
                        {r.overall_score != null ? Number(r.overall_score).toFixed(1) : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono text-[10px] text-[var(--dsa-text-muted)]">
                        {r.fiscal_year ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-3 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
          P/E = price ÷ diluted EPS. P/B = market cap ÷ equity. LT D/E and ROE use available SEC annual filing data.
          Missing fundamental fields remain unavailable and are not replaced with zero.
        </p>
      </div>
    </div>
  );
}
