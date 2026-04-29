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
  /** ISO timestamp from Redis ``dashboard:daily`` warm-up. */
  updated_at?: string;
  meta?: Record<string, unknown>;
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

type CachedEnvelope<T> = { ts: number; data: T };

const BOARD_CACHE_KEY = "beginner:dashboard-daily:v1";
const RANKING_CACHE_PREFIX = "beginner:ranking-board:v1:";
const TOP_VOLUME_CACHE_PREFIX = "beginner:top-by-volume:v1:";
const DEFAULT_CACHE_MAX_AGE_MS = 90_000;
const DEFAULT_STALE_WHILE_REVALIDATE_MS = 10 * 60_000;

const inflight = new Map<string, Promise<unknown>>();

function nowMs(): number {
  return Date.now();
}

function readCache<T>(key: string): CachedEnvelope<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ ts: nowMs(), data } satisfies CachedEnvelope<T>));
  } catch {
    // Ignore localStorage quota / serialization issues.
  }
}

function isFresh(ts: number, maxAgeMs: number): boolean {
  return nowMs() - ts <= Math.max(0, maxAgeMs);
}

function isWithinStaleWindow(ts: number, staleWhileRevalidateMs: number): boolean {
  return nowMs() - ts <= Math.max(0, staleWhileRevalidateMs);
}

async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T | null>,
  opts?: { maxAgeMs?: number; staleWhileRevalidateMs?: number }
): Promise<T | null> {
  const maxAgeMs = opts?.maxAgeMs ?? DEFAULT_CACHE_MAX_AGE_MS;
  const staleWhileRevalidateMs = opts?.staleWhileRevalidateMs ?? DEFAULT_STALE_WHILE_REVALIDATE_MS;
  const cached = readCache<T>(key);
  if (cached && isFresh(cached.ts, maxAgeMs)) {
    return cached.data;
  }
  if (cached && isWithinStaleWindow(cached.ts, staleWhileRevalidateMs)) {
    void dedupe(key, async () => {
      const fresh = await fetcher();
      if (fresh != null) writeCache(key, fresh);
      return fresh;
    });
    return cached.data;
  }
  const fresh = await dedupe(key, fetcher);
  if (fresh != null) writeCache(key, fresh);
  return fresh;
}

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
    return getCachedOrFetch<BeginnerBoardPayload>(`${RANKING_CACHE_PREFIX}${limit}`, async () => {
      try {
        const res = await api.get("/rankings/beginner-board", { params: { limit } });
        return res.data?.data ?? null;
      } catch {
        return null;
      }
    });
  },

  /** Precomputed board from Redis ``dashboard:daily`` (python_engine warm_up). */
  async getDashboardDaily(opts?: { maxAgeMs?: number; staleWhileRevalidateMs?: number }): Promise<BeginnerBoardPayload | null> {
    return getCachedOrFetch<BeginnerBoardPayload>(
      BOARD_CACHE_KEY,
      async () => {
        try {
          const res = await api.get("/rankings/dashboard-daily", { params: { lite: 1 } });
          return res.data?.data ?? null;
        } catch {
          return null;
        }
      },
      opts
    );
  },

  async getTopByVolume(limit = 20): Promise<TopByVolumePayload | null> {
    return getCachedOrFetch<TopByVolumePayload>(`${TOP_VOLUME_CACHE_PREFIX}${limit}`, async () => {
      try {
        const res = await api.get("/rankings/top-by-volume", { params: { limit } });
        return res.data?.data ?? null;
      } catch {
        return null;
      }
    });
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
