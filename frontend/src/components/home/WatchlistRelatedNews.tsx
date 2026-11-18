/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import Card from "@/src/sections/Card";
import { useWatchlist } from "@/src/hooks/useWatchlist";
import { CompanyService } from "@/src/services/Company.service";
import {
  newsSourceLabel,
  pickNewsThumbImage,
  resolveNewsHref,
} from "@/src/libs/newsArticle";
import type { News } from "@/src/types/News";

const MAX_SYMBOLS = 18;
const PER_SYMBOL = 12;
const DISPLAY_CAP = 12;

function publishedMs(item: News): number {
  const raw = item?.published_at || item?.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatRelativeDate(dateString: string | Date) {
  const publishedDate = dateString instanceof Date ? dateString : new Date(dateString);
  if (Number.isNaN(publishedDate.getTime())) return "Time unavailable";

  const diffInMs = Math.max(0, Date.now() - publishedDate.getTime());
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `${Math.max(1, diffInMinutes)}m ago`;
  }
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  return publishedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WatchlistRelatedNews() {
  const { items: watchlist, loading: watchlistLoading } = useWatchlist();
  const [rows, setRows] = useState<Array<News & { _watchSymbols: string[] }>>([]);
  const [loadedSymbolKey, setLoadedSymbolKey] = useState("");

  const symbols = useMemo(
    () =>
      watchlist
        .map((w) => String(w.symbol || "").trim().toUpperCase())
        .filter(Boolean)
        .slice(0, MAX_SYMBOLS),
    [watchlist]
  );

  const symbolKey = symbols.join(",");

  useEffect(() => {
    if (watchlistLoading || symbols.length === 0) return;

    let cancelled = false;

    (async () => {
      const byId = new Map<
        string,
        { item: News; symbols: Set<string>; ts: number }
      >();

      const results = await Promise.allSettled(
        symbols.map(async (sym) => {
          const list = await CompanyService.getCompanyNews(sym, PER_SYMBOL);
          return { sym, list } as const;
        })
      );

      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { sym, list } = r.value;
        for (const item of list) {
          const id = String(item?.id ?? "");
          if (!id) continue;
          const ts = publishedMs(item);
          const prev = byId.get(id);
          if (!prev) {
            byId.set(id, { item, symbols: new Set([sym]), ts });
          } else {
            prev.symbols.add(sym);
            if (ts > prev.ts) prev.ts = ts;
          }
        }
      }

      const merged = [...byId.values()]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, DISPLAY_CAP)
        .map(({ item, symbols: matchedSymbols }) => ({
          ...item,
          _watchSymbols: [...matchedSymbols].sort(),
        }));

      if (!cancelled) {
        setRows(merged);
        setLoadedSymbolKey(symbolKey);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [watchlistLoading, symbols, symbolKey]);

  const loading = watchlistLoading || (symbols.length > 0 && loadedSymbolKey !== symbolKey);

  if (!watchlistLoading && symbols.length === 0) {
    return (
      <Card title="Watchlist news" subtitle="Recent headlines matched to tracked symbols.">
        <p className="text-xs text-[var(--dsa-text-muted)]">
          Add symbols to the watchlist to populate related headlines.
        </p>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card title="Watchlist news" subtitle="Recent headlines matched to tracked symbols.">
        <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]"
            />
          ))}
        </div>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card title="Watchlist news" subtitle="Recent headlines matched to tracked symbols.">
        <p className="text-xs text-[var(--dsa-text-muted)]">
          No related headlines are currently available for the tracked symbols.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Watchlist news" subtitle="Recent headlines matched to tracked symbols.">
      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
        {rows.map((news) => {
          const imageUrl = pickNewsThumbImage(news);
          const href = resolveNewsHref(news);
          const chips: string[] = Array.isArray(news._watchSymbols)
            ? news._watchSymbols
            : [];
          const dateStr = news.published_at || news.created_at || "";

          const inner = (
            <>
              {imageUrl && (
                <div className="relative mb-3 h-28 w-full overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement | null)?.remove();
                    }}
                  />
                </div>
              )}
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {chips.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded-[var(--dsa-radius-sm)] bg-[var(--dsa-accent-soft)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#a9c7ff]"
                  >
                    {s}
                  </span>
                ))}
                {chips.length > 4 && (
                  <span className="text-[10px] text-white/40">+{chips.length - 4}</span>
                )}
              </div>
              <div className="mb-2 flex items-center gap-2 text-[10px] text-[var(--dsa-text-muted)]">
                <span className="max-w-[48%] truncate font-medium text-[#8ab4ff]">
                  {newsSourceLabel(news)}
                </span>
                <span>•</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={10} />
                  {dateStr ? formatRelativeDate(dateStr) : "—"}
                </div>
              </div>
              <h3 className="line-clamp-3 text-xs font-semibold leading-relaxed text-white transition-colors group-hover:text-[#a9c7ff]">
                {news.title}
              </h3>
              <div className="mt-3 flex items-center justify-end border-t border-[var(--dsa-border)] pt-2">
                <ChevronRight
                  size={13}
                  className="text-[var(--dsa-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#8ab4ff]"
                />
              </div>
            </>
          );

          const className =
            "group block h-full rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] p-3 transition-colors hover:border-[var(--dsa-border-strong)]";

          if (href.kind === "external") {
            return (
              <a
                key={news.id}
                href={href.href}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {inner}
              </a>
            );
          }

          return (
            <Link key={news.id} href={href.href} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
