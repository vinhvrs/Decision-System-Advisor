"use client";

import { Clock3, Database, Radio, ShieldCheck, TriangleAlert } from "lucide-react";

type ResearchTrustStripProps = {
  loadedCount: number;
  targetCount?: number;
  historyOk: number;
  historyShort?: number;
  historyMissing?: number;
  quoteObserved: number;
  quoteStale?: number;
  updatedAt?: string | null;
  sourceLabel: string;
  loading?: boolean;
  className?: string;
};

function formatAsOf(value?: string | null): string {
  if (!value) return "Awaiting snapshot";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function ResearchTrustStrip({
  loadedCount,
  targetCount = 40,
  historyOk,
  historyShort = 0,
  historyMissing = 0,
  quoteObserved,
  quoteStale = 0,
  updatedAt,
  sourceLabel,
  loading = false,
  className = "",
}: ResearchTrustStripProps) {
  const target = Math.max(targetCount, loadedCount);
  const historyComplete =
    !loading &&
    loadedCount > 0 &&
    historyOk === loadedCount &&
    historyShort === 0 &&
    historyMissing === 0;
  const scopeComplete = !loading && loadedCount >= targetCount;
  const ready = historyComplete && scopeComplete;
  const partial = !loading && loadedCount > 0 && !ready;

  return (
    <section
      aria-label="Market data status"
      className={[
        "overflow-x-auto border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]",
        "rounded-[var(--dsa-radius-sm)]",
        className,
      ].join(" ")}
    >
      <div className="flex min-w-max items-stretch divide-x divide-[var(--dsa-border)] text-[11px]">
        <div className="flex min-w-[138px] items-center gap-2 px-3 py-2">
          {ready ? (
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--dsa-positive)]" aria-hidden />
          ) : partial ? (
            <TriangleAlert className="h-3.5 w-3.5 text-[var(--dsa-warning)]" aria-hidden />
          ) : (
            <Clock3 className="h-3.5 w-3.5 text-[var(--dsa-text-muted)]" aria-hidden />
          )}
          <div>
            <p className="font-semibold text-[var(--dsa-text)]">
              {loading ? "Loading" : ready ? "Data ready" : partial ? "Partial coverage" : "Awaiting data"}
            </p>
            <p className="text-[var(--dsa-text-muted)]">
              Board {loadedCount}/{target}
            </p>
          </div>
        </div>

        <div className="flex min-w-[156px] items-center gap-2 px-3 py-2">
          <Database className="h-3.5 w-3.5 text-[var(--dsa-accent)]" aria-hidden />
          <div>
            <p className="font-medium text-[var(--dsa-text-secondary)]">Daily history</p>
            <p className="font-mono tabular-nums text-[var(--dsa-text)]">
              {historyOk}/{loadedCount || target} stored
              {(historyShort > 0 || historyMissing > 0) && (
                <span className="ml-1 text-[var(--dsa-warning)]">
                  · {historyShort} short · {historyMissing} missing
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex min-w-[148px] items-center gap-2 px-3 py-2">
          <Radio className="h-3.5 w-3.5 text-[var(--dsa-positive)]" aria-hidden />
          <div>
            <p className="font-medium text-[var(--dsa-text-secondary)]">Quote observations</p>
            <p className="font-mono tabular-nums text-[var(--dsa-text)]">
              {quoteObserved}/{loadedCount || target}
              {quoteStale > 0 && (
                <span className="ml-1 text-[var(--dsa-warning)]">· {quoteStale} stale</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex min-w-[170px] items-center gap-2 px-3 py-2">
          <Clock3 className="h-3.5 w-3.5 text-[var(--dsa-text-muted)]" aria-hidden />
          <div>
            <p className="font-medium text-[var(--dsa-text-secondary)]">Snapshot as of</p>
            <p className="font-mono tabular-nums text-[var(--dsa-text)]">{formatAsOf(updatedAt)}</p>
          </div>
        </div>

        <div className="flex min-w-[190px] items-center px-3 py-2">
          <div>
            <p className="font-medium text-[var(--dsa-text-secondary)]">Source path</p>
            <p className="text-[var(--dsa-text)]">{sourceLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
