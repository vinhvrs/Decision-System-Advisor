import api from "@/src/libs/api";
import { isDemoDevMode } from "@/src/libs/devMode";
import { getSymbolDevRows } from "@/src/libs/symbolDevIdb";

export interface ElasticCompanyHit {
  id: string | null;
  score: number | null;
  source: {
    symbol?: string;
    company_name?: string;
    exchange?: string;
    sector?: string;
    industry?: string;
  };
}

export interface ElasticSearchResult {
  total: number;
  items: ElasticCompanyHit[];
  /** Term suggester / spellcheck-style options from Elasticsearch */
  suggestions?: string[];
}

function rowsToElasticHits(rows: { symbol: string; company_name: string }[]): ElasticCompanyHit[] {
  return rows.map((r) => ({
    id: r.symbol,
    score: null,
    source: { symbol: r.symbol, company_name: r.company_name },
  }));
}

export const ElasticService = {
  async searchCompanies(q: string, size = 10, from = 0, noSuggest = false): Promise<ElasticSearchResult> {
    if (isDemoDevMode()) {
      const rows = await getSymbolDevRows();
      const ql = q.trim().toLowerCase();
      const filtered = ql
        ? rows.filter(
            (r) =>
              r.symbol.toLowerCase().includes(ql) || r.company_name.toLowerCase().includes(ql)
          )
        : rows;
      const slice = filtered.slice(from, from + size);
      return {
        total: filtered.length,
        items: rowsToElasticHits(slice),
        suggestions: [],
      };
    }
    const res = await api.get("/elastic/search", {
      params: { q: q.trim(), size, from, ...(noSuggest ? { no_suggest: 1 } : {}) },
    });
    const data = res.data?.data;
    if (!data) return { total: 0, items: [], suggestions: [] };
    return {
      total: data.total ?? 0,
      items: data.items ?? [],
      suggestions: data.suggestions ?? [],
    };
  },

  /** Demo list (symbol ASC) for empty state / onboarding — default 20. */
  async getDemoTopSymbols(limit = 20): Promise<ElasticSearchResult> {
    if (isDemoDevMode()) {
      const rows = await getSymbolDevRows();
      const slice = rows.slice(0, limit);
      return {
        total: slice.length,
        items: rowsToElasticHits(slice),
        suggestions: [],
      };
    }
    const res = await api.get("/elastic/demo/top-symbols", {
      params: { limit },
    });
    const data = res.data?.data;
    if (!data) return { total: 0, items: [], suggestions: [] };
    return {
      total: data.total ?? 0,
      items: data.items ?? [],
      suggestions: [],
    };
  },
};
