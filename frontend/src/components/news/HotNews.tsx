/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import newsService from "../../../src/services/News.service";

export default function HotNews() {
  const [hotNews, setHotNews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper tách ảnh từ content bài viết (giống logic trang news list)
  const parseContent = (content: string) => {
    const imgPrefix = "Image URL: ";
    if (content?.startsWith(imgPrefix)) {
      const parts = content.split("\n\n");
      const imageUrl = parts[0].replace(imgPrefix, "").trim();
      return { imageUrl: imageUrl !== "null" ? imageUrl : null };
    }
    return { imageUrl: null };
  };

  useEffect(() => {
    const fetchHotNews = async () => {
      try {
        setIsLoading(true);
        // Lấy 4 tin tức mới nhất
        const newsRes = await newsService.getAllNews({ page: 1, per_page: 4 });
        setHotNews(newsRes.data || []);
      } catch (e) {
        console.error("Failed to load hot news", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHotNews();
  }, []);

  if (!isLoading && hotNews.length === 0) return null;

  return (
    <section className="px-6 py-20 bg-[#0B1220] border-t border-white/5">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-orange-500">🔥</span> Hot Market News
          </h2>
          <Link 
            href="/news" 
            className="text-sm text-blue-400 hover:underline flex items-center gap-1 group"
          >
            View all 
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading 
            ? [1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[320px] rounded-[2rem] bg-white/5 animate-pulse" />
              ))
            : hotNews.map((news) => {
                const { imageUrl } = parseContent(news.content || "");
                return (
                  <Link 
                    href={`/news/${news.url_slug}`} 
                    key={news.id} 
                    className="group p-5 rounded-[2rem] bg-[#161D2C]/80 border border-white/10 hover:border-blue-500/40 transition-all flex flex-col shadow-lg"
                  >
                    {imageUrl && (
                      <div className="relative h-40 w-full mb-4 overflow-hidden rounded-2xl border border-white/5">
                        <img 
                          src={imageUrl} 
                          alt="news" 
                          className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          onError={(e: any) => (e.currentTarget.parentElement.style.display = 'none')}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-[10px] text-white/40 mb-2 uppercase font-bold tracking-widest">
                        {news.author?.split(',')[0]} · {new Date(news.published_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                      <h3 className="text-sm font-semibold line-clamp-3 leading-snug group-hover:text-blue-400 transition-colors">
                        {news.topic}
                      </h3>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-green-500/10 text-green-400 uppercase">
                        Analysis Ready
                      </span>
                      <ChevronRight size={14} className="text-white/20 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                );
              })
          }
        </div>
      </div>
    </section>
  );
}