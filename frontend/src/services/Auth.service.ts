/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/src/libs/api";
import { userMapper } from "@/src/libs/mapper";

export const AuthService = {
    register: async (data: any) => {
        try {
            const response = await api.post(`/auth/register`, data);
            const mappedData = userMapper(response.data);
            console.log("Registered user data:", mappedData);
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
            const response = await api.post(`/auth/logout`,{}, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Accept': "application/json",
                },
            });
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return "Logged out successfully";
        } catch (error) {
            console.error("Error during logout:", error);
            throw error;
        }
    },
};