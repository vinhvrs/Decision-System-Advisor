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

    login: async (data: { email: string; password: string; remember?: boolean }) => {
        try {
            const response = await api.post(`/auth/login`, data);
            const token = response.data.token;
            const mappedData = userMapper(response.data.user);
            // Use accessToken (api.ts reads this for Authorization header)
            localStorage.setItem("accessToken", token);
            localStorage.setItem("user", JSON.stringify(mappedData));
            // Remember cookie for quick re-login (7 days)
            const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
            document.cookie = `dsa_remember=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
            return mappedData;
        } catch (error) {
            console.error("Error during login:", error);
            throw error;
        }
    },

    logout: async () => {
        try {
            const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
            if (token) {
                await api.post(`/auth/logout`, {}, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: "application/json",
                    },
                });
            }
            localStorage.removeItem("accessToken");
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            document.cookie = "dsa_remember=; path=/; max-age=0";
            return "Logged out successfully";
        } catch (error) {
            console.error("Error during logout:", error);
            throw error;
        }
    },
};