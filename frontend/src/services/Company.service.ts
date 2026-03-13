import api from "../libs/api";

export const CompanyService = {
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