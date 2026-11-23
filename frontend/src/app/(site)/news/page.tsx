/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Newspaper, X, Clock, Calendar } from "lucide-react";
import newsService from "@/src/services/News.service";
import { News } from "@/src/types/News";
import { pickNewsThumbImage } from "@/src/libs/newsArticle";

function NewsListPageContent() {
  const searchParams = useSearchParams();
  const selectedNewsId = searchParams.get("n") ?? "";
  const [items, setItems] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // --- Logic hiển thị thời gian ---
  const formatDisplayDate = (dateString: string | Date) => {
    if (!dateString) return "Time unavailable";
    const now = new Date();
    const publishedDate = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(publishedDate.getTime())) return "Time unavailable";
    const diffInMs = now.getTime() - publishedDate.getTime();
    if (diffInMs <= 0) return "Just now";
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        return `${diffInMins <= 0 ? 1 : diffInMins}m ago`;
      }
      return `${diffInHours}h ago`;
    }

    return publishedDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const parseContent = (content: string) => {
    const imgPrefix = "Image URL: ";
    if (content?.startsWith(imgPrefix)) {
      const parts = content.split("\n\n");
      const imageUrl = parts[0].replace(imgPrefix, "").trim();
      const body = parts.slice(1).join("\n\n");
      const validImageUrl = (imageUrl && imageUrl !== "null" && imageUrl !== "") ? imageUrl : null;
      return { imageUrl: validImageUrl, body };
    }
    return { imageUrl: null, body: content };
  };

  const fetchPage = async (targetPage: number, mode: "replace" | "append") => {
    try {
      if (mode === "replace") setIsLoading(true);
      else setIsLoadingMore(true);
      const res = await newsService.getAllNews({ page: targetPage, per_page: 15 });
      const batch = res.data || [];
      if (mode === "replace") {
        setItems(batch);
        if (batch.length > 0) setSelectedNews(batch[0]);
      } else {
        setItems(prev => [...prev, ...batch]);
      }
      setHasMore(res.pagination.currentPage < res.pagination.totalPages);
      setPage(res.pagination.currentPage);
    } catch (e) {
      console.error(e);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  useEffect(() => { fetchPage(1, "replace"); }, []);

  useEffect(() => {
    if (!selectedNewsId || !items.length) return;
    const matched = items.find((n) => String(n.id) === selectedNewsId);
    if (matched) setSelectedNews(matched);
  }, [selectedNewsId, items]);

  return (
    <main className="dsa-page flex h-[calc(100vh_-_var(--dsa-header-height)_-_var(--dsa-terminal-modulebar-height)_-_2rem)] min-h-[560px] overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-bg)] font-sans text-white">
      
      {/* Cột danh sách bên trái */}
      <section className="flex h-full w-full flex-col border-r border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] tablet:w-[340px] laptop:w-[400px] pc:w-[450px]">
        <div className="flex items-center justify-between border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-2.5">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <Newspaper size={16} className="text-[#8ab4ff]" />
            Full feed
          </h1>
          <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--dsa-text-muted)]">Latest feed</div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-10 text-center text-xs text-[var(--dsa-text-muted)] animate-pulse">Loading feed…</div>
          ) : (
            <div className="divide-y divide-[var(--dsa-border)]">
              {items.map((item) => {
                const { imageUrl } = parseContent(item.content || "");
                const thumb = imageUrl || pickNewsThumbImage(item as any);
                const timeLabel = formatDisplayDate((item as any).published_at);
                const isRecent = timeLabel.includes('ago');

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className={`flex cursor-pointer gap-3 border-l-2 px-3 py-3 transition-colors hover:bg-[var(--dsa-surface-2)] ${
                      selectedNews?.id === item.id ? "border-l-[#4c8dff] bg-[var(--dsa-accent-soft)]" : "border-l-transparent"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[11px] mb-1.5">
                        <div className={`flex items-center gap-1 ${isRecent ? "text-orange-400" : "text-white/40"}`}>
                          <Clock size={12} />
                          {timeLabel}
                        </div>
                        <span className="font-medium text-[#8ab4ff]">
                          • {(item as any).author?.split?.(",")?.[0]?.trim() || "News"}
                        </span>
                      </div>
                      <h2 className={`text-sm font-semibold leading-snug line-clamp-2 ${
                        selectedNews?.id === item.id ? "text-[#a9c7ff]" : "text-white/90"
                      }`}>
                        {item.title}
                      </h2>
                    </div>
                    {thumb && (
                      <div className="relative h-14 w-16 flex-shrink-0 overflow-hidden rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-2)]">
                        <img src={thumb} alt="thumb" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => fetchPage(page + 1, "append")} className="w-full p-4 text-xs font-medium text-[var(--dsa-text-muted)] transition-colors hover:bg-[var(--dsa-surface-2)] hover:text-white">
                  {isLoadingMore ? "Processing..." : "Load more news"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Cột nội dung bên phải */}
      <section className="hidden h-full flex-1 flex-col bg-[var(--dsa-bg)] tablet:flex">
        {selectedNews ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end border-b border-[var(--dsa-border)] bg-[var(--dsa-surface-1)] px-3 py-2">
               <button onClick={() => setSelectedNews(null)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            
            <article className="custom-scrollbar flex-1 overflow-y-auto bg-[var(--dsa-bg)] p-4 tablet:p-6 laptop:p-8 pc:p-10">
              <div className="max-w-3xl mx-auto">
                {(() => {
                  const { imageUrl, body } = parseContent(selectedNews.content || "");
                  return (
                    <>
                      <div className="mb-6 flex items-center gap-4">
                        <span className="rounded-[var(--dsa-radius-sm)] border border-[rgba(76,141,255,0.28)] bg-[var(--dsa-accent-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#a9c7ff]">
                          {selectedNews.author?.split(',')[0] || "Market News"}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-white/40">
                          <Calendar size={14} />
                          {formatDisplayDate(selectedNews.published_at)}
                        </span>
                      </div>

                      <h1 className="mb-5 text-xl font-semibold leading-tight tracking-[-0.02em] text-white phone:text-2xl tablet:text-3xl">{selectedNews.title}</h1>

                      {selectedNews.source && (
                        <p className="mb-6 text-sm text-white/60">
                          Source:{" "}
                          <a
                            href={selectedNews.source}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-blue-300 hover:text-blue-200 hover:underline"
                          >
                            {selectedNews.source}
                          </a>
                        </p>
                      )}

                      {imageUrl && (
                        <div className="relative mb-8 overflow-hidden rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
                          <img 
                            src={imageUrl} 
                            alt="feature" 
                            className="w-full object-cover max-h-[550px]" 
                            onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
                          />
                        </div>
                      )}

                      <div className="prose prose-invert max-w-none pb-16 text-[15px] leading-relaxed text-[var(--dsa-text-secondary)]">
                        {body?.split('\n').map((para, idx) => (
                          para.trim() && <p key={idx} className="mb-6">{para}</p>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <div className="mt-12 mb-8 pt-8 border-t border-white/5">
                  <p className="text-[11px] text-white/20 italic tracking-wider uppercase">
                    DSA · Source-linked market news
                  </p>
                </div>
              </div>
            </article>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center bg-[var(--dsa-bg)] text-white/10">
            <div className="text-center">
                <Newspaper size={100} strokeWidth={0.5} className="mx-auto mb-4" />
                <p className="text-sm font-medium tracking-widest uppercase">Select an article to read</p>
            </div>
          </div>
        )}
      </section>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </main>
  );
}

export default function NewsListPage() {
  return (
    <Suspense
      fallback={
        <main className="dsa-page flex min-h-[50vh] items-center justify-center bg-[var(--dsa-bg)] text-[var(--dsa-text-muted)]">
          Loading news…
        </main>
      }
    >
      <NewsListPageContent />
    </Suspense>
  );
}