/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Clock, Newspaper, ArrowUp, ChevronLeft } from "lucide-react";

// Đảm bảo đường dẫn import chính xác theo cấu trúc thư mục của bạn
import newsService from "../../../../services/News.service";
import { News } from "../../../../types/News";

export default function NewsDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [news, setNews] = useState<News | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const parseContent = (content: string) => {
    const imgPrefix = "Image URL: ";
    if (content?.startsWith(imgPrefix)) {
      const parts = content.split("\n\n");
      const imageUrl = parts[0].replace(imgPrefix, "").trim();
      const body = parts.slice(1).join("\n\n");
      return { imageUrl: imageUrl !== "null" ? imageUrl : null, body };
    }
    return { imageUrl: null, body: content };
  };

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        if (!params.slug) return;
        const res = await newsService.getBySlug(params.slug as string);
        setNews(res);
      } catch (e) {
        console.error("Failed to load news detail", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [params.slug]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-white/20 animate-pulse">
          <Newspaper size={48} />
          <p className="font-mono text-xs uppercase tracking-widest italic text-blue-400">Syncing Flow...</p>
        </div>
      </div>
    );
  }

  if (!news) return null;

  const { imageUrl, body } = parseContent(news.content || "");

  return (
    <main className="min-h-screen bg-[#0B1220] text-white selection:bg-blue-500/30 relative">
      <article className="max-w-4xl mx-auto px-6 pt-16 pb-32">
        {/* METADATA */}
        <div className="flex items-center gap-3 mb-8">
          <span className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
            {news.author?.split(',')[0] || "MARKET ANALYSIS"}
          </span>
          <div className="h-1 w-1 rounded-full bg-white/20" />
          <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
            <Clock size={14} />
            {new Date(news.published_at as any).toLocaleString("vi-VN", { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>

        {/* HEADLINE */}
        <h1 className="text-4xl md:text-6xl font-black leading-[1.05] tracking-tight mb-12 text-white/95">
          {news.topic}
        </h1>

        {/* FEATURED IMAGE */}
        {imageUrl && (
          <div className="relative mb-16 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5 shadow-2xl">
            <img 
              src={imageUrl} 
              alt="feature" 
              className="w-full object-cover max-h-[550px]" 
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        )}

        {/* CONTENT BODY */}
        <div className="prose prose-invert prose-lg max-w-none">
          <div className="text-white/80 leading-[1.8] text-xl font-medium space-y-10">
            {body?.split('\n').map((para, idx) => (
              para.trim() && <p key={idx}>{para}</p>
            ))}
          </div>
        </div>

        {/* FOOTER DISCLAIMER */}
        <footer className="mt-24 pt-12 border-t border-white/5 opacity-40">
          <p className="text-sm italic leading-relaxed">
            © Copyright {news.author?.split(',')[0] || "Reuters"} 2026. This data is part of the Decision Stocks Advisor automated news flow.
          </p>
        </footer>
      </article>

      {/* FIXED CORNER BUTTONS */}
      {/* Nút bên trái - Quay lại feed */}
      <div className="fixed bottom-6 left-6 z-50">
        <button 
          onClick={() => router.push('/news')}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#161D2C]/90 backdrop-blur-xl border border-white/10 text-white font-bold hover:bg-white/10 hover:border-blue-500/40 transition-all shadow-2xl group"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">News feed</span>
        </button>
      </div>

      {/* Nút bên phải - Lên đầu trang */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={scrollToTop}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#161D2C]/90 backdrop-blur-xl border border-white/10 text-white font-bold hover:bg-white/10 hover:border-blue-500/40 transition-all shadow-2xl group"
        >
          <span className="text-sm">Top</span>
          <ArrowUp size={18} className="group-hover:-translate-y-1 transition-transform" />
        </button>
      </div>
    </main>
  );
}