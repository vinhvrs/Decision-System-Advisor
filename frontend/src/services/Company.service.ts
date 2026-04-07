/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/src/libs/api";
import { isDemoDevMode } from "@/src/libs/devMode";
import { normalizeNewsListResponse } from "@/src/libs/newsArticle";
import { getSymbolDevRows, type SymbolDevCompany } from "@/src/libs/symbolDevIdb";

function pickCompanyFields(row: SymbolDevCompany, select?: string[]) {
    const base: Record<string, unknown> = {
        symbol: row.symbol,
        company_name: row.company_name,
        id: row.id,
        name: row.name,
    };
    if (!select?.length) return base;
    const out: Record<string, unknown> = {};
    for (const k of select) {
        if (k in base) out[k] = base[k];
    }
    return Object.keys(out).length ? out : base;
}

function demoRankingRow(row: SymbolDevCompany, index: number) {
    const h = row.symbol.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const price = Math.round((48 + (h % 520) + (h % 97) / 97) * 100) / 100;
    const change = ((h % 19) - 9) + (index % 3) * 0.15;
    const change_pct = change.toFixed(2);
    const liquidity = `${200 + (h % 800)}M`;
    const market_cap = `${40 + (h % 420)}B`;
    return {
        symbol: row.symbol,
        company_name: row.company_name,
        price,
        change_pct,
        liquidity,
        market_cap,
    };
}

export const CompanyService = {
    async getCompanies(limit: number = 10, page: number = 1, select?: Array<string>, filter?: string) {
        if (isDemoDevMode()) {
            const rows = await getSymbolDevRows();
            const start = Math.max(0, (page - 1) * limit);
            return rows.slice(start, start + limit).map((r) => pickCompanyFields(r, select));
        }
        const params: any = { per_page: limit, page };
        if (select) {
            params.select = select;
        }
        if (filter) {
            params.filter = filter;
        }
        const res = await api.get(`/companies`, { params });
        return res.data?.data ?? [];
    },

    async getCompanyInfo(ticker: string) {
        const res = await api.get(`/companies/${ticker}`);
        return res.data ?? null;
    },

    /**
     * Single HTTP request: profile + news + similar (faster than three parallel calls on high-latency links).
     */
    async getCompanyProfileBundle(
        ticker: string,
        opts?: { newsLimit?: number; similarLimit?: number },
    ) {
        const sym = encodeURIComponent(ticker);
        const res = await api.get(`/companies/${sym}/overview`, {
            params: {
                news_limit: opts?.newsLimit ?? 25,
                similar_limit: opts?.similarLimit ?? 6,
            },
        });
        const body = res.data ?? {};
        return {
            profile: body.profile ?? null,
            news: normalizeNewsListResponse(body.news ?? []),
            similar: Array.isArray(body.similar) ? body.similar : [],
        };
    },

    async getCompanyNews(ticker: string, limit: number = 25) {
        const res = await api.get(`/news/symbol/${encodeURIComponent(ticker)}`, {
            params: { limit },
        });
        return normalizeNewsListResponse(res.data);
    },

    async getSimilarCompanies(ticker: string) {
        const res = await api.get(`/companies/${ticker}/similar`);
        return res.data ?? [];
    },

    async topCompanies(limit: number = 10, orderBy: string = "liquidity") {
        if (isDemoDevMode()) {
            const rows = await getSymbolDevRows();
            return rows.slice(0, limit).map((r, i) => demoRankingRow(r, i));
        }
        const companies = await api.get("/rankings/top-companies", {
            params: { limit, orderBy }
        });
        return companies.data?.data ?? [];
    },

    /**
     * Volume-ranked snapshot: top `limit` symbols with positive change_pct and top `limit` with negative,
     * each side ordered by volume (same logic as `/rankings/top-by-volume`).
     */
    async topVolumeMovers(limit: number = 5): Promise<{
        gainers: any[];
        losers: any[];
        updated_note?: string;
    }> {
        if (isDemoDevMode()) {
            const rows = await getSymbolDevRows();
            const n = Math.min(limit, Math.max(1, Math.ceil(rows.length / 2)));
            const gainers = rows.slice(0, n).map((r, i) => {
                const h = r.symbol.charCodeAt(0) + i;
                return {
                    symbol: r.symbol,
                    company_name: r.company_name,
                    change_pct: 0.35 + i * 0.42 + (h % 7) * 0.05,
                    volume: 2_800_000 * (n - i) + h * 10_000,
                    logo_url: null as string | null,
                };
            });
            const losers = rows.slice(n, n + n).map((r, i) => {
                const h = r.symbol.charCodeAt(0) + i;
                return {
                    symbol: r.symbol,
                    company_name: r.company_name,
                    change_pct: -0.28 - i * 0.31 - (h % 5) * 0.04,
                    volume: 2_200_000 * (n - i) + h * 8_000,
                    logo_url: null as string | null,
                };
            });
            return {
                gainers,
                losers: losers.length ? losers : gainers.map((g) => ({ ...g, change_pct: -Math.abs(Number(g.change_pct)) })),
                updated_note: "Demo mode: sample volume movers from the dev symbol set.",
            };
        }
        const res = await api.get("/rankings/top-by-volume", { params: { limit } });
        const data = res.data?.data ?? {};
        return {
            gainers: Array.isArray(data.gainers) ? data.gainers : [],
            losers: Array.isArray(data.losers) ? data.losers : [],
            updated_note: typeof data.updated_note === "string" ? data.updated_note : undefined,
        };
    },

    /** @deprecated Prefer topVolumeMovers — uses change-only ranking, not volume movers. */
    async topGainers(limit: number = 5) {
        const symbol = await api.get("/rankings/top-gainers", {
            params: { limit },
        });
        return symbol.data?.data ?? [];
    },

    /** @deprecated Prefer topVolumeMovers — uses change-only ranking, not volume movers. */
    async topLosers(limit: number = 5) {
        const symbol = await api.get("/rankings/top-losers", {
            params: { limit },
        });
        return symbol.data?.data ?? [];
    },
};