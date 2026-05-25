/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { attachAuthInterceptors } from "@/src/libs/authInterceptors";
import type {
  Tickets,
  TicketsWithPnl,
  TicketCreatePayload,
  ClosePositionPayload,
  PaginatedTickets,
  TicketFilters,
  TicketListParams,
} from "@/src/types/Tickets";

const API_HOST = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:1111/api";

const tradingApi = axios.create({
  baseURL: API_HOST,
  withCredentials: true,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

attachAuthInterceptors(tradingApi);

function unwrapPaginated(res: any): PaginatedTickets {
  const d = res?.data ?? res;
  return {
    data: Array.isArray(d?.data) ? d.data : (Array.isArray(d) ? d : []),
    current_page: d?.current_page ?? 1,
    last_page: d?.last_page ?? 1,
    per_page: d?.per_page ?? 15,
    total: d?.total ?? 0,
    from: d?.from ?? null,
    to: d?.to ?? null,
  };
}

function buildTicketParams(params: {
  filters?: TicketFilters;
  page?: number;
  perPage?: number;
  select?: string[];
}): URLSearchParams {
  const { filters = {}, page = 1, perPage = 15, select } = params;
  const q = new URLSearchParams();
  q.set("per_page", String(perPage));
  q.set("page", String(page));
  if (filters.status) q.set("status", filters.status);
  if (filters.market) q.set("market", filters.market);
  if (filters.symbol) q.set("symbol", filters.symbol);
  if (filters.type) q.set("type", filters.type);
  if (filters.date_from) q.set("date_from", filters.date_from);
  if (filters.date_to) q.set("date_to", filters.date_to);
  if (select?.length) q.set("select", select.join(","));
  return q;
}

/** Columns for history list - minimal payload for closed positions */
const HISTORY_SELECT = ["symbol", "type", "volume", "leverage", "price", "profit", "close", "created_at", "updated_at"];

/** Trading service - maps to backend /api/tickets endpoints */
export const TradingServices = {
  /** GET /tickets/positions - all open positions for current user (user_id from auth) */
  getPositions: async (perPage = 100): Promise<{ data: TicketsWithPnl[] }> => {
    const res = await tradingApi.get(`/tickets/positions?per_page=${perPage}`);
    const d = res.data?.data ?? res.data;
    return { data: Array.isArray(d) ? d : [] };
  },

  /** GET /tickets - list tickets with filters, pagination, select */
  getTickets: async (params: TicketListParams = {}): Promise<PaginatedTickets> => {
    const { filters = {}, page = 1, perPage = 15, select } = params;
    const q = buildTicketParams({ filters, page, perPage, select });
    const res = await tradingApi.get(`/tickets?${q}`);
    return unwrapPaginated(res.data);
  },

  /** GET /tickets?status=closed - closed positions for paginated history (optimized select) */
  getClosedTickets: async (
    page = 1,
    perPage = 15,
    select?: string[]
  ): Promise<PaginatedTickets> => {
    return TradingServices.getTickets({
      filters: { status: "closed" },
      page,
      perPage,
      select: select ?? [...HISTORY_SELECT],
    });
  },

  /** GET /tickets/user/{user_id} - list open positions for user (backend hardcodes status=open) */
  getOpenTicketsByUser: async (
    userId: string,
    perPage = 15,
    page = 1,
    select?: string[]
  ): Promise<PaginatedTickets> => {
    const q = buildTicketParams({ page, perPage, select });
    const res = await tradingApi.get(`/tickets/user/${userId}?${q}`);
    return unwrapPaginated(res.data);
  },

  /** GET /tickets/user/{user_id}/{symbol} - list tickets for user by symbol */
  getTicketsByUserAndSymbol: async (
    userId: string,
    symbol: string,
    perPage = 15,
    page = 1,
    select?: string[]
  ): Promise<PaginatedTickets> => {
    const q = buildTicketParams({ filters: { symbol }, page, perPage, select });
    const res = await tradingApi.get(
      `/tickets/user/${encodeURIComponent(userId)}/${encodeURIComponent(symbol)}?${q}`
    );
    return unwrapPaginated(res.data);
  },

  /** GET /tickets/{id} - get single ticket */
  getTicket: async (id: string, withPnl = false): Promise<Tickets | TicketsWithPnl> => {
    const params = withPnl ? "?with_pnl=1" : "";
    const res = await tradingApi.get(`/tickets/${id}${params}`);
    return (res.data?.data ?? res.data) as Tickets | TicketsWithPnl;
  },

  /** POST /tickets - create ticket */
  createTicket: async (payload: TicketCreatePayload): Promise<Tickets> => {
    const res = await tradingApi.post("/tickets", payload);
    const body = res.data?.data ?? res.data;
    const ticket = body as Tickets;
    if (!ticket?.id) {
      throw new Error("Create ticket: missing id in response");
    }
    return ticket;
  },

  /** PUT /tickets/{id} - update ticket */
  updateTicket: async (
    id: string,
    data: { status?: "open" | "closed" | "cancelled" }
  ): Promise<Tickets> => {
    const res = await tradingApi.put(`/tickets/${id}`, data);
    return (res.data?.data ?? res.data) as Tickets;
  },

  /** POST or PUT /tickets/close - close position with ticket_id in body */
  closeTicket: async (
    ticketId: string,
    closePrice?: number,
    method: "POST" | "PUT" = "POST"
  ): Promise<Tickets> => {
    const body: ClosePositionPayload = { ticket_id: ticketId };
    if (closePrice != null && closePrice > 0) body.close_price = closePrice;
    const res =
      method === "PUT"
        ? await tradingApi.put("/tickets/close", body)
        : await tradingApi.post("/tickets/close", body);
    return (res.data?.data ?? res.data) as Tickets;
  },

  /** DELETE /tickets/{id} - delete ticket */
  deleteTicket: async (id: string): Promise<{ deleted: boolean }> => {
    const res = await tradingApi.delete(`/tickets/${id}`);
    return (res.data?.data ?? res.data) as { deleted: boolean };
  },
};
