/** Single ticket entity */
export interface Tickets {
  id: string;
  user_id: string;
  type: "Buy" | "Sell";
  market: "stock" | "crypto" | "forex";
  symbol: string;
  leverage: number;
  volume: number;
  price: number;
  status: "open" | "closed" | "cancelled";
  profit: number | null;
  open: string | null;
  close: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload for creating a ticket */
export interface TicketCreatePayload {
  type: "Buy" | "Sell";
  market: "stock" | "crypto" | "forex";
  symbol: string;
  leverage?: number;
  volume: number;
  price: number;
}

/** Payload for closing a position (POST/PUT /tickets/close) */
export interface ClosePositionPayload {
  ticket_id: string;
  close_price?: number;
}

/** Ticket with current price and profit/loss (from positions API) */
export interface TicketsWithPnl extends Tickets {
  current_price: number | null;
  profit: number | null;
  is_profit: boolean | null;
  pnl_status: "profit" | "loss" | "breakeven" | "unknown";
}

/** Paginated tickets response */
export interface PaginatedTickets {
  data: Tickets[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

/** Ticket list filters (matches backend query params) */
export interface TicketFilters {
  status?: "open" | "closed" | "cancelled";
  market?: "stock" | "crypto" | "forex";
  symbol?: string;
  type?: "Buy" | "Sell";
  date_from?: string;
  date_to?: string;
}

/** Params for listing tickets with pagination and select */
export interface TicketListParams {
  filters?: TicketFilters;
  page?: number;
  perPage?: number;
  select?: string[];
}
