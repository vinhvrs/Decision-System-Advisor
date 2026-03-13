/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "../libs/api";
import { instrumentMapper, instrumentDataMapper, instrumentPeriodMapper } from "../libs/mapper";

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
            const response = await api.get(`/instruments/${id}`);
            const data = instrumentMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching instrument by ID:", error);
            throw error;
        }
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
            const response = await api.get(`/instruments/periods/${id}`);
            const data = instrumentPeriodMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching periods by ID:", error);
            throw error;
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

    getInstrumentData: async (symbol: string, period:string, limit: number = 500, page: number = 1) => {
        try {
            const response = await api.get(`/instruments/data/${symbol}?${period}&per_page=${limit}&page=${page}`);
            const data = instrumentDataMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching instrument data:", error);
            throw error;
        }
    },

    getInstrumentDataByPeriod: async (periodId: string, limit: number = 100000, page: number = 1, select?: Array<string>) => {
        try {
            const response = await api.get(`/instruments/data/period/${periodId}?per_page=${limit}&page=${page}${select ? select.map(s => `&select[]=${s}`).join('') : ''}`);
            const data = instrumentDataMapper(response.data.data);
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