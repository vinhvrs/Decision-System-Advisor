"use client";

import { useState, useCallback, useEffect } from "react";
import {
  TradingServices,
} from "@/src/services/Trading.service";
import type { TicketsWithPnl } from "@/src/types/Tickets";
import { readIsLoggedIn } from "@/src/hooks/useAuth";

export function usePositions(perPage = 100) {
  const [positions, setPositions] = useState<TicketsWithPnl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!readIsLoggedIn()) {
      setPositions([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await TradingServices.getPositions(perPage);
      const unique = [...new Map((data ?? []).map((p) => [p.id, p])).values()];
      setPositions(unique);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e && (e as { response?: { status?: number } }).response?.status === 401
          ? "401"
          : e instanceof Error
            ? e.message
            : "Failed to fetch positions";
      setError(msg);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  useEffect(() => {
    const onTicketChanged = () => fetchPositions();
    const onAuthChanged = () => fetchPositions();
    window.addEventListener("ticket-changed", onTicketChanged);
    window.addEventListener("auth-changed", onAuthChanged);
    return () => {
      window.removeEventListener("ticket-changed", onTicketChanged);
      window.removeEventListener("auth-changed", onAuthChanged);
    };
  }, [fetchPositions]);

  const closePosition = useCallback(
    async (ticketId: string, closePrice?: number): Promise<void> => {
      setPositions((prev) => prev.filter((p) => p.id !== ticketId));
      try {
        await TradingServices.closeTicket(ticketId, closePrice);
      } catch (e) {
        console.error("Close position failed:", e);
        await fetchPositions();
      }
    },
    [fetchPositions]
  );

  return { positions, loading, error, refetch: fetchPositions, closePosition };
}
