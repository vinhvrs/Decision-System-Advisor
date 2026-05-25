"use client";

import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import IndicatorsTab from "@/src/app/(site)/indicators/IndicatorsTab";
import StrategyTab from "@/src/app/(site)/strategy/StrategyTab";

type AnalysisTab = "indicators" | "strategy";

function AnalysisTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab: AnalysisTab = searchParams.get("tab") === "strategy" ? "strategy" : "indicators";

  const setTab = useCallback(
    (next: AnalysisTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "indicators") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      const q = params.toString();
      router.replace(q ? `/analysis?${q}` : "/analysis", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="min-h-screen bg-[#0b0e14]">
      <div className="sticky top-0 z-30 border-b border-gray-800 bg-[#0b0e14]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl gap-2 px-4 py-3 phone:px-6">
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
                "rounded-xl px-5 py-2.5 text-sm font-semibold transition-all",
                tab === item.id
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                  : "border border-gray-800 bg-[#161a21] text-gray-400 hover:text-white",
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

export default function AnalysisPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0e14]" aria-busy="true" />}>
      <AnalysisTabs />
    </Suspense>
  );
}
