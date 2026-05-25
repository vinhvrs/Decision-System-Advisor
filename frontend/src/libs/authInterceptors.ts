import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import {
  clearClientSession,
  getAccessToken,
  syncAccessTokenFromCookie,
} from "@/src/libs/session";

const RETRY_FLAG = "_dsaAuthRetry";

export function attachAuthInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    syncAccessTokenFromCookie();
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers.Accept = config.headers.Accept ?? "application/json";
    config.headers["X-Requested-With"] =
      config.headers["X-Requested-With"] ?? "XMLHttpRequest";
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const status = error?.response?.status;
      const config = error?.config as InternalAxiosRequestConfig & {
        [RETRY_FLAG]?: boolean;
      };

      if (status === 401 && config && !config[RETRY_FLAG]) {
        config[RETRY_FLAG] = true;
        localStorage.removeItem("accessToken");
        localStorage.removeItem("token");
        syncAccessTokenFromCookie();
        const retryToken = getAccessToken();
        if (retryToken) {
          config.headers.Authorization = `Bearer ${retryToken}`;
        } else {
          delete config.headers.Authorization;
        }
        try {
          return await client.request(config);
        } catch (retryErr) {
          error = retryErr;
        }
      }

      if (typeof window !== "undefined" && error?.response?.status === 401) {
        const path = window.location.pathname;
        if (path.startsWith("/admin") && !path.startsWith("/admin/auth")) {
          clearClientSession();
          window.location.replace("/admin/auth");
        }
      }

      return Promise.reject(error);
    }
  );
}
