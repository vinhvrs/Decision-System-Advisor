"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3 } from "lucide-react";
import { FundamentalsService } from "@/src/services/Fundamentals.service";
import { useEffect, useMemo, useState } from "react";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL", "META", "AMZN", "IBM", "ORCL", "AVGO"] as const;

type ScoreLite = { overall_score?: number | null };

export default function FundamentalsHomePage() {
  const [scores, setScores] = useState<Record<string, number | null>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, number | null> = {};
      await Promise.all(
        SYMBOLS.map(async (symbol) => {
          try {
            const res = (await FundamentalsService.score(symbol)) as { data?: ScoreLite };
            const value = res?.data?.overall_score;
            next[symbol] = value != null && Number.isFinite(Number(value)) ? Number(value) : null;
          } catch {
            next[symbol] = null;
          }
        }),
      );
      if (!cancelled) setScores(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const coverage = useMemo(
    () => SYMBOLS.filter((symbol) => scores[symbol] != null).length,
    [scores],
  );

  const ranked = useMemo(
    () =>
      SYMBOLS.map((symbol) => ({ symbol, score: scores[symbol] ?? null })).sort((a, b) => {
        if (a.score == null && b.score == null) return a.symbol.localeCompare(b.symbol);
        if (a.score == null) return 1;
        if (b.score == null) return -1;
        return b.score - a.score;
      }),
    [scores],
  );

  return (
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
            <BarChart3 className="h-4 w-4 text-[#8ab4ff]" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="dsa-section-label">Fundamentals</p>
            <h1 className="mt-0.5 truncate text-sm font-semibold text-white">US technology fundamentals</h1>
          </div>
        </div>
        <div className="text-right">
          <p className="dsa-section-label">Coverage</p>
          <p className="mt-0.5 font-mono text-[10px] text-white">{coverage}/{SYMBOLS.length}</p>
        </div>
      </section>

      <section className="grid gap-px overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Universe</p>
          <p className="mt-1 font-mono text-xs text-white">{SYMBOLS.length} symbols</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Source</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">SEC company facts</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">History</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Annual XBRL metrics</p>
        </div>
        <div className="dsa-terminal-kpi">
          <p className="dsa-section-label">Profile link</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">Market + fundamentals</p>
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">Fundamental directory</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">
              Revenue, margins, cash flow, leverage, and orientation scores from SEC-derived history.
            </p>
          </div>
          <span className="text-[9px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
            Score ≠ investment recommendation
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="dsa-terminal-table min-w-[680px]">
            <thead>
              <tr>
                <th className="text-right">#</th>
                <th className="text-left">Symbol</th>
                <th className="text-right">Overall score</th>
                <th className="text-left">Dataset</th>
                <th className="text-right">Research</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, index) => (
                <tr key={row.symbol}>
                  <td className="text-right font-mono text-[10px] tabular-nums text-[var(--dsa-text-muted)]">{index + 1}</td>
                  <td>
                    <Link
                      href={`/fundamentals/${row.symbol.toLowerCase()}`}
                      className="font-mono text-xs font-semibold text-[#8ab4ff] hover:underline"
                    >
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="text-right">
                    <span className={`font-mono text-sm font-semibold tabular-nums ${row.score != null ? "text-white" : "text-[var(--dsa-text-muted)]"}`}>
                      {row.score != null ? row.score.toFixed(1) : "—"}
                    </span>
                  </td>
                  <td className="text-[10px] text-[var(--dsa-text-secondary)]">
                    Revenue · margins · cash flow · leverage
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/companies/profile/${row.symbol.toLowerCase()}?tab=fundamentals`}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#8ab4ff] hover:text-white"
                    >
                      Company profile
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="px-1 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
        Fundamental history is derived from SEC EDGAR company facts (XBRL). Missing scores remain unavailable and are not replaced with synthetic values.
      </p>
    </div>
  );
}
