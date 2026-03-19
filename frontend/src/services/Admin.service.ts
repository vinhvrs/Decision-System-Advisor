import api from "@/src/libs/api";

const ADMIN_PREFIX = "/admin";

export const AdminService = {
  users: {
    list: (params?: { per_page?: number; page?: number; role?: string; search?: string }) =>
      api.get(`${ADMIN_PREFIX}/users`, { params }).then((r) => r.data),
    get: (id: string) => api.get(`${ADMIN_PREFIX}/users/${id}`).then((r) => r.data),
    update: (id: string, data: { name?: string; email?: string; phone?: string; role?: string }) =>
      api.put(`${ADMIN_PREFIX}/users/${id}`, data).then((r) => r.data),
    updateRole: (id: string, role: string) =>
      api.put(`${ADMIN_PREFIX}/users/${id}/role`, { role }).then((r) => r.data),
  },
  companies: {
    list: (params?: { per_page?: number; page?: number; search?: string }) =>
      api.get(`${ADMIN_PREFIX}/companies`, { params }).then((r) => r.data),
    get: (symbol: string) => api.get(`${ADMIN_PREFIX}/companies/${symbol}`).then((r) => r.data),
    update: (symbol: string, data: Record<string, unknown>) =>
      api.put(`${ADMIN_PREFIX}/companies/${symbol}`, data).then((r) => r.data),
  },
  news: {
    list: (params?: { per_page?: number; page?: number; search?: string; symbol?: string }) =>
      api.get(`${ADMIN_PREFIX}/news`, { params }).then((r) => r.data),
    get: (id: string) => api.get(`${ADMIN_PREFIX}/news/${id}`).then((r) => r.data),
    delete: (id: string) => api.delete(`${ADMIN_PREFIX}/news/${id}`).then((r) => r.data),
  },
  statistics: {
    mostWatched: () => api.get(`${ADMIN_PREFIX}/statistics/most-watched`).then((r) => r.data),
  },
};
