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
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-2">Fill Data</h1>
      <p className="text-white/60 text-sm mb-6">
        Trigger python_engine backfill jobs (market OHLC, demo board, news history). Jobs run in the
        background — follow progress under{" "}
        <Link href="/admin/logs" className="text-blue-400 hover:underline">
          Logs &amp; activity
        </Link>
        .
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/60">
          <Loader2 className="animate-spin" size={18} />
          Loading catalog…
        </div>
      ) : (
        <>
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-start gap-3 ${
              catalog?.engine_online
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/30 bg-amber-500/10 text-amber-100"
            }`}
          >
            <Database size={18} className="shrink-0 mt-0.5" />
            <div>
              {catalog?.engine_online ? (
                <p>Python engine is reachable.</p>
              ) : (
                <p>
                  Python engine offline or not configured.
                  {catalog?.engine_error ? ` ${catalog.engine_error}` : ""}
                  {catalog?.engine_error?.includes("127.0.0.1") ? (
                    <>
                      {" "}
                      If Laravel runs in Docker, set{" "}
                      <code className="text-xs bg-black/30 px-1 rounded">PYTHON_ENGINE_URL=http://data-engine:8000</code>{" "}
                      in <code className="text-xs bg-black/30 px-1 rounded">backend/.env</code>, then{" "}
                      <code className="text-xs bg-black/30 px-1 rounded">docker compose restart data-engine app</code>.
                    </>
                  ) : (
                    <>
                      {" "}
                      Set <code className="text-xs bg-black/30 px-1 rounded">PYTHON_ENGINE_URL</code> and{" "}
                      <code className="text-xs bg-black/30 px-1 rounded">ENGINE_INTERNAL_TRIGGER_SECRET</code> in{" "}
                      <code className="text-xs bg-black/30 px-1 rounded">backend/.env</code>.
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          <label className="block text-sm text-white/70 mb-2">Job</label>
          <select
            value={jobId}
            onChange={(e) => {
              setJobId(e.target.value);
              setFields({});
              setMessage(null);
              setError(null);
            }}
            className="w-full mb-4 rounded-lg bg-[#161D2C] border border-white/10 px-4 py-2.5 text-white"
          >
            {(catalog?.jobs ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </select>

          {selectedJob ? (
            <div className="mb-6 p-4 rounded-xl bg-[#161D2C] border border-white/10">
              <p className="text-sm text-white/80 mb-2">{selectedJob.description}</p>
              {selectedJob.module ? (
                <p className="text-xs text-white/40 font-mono mb-4">{selectedJob.module}</p>
              ) : null}

              {(selectedJob.params ?? []).map((param) => (
                <div key={param.name} className="mb-3">
                  <label className="block text-xs text-white/60 mb-1">
                    {param.name}
                    {param.required ? " *" : ""}
                    {param.default !== undefined ? ` (default: ${param.default})` : ""}
                  </label>
                  <input
                    type={param.type === "integer" ? "number" : "text"}
                    value={fields[param.name] ?? ""}
                    placeholder={
                      param.default !== undefined ? String(param.default) : param.optional ? "optional" : ""
                    }
                    min={param.min}
                    max={param.max}
                    onChange={(e) => setFields((prev) => ({ ...prev, [param.name]: e.target.value }))}
                    className="w-full rounded-lg bg-[#0b1220] border border-white/10 px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            disabled={running || !catalog?.engine_online}
            onClick={() => void handleRun()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {running ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
            Run backfill
          </button>

          {message ? (
            <p className="mt-4 text-sm text-emerald-300 flex items-center gap-2">
              <Terminal size={16} />
              {message}
            </p>
          ) : null}
          {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        </>
      )}
    </div>
  );
}
