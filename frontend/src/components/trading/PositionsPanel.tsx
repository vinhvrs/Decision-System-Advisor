"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { TicketsWithPnl, Tickets } from "@/src/types/Tickets";
import { useClosedHistory } from "@/src/hooks/useClosedHistory";

interface PositionsPanelProps {
  positions: TicketsWithPnl[];
  loading?: boolean;
  error?: string | null;
  refetch: () => void;
  closePosition: (id: string, price?: number) => Promise<void>;
  /** Real-time price per symbol (e.g. from socket). Used to compute live PnL. */
  currentPriceBySymbol?: Record<string, number>;
}

function calcLiveProfit(
  type: "Buy" | "Sell",
  openPrice: number,
  currentPrice: number,
  volume: number,
  leverage: number
): number {
  if (!Number.isFinite(openPrice) || openPrice <= 0 || !Number.isFinite(currentPrice)) return 0;
  const mult = (volume * (leverage || 1)) / openPrice;
  return type.toLowerCase() === "buy"
    ? (currentPrice - openPrice) * mult
    : (openPrice - currentPrice) * mult;
}

export default function PositionsPanel({
  positions,
  loading = false,
  error = null,
  refetch,
  closePosition,
  currentPriceBySymbol,
}: PositionsPanelProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const historyScrollRef = useRef<HTMLDivElement>(null);
  const {
    history,
    loading: historyLoading,
    loadingMore: historyLoadingMore,
    error: historyError,
    hasMore: historyHasMore,
    loadMore: loadMoreHistory,
    loadInitial: loadInitialHistory,
  } = useClosedHistory();

  useEffect(() => {
    if (historyExpanded && history.length === 0 && !historyLoading) {
      loadInitialHistory();
    }
  }, [historyExpanded, history.length, historyLoading, loadInitialHistory]);

  useEffect(() => {
    const onTicketChanged = () => {
      if (historyExpanded) loadInitialHistory();
    };
    window.addEventListener("ticket-changed", onTicketChanged);
    return () => window.removeEventListener("ticket-changed", onTicketChanged);
  }, [historyExpanded, loadInitialHistory]);

  const handleHistoryScroll = useCallback(() => {
    const el = historyScrollRef.current;
    if (!el || !historyHasMore || historyLoadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 80) {
      loadMoreHistory();
    }
  }, [historyHasMore, historyLoadingMore, loadMoreHistory]);

  if (loading && positions.length === 0 && !historyExpanded) {
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-slate-400 text-xs">
        Loading positions...
      </div>
    );
  }

  if (error) {
    const message =
      error === "session-expired"
        ? "Session expired — sign in again to sync positions."
        : error === "401"
          ? "Sign in to sync positions."
          : error;
    return (
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-slate-400 text-xs">
        {message}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur px-4 py-3 text-slate-100 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">Open Positions</span>
        <button
          onClick={refetch}
          className="text-slate-400 hover:text-slate-200 text-[10px]"
        >
          Refresh
        </button>
      </div>
      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {positions.length === 0 ? (
          <div className="text-slate-400 py-2">No open positions</div>
        ) : (
          positions.map((p) => (
            <PositionRow
              key={p.id}
              position={p}
              onClose={closePosition}
              currentPrice={
                p.symbol && currentPriceBySymbol?.[p.symbol] != null
                  ? currentPriceBySymbol[p.symbol]
                  : p.current_price ?? undefined
              }
            />
          ))
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-slate-700/60">
        <button
          onClick={() => setHistoryExpanded((e) => !e)}
          className="text-slate-400 hover:text-slate-200 text-[10px] w-full text-left flex items-center justify-between"
        >
          <span>History (closed)</span>
          <span>{historyExpanded ? "▼" : "▶"}</span>
        </button>
        {historyExpanded && (
          <div
            ref={historyScrollRef}
            onScroll={handleHistoryScroll}
            className="mt-2 space-y-2 max-h-40 overflow-y-auto"
          >
            {historyLoading && history.length === 0 ? (
              <div className="text-slate-400 py-2">Loading history...</div>
            ) : historyError ? (
              <div className="text-rose-400 py-2">{historyError}</div>
            ) : history.length === 0 ? (
              <div className="text-slate-400 py-2">No closed positions</div>
            ) : (
              <>
                {history.map((t) => (
                  <HistoryRow key={t.id} ticket={t} />
                ))}
                {historyLoadingMore && (
                  <div className="text-slate-400 py-1 text-center">Loading...</div>
                )}
                {historyHasMore && !historyLoadingMore && (
                  <button
                    onClick={loadMoreHistory}
                    className="text-slate-400 hover:text-slate-200 text-[10px] w-full py-1"
                  >
                    Load more
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryRow({ ticket }: { ticket: Tickets }) {
  const profitNum = ticket.profit != null ? Number(ticket.profit) : null;
  const pnlColor =
    profitNum != null && Number.isFinite(profitNum)
      ? profitNum >= 0
        ? "text-emerald-300"
        : "text-rose-300"
      : "text-slate-300";
  const dateStr = ticket.close || ticket.updated_at || ticket.created_at;
  const shortDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "";

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-700/40 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {ticket.symbol} {ticket.type}
        </div>
        <div className="text-slate-400 text-[10px]">
          {ticket.volume}×{ticket.leverage} @ {Number(ticket.price).toFixed(4)} · {shortDate}
        </div>
      </div>
      {profitNum != null && Number.isFinite(profitNum) && (
        <span className={`font-semibold shrink-0 ${pnlColor}`}>
          {profitNum >= 0 ? "+" : ""}
          {profitNum.toFixed(4)}
        </span>
      )}
    </div>
  );
}

function PositionRow({
  position,
  onClose,
  currentPrice,
}: {
  position: TicketsWithPnl;
  onClose: (id: string, price?: number) => void;
  currentPrice?: number;
}) {
  const handleClose = () => {
    onClose(position.id, currentPrice ?? position.current_price ?? undefined);
  };

  const openPrice = Number(position.price) || 0;
  const vol = Number(position.volume) || 0;
  const lev = Number(position.leverage) || 1;
  const displayPrice = currentPrice ?? position.current_price ?? openPrice;
  const profit =
    currentPrice != null && Number.isFinite(currentPrice)
      ? calcLiveProfit(position.type, openPrice, currentPrice, vol, lev)
      : position.profit ?? null;

  const pnlColor =
    profit != null
      ? profit >= 0
        ? "text-emerald-300"
        : "text-rose-300"
      : "text-slate-300";

  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-700/40 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {position.symbol} {position.type}
        </div>
        <div className="text-slate-400 text-[10px]">
          {position.volume}×{position.leverage} @ {openPrice.toFixed(4)}
          {displayPrice !== openPrice && (
            <> → {displayPrice.toFixed(4)}</>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {profit != null && (
          <span className={`font-semibold ${pnlColor}`}>
            {profit >= 0 ? "+" : ""}
            {profit.toFixed(4)}
          </span>
        )}
        <button
          onClick={handleClose}
          className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-0.5 font-medium hover:bg-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
