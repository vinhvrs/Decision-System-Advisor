"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, FlaskConical } from "lucide-react";
import IndicatorsTab from "@/src/app/(site)/indicators/IndicatorsTab";
import StrategyTab from "@/src/app/(site)/strategy/StrategyTab";

type IndicatorsPageTab = "indicators" | "strategy";

function IndicatorsPageTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: IndicatorsPageTab = searchParams.get("tab") === "strategy" ? "strategy" : "indicators";

  const setTab = useCallback(
    (next: IndicatorsPageTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "indicators") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const q = params.toString();
      router.replace(q ? `/indicators?${q}` : "/indicators", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="dsa-page space-y-3">
      <section className="dsa-terminal-page-head">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
            {tab === "indicators" ? (
              <Activity className="h-4 w-4 text-[#8ab4ff]" />
            ) : (
              <FlaskConical className="h-4 w-4 text-[#8ab4ff]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="dsa-section-label">Technical research</p>
            <h1 className="truncate text-sm font-semibold text-white">
              {tab === "indicators" ? "Indicator laboratory" : "Strategy laboratory"}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {(
            [
              { id: "indicators" as const, label: "Indicators" },
              { id: "strategy" as const, label: "Strategy" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "min-h-7 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] transition-colors",
                tab === item.id
                  ? "border-[rgba(76,141,255,0.45)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                  : "border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] text-[var(--dsa-text-muted)] hover:bg-[var(--dsa-surface-2)] hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="dsa-terminal-panel min-w-0 overflow-hidden">
        {tab === "indicators" ? <IndicatorsTab embedded /> : <StrategyTab embedded />}
      </section>
    </div>
  );
}

export default function IndicatorsPage() {
  return (
    <Suspense fallback={<div className="dsa-page min-h-[50vh] bg-[var(--dsa-bg)]" aria-busy="true" />}>
      <IndicatorsPageTabs />
    </Suspense>
  );
}
