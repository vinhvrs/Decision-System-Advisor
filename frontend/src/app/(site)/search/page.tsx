"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";
import newsService from "@/src/services/newsService";
import { newsSourceLabel } from "@/src/libs/newsArticle";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { stripParentheticals } from "@/src/libs/displayString";

type SearchNewsItem = {
  id?: string;
  title?: string;
  content?: string;
  source?: string;
  author?: string;
  published_at?: string;
};

function normalizeText(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function words(v: string): string[] {
  return normalizeText(v).split(" ").filter(Boolean);
}

function isSubsequence(needle: string, hay: string): boolean {
  if (!needle) return true;
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i += 1;
    if (i >= needle.length) return true;
  }
  return false;
}

function fuzzyNewsScore(query: string, title: string, content: string): number {
  const q = normalizeText(query);
  const t = normalizeText(title);
  const c = normalizeText(content);
  if (!q) return 0;

  let score = 0;
  if (t.includes(q)) score += 14;
  if (c.includes(q)) score += 8;

  const qWords = words(q);
  for (const w of qWords) {
    if (w.length < 2) continue;
    if (t.includes(w)) score += 4;
    else if (c.includes(w)) score += 2;
    else if (isSubsequence(w, t) || isSubsequence(w, c)) score += 1;
  }
  return score;
}

function teaser(content: string, maxLen = 100): string {
  const firstLine = (content || "").replace(/\s+/g, " ").trim();
  if (!firstLine) return "Short market brief available.";
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen).trimEnd()}...` : firstLine;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const debouncedQ = useDebouncedValue(q, 300);
  const [results, setResults] = useState<ElasticCompanyHit[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [demoTop, setDemoTop] = useState<ElasticCompanyHit[]>([]);
  const [newsResults, setNewsResults] = useState<SearchNewsItem[]>([]);

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
      setNewsResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all([
      ElasticService.searchCompanies(query, 50),
      newsService.getAllNews({ page: 1, per_page: 120 }),
    ])
      .then(([companyRes, newsRes]) => {
        if (cancelled) return;
        setResults(companyRes.items);
        setTotal(companyRes.total);
        setSuggestions(companyRes.suggestions ?? []);

        const newsRows = Array.isArray(newsRes?.data) ? newsRes.data : [];
        const rankedNews = newsRows
          .map((n: SearchNewsItem) => ({
            row: n,
            score: fuzzyNewsScore(query, String(n?.title ?? ""), String(n?.content ?? "")),
          }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 8)
          .map((x) => x.row);
        setNewsResults(rankedNews);
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setTotal(0);
          setSuggestions([]);
          setNewsResults([]);
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

        <section className="mt-8">
          <h2 className="text-base font-semibold text-white">Related news (fuzzy keyword)</h2>
          <p className="mt-1 text-xs text-white/45">
            Lightweight snippets only; open item for full details.
          </p>
          {newsResults.length === 0 ? (
            <p className="py-4 text-sm text-white/50">No related news found for this keyword.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {newsResults.map((n, idx) => {
                const href = n.id ? `/news?n=${encodeURIComponent(String(n.id))}` : "/news";
                const title = String(n.title || "Untitled");
                const meta = newsSourceLabel({ source: n.source, author: n.author });
                const ts = n.published_at ? new Date(n.published_at).toISOString().slice(0, 10) : "—";
                const desc = teaser(String(n.content ?? ""));
                const baseClass =
                  "block rounded-xl border border-white/5 bg-white/5 px-4 py-3 transition hover:border-white/10 hover:bg-white/10";
                return (
                  <li key={`${n.id ?? title}-${idx}`}>
                    <Link href={href} className={baseClass}>
                      <p className="text-sm font-medium text-white">{title}</p>
                      <p className="mt-1 text-xs text-white/45">{meta} · {ts}</p>
                      <p className="mt-2 text-sm text-white/70">{desc}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
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
