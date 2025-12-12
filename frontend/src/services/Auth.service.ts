/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "../libs/api";
import { userMapper } from "../libs/mapper";

export const AuthService = {
    register: async (data: any) => {
        try {
            const response = await api.post(`/auth/register`, data);
            const mappedData = userMapper(response.data.data);
            return mappedData;
        } catch (error) {
            console.error("Error during registration:", error);
            throw error;
        }
    },

    login: async (data: any) => {
        try {
            const response = await api.post(`/auth/login`, data);
            localStorage.setItem('token', response.data.token);
            const mappedData = userMapper(response.data.user);
            localStorage.setItem('user', JSON.stringify(mappedData));
            return mappedData;
        } catch (error) {
            console.error("Error during login:", error);
            throw error;
        }
    },

    logout: async () => {
        try {
            const response = await api.post(`/auth/logout`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });
            localStorage.removeItem('token');
            return response.data;
        } catch (error) {
            console.error("Error during logout:", error);
            throw error;
        }
    },
};