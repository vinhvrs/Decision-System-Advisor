/* eslint-disable @typescript-eslint/no-explicit-any */
import api from "@/src/libs/api";
import { userMapper } from "@/src/libs/mapper";
import { clearClientSession, notifyAuthChanged } from "@/src/libs/session";

function persistSession(token: string, user: ReturnType<typeof userMapper>) {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(user));
    const maxAge = 7 * 24 * 60 * 60;
    document.cookie = `dsa_remember=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    notifyAuthChanged();
}

export const AuthService = {
    registerRequestOtp: async (data: {
        name: string;
        username: string;
        email: string;
        password: string;
        password_confirmation: string;
    }) => {
        const response = await api.post(`/auth/register/request-otp`, data);
        return response.data as { message: string; email?: string };
    },

    registerVerify: async (email: string, otp: string) => {
        const response = await api.post(`/auth/register/verify`, { email, otp });
        const token = response.data.token as string;
        const mappedData = userMapper(response.data.user);
        persistSession(token, mappedData);
        return mappedData;
    },

    forgotPasswordRequest: async (email: string) => {
        const response = await api.post(`/auth/forgot-password`, { email });
        return response.data as { message: string };
    },

    forgotPasswordVerify: async (email: string, otp: string) => {
        const response = await api.post(`/auth/forgot-password/verify`, { email, otp });
        return response.data as { message: string; redirect?: string; must_change_password?: boolean };
    },

    resetPasswordFromTemp: async (data: {
        email: string;
        current_password: string;
        password: string;
        password_confirmation: string;
    }) => {
        const response = await api.post(`/auth/password/reset-temp`, data);
        return response.data as { message: string };
    },

    login: async (data: { email: string; password: string; remember?: boolean }) => {
        try {
            const response = await api.post(`/auth/login`, data);
            const token = response.data.token;
            const mappedData = userMapper(response.data.user);
            persistSession(token, mappedData);
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
        clearClientSession();
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