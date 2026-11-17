"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { TicketsWithPnl, Tickets } from "@/src/types/Tickets";
import { useClosedHistory } from "@/src/hooks/useClosedHistory";
import { calcTicketProfit, formatOpenPnl } from "@/src/libs/tradingPnl";

interface PositionsPanelProps {
  positions: TicketsWithPnl[];
  loading?: boolean;
  error?: string | null;
  refetch: () => void;
  closePosition: (id: string, price?: number) => Promise<void>;
  /** Real-time price per symbol (e.g. from socket). Used to compute live PnL. */
  currentPriceBySymbol?: Record<string, number>;
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
      <div className="dsa-panel px-3 py-2 text-xs text-[var(--dsa-text-muted)]">
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
      <div className="dsa-panel px-3 py-2 text-xs text-[var(--dsa-text-muted)]">
        {message}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur px-4 py-3 text-slate-100 text-sm">
      <div className="flex items-center justify-between border-b border-[var(--dsa-border)] px-3 py-2">
        <span className="text-xs font-semibold">Open positions</span>
        <button
          onClick={refetch}
          className="text-[10px] text-[var(--dsa-text-muted)] hover:text-white"
        >
          Refresh
        </button>
      </div>
      <div className="max-h-[280px] overflow-y-auto px-3">
        {positions.length === 0 ? (
          <div className="py-3 text-[var(--dsa-text-muted)]">No open positions.</div>
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

      <div className="border-t border-[var(--dsa-border)] px-3 py-2">
        <button
          onClick={() => setHistoryExpanded((e) => !e)}
          className="flex w-full items-center justify-between text-left text-[10px] text-[var(--dsa-text-muted)] hover:text-white"
        >
          <span>History (closed)</span>
          <span>{historyExpanded ? "▼" : "▶"}</span>
        </button>
        {historyExpanded && (
          <div
            ref={historyScrollRef}
            onScroll={handleHistoryScroll}
            className="mt-2 max-h-40 overflow-y-auto"
          >
            {historyLoading && history.length === 0 ? (
              <div className="py-2 text-[var(--dsa-text-muted)]">Loading history…</div>
            ) : historyError ? (
              <div className="py-2 text-[var(--dsa-negative)]">{historyError}</div>
            ) : history.length === 0 ? (
              <div className="py-2 text-[var(--dsa-text-muted)]">No closed positions.</div>
            ) : (
              <>
                {history.map((t) => (
                  <HistoryRow key={t.id} ticket={t} />
                ))}
                {historyLoadingMore && (
                  <div className="py-1 text-center text-[var(--dsa-text-muted)]">Loading…</div>
                )}
                {historyHasMore && !historyLoadingMore && (
                  <button
                    onClick={loadMoreHistory}
                    className="w-full py-1 text-[10px] text-[var(--dsa-text-muted)] hover:text-white"
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
        ? "text-[var(--dsa-positive)]"
        : "text-[var(--dsa-negative)]"
      : "text-[var(--dsa-text-secondary)]";
  const dateStr = ticket.close || ticket.updated_at || ticket.created_at;
  const shortDate = dateStr ? new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "";

  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--dsa-border)] py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {ticket.symbol} {ticket.type}
        </div>
        <div className="text-[10px] text-[var(--dsa-text-muted)]">
          {ticket.volume}×{ticket.leverage} @ {Number(ticket.price).toFixed(4)} · {shortDate}
        </div>
      </div>
      {profitNum != null && Number.isFinite(profitNum) && (
        <span className={`font-semibold shrink-0 ${pnlColor}`}>{formatOpenPnl(profitNum)}</span>
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
      ? calcTicketProfit(position.type, openPrice, currentPrice, vol, lev)
      : position.profit ?? null;

  const pnlColor =
    profit != null
      ? profit >= 0
        ? "text-[var(--dsa-positive)]"
        : "text-[var(--dsa-negative)]"
      : "text-[var(--dsa-text-secondary)]";

  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--dsa-border)] py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">
          {position.symbol} {position.type}
        </div>
        <div className="text-[10px] text-[var(--dsa-text-muted)]">
          {position.volume}×{position.leverage} @ {openPrice.toFixed(4)}
          {displayPrice !== openPrice && (
            <> → {displayPrice.toFixed(4)}</>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {profit != null && (
          <span className={`font-semibold ${pnlColor}`}>{formatOpenPnl(profit)}</span>
        )}
        <button
          onClick={handleClose}
          className="rounded-[var(--dsa-radius-sm)] border border-[var(--dsa-border-strong)] bg-[var(--dsa-surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--dsa-text-secondary)] hover:border-[var(--dsa-negative)] hover:text-[var(--dsa-negative)]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
