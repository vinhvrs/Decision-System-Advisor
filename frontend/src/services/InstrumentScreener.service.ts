import api from "@/src/libs/api";

export const SCREENER_TECH_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "TSLA",
  "GOOGL",
  "META",
  "AMZN",
  "IBM",
  "ORCL",
  "AVGO",
] as const;

export type ScreenerRow = {
  symbol: string;
  company_name?: string;
  logo_url?: string | null;
  price?: number | null;
  change_pct?: number | null;
  volume?: number | null;
  liquidity?: number | null;
  market_cap?: number | null;
  fiscal_year?: number | null;
  revenue?: number | null;
  net_income?: number | null;
  roe?: number | null;
  debt_equity?: number | null;
  pe_ratio?: number | null;
  pb_ratio?: number | null;
  overall_score?: number | null;
  filing_date?: string | null;
  fundamentals_updated_at?: string | null;
  sec_fetched_at?: string | null;
  market_updated_at?: string | null;
};

export type ScreenerPayload = {
  symbols: string[];
  rows: ScreenerRow[];
  updated_at?: string;
};

export const InstrumentScreenerService = {
  /** Single request: 10 US tech symbols + market snapshot + SEC fundamentals. */
  async getTechScreener(): Promise<ScreenerPayload | null> {
    try {
      const res = await api.get("/fundamentals/screener");
      const data = res.data?.data as ScreenerPayload | undefined;
      if (!data?.rows) return null;
      return data;
    } catch {
      return null;
    }
  },
};
