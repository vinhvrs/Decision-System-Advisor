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

export default api;
