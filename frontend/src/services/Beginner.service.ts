import api from "@/src/libs/api";

export type BeginnerOverview = {
  symbol: string;
  company_name: string;
  logo_url?: string | null;
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
  logo_url?: string | null;
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
  /** Pre-serialized daily closes (e.g. Redis ``dashboard:daily``), oldest → newest. */
  chart?: number[];
};

export type BeginnerBoardPayload = {
  axes: string[];
  rows: BeginnerBoardRow[];
  legend?: { strong_rule?: string; tie_break?: string; buy_sell?: string };
};

/** Same radar + F&amp;G as beginner homepage (`/rankings/beginner-radar/{symbol}`). */
export type BeginnerFormalRadarPayload = {
  symbol: string;
  axes: string[];
  radar: BeginnerRadarPoint[];
  scores: Record<string, number>;
  /** Five-spoke strong count (same as beginner board Str); from API. */
  strong_count?: number;
  change_pct_snapshot: number;
  fear_greed: { value: number; label: string };
  pool_limit: number;
};

export type TopByVolumeRow = {
  symbol: string;
  company_name: string;
  logo_url?: string | null;
  volume: number;
  change_pct: number;
  price: number;
  liquidity: number;
};

export type TopByVolumePayload = {
  gainers: TopByVolumeRow[];
  losers: TopByVolumeRow[];
  updated_note?: string;
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

  /** Formal radar payload (API may include Price; chart UI shows five spokes without Price). */
  async getFormalRadar(symbol: string, poolLimit = 100): Promise<BeginnerFormalRadarPayload | null> {
    try {
      const res = await api.get(`/rankings/beginner-radar/${encodeURIComponent(symbol)}`, {
        params: { pool_limit: poolLimit },
      });
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },

  async getRankingBoard(limit = 20): Promise<BeginnerBoardPayload | null> {
    try {
      const res = await api.get("/rankings/beginner-board", { params: { limit } });
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },

  /** Precomputed board from Redis ``dashboard:daily`` (python_engine warm_up). */
  async getDashboardDaily(): Promise<BeginnerBoardPayload | null> {
    try {
      const res = await api.get("/rankings/dashboard-daily");
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },

  async getTopByVolume(limit = 20): Promise<TopByVolumePayload | null> {
    try {
      const res = await api.get("/rankings/top-by-volume", { params: { limit } });
      return res.data?.data ?? null;
    } catch {
      return null;
    }
  },

  /** Overview + OHLCV in one call (beginner /test page). */
  async getBeginnerPage(
    symbol: string,
    opts?: { period?: string; candles_limit?: number }
  ): Promise<{ overview: BeginnerOverview | null; candles: unknown[] } | null> {
    try {
      const res = await api.get(`/rankings/beginner-page/${encodeURIComponent(symbol)}`, {
        params: {
          period: opts?.period ?? "daily",
          ...(opts?.candles_limit != null ? { candles_limit: opts.candles_limit } : {}),
        },
        timeout: 120_000,
      });
      const d = res.data?.data;
      if (!d || typeof d !== "object") return null;
      return {
        overview: (d as { overview?: BeginnerOverview | null }).overview ?? null,
        candles: Array.isArray((d as { candles?: unknown[] }).candles) ? (d as { candles: unknown[] }).candles : [],
      };
    } catch {
      return null;
    }
  },
};
