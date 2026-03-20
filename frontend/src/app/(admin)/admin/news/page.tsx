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
    <div>
      <h1 className="text-2xl font-bold mb-6">News Management</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by title or content..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchNews(1, search)}
          className="px-4 py-2 rounded-lg bg-[#161D2C] border border-white/10 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-w-[250px]"
        />
        <button
          onClick={() => fetchNews(1, search)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
        >
          Search
        </button>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-[#161D2C]">
        {loading ? (
          <div className="p-12 text-center text-white/60 flex items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-white/60">
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Symbol</th>
                  <th className="p-4 font-medium">Published</th>
                  <th className="p-4 font-medium">Source</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {news.map((n) => (
                  <tr key={n.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 max-w-[300px] truncate" title={n.title}>
                      {n.title}
                    </td>
                    <td className="p-4 font-mono">{n.symbol ?? "—"}</td>
                    <td className="p-4 text-sm">{formatDate(n.published_at)}</td>
                    <td className="p-4 text-sm max-w-[150px] truncate">{n.source ?? "—"}</td>
                    <td className="p-4">
                      <button
                        onClick={() => handleDelete(n.id)}
                        disabled={deleting === n.id}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === n.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.last_page > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={pagination.current_page <= 1}
            onClick={() => fetchNews(pagination.current_page - 1)}
            className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-white/60">
            {pagination.current_page} / {pagination.last_page}
          </span>
          <button
            disabled={pagination.current_page >= pagination.last_page}
            onClick={() => fetchNews(pagination.current_page + 1)}
            className="px-4 py-2 rounded-lg bg-white/10 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
