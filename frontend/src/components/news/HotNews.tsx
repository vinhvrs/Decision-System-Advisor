/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react";
import newsService from "@/src/services/News.service";
import {
  newsSourceLabel,
  pickNewsThumbImage,
  resolveNewsHref,
} from "@/src/libs/newsArticle";
import type { News } from "@/src/types/News";

function formatRelativeDate(value: string | Date | null | undefined): string {
  if (!value) return "Time unavailable";
  const published = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(published.getTime())) return "Time unavailable";

  const now = Date.now();
  const diffMs = Math.max(0, now - published.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);

  if (hours < 1) return `${Math.max(1, minutes)}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return published.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HotNews() {
  const [hotNews, setHotNews] = useState<News[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void newsService
      .getAllNews({ page: 1, per_page: 4 })
      .then((response) => {
        if (cancelled) return;
        setHotNews(Array.isArray(response?.data) ? response.data : []);
        setLoadError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHotNews([]);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[220px] animate-pulse rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]"
          />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="dsa-panel px-3 py-5 text-xs text-[var(--dsa-text-muted)]">
        Market headlines are temporarily unavailable.
      </div>
    );
  }

  if (hotNews.length === 0) {
    return (
      <div className="dsa-panel px-3 py-5 text-xs text-[var(--dsa-text-muted)]">
        No recent market headlines are available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-4">
      {hotNews.map((news) => {
        const imageUrl = pickNewsThumbImage(news);
        const target = resolveNewsHref(news);
        const source = newsSourceLabel(news);
        const dateValue = news.published_at || news.created_at;

        const inner = (
          <>
            {imageUrl ? (
              <div className="relative h-28 w-full overflow-hidden border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent) parent.style.display = "none";
                  }}
                />
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col p-3">
              <div className="mb-2 flex min-w-0 items-center gap-2 text-[10px] text-[var(--dsa-text-muted)]">
                <span className="min-w-0 truncate font-medium text-[#8ab4ff]">
                  {source}
                </span>
                <span aria-hidden>·</span>
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Clock size={10} />
                  {formatRelativeDate(dateValue)}
                </span>
              </div>

              <h3 className="line-clamp-3 text-xs font-semibold leading-relaxed text-white transition-colors group-hover:text-[#a9c7ff]">
                {news.title}
              </h3>

              <div className="mt-auto flex items-center justify-end pt-3">
                <ChevronRight
                  size={13}
                  className="text-[var(--dsa-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[#8ab4ff]"
                />
              </div>
            </div>
          </>
        );

        const className =
          "group flex h-full min-h-[190px] flex-col overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] transition-colors hover:border-[var(--dsa-border-strong)]";

        if (target.kind === "external") {
          return (
            <a
              key={news.id}
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {inner}
            </a>
          );
        }

        return (
          <Link key={news.id} href={target.href} className={className}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
