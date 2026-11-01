/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Newspaper, X, Clock, User, ExternalLink, ImageOff } from "lucide-react";
import newsService from "@/src/services/News.service";
import { News } from "@/src/types/News";

export default function NewsListPage() {
  const [items, setItems] = useState<News[]>([]);
  const [selectedNews, setSelectedNews] = useState<News | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
      setIsLoadingMore(false);
    }
  };

  useEffect(() => { fetchPage(1, "replace"); }, []);

  return (
    /* 1. Đặt chiều cao main khớp chính xác với viewport trừ đi Header (64px) */
    <main className="flex h-[calc(100vh-64px)] w-full overflow-hidden bg-[#0B1220] text-white">
      
      {/* 2. Cột danh sách bên trái: Chiều cao h-full để chạm đáy */}
      <section className="flex h-full w-full flex-col border-r border-white/10 md:w-[400px] lg:w-[450px]">
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
                return (
                  <div
                    key={item.id || item.id}
                    onClick={() => setSelectedNews(item)}
                    className={`flex gap-4 cursor-pointer p-4 transition-all hover:bg-white/5 ${
                      selectedNews?.id === item.id ? "bg-blue-500/10 border-l-4 border-blue-500" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-white/40 mb-1">
                        <Clock size={12} />
                        {item.published_at ? new Date(item.published_at as any).toLocaleTimeString("vi-VN") : "Just now"}
                        <span className="text-blue-400/80">• {item.author?.split(',')[0] || "Reuters"}</span>
                      </div>
                      <h2 className={`text-sm font-semibold leading-snug line-clamp-2 ${
                        selectedNews?.id === item.id ? "text-blue-400" : "text-white/90"
                      }`}>
                        {item.title}
                      </h2>
                    </div>
                    {imageUrl && (
                      <div className="relative h-14 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-white/5">
                        <img src={imageUrl} alt="thumb" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => fetchPage(page + 1, "append")} className="w-full p-4 text-xs font-bold text-white/40 hover:text-white transition-colors">
                  {isLoadingMore ? "Loading..." : "Load more news"}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. Cột nội dung bên phải: Sử dụng h-full và loại bỏ padding bottom dư thừa */}
      <section className="hidden h-full flex-1 flex-col bg-[#0b1220] md:flex">
        {selectedNews ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-end p-4 border-b border-white/5">
               <button onClick={() => setSelectedNews(null)} className="text-white/40 hover:text-white"><X size={24} /></button>
            </div>
            
            <article className="flex-1 overflow-y-auto p-8 lg:p-12 custom-scrollbar">
              <div className="max-w-3xl mx-auto">
                {(() => {
                  const { imageUrl, body } = parseContent(selectedNews.content || "");
                  return (
                    <>
                      <div className="mb-6 flex items-center gap-3">
                        <span className="rounded-lg bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white/40 border border-white/10">
                          {selectedNews.author?.split(',')[0] || "Market News"}
                        </span>
                      </div>

                      <h1 className="text-3xl lg:text-4xl font-black leading-tight mb-8">{selectedNews.title}</h1>

                      {imageUrl && (
                        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl">
                          <img 
                            src={imageUrl} 
                            alt="feature" 
                            className="w-full object-cover max-h-[500px]" 
                            onError={(e) => (e.currentTarget.parentElement!.style.display = 'none')}
                          />
                        </div>
                      )}

                      <div className="prose prose-invert max-w-none text-white/80 leading-relaxed text-lg">
                        {body?.split('\n').map((para, idx) => (
                          para.trim() && <p key={idx} className="mb-6">{para}</p>
                        ))}
                      </div>
                    </>
                  );
                })()}

                {/* Footer chân trang - Đặt margin bottom thấp để sát cạnh */}
                <div className="mt-12 mb-6 pt-6 border-t border-white/5">
                  <p className="text-[11px] text-white/30 italic">
                    © 2026 Decision Stock Advisor · Academic Project
                  </p>
                </div>
              </div>
            </article>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-white/5">
            <Newspaper size={80} strokeWidth={1} />
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