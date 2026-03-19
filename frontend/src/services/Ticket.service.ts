/**
 * Re-exports for backwards compatibility.
 * Prefer: import { TradingServices } from "@/src/services/Trading.service"
 *         import type { Tickets, TicketsWithPnl } from "@/src/types/Tickets"
 */
export { TradingServices as TicketService } from "./Trading.service";
export type {
  Tickets as Ticket,
  TicketsWithPnl as TicketWithPnl,
  TicketCreatePayload,
  ClosePositionPayload,
  PaginatedTickets,
} from "@/src/types/Tickets";
