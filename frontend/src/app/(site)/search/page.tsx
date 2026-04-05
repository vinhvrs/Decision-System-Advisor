"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { stripParentheticals } from "@/src/libs/displayString";

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const debouncedQ = useDebouncedValue(q, 300);
  const [results, setResults] = useState<ElasticCompanyHit[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [demoTop, setDemoTop] = useState<ElasticCompanyHit[]>([]);

  useEffect(() => {
    ElasticService.getDemoTopSymbols(20)
      .then(({ items }) => setDemoTop(items))
      .catch(() => setDemoTop([]));
  }, []);

  useEffect(() => {
    const query = debouncedQ.trim();
    if (query.length < 2) {
      setResults([]);
      setSuggestions([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    ElasticService.searchCompanies(query, 50)
      .then(({ items, total: t, suggestions: sug }) => {
        if (!cancelled) {
          setResults(items);
          setTotal(t);
          setSuggestions(sug ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setTotal(0);
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const searchPending = q.trim() !== debouncedQ.trim();

  const demoColumn = (
    <aside className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:sticky lg:top-20 lg:self-start">
      <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Demo · top 20 symbols</h2>
      <p className="mt-1 text-[11px] leading-snug text-white/35">
        From Elasticsearch (<code className="text-white/50">match_all</code>, symbol A→Z). Use when exploring the index.
      </p>
      <ul className="mt-3 max-h-[min(70vh,520px)] space-y-1 overflow-y-auto text-sm">
        {demoTop.length === 0 ? (
          <li className="text-white/30">Unavailable (check API / elastic).</li>
        ) : (
          demoTop.map((hit, idx) => {
            const symbol = hit.source?.symbol ?? "—";
            return (
              <li key={hit.id ?? `${symbol}-${idx}`}>
                <Link
                  href={`/companies/profile/${symbol.toLowerCase()}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-white/80 hover:bg-white/5"
                >
                  <span className="w-6 text-[10px] text-white/30">{idx + 1}</span>
                  <span className="font-mono font-semibold text-indigo-300">{symbol}</span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );

  if (q.trim().length < 2) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 lg:grid-cols-[1fr_260px]">
        <div className="text-center lg:text-left">
          <h1 className="text-xl font-semibold text-white">Company search</h1>
          <p className="mt-2 text-sm text-white/50">
            Enter at least <strong className="text-white/70">2 characters</strong> in the URL query{" "}
            <code className="rounded bg-white/10 px-1 text-xs">?q=</code>. Search uses Elasticsearch with{" "}
            <strong className="text-white/70">fuzzy matching</strong> on names and{" "}
            <strong className="text-white/70">suggestions</strong> for typos when your query is 3+ characters.
          </p>
        </div>
        {demoColumn}
      </div>
    );
  }

  if (searchPending || loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="mt-4 text-white/50">Searching…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-white">
          Results for &quot;{q}&quot;
        </h1>
        <p className="mt-1 text-sm text-white/50">
          {total} {total === 1 ? "match" : "matches"} · includes fuzzy / typo-tolerant scoring on company name &amp;
          description
        </p>

        {suggestions.length > 0 && (
          <div className="mt-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">Did you mean</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Link
                  key={s}
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-sm text-indigo-200 hover:bg-indigo-500/30"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
        )}

        {results.length === 0 ? (
          <p className="py-8 text-white/50">No results. Try a suggestion above or a shorter prefix.</p>
        ) : (
          <ul className="mt-6 space-y-1">
            {results.map((hit, idx) => {
              const symbol = hit.source?.symbol ?? "—";
              const name = stripParentheticals(hit.source?.company_name) || "—";
              const score = hit.score != null ? hit.score.toFixed(2) : null;
              return (
                <li key={hit.id ?? `${symbol}-${idx}`}>
                  <Link
                    href={`/companies/profile/${symbol.toLowerCase()}`}
                    className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-white/10 hover:bg-white/10"
                  >
                    <span className="w-8 text-sm text-slate-400">#{idx + 1}</span>
                    <span className="w-20 shrink-0 font-semibold uppercase text-white">{symbol}</span>
                    <span className="flex-1 truncate text-white/80">{name}</span>
                    {score != null && (
                      <span className="shrink-0 text-xs text-indigo-400/80">score: {score}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {demoColumn}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen bg-[#0B1220]">
      <Suspense
        fallback={
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </div>
  );
}
