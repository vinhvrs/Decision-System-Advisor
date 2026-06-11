import api from "@/src/libs/api";
import { normalizeNewsListResponse } from "@/src/libs/newsArticle";

class NewsService {
    // Fetch all news with pagination
    async getAllNews(params?: { page?: number; per_page?: number; }) {
        try {
            const response = await api.get("/news", { params, timeout: 25_000 });
            const paginated = response.data;
            const rows = normalizeNewsListResponse(paginated?.data ?? paginated);
            return {
                data: rows,
                pagination: {
                    currentPage: paginated?.current_page ?? 1,
                    totalPages: paginated?.last_page ?? 1,
                    totalItems: paginated?.total ?? rows.length,
                    perPage: paginated?.per_page ?? params?.per_page ?? 15,
                },
            };
        } catch {
            return {
                data: [],
                pagination: {
                    currentPage: params?.page ?? 1,
                    totalPages: 1,
                    totalItems: 0,
                    perPage: params?.per_page ?? 15,
                },
            };
        }
    }

    // Fetch a single news item by ID
    async getNewsById(id: string) {
        try {
            const response = await api.get(`/news/${encodeURIComponent(id)}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching news with ID ${id}:`, error);
            throw error;
        }
    }

    // // Fetch a single news item by Slug
    // async getBySlug(slug: string) {
    //     try {
    //         const response = await api.get(`/news/get-by-slug/${slug}`);
    //         return response.data;
    //     } catch (error) {
    //         console.error(`Error fetching news with slug ${slug}:`, error);
    //         throw error;
    //     }
    // }

    // Delete a news item
    async deleteNews(id: string) {
        try {
            const response = await api.delete(`/news/${id}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting news with ID ${id}:`, error);
            throw error;
        }
    }
}

const newsService = new NewsService();
export default newsService;