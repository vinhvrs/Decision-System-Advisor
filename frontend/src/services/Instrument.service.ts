/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/src/libs/api";
import { instrumentMapper, instrumentFromApi, instrumentDataMapper, instrumentPeriodMapper } from "@/src/libs/mapper";
import type { InstrumentAPI } from "@/src/types/Instrument";

export const InstrumentService = {
    getInstruments: async (limit: number = 10, page: number = 1, select?: Array<string>) => {
        try {
            const instrumentList = localStorage.getItem('instrumentList');
            if (instrumentList) {
                return JSON.parse(instrumentList);
            }
            const response = await api.get(`/instruments?per_page=${limit}&page=${page}${select ? select.map(s => `&select[]=${s}`).join('') : ''}`);
            const data = instrumentMapper(response.data.data);
            localStorage.setItem('instrumentList', JSON.stringify(data));
            return data;
        } catch (error) {
            console.error("Error fetching instruments:", error);
            throw error;
        }
    },

    getInstrumentById: async (id: string) => {
        try {
            const response = await api.get(`/instruments/${encodeURIComponent(id)}`);
            const raw = response.data?.data ?? response.data;
            if (!raw || typeof raw !== "object" || !("id" in raw)) {
                throw new Error("Instrument not found");
            }
            return instrumentFromApi(raw as InstrumentAPI);
        } catch (error) {
            console.error("Error fetching instrument by ID:", error);
            throw error;
        }
    },

    /** One request: resolve by UUID, symbol, or slug (no full instrument list). */
    getBySlugOrSymbol: async (slugOrSymbol: string) => {
        const response = await api.get(`/instruments/${encodeURIComponent(slugOrSymbol)}`);
        const raw = response.data?.data ?? response.data;
        if (!raw || typeof raw !== "object" || !("id" in raw)) {
            throw new Error("Instrument not found");
        }
        return instrumentFromApi(raw as InstrumentAPI);
    },

    getPeriods: async () => {
        try {
            const response = await api.get(`/instruments/periods`);
            const data = instrumentPeriodMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching periods:", error);
            throw error;
        }
    },

    getPeriodsById: async (id: string) => {
        try {
            const response = await api.get(`/instruments/periods/${encodeURIComponent(id)}`);
            const rows = response.data?.data ?? [];
            return instrumentPeriodMapper(Array.isArray(rows) ? rows : []);
        } catch {
            return [];
        }
    },

    createPeriods: async (data: any) => {
        try {
            const response = await api.post(`/instruments/periods`, data);
            const mappedData = instrumentPeriodMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error creating periods:", error);
            throw error;
        }
    },

    updatePeriods: async (id: string, data: any) => {
        try {
            const response = await api.put(`/instruments/periods/${id}`, data);
            const mappedData = instrumentPeriodMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error updating periods:", error);
            throw error;
        }
    },

    deletePeriods: async (id: string) => {
        try {
            const response = await api.delete(`/instruments/periods/${id}`);
            return response.data.data;
        } catch (error) {
            console.error("Error deleting periods:", error);
            throw error;
        }
    },

    getInstrumentData: async (symbol: string, period: string, limit: number = 500, page: number = 1) => {
        try {
            const response = await api.get(`/instruments/data/${encodeURIComponent(symbol)}`, {
                params: {
                    period: period || "daily",
                    per_page: limit,
                    page,
                },
                timeout: 120_000,
            });
            const rows = response.data?.data;
            const data = instrumentDataMapper(Array.isArray(rows) ? rows : []);
            return data;
        } catch (error) {
            console.error("Error fetching instrument data:", error);
            throw error;
        }
    },

    /** One POST: daily closes per symbol (oldest first), max 100 symbols. */
    batchDailyCloses: async (symbols: string[], limit: number = 40): Promise<Record<string, number[]>> => {
        const clean = [...new Set(symbols.map((s) => String(s || "").trim().toUpperCase()).filter(Boolean))].slice(0, 100);
        if (!clean.length) return {};
        try {
            const response = await api.post(
                `/instruments/data/batch-daily-closes`,
                { symbols: clean, limit },
                { timeout: 120_000 }
            );
            const raw = response.data?.data;
            if (!raw || typeof raw !== "object") return {};
            const out: Record<string, number[]> = {};
            for (const [k, v] of Object.entries(raw)) {
                if (Array.isArray(v)) {
                    out[k] = v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
                }
            }
            return out;
        } catch (error) {
            console.error("Error batchDailyCloses:", error);
            return {};
        }
    },

    getInstrumentDataByPeriod: async (periodId: string, limit: number = 5000, page: number = 1) => {
        try {
            const response = await api.get(`/instruments/data/period/${encodeURIComponent(periodId)}`, {
                params: {
                    per_page: Math.min(limit, 10000),
                    page,
                },
                timeout: 120_000,
            });
            const rows = response.data?.data;
            const data = instrumentDataMapper(Array.isArray(rows) ? rows : []);
            return data;
        } catch (error) {
            console.error("Error fetching instrument data by period:", error);
            throw error;
        }
    },

    getInstrumentDataById: async (id: string) => {
        try {
            const response = await api.get(`/instruments/data/${id}`);
            const data = instrumentDataMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching instrument data by ID:", error);
            throw error;
        }
    },

    createInstrumentData: async (data: any) => {
        try {
            const response = await api.post(`/instruments/data`, data);
            const mappedData = instrumentDataMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error creating instrument data:", error);
            throw error;
        }
    },

    updateInstrumentData: async (id: string, data: any) => {
        try {
            const response = await api.put(`/instruments/data/${id}`, data);
            const mappedData = instrumentDataMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error updating instrument data:", error);
            throw error;
        }
    },

    deleteInstrumentData: async (id: string) => {
        try {
            const response = await api.delete(`/instruments/data/${id}`);
            return response.data.data;
        } catch (error) {
            console.error("Error deleting instrument data:", error);
            throw error;
        }
    },

    createInstrument: async (data: any) => {
        try {
            const response = await api.post(`/instruments`, data);
            const mappedData = instrumentMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error creating instrument:", error);
            throw error;
        }
    },

    updateInstrument: async (id: string, data: any) => {
        try {
            const response = await api.put(`/instruments/${id}`, data);
            const mappedData = instrumentMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error updating instrument:", error);
            throw error;
        }
    },

    deleteInstrument: async (id: string) => {
        try {
            const response = await api.delete(`/instruments/${id}`);
            return response.data.data;
        } catch (error) {
            console.error("Error deleting instrument:", error);
            throw error;
        }
    },
};