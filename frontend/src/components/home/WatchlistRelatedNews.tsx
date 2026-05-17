/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
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

const MAX_SYMBOLS = 18;
const PER_SYMBOL = 12;
const DISPLAY_CAP = 12;

function publishedMs(item: any): number {
  const raw = item?.published_at || item?.created_at;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatRelativeDate(dateString: string) {
  const now = new Date();
  const publishedDate = new Date(dateString);
  const diffInMs = now.getTime() - publishedDate.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `${diffInMinutes <= 0 ? 1 : diffInMinutes} min ago`;
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
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const symbols = useMemo(
    () =>
      watchlist
        .map((w) => String(w.symbol || "").trim().toUpperCase())
        .filter(Boolean)
        .slice(0, MAX_SYMBOLS),
    [watchlist]
  );

  useEffect(() => {
    if (watchlistLoading) return;

    if (symbols.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      const byId = new Map<
        string,
        { item: any; symbols: Set<string>; ts: number }
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
        .map(({ item, symbols }) => ({
          ...item,
          _watchSymbols: [...symbols].sort(),
        }));

      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [watchlistLoading, symbols]);

  if (watchlistLoading || loading) {
    return (
      <Card title="Related news" subtitle="Latest headlines tied to your watchlist symbols.">
        <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl bg-white/5 animate-pulse border border-white/5"
            />
          ))}
        </div>
      </Card>
    );
  }

  if (symbols.length === 0) {
    return (
      <Card title="Related news" subtitle="Latest headlines tied to your watchlist symbols.">
        <p className="text-sm text-white/60">
          Add symbols to your watchlist to see related market news here.
        </p>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card title="Related news" subtitle="Latest headlines tied to your watchlist symbols.">
        <p className="text-sm text-white/60">
          No related news returned for your watchlist yet. Try again later or add more symbols.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Related news" subtitle="Latest headlines tied to your watchlist symbols.">
      <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-3 gap-4 tablet:gap-5">
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
                <div className="relative h-36 w-full mb-3 overflow-hidden rounded-xl border border-white/5">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement | null)?.remove();
                    }}
                  />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {chips.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-semibold uppercase tracking-wide rounded bg-blue-500/15 text-blue-300 px-1.5 py-0.5"
                  >
                    {s}
                  </span>
                ))}
                {chips.length > 4 && (
                  <span className="text-[10px] text-white/40">+{chips.length - 4}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-white/40 mb-2 uppercase font-bold tracking-widest">
                <span className="text-blue-400/90 truncate max-w-[45%]">
                  {newsSourceLabel(news)}
                </span>
                <span>•</span>
                <div className="flex items-center gap-1 shrink-0">
                  <Clock size={10} />
                  {dateStr ? formatRelativeDate(dateStr) : "—"}
                </div>
              </div>
              <h3 className="text-sm font-semibold line-clamp-3 leading-snug group-hover:text-blue-400 transition-colors">
                {news.title}
              </h3>
              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white/5 text-white/50 uppercase">
                  Watchlist
                </span>
                <ChevronRight
                  size={14}
                  className="text-white/20 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all"
                />
              </div>
            </>
          );

          const className =
            "group block p-4 rounded-2xl bg-[#161D2C]/60 border border-white/10 hover:border-blue-500/35 transition-all flex flex-col shadow-md h-full";

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
