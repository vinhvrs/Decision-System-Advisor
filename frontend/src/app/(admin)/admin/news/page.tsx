"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { useDebouncedValue } from "@/src/hooks/useDebouncedValue";
import { Loader2, Trash2 } from "lucide-react";

type NewsItem = {
  id: string;
  title: string;
  symbol?: string;
  published_at?: string;
  source?: string;
  author?: string;
};

export default function AdminNewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 400);
  const appliedSearchRef = useRef("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchNews = useCallback(async (page = 1, searchTerm?: string) => {
    const raw = searchTerm !== undefined ? searchTerm : appliedSearchRef.current;
    const term = raw.trim() || undefined;
    setLoading(true);
    try {
      const res = await AdminService.news.list({
        page,
        per_page: 15,
        search: term,
      });
      setNews(res.data ?? []);
      setPagination({
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
      });
      appliedSearchRef.current = raw.trim();
    } catch (e) {
      console.error(e);
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(1, debouncedSearch);
  }, [debouncedSearch, fetchNews]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this news article?")) return;
    setDeleting(id);
    try {
      await AdminService.news.delete(id);
      await fetchNews(pagination.current_page);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div>
          <p className="dsa-section-label">Content operations</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">News management</h1>
        </div>
        <div className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
          Page {pagination.current_page}/{pagination.last_page}
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <input
            type="text"
            placeholder="Filter title / content"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchNews(1, search)}
            className="dsa-control h-7 min-h-0 w-[320px] max-w-[68vw] px-2.5 text-[11px] outline-none"
          />
          <button
            type="button"
            onClick={() => fetchNews(1, search)}
            className="dsa-button-secondary min-h-0 px-2.5 py-1 text-[10px]"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
            <Loader2 size={15} className="animate-spin" />
            Loading news…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dsa-terminal-table min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left">Title</th>
                  <th className="text-left">Symbol</th>
                  <th className="text-left">Published</th>
                  <th className="text-left">Source</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {news.map((item) => (
                  <tr key={item.id}>
                    <td className="max-w-[420px]">
                      <span className="block truncate text-[11px] font-medium text-white" title={item.title}>
                        {item.title}
                      </span>
                    </td>
                    <td className="font-mono text-[10px] text-[#8ab4ff]">{item.symbol ?? "—"}</td>
                    <td className="font-mono text-[10px] text-[var(--dsa-text-muted)]">{formatDate(item.published_at)}</td>
                    <td className="max-w-[200px] truncate text-[10px] text-[var(--dsa-text-secondary)]">{item.source ?? "—"}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="inline-flex min-h-7 items-center justify-center rounded-[var(--dsa-radius-sm)] border border-[rgba(231,91,100,0.25)] px-2 text-[var(--dsa-negative)] hover:bg-[rgba(231,91,100,0.08)] disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === item.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--dsa-border)] px-3 py-2">
            <span className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
              {pagination.current_page} / {pagination.last_page}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={pagination.current_page <= 1}
                onClick={() => fetchNews(pagination.current_page - 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => fetchNews(pagination.current_page + 1)}
                className="dsa-button-secondary min-h-0 px-2 py-1 text-[10px] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
