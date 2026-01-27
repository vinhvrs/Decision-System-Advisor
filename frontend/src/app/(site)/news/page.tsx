/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, ChevronRight, X, Clock, User, ExternalLink } from "lucide-react";
import newsService from "../../../services/News.service";
import { News } from "../../../types/News";

export default function NewsListPage() {
  const [items, setItems] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = async (targetPage: number, mode: "replace" | "append") => {
    try {
      mode === "replace" ? setIsLoading(true) : setIsLoadingMore(true);
      const res = await newsService.getAllNews({ page: targetPage, per_page: 15 });
      
      const batch = res.data || [];
      if (mode === "replace") {
        setItems(batch);
        if (batch.length > 0) setSelectedNews(batch[0]); // Mặc định mở tin đầu tiên
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

  return (
    <main className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0B1220] text-white">
      {/* 1. LEFT SIDE: NEWS FEED (40%) */}
      <section className="flex w-full flex-col border-r border-white/10 md:w-[400px] lg:w-[450px]">
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
              {items.map((item) => (
                <div
                  key={item.id || item.url_slug}
                  onClick={() => setSelectedNews(item)}
                  className={`cursor-pointer p-4 transition-all hover:bg-white/5 ${
                    selectedNews?.id === item.id ? "bg-blue-500/10 border-l-4 border-blue-500" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-white/40 mb-1">
                    <Clock size={12} />
                    {item.published_at ? new Date(item.published_at as any).toLocaleTimeString("vi-VN") : "Just now"}
                    <span>•</span>
                    <span className="text-blue-400/80">{item.author || "Reuters"}</span>
                  </div>
                  <h2 className={`text-sm font-semibold leading-snug transition-colors ${
                    selectedNews?.id === item.id ? "text-blue-400" : "text-white/90"
                  }`}>
                    {item.topic}
                  </h2>
                </div>
              ))}
              
              {hasMore && (
                <button
                  onClick={() => fetchPage(page + 1, "append")}
                  disabled={isLoadingMore}
                  className="w-full p-4 text-xs font-bold text-white/40 hover:text-white transition-colors"
                >
                  {isLoadingMore ? "Loading..." : "Load more news"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. RIGHT SIDE: CONTENT DETAIL (60%) */}
      <section className="hidden flex-1 flex-col bg-[#111827] md:flex">
        {selectedNews ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end p-4 border-b border-white/5">
               <button onClick={() => setSelectedNews(null)} className="text-white/40 hover:text-white">
                  <X size={24} />
               </button>
            </div>
            
            <article className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                  <div className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/10">
                    {selectedNews.author || "Market News"}
                  </div>
                </div>

                <h1 className="text-3xl lg:text-4xl font-black leading-tight mb-6">
                  {selectedNews.topic}
                </h1>

                <div className="flex items-center gap-6 text-sm text-white/40 mb-10 pb-6 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span>{selectedNews.author || "Reuters"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>{new Date(selectedNews.published_at as any).toLocaleString("vi-VN")}</span>
                  </div>
                </div>

                <div className="prose prose-invert max-w-none text-white/80 leading-relaxed text-lg">
                  {selectedNews.content?.split('\n').map((para, idx) => (
                    <p key={idx} className="mb-6">{para}</p>
                  ))}
                </div>

                <div className="mt-12 p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                  <p className="text-sm text-white/40 mb-4 tracking-wide italic">
                    © Copyright {selectedNews.author || "Reuters"} 2026. All rights reserved.
                  </p>
                  <Link href={`/news/${selectedNews.url_slug}`} className="inline-flex items-center gap-2 text-blue-400 font-bold hover:underline">
                    Permalink to this news <ExternalLink size={16} />
                  </Link>
                </div>
              </div>
            </article>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-white/10">
            <div className="text-center">
              <Newspaper size={64} className="mx-auto mb-4 opacity-10" />
              <p>Select a headline to read full story</p>
            </div>
          </div>
        )}
      </section>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </main>
  );
}