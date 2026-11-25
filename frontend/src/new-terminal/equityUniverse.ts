export type EquityUniverseMember = {
  symbol: string;
  sector: string;
};

export const EQUITY_HEATMAP_UNIVERSE: EquityUniverseMember[] = [
  { symbol: "NVDA", sector: "Technology" },
  { symbol: "MSFT", sector: "Technology" },
  { symbol: "AAPL", sector: "Technology" },
  { symbol: "AVGO", sector: "Technology" },
  { symbol: "AMD", sector: "Technology" },
  { symbol: "ORCL", sector: "Technology" },
  { symbol: "CRM", sector: "Technology" },
  { symbol: "MU", sector: "Technology" },
  { symbol: "ADBE", sector: "Technology" },
  { symbol: "QCOM", sector: "Technology" },
  { symbol: "AMAT", sector: "Technology" },
  { symbol: "PANW", sector: "Technology" },
  { symbol: "PLTR", sector: "Technology" },

  { symbol: "AMZN", sector: "Consumer Discr." },
  { symbol: "TSLA", sector: "Consumer Discr." },
  { symbol: "COST", sector: "Staples" },
  { symbol: "WMT", sector: "Staples" },
  { symbol: "HD", sector: "Consumer Discr." },
  { symbol: "MCD", sector: "Consumer Discr." },
  { symbol: "NKE", sector: "Consumer Discr." },
  { symbol: "SBUX", sector: "Consumer Discr." },

  { symbol: "GOOGL", sector: "Communication" },
  { symbol: "META", sector: "Communication" },
  { symbol: "NFLX", sector: "Communication" },
  { symbol: "DIS", sector: "Communication" },

  { symbol: "JPM", sector: "Financials" },
  { symbol: "BAC", sector: "Financials" },
  { symbol: "V", sector: "Financials" },
  { symbol: "MA", sector: "Financials" },
  { symbol: "GS", sector: "Financials" },

  { symbol: "XOM", sector: "Energy" },
  { symbol: "CVX", sector: "Energy" },

  { symbol: "LLY", sector: "Health Care" },
  { symbol: "UNH", sector: "Health Care" },
  { symbol: "JNJ", sector: "Health Care" },
  { symbol: "ABBV", sector: "Health Care" },

  { symbol: "CAT", sector: "Industrials" },
  { symbol: "GE", sector: "Industrials" },
  { symbol: "HON", sector: "Industrials" },

  { symbol: "NEE", sector: "Utilities" },
];

export const EQUITY_HEATMAP_SIZE = EQUITY_HEATMAP_UNIVERSE.length;
