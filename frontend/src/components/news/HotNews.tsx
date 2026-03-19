/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock } from "lucide-react"; // Thêm icon Clock cho đẹp
import newsService from "@/src/services/News.service";

export default function HotNews() {
  const [hotNews, setHotNews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Logic xử lý thời gian ---
  const formatRelativeDate = (dateString: string) => {
    const now = new Date();
    const publishedDate = new Date(dateString);
    const diffInMs = now.getTime() - publishedDate.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return `${diffInMinutes <= 0 ? 1 : diffInMinutes} minutes ago`;
    }

    if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    }

    // Nếu qua ngày hôm sau thì hiển thị DD/MM/YYYY
    return publishedDate.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Helper tách ảnh từ content
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
    <section className="px-4 phone:px-5 tablet:px-6 py-6 tablet:py-10 bg-[#0B1220] border-t border-white/5">
      <div className="grid grid-cols-1 tablet:grid-cols-2 laptop:grid-cols-4 gap-4 tablet:gap-6">
        {isLoading
          ? [1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[320px] rounded-[2rem] bg-white/5 animate-pulse" />
          ))
          : hotNews.map((news) => {
            const { imageUrl } = parseContent(news.content || "");
            return (
              <Link
                href={`/news/${news.id}`}
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
                  <div className="flex items-center gap-2 text-[10px] text-white/40 mb-2 uppercase font-bold tracking-widest">
                    <span className="text-blue-400">{news.author?.split(',')[0]}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Clock size={10} />
                      {formatRelativeDate(news.published_at)}
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold line-clamp-3 leading-snug group-hover:text-blue-400 transition-colors">
                    {news.title}
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
    </section>
  );
}