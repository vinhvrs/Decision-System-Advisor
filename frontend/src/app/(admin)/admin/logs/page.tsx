"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { RefreshCw, Terminal, Activity, AlertTriangle, FileText } from "lucide-react";

type MainTab = "activity" | "laravel" | "raw";

type RawTab = "php" | "python" | "frontend";

type LogPayload = {
  php: string;
  python: string;
  frontend: string;
  paths?: Record<string, string>;
  readable?: Record<string, boolean>;
  truncated_bytes?: number;
};

type LaravelEntry = {
  at: string | null;
  env: string | null;
  level: string;
  message: string;
  raw: string;
};

type ActivityRow = {
  id: string;
  level: string;
  channel: string;
  message: string;
  context?: Record<string, unknown> | null;
  ip_address?: string | null;
  created_at: string;
  user?: { id: string; name?: string; email?: string; username?: string } | null;
};

function levelStyle(level: string): string {
  const u = level.toUpperCase();
  if (u === "ERROR" || u === "CRITICAL" || u === "ALERT" || u === "EMERGENCY") {
    return "bg-red-500/20 text-red-200 border-red-500/40";
  }
  if (u === "WARNING" || u === "NOTICE") {
    return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  }
  if (u === "ACTION") {
    return "bg-blue-500/20 text-blue-200 border-blue-500/40";
  }
  return "bg-white/10 text-white/80 border-white/15";
}

export default function AdminLogsPage() {
  const [mainTab, setMainTab] = useState<MainTab>("activity");
  const [rawTab, setRawTab] = useState<RawTab>("php");

  const [rawPayload, setRawPayload] = useState<LogPayload | null>(null);
  const [laravelData, setLaravelData] = useState<{
    entries: LaravelEntry[];
    path?: string;
    truncated_bytes?: number;
  } | null>(null);
  const [laravelLevels, setLaravelLevels] = useState<string>("ERROR,WARNING,CRITICAL");

  const [activityRows, setActivityRows] = useState<ActivityRow[]>([]);
  const [activityMeta, setActivityMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [activityLevel, setActivityLevel] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const activityLevelRef = useRef(activityLevel);
  const activitySearchRef = useRef(activitySearch);
  activityLevelRef.current = activityLevel;
  activitySearchRef.current = activitySearch;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRaw = useCallback(async () => {
    const data = (await AdminService.logs.tail()) as LogPayload;
    setRawPayload(data);
  }, []);

  const loadLaravel = useCallback(async () => {
    const data = (await AdminService.logs.laravelEntries({
      levels: laravelLevels.trim() || undefined,
      limit: 500,
    })) as { entries?: LaravelEntry[]; path?: string; truncated_bytes?: number };
    setLaravelData({
      entries: data.entries ?? [],
      path: data.path,
      truncated_bytes: data.truncated_bytes,
    });
  }, [laravelLevels]);

  const loadActivity = useCallback(async (page = 1) => {
    const res = (await AdminService.logs.activity({
      page,
      per_page: 20,
      level: activityLevelRef.current || undefined,
      search: activitySearchRef.current.trim() || undefined,
    })) as {
      data?: ActivityRow[];
      current_page?: number;
      last_page?: number;
      total?: number;
    };
    setActivityRows(res.data ?? []);
    setActivityMeta({
      current_page: res.current_page ?? 1,
      last_page: res.last_page ?? 1,
      total: res.total ?? 0,
    });
  }, []);

  const activityPageRef = useRef(1);
  activityPageRef.current = activityMeta.current_page;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (mainTab === "raw") await loadRaw();
      if (mainTab === "laravel") await loadLaravel();
      if (mainTab === "activity") await loadActivity(activityPageRef.current);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, [mainTab, loadRaw, loadLaravel, loadActivity]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (mainTab === "raw") await loadRaw();
        else if (mainTab === "laravel") await loadLaravel();
        else await loadActivity(1);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load logs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mainTab, loadRaw, loadLaravel, loadActivity]);

  const rawText =
    rawPayload == null
      ? ""
      : rawTab === "php"
        ? rawPayload.php
        : rawTab === "python"
          ? rawPayload.python
          : rawPayload.frontend;

  const rawPath = rawPayload?.paths?.[rawTab] ?? "";
  const rawOk = rawPayload?.readable?.[rawTab] ?? false;

  return (
    <div className="max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Terminal className="text-blue-400" size={28} />
            Logs &amp; activity
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Admin actions (mutating API calls), parsed Laravel levels (warning / error / …), and raw service tails.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {(
          [
            ["activity", "User & admin actions", Activity],
            ["laravel", "Laravel log (levels)", AlertTriangle],
            ["raw", "Raw service logs", FileText],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMainTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mainTab === id ? "bg-blue-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

      {mainTab === "activity" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-white/50">Level</label>
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                <option value="">All</option>
                <option value="action">action</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-[11px] font-medium text-white/50">Search message</label>
              <input
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="e.g. email/send"
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
            </div>
            <button
              type="button"
              onClick={() => loadActivity(1)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Apply
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 bg-black/30 text-[11px] uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activityRows.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-white/70">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${levelStyle(row.level)}`}
                      >
                        {row.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-white/80">
                      {row.user?.email || row.user?.name || "—"}
                    </td>
                    <td className="max-w-md px-3 py-2">
                      <div className="font-mono text-xs text-emerald-100/90">{row.message}</div>
                      {row.context && Object.keys(row.context).length > 0 ? (
                        <pre className="mt-1 max-h-24 overflow-auto text-[10px] text-white/40">
                          {JSON.stringify(row.context, null, 0)}
                        </pre>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-white/50">
                      {row.ip_address ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
            <span>
              Page {activityMeta.current_page} / {activityMeta.last_page} · {activityMeta.total} rows
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={activityMeta.current_page <= 1}
                onClick={() => loadActivity(activityMeta.current_page - 1)}
                className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={activityMeta.current_page >= activityMeta.last_page}
                onClick={() => loadActivity(activityMeta.current_page + 1)}
                className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {mainTab === "laravel" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="mb-1 block text-[11px] font-medium text-white/50">
              Levels (comma-separated, empty = all)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                value={laravelLevels}
                onChange={(e) => setLaravelLevels(e.target.value)}
                className="min-w-[240px] flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                placeholder="ERROR,WARNING,CRITICAL"
              />
              <button
                type="button"
                onClick={() => loadLaravel()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Reload
              </button>
            </div>
            {laravelData?.path ? (
              <p className="mt-2 font-mono text-[11px] text-white/40 break-all">{laravelData.path}</p>
            ) : null}
          </div>

          <div className="max-h-[min(72vh,720px)] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-3">
            {(laravelData?.entries ?? []).length === 0 ? (
              <p className="text-sm text-white/45">No matching log lines in the last ~{laravelData?.truncated_bytes ?? "—"} bytes.</p>
            ) : (
              (laravelData?.entries ?? []).map((e, i) => (
                <div
                  key={`${e.at}-${i}`}
                  className="rounded-lg border border-white/10 bg-[#0b1220]/80 p-3 text-sm"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-white/50">{e.at}</span>
                    <span
                      className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${levelStyle(e.level)}`}
                    >
                      {e.level}
                    </span>
                    {e.env ? <span className="text-[10px] text-white/40">{e.env}</span> : null}
                  </div>
                  <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-emerald-100/85">
                    {e.message}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {mainTab === "raw" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {(
              [
                ["php", "PHP (Laravel)"],
                ["python", "Python engine"],
                ["frontend", "Frontend"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRawTab(id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  rawTab === id ? "bg-blue-600 text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {rawPath ? (
            <p className="mb-2 font-mono text-[11px] text-white/45 break-all">
              {rawOk ? "" : "⚠ "}
              {rawPath}
            </p>
          ) : null}

          <pre
            className="max-h-[min(70vh,720px)] overflow-auto rounded-xl border border-white/10 bg-black/50 p-4 text-[11px] leading-relaxed text-emerald-100/90 whitespace-pre-wrap break-words"
            aria-live="polite"
          >
            {loading && !rawPayload ? "Loading…" : rawText || "(no output)"}
          </pre>
          <p className="mt-2 text-[11px] text-white/40">
            Tail ~{rawPayload?.truncated_bytes ?? 120000} bytes. Override with{" "}
            <code className="rounded bg-black/40 px-1">ADMIN_LOG_MAX_BYTES</code>.
          </p>
        </>
      )}
    </div>
  );
}
