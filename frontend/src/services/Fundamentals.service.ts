import api from "@/src/libs/api";

function sym(s: string): string {
  return encodeURIComponent(s.trim().toUpperCase());
}

export const FundamentalsService = {
  summary: (symbol: string) => api.get(`/fundamentals/${sym(symbol)}`).then((r) => r.data),

  annual: (symbol: string, limit = 20) =>
    api.get(`/fundamentals/${sym(symbol)}/annual`, { params: { limit } }).then((r) => r.data),

  quarterly: (symbol: string, limit = 24) =>
    api.get(`/fundamentals/${sym(symbol)}/quarterly`, { params: { limit } }).then((r) => r.data),

  score: (symbol: string) =>
    api.get(`/fundamentals/${sym(symbol)}/score`).then((r) => r.data).catch(() => ({ data: null })),

  filings: (symbol: string, limit = 80) =>
    api.get(`/filings/${sym(symbol)}`, { params: { limit } }).then((r) => r.data),
};
