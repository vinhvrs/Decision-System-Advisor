import api from "@/src/libs/api";

export type WatchlistItem = {
  id: string;
  user_id: string;
  symbol: string;
  positions?: Array<{
    id: string;
    type: string;
    symbol: string;
    volume: number;
    price: number;
    leverage?: number;
    status: string;
  }>;
  created_at?: string;
  updated_at?: string;
};

export const WatchlistService = {
  async list(withPositions = true): Promise<WatchlistItem[]> {
    const res = await api.get("/watchlist", {
      params: { with_positions: withPositions },
    });
    const d = res?.data?.data ?? res?.data ?? [];
    return Array.isArray(d) ? d : [];
  },

  async add(symbol: string): Promise<WatchlistItem> {
    const res = await api.post("/watchlist", { symbol });
    return res?.data ?? res;
  },

  async remove(symbol: string): Promise<void> {
    await api.delete(`/watchlist/${encodeURIComponent(symbol)}`);
  },
};
