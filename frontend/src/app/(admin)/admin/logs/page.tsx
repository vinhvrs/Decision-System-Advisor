"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { RefreshCw, Activity, AlertTriangle, FileText } from "lucide-react";

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
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="min-w-0">
          <p className="dsa-section-label">Operations</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">Logs & activity</h1>
          <p className="mt-0.5 max-w-3xl truncate text-[10px] text-[var(--dsa-text-muted)]">
            Admin actions, Laravel levels, and raw service tails.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading}
          className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[11px]"
        >
          <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          Refresh
        </button>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div className="flex min-w-0 flex-wrap gap-1">
            {(
              [
                ["activity", "Activity", Activity],
                ["laravel", "Laravel", AlertTriangle],
                ["raw", "Raw logs", FileText],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMainTab(id)}
                className={`inline-flex min-h-7 items-center gap-1.5 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] transition-colors ${
                  mainTab === id
                    ? "border-[rgba(76,141,255,0.4)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                    : "border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                }`}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
            {mainTab === "activity"
              ? `${activityMeta.total} rows`
              : mainTab === "laravel"
                ? `${laravelData?.entries?.length ?? 0} entries`
                : rawOk
                  ? "Readable"
                  : "Unavailable"}
          </div>
        </div>

        {error ? (
          <div className="border-b border-[rgba(231,91,100,0.28)] bg-[rgba(231,91,100,0.08)] px-3 py-2 text-[11px] text-[var(--dsa-negative)]">
            {error}
          </div>
        ) : null}

        {mainTab === "activity" && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dsa-border)] bg-[#0b1118] px-3 py-2">
              <select
                value={activityLevel}
                onChange={(e) => setActivityLevel(e.target.value)}
                className="dsa-control h-7 min-h-0 px-2 text-[11px] outline-none"
              >
                <option value="">All levels</option>
                <option value="action">action</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="error">error</option>
              </select>
              <input
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                placeholder="Filter message"
                className="dsa-control h-7 min-h-0 w-[260px] max-w-[55vw] px-2.5 text-[11px] outline-none"
              />
              <button
                type="button"
                onClick={() => loadActivity(1)}
                className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
              >
                Apply
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="dsa-terminal-table min-w-[820px]">
                <thead>
                  <tr>
                    <th className="text-left">When</th>
                    <th className="text-left">Level</th>
                    <th className="text-left">User</th>
                    <th className="text-left">Message</th>
                    <th className="text-left">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap font-mono text-[10px] text-[var(--dsa-text-muted)]">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td>
                        <span className={`rounded-[var(--dsa-radius-sm)] border px-1.5 py-0.5 text-[9px] font-bold uppercase ${levelStyle(row.level)}`}>
                          {row.level}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate text-[var(--dsa-text-secondary)]">
                        {row.user?.email || row.user?.name || "—"}
                      </td>
                      <td className="max-w-[520px]">
                        <div className="truncate font-mono text-[11px] text-[#b9e2cf]">{row.message}</div>
                        {row.context && Object.keys(row.context).length > 0 ? (
                          <pre className="mt-1 max-h-16 overflow-auto whitespace-pre-wrap text-[9px] text-[var(--dsa-text-muted)]">
                            {JSON.stringify(row.context, null, 0)}
                          </pre>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap font-mono text-[10px] text-[var(--dsa-text-muted)]">
                        {row.ip_address ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--dsa-border)] px-3 py-2">
              <span className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
                {activityMeta.current_page}/{activityMeta.last_page} · {activityMeta.total} rows
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  disabled={activityMeta.current_page <= 1}
                  onClick={() => loadActivity(activityMeta.current_page - 1)}
                  className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={activityMeta.current_page >= activityMeta.last_page}
                  onClick={() => loadActivity(activityMeta.current_page + 1)}
                  className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}

        {mainTab === "laravel" && (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dsa-border)] bg-[#0b1118] px-3 py-2">
              <input
                value={laravelLevels}
                onChange={(e) => setLaravelLevels(e.target.value)}
                className="dsa-control h-7 min-h-0 w-[320px] max-w-[65vw] px-2.5 font-mono text-[11px] outline-none"
                placeholder="ERROR,WARNING,CRITICAL"
              />
              <button
                type="button"
                onClick={() => loadLaravel()}
                className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
              >
                Reload
              </button>
              {laravelData?.path ? (
                <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-[var(--dsa-text-muted)]" title={laravelData.path}>
                  {laravelData.path}
                </span>
              ) : null}
            </div>

            <div className="max-h-[min(72vh,720px)] divide-y divide-[var(--dsa-border)] overflow-y-auto">
              {(laravelData?.entries ?? []).length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-[var(--dsa-text-muted)]">
                  No matching log lines in the last ~{laravelData?.truncated_bytes ?? "—"} bytes.
                </p>
              ) : (
                (laravelData?.entries ?? []).map((entry, i) => (
                  <div key={`${entry.at}-${i}`} className="px-3 py-2.5 hover:bg-[var(--dsa-surface-2)]">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[9px] text-[var(--dsa-text-muted)]">{entry.at}</span>
                      <span className={`rounded-[var(--dsa-radius-sm)] border px-1.5 py-0.5 text-[9px] font-bold uppercase ${levelStyle(entry.level)}`}>
                        {entry.level}
                      </span>
                      {entry.env ? <span className="text-[9px] text-[var(--dsa-text-muted)]">{entry.env}</span> : null}
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#b9e2cf]">
                      {entry.message}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {mainTab === "raw" && (
          <>
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--dsa-border)] bg-[#0b1118] px-3 py-2">
              {(
                [
                  ["php", "PHP"],
                  ["python", "Python"],
                  ["frontend", "Frontend"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRawTab(id)}
                  className={`min-h-7 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                    rawTab === id
                      ? "border-[rgba(76,141,255,0.4)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                      : "border-[var(--dsa-border)] text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
              {rawPath ? (
                <span className="ml-2 min-w-0 flex-1 truncate font-mono text-[9px] text-[var(--dsa-text-muted)]" title={rawPath}>
                  {rawOk ? "" : "⚠ "}{rawPath}
                </span>
              ) : null}
            </div>

            <pre
              className="max-h-[min(72vh,720px)] overflow-auto whitespace-pre-wrap break-words bg-[#070b0f] p-3 font-mono text-[10px] leading-relaxed text-[#b9e2cf]"
              aria-live="polite"
            >
              {loading && !rawPayload ? "Loading…" : rawText || "(no output)"}
            </pre>
            <p className="border-t border-[var(--dsa-border)] px-3 py-2 font-mono text-[9px] text-[var(--dsa-text-muted)]">
              Tail ~{rawPayload?.truncated_bytes ?? 120000} bytes · ADMIN_LOG_MAX_BYTES controls the limit.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
