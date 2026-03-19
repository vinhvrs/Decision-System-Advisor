"use client";

import { useCallback, useEffect, useRef } from "react";
import { TradingServices } from "@/src/services/Trading.service";
import type { TicketCreatePayload } from "@/src/types/Tickets";

type QueuedCreate = { type: "create"; payload: TicketCreatePayload; volume: number };
type QueuedClose = { type: "close"; ticketIds: string[]; price?: number };
type QueuedAction = QueuedCreate | QueuedClose;

const FLUSH_INTERVAL_MS = 700;

/**
 * Queue trade API calls to avoid duplicates from React double-invoke.
 * Collects actions, flushes after ~0.7s, calls API once per action.
 */
export function useTradeApiQueue(options: {
  onTicketCreated?: (ticketId: string, volume: number) => void;
  onTicketChanged?: () => void;
}) {
  const queueRef = useRef<QueuedAction[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const flush = useCallback(() => {
    const items = queueRef.current.splice(0, queueRef.current.length);
    if (items.length === 0) return;

    const { onTicketCreated, onTicketChanged } = optionsRef.current;
    for (const item of items) {
      if (item.type === "create") {
        TradingServices.createTicket(item.payload)
          .then((ticket) => {
            onTicketCreated?.(ticket.id, item.volume);
            onTicketChanged?.();
          })
          .catch((e) => console.error("Create ticket failed:", e));
      } else {
        item.ticketIds.forEach((id) =>
          TradingServices.closeTicket(id, item.price)
            .then(() => onTicketChanged?.())
            .catch((e) => console.error("Close ticket failed:", e))
        );
      }
    }
  }, []);

  useEffect(() => {
    const id = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [flush]);

  const enqueueCreate = useCallback((payload: TicketCreatePayload, volume: number) => {
    queueRef.current.push({ type: "create", payload, volume });
  }, []);

  const enqueueClose = useCallback((ticketIds: string[], price?: number) => {
    if (ticketIds.length > 0) {
      queueRef.current.push({ type: "close", ticketIds, price });
    }
  }, []);

  return { enqueueCreate, enqueueClose };
}
