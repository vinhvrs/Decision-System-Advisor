"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FundamentalsService } from "@/src/services/Fundamentals.service";

export type FundamentalChartKind = "line" | "bar";

function toFiniteNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

type AnnualRow = {
  fiscal_year: number;
  revenue?: number | null;
  net_income?: number | null;
  fcf?: number | null;
  gross_margin?: number | null;
  roe?: number | null;
  debt_equity?: number | null;
  current_ratio?: number | null;
  asset_turnover?: number | null;
};

type ScoreRow = {
  growth_score?: number | null;
  profitability_score?: number | null;
  balance_sheet_score?: number | null;
  cash_flow_score?: number | null;
  capital_efficiency_score?: number | null;
  overall_score?: number | null;
  meta?: Record<string, unknown> | null;
};

function fmtB(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toFixed(0);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function MiniFundamentalChart({
  title,
  data,
  dataKey,
  valueFmt,
  chartKind,
}: {
  title: string;
  data: AnnualRow[];
  dataKey: keyof AnnualRow;
  valueFmt: (v: number | null | undefined) => string;
  chartKind: FundamentalChartKind;
}) {
  const pts = useMemo(() => {
    const rows = [...data].sort((a, b) => Number(a.fiscal_year) - Number(b.fiscal_year));
    return rows
      .map((r) => {
        const fy = Number(r.fiscal_year);
        const v = toFiniteNumber(r[dataKey]);
        return { fy: Number.isFinite(fy) ? fy : 0, v };
      })
      .filter((p) => p.v != null);
  }, [data, dataKey]);

  const chartMargin = { top: 8, right: 8, left: 0, bottom: 0 };

  return (
    <div className="rounded-xl border border-[#2b3139] bg-[#1e2329] p-4">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#848e9c]">{title}</h4>
      {pts.length === 0 ? (
        <p className="text-xs text-[#848e9c]">No data for this metric in the loaded window.</p>
      ) : (
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartKind === "bar" ? (
              <BarChart data={pts} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
                <XAxis dataKey="fy" tick={{ fill: "#848e9c", fontSize: 10 }} />
                <YAxis
                  width={44}
                  tick={{ fill: "#848e9c", fontSize: 10 }}
                  tickFormatter={(v) => valueFmt(v as number)}
                />
                <Tooltip
                  contentStyle={{ background: "#0b0e11", border: "1px solid #2b3139", borderRadius: 8 }}
                  labelStyle={{ color: "#eaecef" }}
                  formatter={(v: number | undefined) => [valueFmt(v), title]}
                />
                <Bar dataKey="v" fill="#3861fb" radius={[3, 3, 0, 0]} maxBarSize={48} />
              </BarChart>
            ) : (
              <LineChart data={pts} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2b3139" />
                <XAxis dataKey="fy" tick={{ fill: "#848e9c", fontSize: 10 }} />
                <YAxis
                  width={44}
                  tick={{ fill: "#848e9c", fontSize: 10 }}
                  tickFormatter={(v) => valueFmt(v as number)}
                />
                <Tooltip
                  contentStyle={{ background: "#0b0e11", border: "1px solid #2b3139", borderRadius: 8 }}
                  labelStyle={{ color: "#eaecef" }}
                  formatter={(v: number | undefined) => [valueFmt(v), title]}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke="#3861fb"
                  strokeWidth={2}
                  dot={pts.length <= 8}
                  connectNulls
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function FundamentalSection({ symbol }: { symbol: string }) {
  const [annual, setAnnual] = useState<AnnualRow[]>([]);
  const [score, setScore] = useState<ScoreRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [chartKind, setChartKind] = useState<FundamentalChartKind>("line");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [aRes, sRes] = await Promise.all([
        FundamentalsService.annual(symbol, 20).catch(() => ({ data: [] as AnnualRow[] })),
        FundamentalsService.score(symbol),
      ]);
      const raw = (aRes as { data?: unknown }).data;
      const rows = Array.isArray(raw) ? (raw as AnnualRow[]) : [];
      setAnnual(rows);
      const sd = (sRes as { data?: ScoreRow | null })?.data ?? null;
      setScore(sd);
    } catch {
      setErr("Could not load fundamentals.");
      setAnnual([]);
      setScore(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void load();
  }, [load]);

  const scoreCards = useMemo(
    () => [
      { label: "Growth", v: score?.growth_score },
      { label: "Profitability", v: score?.profitability_score },
      { label: "Balance sheet", v: score?.balance_sheet_score },
      { label: "Cash flow", v: score?.cash_flow_score },
      { label: "Capital efficiency", v: score?.capital_efficiency_score },
      { label: "Overall", v: score?.overall_score, bold: true },
    ],
    [score],
  );

  if (loading) {
    return (
      <div className={`rounded-xl border border-[#2b3139] bg-[#1e2329] p-8 text-center text-sm text-[#848e9c]`}>
        Loading fundamentals…
      </div>
    );
  }

  if (err) {
    return (
      <div className={`rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200`}>{err}</div>
    );
  }

  if (!annual.length) {
    return (
      <div className={`rounded-xl border border-[#2b3139] bg-[#1e2329] p-8 text-center text-sm text-[#848e9c]`}>
        No SEC fundamental data for <span className="font-mono text-white">{symbol}</span> yet. Run the Python ingest
        job (`python fundamental_ingest.py` from <span className="font-mono">python_engine</span>) after migrating the
        database.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className={`text-xs leading-relaxed text-[#848e9c]`}>
        Annual and quarterly metrics are derived from SEC XBRL company facts (US-GAAP tags with aliases). Scores are
        heuristic summaries for orientation only — not investment advice.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="fundamental-chart-kind" className="text-xs font-semibold text-[#848e9c]">
          Chart type
        </label>
        <select
          id="fundamental-chart-kind"
          value={chartKind}
          onChange={(e) => setChartKind(e.target.value as FundamentalChartKind)}
          className="dsa-select"
        >
          <option value="line">Line chart</option>
          <option value="bar">Bar chart</option>
        </select>
      </div>

      {score ? (
        <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 laptop:grid-cols-6">
          {scoreCards.map((c) => (
            <div
              key={c.label}
              className={`rounded-xl border border-[#2b3139] bg-[#1e2329] p-3 ${c.bold ? "ring-1 ring-[#3861fb]/40" : ""}`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-wide text-[#848e9c]`}>{c.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums text-white ${c.bold ? "text-[#7b9cff]" : ""}`}>
                {c.v != null && Number.isFinite(Number(c.v)) ? Number(c.v).toFixed(1) : "—"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className={`text-xs text-[#848e9c]`}>Fundamental scores not available yet for this symbol.</p>
      )}

      <div className="grid grid-cols-1 gap-4 laptop:grid-cols-2">
        <MiniFundamentalChart
          title="Revenue"
          data={annual}
          dataKey="revenue"
          valueFmt={(v) => fmtB(v)}
          chartKind={chartKind}
        />
        <MiniFundamentalChart
          title="Net income"
          data={annual}
          dataKey="net_income"
          valueFmt={(v) => fmtB(v)}
          chartKind={chartKind}
        />
        <MiniFundamentalChart
          title="Free cash flow"
          data={annual}
          dataKey="fcf"
          valueFmt={(v) => fmtB(v)}
          chartKind={chartKind}
        />
        <MiniFundamentalChart
          title="Gross margin"
          data={annual}
          dataKey="gross_margin"
          valueFmt={(v) => fmtPct(v)}
          chartKind={chartKind}
        />
        <MiniFundamentalChart title="ROE" data={annual} dataKey="roe" valueFmt={(v) => fmtPct(v)} chartKind={chartKind} />
        <MiniFundamentalChart
          title="Debt / equity"
          data={annual}
          dataKey="debt_equity"
          valueFmt={(v) => (v == null ? "—" : Number(v).toFixed(2))}
          chartKind={chartKind}
        />
        <MiniFundamentalChart
          title="Current ratio"
          data={annual}
          dataKey="current_ratio"
          valueFmt={(v) => (v == null ? "—" : Number(v).toFixed(2))}
          chartKind={chartKind}
        />
        <MiniFundamentalChart
          title="Asset turnover"
          data={annual}
          dataKey="asset_turnover"
          valueFmt={(v) => (v == null ? "—" : Number(v).toFixed(2))}
          chartKind={chartKind}
        />
      </div>
    </div>
  );
}
