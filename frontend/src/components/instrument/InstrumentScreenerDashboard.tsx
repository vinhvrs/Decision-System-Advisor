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

export function InstrumentScreenerDashboard() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("symbol");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("asc");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await InstrumentScreenerService.getTechScreener();
      if (!data?.rows?.length) {
        setErr("Could not load screener. Check API /fundamentals/screener.");
        setRows([]);
        return;
      }
      setRows(data.rows);
      setUpdatedAt(data.updated_at ?? null);
      const hasFundamentals = data.rows.some(
        (r) => r.fiscal_year != null || r.revenue != null || r.net_income != null
      );
      setErr(
        hasFundamentals
          ? null
          : "Market rows loaded; SEC fundamentals missing. Run: docker exec dsa-data-engine python3 -m app.pipeline.fundamental_ingest"
      );
    } catch {
      setErr("Could not load screener.");
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

  const Th = ({ k, children }: { k: SortKey; children: ReactNode }) => (
    <th className="px-3 py-2.5 text-left">
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className="inline-flex items-center gap-1 font-semibold text-[#b7bdc6] hover:text-white"
      >
        {children}
        {sortKey === k ? <span className="text-[#7b9cff]">{sortDir === "desc" ? "↓" : "↑"}</span> : null}
      </button>
    </th>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-16 text-center text-sm text-[#848e9c] phone:px-6">
        Loading US tech screener…
      </div>
    );
  }

  if (err) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 py-12 text-sm text-red-300 phone:px-6">
        {err}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-3 rounded-lg border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <div className="border-b border-white/10 bg-gradient-to-r from-[#0b1220] via-[#111827] to-[#0b1220]">
        <div className="mx-auto max-w-[1400px] px-4 py-10 phone:px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#7b9cff]">Instruments</p>
          <h1 className="mt-2 text-3xl font-bold phone:text-4xl">US tech screener</h1>
          <p className="mt-3 max-w-3xl text-sm text-white/65">
            Fixed universe of {SCREENER_TECH_SYMBOLS.length} symbols — market snapshot plus SEC fundamentals.
          </p>
          <p className="mt-2 font-mono text-xs text-white/45">{SCREENER_TECH_SYMBOLS.join(" · ")}</p>
          {updatedAt ? (
            <p className="mt-2 text-xs text-white/45">Updated {new Date(updatedAt).toLocaleString()}</p>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-8 phone:px-6">
        <section className="overflow-hidden rounded-xl border border-[#2b3139] bg-[#131722]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b3139] px-4 py-3">
            <p className="text-sm text-[#848e9c]">
              <span className="font-mono font-semibold text-white">{sorted.length}</span> symbols
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-[#3861fb]/50 px-3 py-1.5 text-xs text-[#7b9cff] hover:bg-[#3861fb]/10"
            >
              Refresh
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead className="bg-[#1a1f2e] text-xs uppercase tracking-wide text-[#848e9c]">
                <tr>
                  <th className="px-3 py-2.5 text-left">#</th>
                  <Th k="symbol">Symbol</Th>
                  <Th k="price">Price</Th>
                  <Th k="change_pct">24h %</Th>
                  <Th k="pe_ratio">P/E</Th>
                  <Th k="pb_ratio">P/B</Th>
                  <Th k="debt_equity">LT D/E</Th>
                  <Th k="roe">ROE</Th>
                  <Th k="revenue">Revenue</Th>
                  <Th k="net_income">Net income</Th>
                  <Th k="overall_score">Score</Th>
                  <th className="px-3 py-2.5 text-left">FY</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const sym = r.symbol.toUpperCase();
                  const chg = r.change_pct != null ? Number(r.change_pct) : null;
                  return (
                    <tr key={sym} className="border-t border-[#2b3139] odd:bg-[#131722] even:bg-[#0f141c]">
                      <td className="px-3 py-2.5 text-[#5e6673]">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/companies/profile/${encodeURIComponent(sym.toLowerCase())}`}
                          className="font-mono font-semibold text-[#7b9cff] hover:underline"
                        >
                          {sym}
                        </Link>
                        <div className="max-w-[200px] truncate text-xs text-[#848e9c]">{r.company_name}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {r.price != null ? Number(r.price).toFixed(2) : "—"}
                      </td>
                      <td
                        className={`px-3 py-2.5 font-mono tabular-nums ${
                          chg != null && chg > 0
                            ? "text-emerald-400"
                            : chg != null && chg < 0
                              ? "text-rose-400"
                              : "text-[#848e9c]"
                        }`}
                      >
                        {chg != null ? `${chg > 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {r.pe_ratio != null ? Number(r.pe_ratio).toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {r.pb_ratio != null ? Number(r.pb_ratio).toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">
                        {r.debt_equity != null ? Number(r.debt_equity).toFixed(2) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">{fmtPctRatio(r.roe)}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">{fmtB(r.revenue)}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums">{fmtB(r.net_income)}</td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-[#7b9cff]">
                        {r.overall_score != null ? Number(r.overall_score).toFixed(1) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#848e9c]">{r.fiscal_year ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <p className="mt-4 text-center text-xs text-[#5e6673]">
          P/E: price ÷ diluted EPS. P/B: market cap ÷ equity. LT D/E and ROE from SEC annual filings.
        </p>
      </div>
    </div>
  );
}
