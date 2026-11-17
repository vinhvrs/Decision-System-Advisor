"use client";

import { useState, useCallback, useEffect } from "react";
import { BookmarkPlus, BookmarkCheck, Loader2 } from "lucide-react";
import { useWatchlist } from "@/src/hooks/useWatchlist";

interface AddToWatchlistButtonProps {
  symbol: string;
  className?: string;
}

export default function AddToWatchlistButton({ symbol, className = "" }: AddToWatchlistButtonProps) {
  const { add, isInWatchlist, loading: listLoading } = useWatchlist();
  const [adding, setAdding] = useState(false);
  const [notification, setNotification] = useState<{ text: string; type: "info" | "success" | "error" } | null>(null);

  const inList = isInWatchlist(symbol);

  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(t);
  }, [notification]);

  const handleClick = useCallback(async () => {
    if (listLoading || adding) return;

    if (inList) {
      setNotification({ text: "Already in watchlist", type: "info" });
      return;
    }

    setAdding(true);
    const result = await add(symbol);
    setAdding(false);

    if (result.ok) {
      setNotification({ text: "Added to watchlist", type: "success" });
    } else {
      setNotification({ text: result.message || "Failed to add", type: "error" });
    }
  }, [symbol, inList, add, listLoading, adding]);

  const isDisabled = listLoading || adding;

  if (!listLoading && inList) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={inList ? "Already in watchlist" : "Add to watchlist"}
        className={`
          inline-flex min-h-8 items-center gap-1.5 rounded-[var(--dsa-radius-sm)] border px-2.5 py-1.5
          text-[10px] font-semibold transition-colors
          ${inList
            ? "cursor-default border-[rgba(76,141,255,0.35)] bg-[var(--dsa-accent-soft)] text-[#b8d1ff]"
            : "border-[var(--dsa-border-strong)] bg-[var(--dsa-surface-2)] text-[var(--dsa-text-secondary)] hover:border-[var(--dsa-accent)] hover:text-white"
          }
          ${isDisabled ? "cursor-not-allowed opacity-60" : ""}
        `}
      >
        {adding ? (
          <Loader2 size={12} className="animate-spin shrink-0" />
        ) : inList ? (
          <BookmarkCheck size={12} className="shrink-0" />
        ) : (
          <BookmarkPlus size={12} className="shrink-0" />
        )}
        <span>{inList ? "In watchlist" : "Add to watchlist"}</span>
      </button>

      {notification && (
        <div
          className={`
            absolute right-0 top-full z-50 mt-1.5 whitespace-nowrap rounded-[var(--dsa-radius-sm)]
            border bg-[var(--dsa-surface-2)] px-3 py-2 text-[10px] font-medium shadow-lg
            ${notification.type === "info" && "border-[rgba(76,141,255,0.4)] text-[#b8d1ff]"}
            ${notification.type === "success" && "border-[rgba(44,182,125,0.4)] text-[var(--dsa-positive)]"}
            ${notification.type === "error" && "border-[rgba(231,91,100,0.4)] text-[var(--dsa-negative)]"}
          `}
        >
          {notification.text}
        </div>
      )}
    </div>
  );
}
