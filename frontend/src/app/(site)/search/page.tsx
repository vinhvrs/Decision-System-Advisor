"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { ElasticService, type ElasticCompanyHit } from "@/src/services/Elastic.service";
import newsService from "@/src/services/newsService";
import { newsSourceLabel } from "@/src/libs/newsArticle";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { stripParentheticals } from "@/src/libs/displayString";
import type { News } from "@/src/types/News";

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

  for (const w of words(q)) {
    if (w.length < 2) continue;
    if (t.includes(w)) score += 4;
    else if (c.includes(w)) score += 2;
    else if (isSubsequence(w, t) || isSubsequence(w, c)) score += 1;
  }
  return score;
}

function teaser(content: string, maxLen = 130): string {
  const firstLine = (content || "").replace(/\s+/g, " ").trim();
  if (!firstLine) return "Market brief available.";
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen).trimEnd()}...` : firstLine;
}

function SearchResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [draftState, setDraftState] = useState({ sourceQuery: q, value: q });
  const draftQuery = draftState.sourceQuery === q ? draftState.value : q;
  const debouncedQ = useDebouncedValue(q, 300);
  const [results, setResults] = useState<ElasticCompanyHit[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [popular, setPopular] = useState<ElasticCompanyHit[]>([]);
  const [newsResults, setNewsResults] = useState<News[]>([]);

  useEffect(() => {
    ElasticService.getTopSymbols(20)
      .then(({ items }) => setPopular(items))
      .catch(() => setPopular([]));
  }, []);

  useEffect(() => {
    const query = debouncedQ.trim();
    let cancelled = false;

    if (query.length < 2) return;

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
          .map((n: News) => ({
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
        if (!cancelled) setResolvedQuery(query);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draftQuery.trim();
    if (next.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(next)}`);
  };

  const selectSuggestion = (value: string) => {
    setDraftState({ sourceQuery: value, value });
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  const searchPending = q.trim() !== debouncedQ.trim();
  const hasQuery = q.trim().length >= 2;
  const loading = hasQuery && resolvedQuery !== debouncedQ.trim();

  const popularPanel = (
    <aside className="dsa-panel overflow-hidden laptop:sticky laptop:top-[calc(var(--dsa-header-height)+16px)] laptop:self-start">
      <div className="border-b border-[var(--dsa-border)] px-3 py-2">
        <p className="dsa-section-label">Popular symbols</p>
      </div>
      <ul className="max-h-[min(70vh,520px)] overflow-y-auto">
        {popular.length === 0 ? (
          <li className="px-3 py-4 text-xs text-[var(--dsa-text-muted)]">This list is temporarily unavailable.</li>
        ) : (
          popular.map((hit, idx) => {
            const symbol = hit.source?.symbol ?? "—";
            const name = stripParentheticals(hit.source?.company_name) || "—";
            return (
              <li key={hit.id ?? `${symbol}-${idx}`} className="border-b border-[var(--dsa-border)] last:border-b-0">
                <Link
                  href={`/companies/profile/${symbol.toLowerCase()}`}
                  className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--dsa-surface-2)]"
                >
                  <span className="w-5 shrink-0 font-mono text-[10px] tabular-nums text-[var(--dsa-text-muted)]">
                    {idx + 1}
                  </span>
                  <span className="w-14 shrink-0 font-mono text-xs font-semibold text-[var(--dsa-text)]">{symbol}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--dsa-text-secondary)]">{name}</span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );

  return (
    <div className="-mx-3 min-h-screen bg-[var(--dsa-bg)] text-[var(--dsa-text)] phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
      <header className="border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-4 phone:px-4 tablet:px-5 laptop:px-6">
        <div className="dsa-page">
          <p className="dsa-section-label">Global search</p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white tablet:text-2xl">
            Companies & market news
          </h1>
          <form onSubmit={submitSearch} className="mt-3 flex max-w-3xl items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dsa-text-muted)]"
                aria-hidden
              />
              <input
                autoFocus={!hasQuery}
                value={draftQuery}
                onChange={(event) => setDraftState({ sourceQuery: q, value: event.target.value })}
                placeholder="Ticker or company name"
                aria-label="Search ticker or company"
                className="dsa-control h-9 w-full pl-9 pr-3 text-sm placeholder:text-[var(--dsa-text-muted)]"
              />
            </div>
            <button type="submit" className="dsa-button-primary h-9 shrink-0 px-4" disabled={draftQuery.trim().length < 2}>
              Search
            </button>
          </form>
          <p className="mt-2 text-[11px] text-[var(--dsa-text-muted)]">
            Search requires at least two characters. Company matches come from the indexed instrument catalog; related news is matched separately.
          </p>
        </div>
      </header>

      <div className="dsa-page grid gap-4 px-3 py-4 phone:px-4 tablet:px-5 laptop:grid-cols-[minmax(0,1fr)_280px] laptop:px-6">
        <main className="min-w-0 space-y-4">
          {!hasQuery ? (
            <section className="dsa-panel p-4">
              <h2 className="text-sm font-semibold text-white">Start with a symbol or company</h2>
              <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">
                Examples: AAPL, NVIDIA, Microsoft. No result or score is inferred before a query is submitted.
              </p>
            </section>
          ) : searchPending || loading ? (
            <section className="dsa-panel flex min-h-36 items-center justify-center gap-2 p-4 text-sm text-[var(--dsa-text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Searching…
            </section>
          ) : (
            <>
              {suggestions.length > 0 && (
                <section className="dsa-panel flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="dsa-section-label mr-1">Suggestions</span>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => selectSuggestion(suggestion)}
                      className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1 text-xs text-[var(--dsa-text-secondary)] hover:border-[var(--dsa-border-strong)] hover:text-white"
                    >
                      {suggestion}
                    </button>
                  ))}
                </section>
              )}

              <section className="dsa-panel overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--dsa-border)] px-3 py-2">
                  <div>
                    <p className="dsa-section-label">Companies</p>
                    <h2 className="mt-0.5 text-sm font-semibold text-white">Results for “{q}”</h2>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-[var(--dsa-text-muted)]">{total} found</span>
                </div>

                {results.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-[var(--dsa-text-muted)]">
                    No company results. Try a suggestion or shorter prefix.
                  </p>
                ) : (
                  <ul>
                    {results.map((hit, idx) => {
                      const symbol = hit.source?.symbol ?? "—";
                      const name = stripParentheticals(hit.source?.company_name) || "—";
                      return (
                        <li key={hit.id ?? `${symbol}-${idx}`} className="border-b border-[var(--dsa-border)] last:border-b-0">
                          <Link
                            href={`/companies/profile/${symbol.toLowerCase()}`}
                            className="grid grid-cols-[36px_72px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--dsa-surface-2)]"
                          >
                            <span className="font-mono text-[10px] tabular-nums text-[var(--dsa-text-muted)]">#{idx + 1}</span>
                            <span className="font-mono text-xs font-semibold text-white">{symbol}</span>
                            <span className="truncate text-xs text-[var(--dsa-text-secondary)]">{name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="dsa-panel overflow-hidden">
                <div className="border-b border-[var(--dsa-border)] px-3 py-2">
                  <p className="dsa-section-label">Related news</p>
                </div>
                {newsResults.length === 0 ? (
                  <p className="px-3 py-5 text-sm text-[var(--dsa-text-muted)]">
                    No related headlines found for this query.
                  </p>
                ) : (
                  <ul>
                    {newsResults.map((item, idx) => {
                      const href = item.id ? `/news?n=${encodeURIComponent(String(item.id))}` : "/news";
                      const title = String(item.title || "Untitled");
                      const meta = newsSourceLabel({ source: item.source, author: item.author });
                      const date = item.published_at ? new Date(item.published_at) : null;
                      const ts = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "—";
                      return (
                        <li key={`${item.id ?? title}-${idx}`} className="border-b border-[var(--dsa-border)] last:border-b-0">
                          <Link href={href} className="block px-3 py-3 transition-colors hover:bg-[var(--dsa-surface-2)]">
                            <p className="text-sm font-medium text-white">{title}</p>
                            <p className="mt-1 text-[10px] text-[var(--dsa-text-muted)]">{meta} · {ts}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
                              {teaser(String(item.content ?? ""))}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </main>

        {popularPanel}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="-mx-3 min-h-screen bg-[var(--dsa-bg)] px-4 py-16 text-center text-sm text-[var(--dsa-text-muted)] phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
          Loading search…
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  );
}
