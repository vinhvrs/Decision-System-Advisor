"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
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
    <section className="rounded-[var(--dsa-radius-md)] border border-[var(--dsa-border)] bg-[var(--dsa-surface-1)]">
      <div className="flex items-center justify-between border-b border-[var(--dsa-border)] px-3 py-2">
        <h3 className="text-xs font-semibold text-white">Quick watchlist</h3>
      </div>
      <div className="space-y-3 px-3 py-3">
        {/* Add input */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add symbol (e.g. AAPL)"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="dsa-control min-w-0 flex-1 px-3 py-2 text-sm placeholder:text-[var(--dsa-text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !inputSymbol.trim()}
            className="dsa-button-primary px-3 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
            Add
          </button>
        </div>

        {notification && (
          <div
            className={`rounded-[var(--dsa-radius-sm)] px-2 py-1 text-[11px] font-medium
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
                className="group flex items-center justify-between rounded-[var(--dsa-radius-sm)] border border-transparent px-2 py-1.5 hover:border-[var(--dsa-border)] hover:bg-[var(--dsa-surface-2)]"
              >
                <Link
                  href={`/companies/profile/${String(item.symbol || "").toLowerCase()}`}
                  className="font-mono text-sm font-semibold text-white transition-colors hover:text-[#8ab4ff]"
                >
                  {item.symbol}
                </Link>
                <button
                  type="button"
                  onClick={() => handleRemove(item.symbol)}
                  className="rounded-[var(--dsa-radius-sm)] p-1 text-[var(--dsa-text-muted)] transition-colors hover:bg-[rgba(231,91,100,0.12)] hover:text-[var(--dsa-negative)] group-hover:text-[var(--dsa-negative)]"
                  title="Remove from watchlist"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
