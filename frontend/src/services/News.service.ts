import api from "@/src/libs/api";

class NewsService {
    // Fetch all news with pagination
    async getAllNews(params?: { page?: number; per_page?: number; }) {
        try {
            const response = await api.get('/news', { params });
            return {
                data: response.data.data,
                pagination: {
                    currentPage: response.data.current_page,
                    totalPages: response.data.total_pages,
                    totalItems: response.data.total_items,
                    perPage: response.data.per_page,
                },
            };
        } catch (error) {
            console.error('Error fetching news:', error);
            throw error;
        }
    }

    // Fetch a single news item by ID
    async getNewsById(id: string) {
        try {
            const response = await api.get(`/news/${id}`);
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