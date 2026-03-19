/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Newspaper, X, Clock, Calendar } from "lucide-react";
import newsService from "@/src/services/News.service";
import { News } from "@/src/types/News";

export default function NewsListPage() {
  const [items, setItems] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // --- Logic hiển thị thời gian ---
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "Just now";
    const now = new Date();
    const publishedDate = new Date(dateString);
    const diffInMs = now.getTime() - publishedDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    // Nếu trong vòng 24 giờ
    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        return `${diffInMins <= 0 ? 1 : diffInMins}m ago`;
      }
      return `${diffInHours}h ago`;
    }

    // Nếu qua ngày khác
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
      mode === "replace" ? setIsLoading(true) : setIsLoadingMore(true);
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
      setIsMoreLoading(false);
    }
  };

  function setIsMoreLoading(val: boolean) { setIsLoadingMore(val); }

  useEffect(() => { fetchPage(1, "replace"); }, []);

  return (
    <main className="flex h-[calc(100vh-56px)] phone:h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0B1220] text-white font-sans">
      
      {/* Cột danh sách bên trái */}
      <section className="flex h-full w-full flex-col border-r border-white/10 tablet:w-[340px] laptop:w-[400px] pc:w-[450px]">
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Newspaper size={18} className="text-blue-400" />
            Full feed
          </h1>
          <div className="text-[10px] uppercase tracking-widest text-white/40">Real-time</div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-10 text-center text-white/20 animate-pulse">Loading feed...</div>
          ) : (
            <div className="divide-y divide-white/5">
              {items.map((item) => {
                const { imageUrl } = parseContent(item.content || "");
                const timeLabel = formatDisplayDate((item as any).published_at);
                const isRecent = timeLabel.includes('ago');

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className={`flex gap-4 cursor-pointer p-4 transition-all hover:bg-white/5 ${
                      selectedNews?.id === item.id ? "bg-blue-500/10 border-l-4 border-blue-500" : "border-l-4 border-transparent"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[11px] mb-1.5">
                        <div className={`flex items-center gap-1 ${isRecent ? "text-orange-400" : "text-white/40"}`}>
                          <Clock size={12} />
                          {timeLabel}
                        </div>
                        <span className="text-blue-400/80 font-medium">• {item.author?.split(',')[0] || "Reuters"}</span>
                      </div>
                      <h2 className={`text-sm font-semibold leading-snug line-clamp-2 ${
                        selectedNews?.id === item.id ? "text-blue-400" : "text-white/90"
                      }`}>
                        {item.title}
                      </h2>
                    </div>
                    {imageUrl && (
                      <div className="relative h-14 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/5 bg-white/5">
                        <img src={imageUrl} alt="thumb" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => fetchPage(page + 1, "append")} className="w-full p-6 text-xs font-bold text-white/40 hover:text-white transition-colors">
                  {isLoadingMore ? "Processing..." : "Load more news"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Cột nội dung bên phải */}
      <section className="hidden h-full flex-1 flex-col bg-[#0b1220] tablet:flex">
        {selectedNews ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end p-4 border-b border-white/5 bg-[#0B1220]">
               <button onClick={() => setSelectedNews(null)} className="text-white/40 hover:text-white transition-colors"><X size={24} /></button>
            </div>
            
            <article className="flex-1 overflow-y-auto p-4 tablet:p-6 laptop:p-8 pc:p-12 custom-scrollbar bg-[#0B1220]">
              <div className="max-w-3xl mx-auto">
                {(() => {
                  const { imageUrl, body } = parseContent(selectedNews.content || "");
                  return (
                    <>
                      <div className="mb-6 flex items-center gap-4">
                        <span className="rounded-lg bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 border border-blue-500/20">
                          {selectedNews.author?.split(',')[0] || "Market News"}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-white/40">
                          <Calendar size={14} />
                          {new Date(selectedNews.published_at).toLocaleString('en-GB')}
                        </span>
                      </div>

                      <h1 className="text-xl phone:text-2xl tablet:text-3xl laptop:text-4xl font-black leading-tight mb-6 tablet:mb-8 text-white">{selectedNews.title}</h1>

                      {imageUrl && (
                        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
                          <img 
                            src={imageUrl} 
                            alt="feature" 
                            className="w-full object-cover max-h-[550px]" 
                            onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
                          />
                        </div>
                      )}

                      <div className="prose prose-invert max-w-none text-white/80 leading-relaxed text-lg pb-20">
                        {body?.split('\n').map((para, idx) => (
                          para.trim() && <p key={idx} className="mb-6">{para}</p>
                        ))}
                      </div>
                    </>
                  );
                })()}

                <div className="mt-12 mb-8 pt-8 border-t border-white/5">
                  <p className="text-[11px] text-white/20 italic tracking-wider uppercase">
                    © 2026 Decision Stock Advisor · Institutional Grade Analysis
                  </p>
                </div>
              </div>
            </article>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-white/5 bg-[#0B1220]">
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