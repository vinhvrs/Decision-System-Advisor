import api from "@/src/libs/api";

export type BeginnerOverview = {
  symbol: string;
  company_name: string;
  price: number;
  day_open: number;
  volume: number;
  liquidity: number;
  change_pct_snapshot: number;
  market_cap: number | null;
  snapshot_updated_at: string | null;
  people_watching: number;
  reputation: string;
  reputation_label: string;
};

export type BeginnerRadarPoint = { subject: string; value: number };

export type BeginnerBoardRow = {
  rank: number;
  symbol: string;
  company_name: string;
  strong_count: number;
  scores: {
    reputation: number;
    price_period: number;
    candle_change: number;
    volume: number;
    liquidity: number;
    people_care: number;
  };
  radar: BeginnerRadarPoint[];
  liquidity: number;
  volume: number;
  people_watching: number;
  price: number;
  candle_move_abs_pct: number;
  /** Same daily snapshot % as dashboard (open→close that day). */
  change_pct_snapshot: number;
  /** Derived from change_pct_snapshot for UI (not advice). */
  day_bias?: "buy" | "sell" | "flat";
};

export type BeginnerBoardPayload = {
  axes: string[];
  rows: BeginnerBoardRow[];
  legend?: { strong_rule?: string; tie_break?: string; buy_sell?: string };
};

export const BeginnerService = {
  async getOverview(symbol: string): Promise<BeginnerOverview | null> {
    try {
      const res = await api.get(`/rankings/beginner/${encodeURIComponent(symbol)}`);
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },

  async getRankingBoard(limit = 50): Promise<BeginnerBoardPayload | null> {
    try {
      const res = await api.get("/rankings/beginner-board", { params: { limit } });
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },
};
