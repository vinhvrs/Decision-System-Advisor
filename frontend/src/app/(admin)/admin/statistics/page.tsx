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
    <div>
      <h1 className="text-2xl font-bold mb-2">Most Watched Companies</h1>
      <p className="text-white/60 text-sm mb-6">
        Based on watchlist entries from all users. Shows which symbols are most added to watchlists.
      </p>

      <div className="rounded-xl border border-white/10 overflow-hidden bg-[#161D2C]">
        {loading ? (
          <div className="p-12 text-center text-white/60 flex items-center justify-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Loading...
          </div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-white/60">No watchlist data yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-white/60">
                  <th className="p-4 font-medium">#</th>
                  <th className="p-4 font-medium">Symbol</th>
                  <th className="p-4 font-medium">Company</th>
                  <th className="p-4 font-medium">Total Watchlist Adds</th>
                  <th className="p-4 font-medium">Unique Users</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={item.symbol} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4 font-bold text-white/60">{idx + 1}</td>
                    <td className="p-4 font-mono font-bold">{item.symbol}</td>
                    <td className="p-4">{item.company_name ?? "—"}</td>
                    <td className="p-4">
                      <span className="flex items-center gap-1 text-blue-400">
                        <TrendingUp size={14} />
                        {item.watch_count}
                      </span>
                    </td>
                    <td className="p-4">{item.user_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
