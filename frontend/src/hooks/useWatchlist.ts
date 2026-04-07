"use client";

import { useState, useEffect, useCallback } from "react";
import { WatchlistService, type WatchlistItem } from "@/src/services/Watchlist.service";

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await WatchlistService.list(true);
      setItems(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load watchlist";
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const add = useCallback(
    async (symbol: string): Promise<{ ok: boolean; message?: string }> => {
      const sym = (symbol || "").trim().toUpperCase();
      if (!sym) return { ok: false, message: "Invalid symbol" };

      const exists = items.some(
        (i) => (i.symbol || "").toUpperCase() === sym
      );
      if (exists) return { ok: false, message: "Already in watchlist" };

      try {
        await WatchlistService.add(sym);
        await fetch();
        return { ok: true };
      } catch (e: unknown) {
        const res = e as { response?: { status?: number; data?: { message?: string } } };
        if (res?.response?.status === 401) {
          return { ok: false, message: "Please sign in to add to watchlist" };
        }
        const msg = res?.response?.data?.message || (e instanceof Error ? e.message : "Failed to add");
        return { ok: false, message: msg };
      }
    },
    [items, fetch]
  );

  const remove = useCallback(
    async (symbol: string): Promise<boolean> => {
      try {
        await WatchlistService.remove(symbol);
        await fetch();
        return true;
      } catch {
        return false;
      }
    },
    [fetch]
  );

  const isInWatchlist = useCallback(
    (symbol: string): boolean => {
      const sym = (symbol || "").toUpperCase();
      return items.some((i) => (i.symbol || "").toUpperCase() === sym);
    },
    [items]
  );

  return { items, loading, error, add, remove, isInWatchlist, refetch: fetch };
}
