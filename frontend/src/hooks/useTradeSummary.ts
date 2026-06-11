"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TradingServices } from "@/src/services/Trading.service";
import { calcTicketProfit, isBuyTicket } from "@/src/libs/tradingPnl";
import { readIsLoggedIn, syncAccessTokenFromCookie } from "@/src/libs/session";
import type { Tickets, TicketsWithPnl } from "@/src/types/Tickets";

const CLOSED_PAGE_SIZE = 100;
const MAX_CLOSED_PAGES = 50;

async function fetchAllClosedTickets(): Promise<Tickets[]> {
  const all: Tickets[] = [];
  let page = 1;
  let lastPage = 1;

  while (page <= lastPage && page <= MAX_CLOSED_PAGES) {
    const res = await TradingServices.getClosedTickets(page, CLOSED_PAGE_SIZE);
    const batch = res.data ?? [];
    all.push(...batch);
    lastPage = res.last_page ?? 1;
    if (batch.length === 0) break;
    page += 1;
  }

  return all;
}

export type TradeSummaryStats = {
  totalProfit: number;
  realizedProfit: number;
  unrealizedProfit: number;
  buyTrades: number;
  sellTrades: number;
};

export function useTradeSummary(
  openPositions: TicketsWithPnl[],
  currentPriceBySymbol?: Record<string, number>
) {
  const [closedTickets, setClosedTickets] = useState<Tickets[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    syncAccessTokenFromCookie();
    if (!readIsLoggedIn()) {
      setClosedTickets([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const closed = await fetchAllClosedTickets();
      setClosedTickets(closed);
    } catch (e: unknown) {
      const is401 =
        e &&
        typeof e === "object" &&
        "response" in e &&
        (e as { response?: { status?: number } }).response?.status === 401;
      setError(is401 ? "401" : "Failed to load trade summary");
      setClosedTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onTicketChanged = () => refresh();
    window.addEventListener("ticket-changed", onTicketChanged);
    return () => window.removeEventListener("ticket-changed", onTicketChanged);
  }, [refresh]);

  const stats = useMemo((): TradeSummaryStats => {
    let buyTrades = 0;
    let sellTrades = 0;
    let realizedProfit = 0;

    for (const t of closedTickets) {
      if (isBuyTicket(t.type)) buyTrades += 1;
      else sellTrades += 1;
      const p = t.profit != null ? Number(t.profit) : NaN;
      if (Number.isFinite(p)) realizedProfit += p;
    }

    let unrealizedProfit = 0;
    for (const pos of openPositions) {
      if (isBuyTicket(pos.type)) buyTrades += 1;
      else sellTrades += 1;

      const openPrice = Number(pos.price) || 0;
      const vol = Number(pos.volume) || 0;
      const lev = Number(pos.leverage) || 1;
      const sym = pos.symbol || "";
      const live =
        sym && currentPriceBySymbol?.[sym] != null
          ? currentPriceBySymbol[sym]
          : pos.current_price ?? null;

      if (live != null && Number.isFinite(live)) {
        unrealizedProfit += calcTicketProfit(pos.type, openPrice, live, vol, lev);
      } else if (pos.profit != null && Number.isFinite(Number(pos.profit))) {
        unrealizedProfit += Number(pos.profit);
      }
    }

    return {
      realizedProfit,
      unrealizedProfit,
      totalProfit: realizedProfit + unrealizedProfit,
      buyTrades,
      sellTrades,
    };
  }, [closedTickets, openPositions, currentPriceBySymbol]);

  return { stats, loading, error, refresh };
}
