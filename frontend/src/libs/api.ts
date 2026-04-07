import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:1111/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 60_000,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

api.interceptors.request.use((config) => {
  // Prefer accessToken, fallback to remember cookie for quick re-login
  let token = localStorage.getItem("accessToken");
  if (!token && typeof document !== "undefined") {
    const match = document.cookie.match(/dsa_remember=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
      localStorage.setItem("accessToken", token);
    }
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (typeof window === "undefined") {
      return Promise.reject(error);
    }
    const status = error?.response?.status;
    if (status !== 401) {
      return Promise.reject(error);
    }
    const path = window.location.pathname;
    if (!path.startsWith("/admin") || path.startsWith("/admin/auth")) {
      return Promise.reject(error);
    }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "dsa_remember=; path=/; max-age=0";
    window.location.replace("/admin/auth");
    return Promise.reject(error);
  }
);

export default api;
