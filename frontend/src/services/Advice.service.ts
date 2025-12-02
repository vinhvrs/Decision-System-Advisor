/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "../libs/api";
import { stockMapper } from "../libs/mapper";

export const AdviceService = {
    getAdvices: async (limit: number = 10, page: number = 1, select?: Array<string>) => {
        try {
            const response = await api.get(`/advices?per_page=${limit}&page=${page}${select ? select.map(s => `&select[]=${s}`).join('') : ''}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advices:", error);
            throw error;
        }
    },

    getAdviceById: async (id: string) => {
        try {
            const response = await api.get(`/advices/${id}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advice by ID:", error);
            throw error;
        }
    },

    getAdviceBySymbol: async (symbol: string) => {
        try {
            const response = await api.get(`/advices/symbol/${symbol}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advice by symbol:", error);
            throw error;
        }
    },

    getAdviceByName: async (name: string) => {
        try {
            const response = await api.get(`/advices/name/${name}`);
            const data = stockMapper(response.data.data);
            return data;
        } catch (error) {
            console.error("Error fetching advice by name:", error);
            throw error;
        }
    },

    createAdvice: async (data: any) => {
        try {
            const response = await api.post(`/advices`, data);
            const mappedData = stockMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error creating advice:", error);
            throw error;
        }
    },

    updateAdvice: async (id: string, data: any) => {
        try {
            const response = await api.put(`/advices/${id}`, data);
            const mappedData = stockMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error updating advice:", error);
            throw error;
        }
    },

    deleteAdvice: async (id: string) => {
        try {
            const response = await api.delete(`/advices/${id}`);
            const mappedData = stockMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error deleting advice:", error);
            throw error;
        }
    },
};