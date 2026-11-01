/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/src/libs/api";

export const CompanyService = {
    async getCompanies(limit: number = 10, page: number = 1, select?: Array<string>, filter?: string) {
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

    async getCompanyNews(ticker: string) {
        const res = await api.get(`/news/symbol/${ticker}`);
        return res.data ?? [];
    },

    async getSimilarCompanies(ticker: string) {
        const res = await api.get(`/companies/${ticker}/similar`);
        return res.data ?? [];
    },

    async topCompanies(limit: number = 10, orderBy: string = "liquidity") {
        const companies = await api.get("/rankings/top-companies", {
            params: { limit, orderBy }
        });
        return companies.data?.data ?? [];
    },

    async topGainers(limit: number = 5){
        const symbol = await api.get("/rankings/top-gainers", {
            params: { limit }
        });
        return symbol.data?.data ?? [];
    },

    async topLosers(limit: number = 5){
        const symbol = await api.get("/rankings/top-losers", {
            params: { limit }
        });
        return symbol.data?.data ?? [];
    }
}