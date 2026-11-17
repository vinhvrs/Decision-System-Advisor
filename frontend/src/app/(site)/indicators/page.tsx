"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    <div className="-mx-3 min-h-screen bg-[var(--dsa-bg)] phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
      <div className="sticky top-[var(--dsa-header-height)] z-30 border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
        <div className="dsa-page flex gap-1 px-3 py-2 phone:px-4 tablet:px-5 laptop:px-6">
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
                "rounded-[var(--dsa-radius-sm)] border px-3 py-1.5 text-xs font-semibold transition-colors",
                tab === item.id
                  ? "border-[rgba(76,141,255,0.45)] bg-[var(--dsa-accent-soft)] text-[#c5d9ff]"
                  : "border-transparent bg-transparent text-[var(--dsa-text-muted)] hover:border-[var(--dsa-border)] hover:bg-[var(--dsa-surface-2)] hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "indicators" ? <IndicatorsTab embedded /> : <StrategyTab embedded />}
    </div>
  );
}

export default function IndicatorsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--dsa-bg)]" aria-busy="true" />}>
      <IndicatorsPageTabs />
    </Suspense>
  );
}
