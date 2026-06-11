"use client";

import { useCallback, useEffect, useRef } from "react";
import { TradingServices } from "@/src/services/Trading.service";
import type { TicketCreatePayload } from "@/src/types/Tickets";

type QueuedCreate = { type: "create"; payload: TicketCreatePayload; volume: number };
type QueuedClose = { type: "close"; ticketIds: string[]; price?: number };
type QueuedAction = QueuedCreate | QueuedClose;

const FLUSH_DEBOUNCE_MS = 120;

function createDedupeKey(payload: TicketCreatePayload): string {
  return `${payload.market}|${payload.symbol}|${payload.type}`;
}

/**
 * Queue trade API calls; coalesce duplicate creates and close ids per flush.
 * Does not flush on unmount (avoids duplicate tickets when the chart remounts).
 */
export function useTradeApiQueue(options: {
  onTicketCreated?: (ticketId: string, volume: number) => void;
  onTicketChanged?: () => void;
  onCreateFailed?: () => void;
}) {
  const queueRef = useRef<QueuedAction[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inflightCreatesRef = useRef<Set<string>>(new Set());

  const coalesceQueue = (items: QueuedAction[]): QueuedAction[] => {
    const out: QueuedAction[] = [];
    for (const item of items) {
      if (item.type === "create") {
        const key = createDedupeKey(item.payload);
        const existing = out.find(
          (x): x is QueuedCreate => x.type === "create" && createDedupeKey(x.payload) === key
        );
        if (existing) {
          existing.volume += item.volume;
          existing.payload = {
            ...existing.payload,
            volume: Number(existing.payload.volume) + Number(item.payload.volume),
          };
          continue;
        }
        out.push({ ...item, payload: { ...item.payload } });
      } else {
        const ids = [...new Set(item.ticketIds)];
        if (ids.length === 0) continue;
        const existing = out.find((x): x is QueuedClose => x.type === "close");
        if (existing) {
          existing.ticketIds = [...new Set([...existing.ticketIds, ...ids])];
          if (item.price != null) existing.price = item.price;
        } else {
          out.push({ type: "close", ticketIds: ids, price: item.price });
        }
      }
    }
    return out;
  };

  const flush = useCallback(() => {
    const items = coalesceQueue(queueRef.current.splice(0, queueRef.current.length));
    if (items.length === 0) return;

    const { onTicketCreated, onTicketChanged, onCreateFailed } = optionsRef.current;
    for (const item of items) {
      if (item.type === "create") {
        const key = createDedupeKey(item.payload);
        if (inflightCreatesRef.current.has(key)) continue;
        inflightCreatesRef.current.add(key);
        TradingServices.createTicket(item.payload)
          .then((ticket) => {
            onTicketCreated?.(ticket.id, item.volume);
            onTicketChanged?.();
          })
          .catch((e) => {
            console.error("Create ticket failed:", e);
            onCreateFailed?.();
          })
          .finally(() => {
            inflightCreatesRef.current.delete(key);
          });
      } else {
        const ids = [...new Set(item.ticketIds)];
        Promise.all(
          ids.map((id) =>
            TradingServices.closeTicket(id, item.price).then(() => onTicketChanged?.())
          )
        ).catch((e) => console.error("Close ticket failed:", e));
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      flush();
    }, FLUSH_DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, []);

  const enqueueCreate = useCallback(
    (payload: TicketCreatePayload, volume: number) => {
      const key = createDedupeKey(payload);
      if (inflightCreatesRef.current.has(key)) return;
      const dup = queueRef.current.some(
        (i) => i.type === "create" && createDedupeKey(i.payload) === key
      );
      if (dup) return;
      queueRef.current.push({ type: "create", payload: { ...payload }, volume });
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const enqueueClose = useCallback(
    (ticketIds: string[], price?: number) => {
      if (ticketIds.length > 0) {
        queueRef.current.push({ type: "close", ticketIds, price });
        scheduleFlush();
      }
    },
    [scheduleFlush]
  );

  return { enqueueCreate, enqueueClose };
}
