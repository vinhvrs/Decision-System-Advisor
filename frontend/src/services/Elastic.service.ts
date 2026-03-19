import api from "@/src/libs/api";

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
}

export const ElasticService = {
  async searchCompanies(q: string, size = 10, from = 0): Promise<ElasticSearchResult> {
    const res = await api.get("/elastic/search", {
      params: { q: q.trim(), size, from },
    });
    const data = res.data?.data;
    return data ?? { total: 0, items: [] };
  },
};
