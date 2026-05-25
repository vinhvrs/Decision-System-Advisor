import axios from "axios";
import { attachAuthInterceptors } from "@/src/libs/authInterceptors";

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

attachAuthInterceptors(api);

export default api;
