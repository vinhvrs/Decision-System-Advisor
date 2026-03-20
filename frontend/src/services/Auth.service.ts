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

    loginAdmin: async (data: { email: string; password: string; remember?: boolean }) => {
        try {
            const response = await api.post(`/admin/auth/login`, data);
            const token = response.data.token;
            const mappedData = userMapper(response.data.user);
            const role = mappedData.role;
            if (role !== "admin" && role !== "staff") {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("user");
                document.cookie = "dsa_remember=; path=/; max-age=0";
                throw new Error("FORBIDDEN");
            }
            localStorage.setItem("accessToken", token);
            localStorage.setItem("user", JSON.stringify(mappedData));
            const maxAge = 7 * 24 * 60 * 60;
            document.cookie = `dsa_remember=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
            return mappedData;
        } catch (error: any) {
            if (error?.message === "FORBIDDEN") throw error;
            console.error("Admin login error:", error);
            throw error;
        }
    },

    logout: async () => {
        const token = localStorage.getItem("accessToken") || localStorage.getItem("token");
        // Optimistic: clear session immediately for instant UI feedback
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        document.cookie = "dsa_remember=; path=/; max-age=0";
        // Fire logout API in background (fire-and-forget)
        if (token) {
            api.post(`/auth/logout`, {}, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json",
                },
            }).catch((err) => console.warn("Logout API (background):", err));
        }
        return "Logged out successfully";
    },
};