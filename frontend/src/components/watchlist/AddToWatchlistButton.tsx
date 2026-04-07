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

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        title={inList ? "Already in watchlist" : "Add to watchlist"}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider
          transition-all border
          ${inList
            ? "bg-blue-500/20 text-blue-400 border-blue-500/40 cursor-default"
            : "bg-black/60 text-white border-white/10 hover:bg-white/10 hover:border-white/20"
          }
          ${isDisabled ? "opacity-70 cursor-not-allowed" : ""}
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
            absolute top-full right-0 mt-1.5 z-50 px-3 py-2 rounded-lg text-[11px] font-bold
            shadow-lg border whitespace-nowrap
            ${notification.type === "info" && "bg-blue-500/20 text-blue-300 border-blue-500/40"}
            ${notification.type === "success" && "bg-green-500/20 text-green-300 border-green-500/40"}
            ${notification.type === "error" && "bg-red-500/20 text-red-300 border-red-500/40"}
          `}
        >
          {notification.text}
        </div>
      )}
    </div>
  );
}
