"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const debouncedQ = useDebouncedValue(q, 300);
  const [results, setResults] = useState<ElasticCompanyHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const query = debouncedQ.trim();
    if (query.length < 2) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    ElasticService.searchCompanies(query, 50)
      .then(({ items, total: t }) => {
        if (!cancelled) {
          setResults(items);
          setTotal(t);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  if (q.trim().length < 2) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-white/50">Enter at least 2 characters to search.</p>
      </div>
    );
  }

  const searchPending = q.trim() !== debouncedQ.trim();
  if (searchPending || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/50 mt-4">Searching...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold text-white mb-2">
        Results for &quot;{q}&quot;
      </h1>
      <p className="text-white/50 text-sm mb-6">
        {total} {total === 1 ? "match" : "matches"} (ordered by relevance)
      </p>

      {results.length === 0 ? (
        <p className="text-white/50 py-8">No results found.</p>
      ) : (
        <ul className="space-y-1">
          {results.map((hit, idx) => {
            const symbol = hit.source?.symbol ?? "—";
            const name = hit.source?.company_name ?? "—";
            const score = hit.score != null ? hit.score.toFixed(2) : null;
            return (
              <li key={hit.id ?? `${symbol}-${idx}`}>
                <Link
                  href={`/companies/profile/${symbol.toLowerCase()}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition"
                >
                  <span className="text-slate-400 text-sm w-8">#{idx + 1}</span>
                  <span className="font-semibold text-white uppercase w-20 shrink-0">
                    {symbol}
                  </span>
                  <span className="text-white/80 flex-1 truncate">{name}</span>
                  {score != null && (
                    <span className="text-indigo-400/80 text-xs shrink-0">
                      score: {score}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#0B1220]">
      <Suspense
        fallback={
          <div className="max-w-3xl mx-auto px-4 py-16 text-center">
            <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </div>
  );
}
