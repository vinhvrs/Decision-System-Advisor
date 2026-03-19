"use client";

import { useState, useCallback, useRef } from "react";
import { TradingServices } from "@/src/services/Trading.service";
import type { Tickets, PaginatedTickets } from "@/src/types/Tickets";

const PAGE_SIZE = 15;

export function useClosedHistory() {
  const [history, setHistory] = useState<Tickets[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(1);

  const loadPage = useCallback(async (page: number, append: boolean) => {
    const setLoadState = append ? setLoadingMore : setLoading;
    setLoadState(true);
    setError(null);
    try {
      const result = await TradingServices.getClosedTickets(page, PAGE_SIZE);
      const data = result.data ?? [];
      setHistory((prev) => (append ? [...prev, ...data] : data));
      setHasMore((result.current_page ?? 1) < (result.last_page ?? 1));
      pageRef.current = page;
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { status?: number } }).response?.status === 401
            ? "401"
            : e instanceof Error
              ? e.message
              : "Failed to load history"
          : "Failed to load history";
      setError(msg);
      if (!append) setHistory([]);
    } finally {
      setLoadState(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    loadPage(pageRef.current + 1, true);
  }, [loadPage, loading, loadingMore, hasMore]);

  const loadInitial = useCallback(() => {
    pageRef.current = 1;
    loadPage(1, false);
  }, [loadPage]);

  return {
    history,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    loadInitial,
  };
}
