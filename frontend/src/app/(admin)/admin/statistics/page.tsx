"use client";

import { useEffect, useState } from "react";
import { AdminService } from "@/src/services/Admin.service";
import { Loader2, TrendingUp } from "lucide-react";

type WatchedItem = {
  symbol: string;
  watch_count: number;
  user_count: number;
  company_name?: string;
};

export default function AdminStatisticsPage() {
  const [data, setData] = useState<WatchedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await AdminService.statistics.mostWatched();
        setData(res.data ?? []);
      } catch (e) {
        console.error(e);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-3">
      <section className="dsa-terminal-page-head">
        <div>
          <p className="dsa-section-label">Usage analytics</p>
          <h1 className="mt-0.5 text-sm font-semibold text-white">Most watched companies</h1>
          <p className="mt-0.5 text-[10px] text-[var(--dsa-text-muted)]">
            Aggregated watchlist demand across users.
          </p>
        </div>
        <div className="font-mono text-[10px] text-[var(--dsa-text-muted)]">
          {data.length} symbols
        </div>
      </section>

      <section className="dsa-terminal-panel overflow-hidden">
        <div className="dsa-terminal-panel-head">
          <div>
            <p className="text-xs font-semibold text-white">Watchlist ranking</p>
            <p className="text-[10px] text-[var(--dsa-text-muted)]">Sorted by stored watchlist activity from the admin statistics endpoint.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-xs text-[var(--dsa-text-muted)]">
            <Loader2 size={15} className="animate-spin" />
            Loading statistics…
          </div>
        ) : data.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-[var(--dsa-text-muted)]">No watchlist data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="dsa-terminal-table min-w-[700px]">
              <thead>
                <tr>
                  <th className="text-right">#</th>
                  <th className="text-left">Symbol</th>
                  <th className="text-left">Company</th>
                  <th className="text-right">Watchlist adds</th>
                  <th className="text-right">Unique users</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={item.symbol}>
                    <td className="text-right font-mono tabular-nums text-[var(--dsa-text-muted)]">{idx + 1}</td>
                    <td className="font-mono font-semibold text-[#8ab4ff]">{item.symbol}</td>
                    <td className="text-[var(--dsa-text-secondary)]">{item.company_name ?? "—"}</td>
                    <td className="text-right">
                      <span className="inline-flex items-center justify-end gap-1 font-mono tabular-nums text-white">
                        <TrendingUp size={12} className="text-[var(--dsa-positive)]" />
                        {item.watch_count}
                      </span>
                    </td>
                    <td className="text-right font-mono tabular-nums text-[var(--dsa-text-secondary)]">{item.user_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
