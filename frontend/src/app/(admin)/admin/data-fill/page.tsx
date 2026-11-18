"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminService } from "@/src/services/Admin.service";
import { Database, Loader2, Play, Terminal } from "lucide-react";

type JobParam = {
  name: string;
  type: string;
  required?: boolean;
  optional?: boolean;
  default?: number | string;
  min?: number;
  max?: number;
};

type BackfillJob = {
  id: string;
  label: string;
  description: string;
  module?: string;
  params?: JobParam[];
};

type CatalogResponse = {
  engine_online?: boolean;
  engine_error?: string;
  jobs?: BackfillJob[];
};

const DEFAULTS: Record<string, Record<string, string | number>> = {
  market_symbol: { backfill_days: 30 },
  demo_board_refill: { backfill_days: 30 },
  demo_sync_all: { history_period: "7d", backfill_days: 30 },
  news_backfill: { limit_year: 2018 },
  market_symbol_demo: { backfill_days: 365 },
};

export default function AdminDataFillPage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobId, setJobId] = useState("market_symbol");
  const [fields, setFields] = useState<Record<string, string>>({ symbol: "NVDA" });
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await AdminService.dataBackfill.catalog()) as CatalogResponse;
      setCatalog(data);
    } catch (e) {
      console.error(e);
      setCatalog(null);
      setError("Could not load job catalog from API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const selectedJob = catalog?.jobs?.find((j) => j.id === jobId);

  const handleRun = async () => {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const payload: Record<string, string | number> = { job: jobId };
      for (const [key, val] of Object.entries(fields)) {
        const trimmed = val.trim();
        if (!trimmed) continue;
        if (key === "symbol" || key === "history_period") {
          payload[key] = trimmed;
        } else {
          payload[key] = Number(trimmed);
        }
      }

      const defaults = DEFAULTS[jobId] ?? {};
      for (const [key, val] of Object.entries(defaults)) {
        if (payload[key] === undefined) payload[key] = val;
      }

      const res = await AdminService.dataBackfill.run(payload as Parameters<typeof AdminService.dataBackfill.run>[0]);
      const body = res as { data?: { message?: string }; message?: string };
      setMessage(body?.data?.message ?? body?.message ?? "Job accepted by python_engine.");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? "Failed to start backfill job.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <p className="dsa-section-label">Data operations</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">Fill data / backfill</h1>
          <p className="mt-0.5 max-w-3xl truncate text-[10px] text-[var(--dsa-text-muted)]">
            Trigger python_engine market, demo-board, and news-history jobs.
          </p>
        </div>
        <Link
          href="/admin/logs"
          className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
        >
          <Terminal size={12} />
          Logs
        </Link>
      </section>

      {loading ? (
        <section className="dsa-terminal-panel flex min-h-32 items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
          <Loader2 className="animate-spin" size={15} />
          Loading job catalog…
        </section>
      ) : (
        <>
          <section className="grid gap-px overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-border)] phone:grid-cols-2 laptop:grid-cols-4">
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">Engine</p>
              <p className={`mt-1 text-xs font-medium ${catalog?.engine_online ? "text-[var(--dsa-positive)]" : "text-[var(--dsa-warning)]"}`}>
                {catalog?.engine_online ? "Online" : "Unavailable"}
              </p>
            </div>
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">Jobs</p>
              <p className="mt-1 font-mono text-xs text-white">{catalog?.jobs?.length ?? 0}</p>
            </div>
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">Selected</p>
              <p className="mt-1 truncate font-mono text-[10px] text-[var(--dsa-text-secondary)]">{jobId}</p>
            </div>
            <div className="dsa-terminal-kpi">
              <p className="dsa-section-label">Execution</p>
              <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">{running ? "Submitting…" : "Manual trigger"}</p>
            </div>
          </section>

          {!catalog?.engine_online ? (
            <section className="dsa-terminal-panel border-[rgba(216,163,64,0.32)] bg-[rgba(216,163,64,0.06)] px-3 py-2 text-[10px] leading-relaxed text-[#d9bb7a]">
              <div className="flex items-start gap-2">
                <Database size={13} className="mt-0.5 shrink-0" />
                <div>
                  Python engine is offline or not configured.
                  {catalog?.engine_error ? <span className="ml-1 font-mono">{catalog.engine_error}</span> : null}
                </div>
              </div>
            </section>
          ) : null}

          <section className="dsa-terminal-panel overflow-hidden">
            <div className="dsa-terminal-panel-head">
              <div>
                <p className="text-xs font-semibold text-white">Backfill job</p>
                <p className="text-[10px] text-[var(--dsa-text-muted)]">Select a registered job and provide only the required parameters.</p>
              </div>
              <select
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setFields({});
                  setMessage(null);
                  setError(null);
                }}
                className="dsa-control h-7 min-h-0 max-w-[320px] px-2 text-[11px] outline-none"
              >
                {(catalog?.jobs ?? []).map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </select>
            </div>

            {selectedJob ? (
              <>
                <div className="border-b border-[var(--dsa-border)] px-3 py-2">
                  <p className="text-[11px] text-[var(--dsa-text-secondary)]">{selectedJob.description}</p>
                  {selectedJob.module ? (
                    <p className="mt-1 font-mono text-[9px] text-[var(--dsa-text-muted)]">{selectedJob.module}</p>
                  ) : null}
                </div>

                <div className="divide-y divide-[var(--dsa-border)]">
                  {(selectedJob.params ?? []).map((param) => (
                    <div
                      key={param.name}
                      className="grid gap-2 px-3 py-2.5 tablet:grid-cols-[190px_minmax(0,1fr)] tablet:items-center"
                    >
                      <div>
                        <p className="font-mono text-[10px] font-semibold text-white">
                          {param.name}{param.required ? " *" : ""}
                        </p>
                        <p className="mt-0.5 text-[9px] text-[var(--dsa-text-muted)]">
                          {param.type}
                          {param.default !== undefined ? ` · default ${param.default}` : ""}
                          {param.optional ? " · optional" : ""}
                        </p>
                      </div>
                      <input
                        type={param.type === "integer" ? "number" : "text"}
                        value={fields[param.name] ?? ""}
                        placeholder={param.default !== undefined ? String(param.default) : param.optional ? "optional" : ""}
                        min={param.min}
                        max={param.max}
                        onChange={(e) => setFields((prev) => ({ ...prev, [param.name]: e.target.value }))}
                        className="dsa-control h-8 min-h-0 max-w-xl px-2.5 font-mono text-[11px]"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--dsa-border)] bg-[#0b1118] px-3 py-2">
                  <div className="min-w-0">
                    {message ? (
                      <p className="truncate text-[10px] text-[var(--dsa-positive)]">{message}</p>
                    ) : error ? (
                      <p className="truncate text-[10px] text-[var(--dsa-negative)]">{error}</p>
                    ) : (
                      <p className="text-[9px] text-[var(--dsa-text-muted)]">Execution is submitted to python_engine.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={running || !catalog?.engine_online}
                    onClick={() => void handleRun()}
                    className="dsa-button-primary min-h-0 px-3 py-1.5 text-[10px] disabled:opacity-50"
                  >
                    {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    Run backfill
                  </button>
                </div>
              </>
            ) : (
              <p className="px-3 py-8 text-center text-xs text-[var(--dsa-text-muted)]">No job selected.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
