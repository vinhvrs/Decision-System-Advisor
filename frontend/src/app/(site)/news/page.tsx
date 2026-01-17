/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import newsService from "../../../services/News.service";
import { News } from "../../../types/News";

type NewsLaravelResponse = {
  current_page: number;
  data: News[];
  per_page: number;
  next_page_url: string | null;
};

export default function NewsListPage() {
  const [items, setItems] = useState<News[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const [isLoading, setIsLoading] = useState(true); // first load
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [hasMore, setHasMore] = useState(true); // chỉ cần next hay không

  // ===== fetch page (append) =====
  const fetchPage = async (targetPage: number, mode: "replace" | "append") => {
    try {
      if (mode === "replace") setIsLoading(true);
      else setIsLoadingMore(true);

      setError(null);

      const rawResponse = await newsService.getAllNews({
        page: targetPage,
        per_page: perPage,
      });

      const res: NewsLaravelResponse = {
        current_page: rawResponse.pagination.currentPage,
        data: rawResponse.data,
        per_page: rawResponse.pagination.perPage,
        next_page_url: rawResponse.pagination.currentPage < rawResponse.pagination.totalPages ? "next" : null,
      };

      const batch = Array.isArray(res.data) ? res.data : [];
      setPerPage(res.per_page || perPage);

      if (mode === "replace") {
        setItems(batch);
      } else {
        setItems((prev) => {
          // tránh duplicate nếu API có thể trả trùng
          const map = new Map<string, News>();
          prev.forEach((x) => map.set(x.id || x.url_slug, x));
          batch.forEach((x) => map.set(x.id || x.url_slug, x));
          return Array.from(map.values());
        });
      }

      // quyết định còn trang sau không
      // ưu tiên dùng next_page_url
      if (res.next_page_url) {
        setHasMore(true);
      } else {
        // fallback: nếu batch < per_page => hết
        setHasMore(batch.length >= (res.per_page || perPage));
      }

      setPage(res.current_page || targetPage);
    } catch (e) {
      console.error("News fetch error:", e);
      setError("Không thể tải tin tức. Vui lòng kiểm tra kết nối API.");
      if (mode === "replace") setItems([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // ===== initial load =====
  useEffect(() => {
    fetchPage(1, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== load more =====
  const loadMore = () => {
    if (isLoadingMore || !hasMore) return;
    fetchPage(page + 1, "append");
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">News</h1>
        <p className="mt-2 text-white/60">Market headlines — TradingView vibe</p>
        <div className="mt-6 h-px w-full bg-white/10" />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/80">
          Đang tải tin tức...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/70">
          Không có tin tức nào.
        </div>
      ) : (
        <>
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={item.id || item.url_slug}
                className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition
                           hover:bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
              >
                <Link href={`/news/${item.url_slug}`} className="block">
                  <h2 className="text-xl font-bold text-white transition group-hover:text-blue-300">
                    {item.topic}
                  </h2>

                  <p className="mt-2 text-sm text-white/50">
                    {item.author ? `Tác giả: ${item.author} • ` : ""}
                    Ngày:{" "}
                    {item.published_at
                      ? new Date(item.published_at as any).toLocaleString("vi-VN")
                      : "—"}
                  </p>

                  <p className="mt-3 text-white/75 leading-relaxed">
                    {(item.content || "").substring(0, 160)}...
                  </p>

                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-400 group-hover:underline">
                    Xem chi tiết <span className="text-base leading-none">›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* ✅ Only Next page (Load more) */}
          <div className="mt-10 flex justify-center">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className={[
                  "h-11 rounded-full px-6 text-sm font-semibold transition",
                  "border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </button>
            ) : (
              <div className="text-sm text-white/45">You’re all caught up.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
