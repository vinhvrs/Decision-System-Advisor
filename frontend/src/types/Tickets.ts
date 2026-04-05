export interface Tickets {
  id: string;
  user_id: string;
  type: "Buy" | "Sell";
  market: "stock";
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

export interface TicketCreatePayload {
  type: "Buy" | "Sell";
  market: "stock";
  symbol: string;
  leverage?: number;
  volume: number;
  price: number;
}

export interface ClosePositionPayload {
  ticket_id: string;
  close_price?: number;
}

export interface TicketsWithPnl extends Tickets {
  current_price: number | null;
  profit: number | null;
  is_profit: boolean | null;
  pnl_status: "profit" | "loss" | "breakeven" | "unknown";
}

export interface PaginatedTickets {
  data: Tickets[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface TicketFilters {
  status?: "open" | "closed" | "cancelled";
  market?: "stock";
  symbol?: string;
  type?: "Buy" | "Sell";
  date_from?: string;
  date_to?: string;
}

export interface TicketListParams {
  filters?: TicketFilters;
  page?: number;
  perPage?: number;
  select?: string[];
}
