"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function teaser(content: string, maxLen = 120): string {
  const firstLine = (content || "").replace(/\s+/g, " ").trim();
  if (!firstLine) return "Summary unavailable.";
  return firstLine.length > maxLen ? `${firstLine.slice(0, maxLen).trimEnd()}…` : firstLine;
}

function formatNewsDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function SymbolCatalog({ rows }: { rows: ElasticCompanyHit[] }) {
  return (
    <aside className="dsa-panel self-start overflow-hidden lg:sticky lg:top-[calc(var(--dsa-header-height)_+_12px)]">
      <div className="border-b border-[var(--dsa-border)] px-3 py-2">
        <p className="dsa-section-label">Browse symbols</p>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--dsa-text-muted)]">
          Alphabetical company catalog from the search index. This is not a popularity ranking.
        </p>
      </div>
      <ul className="max-h-[min(70vh,560px)] overflow-y-auto py-1">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-xs text-[var(--dsa-text-muted)]">Symbol catalog unavailable.</li>
        ) : (
          rows.map((hit, idx) => {
            const symbol = hit.source?.symbol?.toUpperCase() || "—";
            const name = stripParentheticals(hit.source?.company_name) || "Company name unavailable";
            return (
              <li key={hit.id ?? `${symbol}-${idx}`}>
                <Link
                  href={`/companies/profile/${symbol.toLowerCase()}`}
                  className="grid grid-cols-[1.5rem_4.5rem_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--dsa-surface-2)]"
                >
                  <span className="text-right font-mono text-[10px] text-[var(--dsa-text-muted)]">{idx + 1}</span>
                  <span className="font-mono font-semibold text-[#8ab4ff]">{symbol}</span>
                  <span className="truncate text-[10px] text-[var(--dsa-text-secondary)]">{name}</span>
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const debouncedQ = useDebouncedValue(q, 300);
  const [results, setResults] = useState<ElasticCompanyHit[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [browseRows, setBrowseRows] = useState<ElasticCompanyHit[]>([]);
  const [newsResults, setNewsResults] = useState<News[]>([]);

  useEffect(() => {
    ElasticService.browseSymbols(30)
      .then(({ items }) => setBrowseRows(items))
      .catch(() => setBrowseRows([]));
  }, []);

  useEffect(() => {
    const query = debouncedQ.trim();
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (query.length < 2) {
        setResults([]);
        setSuggestions([]);
        setTotal(0);
        setNewsResults([]);
        setLoading(false);
        return;
      }

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
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [debouncedQ]);

  const searchPending = q.trim() !== debouncedQ.trim();

  if (q.trim().length < 2) {
    return (
      <div className="dsa-page grid gap-4 px-3 py-5 phone:px-4 tablet:px-5 lg:grid-cols-[minmax(0,1fr)_300px] laptop:px-6">
        <section className="dsa-panel p-4">
          <p className="dsa-section-label">Company search</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Find a company or ticker</h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
            Enter at least two characters in the global search box. Results come from the indexed company catalog and can include spelling suggestions for longer queries.
          </p>
          <div className="mt-4 border-t border-[var(--dsa-border)] pt-3 text-[10px] text-[var(--dsa-text-muted)]">
            Search matches company names, tickers, sectors, industries, and indexed descriptions. Search ranking is not an investment ranking.
          </div>
        </section>
        <SymbolCatalog rows={browseRows} />
      </div>
    );
  }

  return (
    <div className="dsa-page grid gap-4 px-3 py-5 phone:px-4 tablet:px-5 lg:grid-cols-[minmax(0,1fr)_300px] laptop:px-6">
      <main className="min-w-0">
        <div className="mb-3 flex flex-col gap-2 tablet:flex-row tablet:items-end tablet:justify-between">
          <div>
            <p className="dsa-section-label">Search</p>
            <h1 className="mt-1 text-lg font-semibold text-white">Results for “{q}”</h1>
            <p className="mt-1 text-xs text-[var(--dsa-text-muted)]">
              {searchPending || loading ? "Searching…" : `${total} ${total === 1 ? "company" : "companies"} found`}
            </p>
          </div>
        </div>

        {searchPending || loading ? (
          <div className="dsa-panel flex h-28 items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4c8dff] border-t-transparent" />
            Searching indexed companies and recent news…
          </div>
        ) : (
          <>
            {suggestions.length > 0 ? (
              <section className="dsa-panel mb-3 p-3">
                <p className="dsa-section-label">Suggestions</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion) => (
                    <Link
                      key={suggestion}
                      href={`/search?q=${encodeURIComponent(suggestion)}`}
                      className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-2 py-1 text-xs text-[#a9c7ff] hover:border-[#4c8dff]"
                    >
                      {suggestion}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="dsa-panel overflow-hidden">
              <div className="grid grid-cols-[2rem_5rem_minmax(0,1fr)] gap-2 border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.05em] text-[var(--dsa-text-muted)]">
                <span>#</span>
                <span>Symbol</span>
                <span>Company</span>
              </div>
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-xs text-[var(--dsa-text-muted)]">
                  No indexed companies matched this query.
                </p>
              ) : (
                <ul>
                  {results.map((hit, idx) => {
                    const symbol = hit.source?.symbol?.toUpperCase() || "—";
                    const name = stripParentheticals(hit.source?.company_name) || "Company name unavailable";
                    return (
                      <li key={hit.id ?? `${symbol}-${idx}`} className="border-t border-[var(--dsa-border)] first:border-t-0">
                        <Link
                          href={`/companies/profile/${symbol.toLowerCase()}`}
                          className="grid grid-cols-[2rem_5rem_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--dsa-surface-2)]"
                        >
                          <span className="font-mono text-[10px] text-[var(--dsa-text-muted)]">{idx + 1}</span>
                          <span className="font-mono font-semibold text-[#8ab4ff]">{symbol}</span>
                          <span className="truncate text-[var(--dsa-text-secondary)]">{name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="mt-4">
              <div className="mb-2">
                <p className="dsa-section-label">Related news</p>
                <p className="mt-1 text-[10px] text-[var(--dsa-text-muted)]">
                  Recent indexed headlines ranked locally by text relevance to the search terms.
                </p>
              </div>

              {newsResults.length === 0 ? (
                <div className="dsa-panel px-3 py-5 text-xs text-[var(--dsa-text-muted)]">
                  No related news found for this keyword.
                </div>
              ) : (
                <div className="dsa-panel overflow-hidden">
                  {newsResults.map((n, idx) => {
                    const href = n.id ? `/news?n=${encodeURIComponent(String(n.id))}` : "/news";
                    const title = String(n.title || "Untitled");
                    const meta = newsSourceLabel({ source: n.source, author: n.author });
                    return (
                      <Link
                        key={`${n.id ?? title}-${idx}`}
                        href={href}
                        className="block border-t border-[var(--dsa-border)] px-3 py-3 first:border-t-0 hover:bg-[var(--dsa-surface-2)]"
                      >
                        <p className="text-xs font-semibold text-white">{title}</p>
                        <p className="mt-1 text-[10px] text-[var(--dsa-text-muted)]">
                          {meta} · {formatNewsDate(n.published_at)}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--dsa-text-secondary)]">
                          {teaser(String(n.content ?? ""))}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <SymbolCatalog rows={browseRows} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="-mx-3 min-h-screen bg-[var(--dsa-bg)] phone:-mx-4 tablet:-mx-5 laptop:-mx-6">
      <header className="border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-3 phone:px-4 tablet:px-5 laptop:px-6">
        <div className="dsa-page">
          <p className="dsa-section-label">Discovery</p>
          <p className="mt-1 text-xs text-[var(--dsa-text-secondary)]">
            Company catalog, ticker search, and related news context.
          </p>
        </div>
      </header>
      <Suspense
        fallback={
          <div className="dsa-page flex h-32 items-center justify-center text-xs text-[var(--dsa-text-muted)]">
            Loading search…
          </div>
        }
      >
        <SearchResults />
      </Suspense>
    </div>
  );
}
