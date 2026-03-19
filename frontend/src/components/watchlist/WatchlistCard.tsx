"use client";

import { useState, useCallback, useEffect } from "react";
import { BookmarkPlus, X, Loader2 } from "lucide-react";
import { useWatchlist } from "@/src/hooks/useWatchlist";

export default function WatchlistCard() {
  const { items, loading, add, remove } = useWatchlist();
  const [inputSymbol, setInputSymbol] = useState("");
  const [adding, setAdding] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  const handleAdd = useCallback(async () => {
    const sym = inputSymbol.trim().toUpperCase();
    if (!sym) return;
    if (adding) return;

    setAdding(true);
    const result = await add(sym);
    setAdding(false);

    if (result.ok) {
      setInputSymbol("");
      setNotification({ text: `${sym} added to watchlist`, type: "success" });
    } else {
      setNotification({ text: result.message || "Failed to add", type: result.message?.includes("Already") ? "info" : "error" });
    }
  }, [inputSymbol, add, adding]);

  const handleRemove = useCallback(async (symbol: string) => {
    await remove(symbol);
  }, [remove]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0F172A]/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all hover:border-white/20">
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="text-sm font-semibold text-white">Quick watchlist</h3>
      </div>
      <div className="px-5 pb-5 pt-3 space-y-3">
        {/* Add input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add symbol (e.g. AAPL)"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !inputSymbol.trim()}
            className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
            Add
          </button>
        </div>

        {notification && (
          <div
            className={`text-[11px] font-bold px-2 py-1 rounded
              ${notification.type === "info" && "bg-blue-500/20 text-blue-300"}
              ${notification.type === "success" && "bg-green-500/20 text-green-300"}
              ${notification.type === "error" && "bg-red-500/20 text-red-300"}
            `}
          >
            {notification.text}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center gap-2 text-white/50 text-sm py-2">
            <Loader2 size={14} className="animate-spin" />
            Loading...
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-white/40 py-2">No symbols yet. Add one above.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-black/20 hover:bg-black/30 group"
              >
                <span className="text-sm font-bold text-white">{item.symbol}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.symbol)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-all"
                  title="Remove from watchlist"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
