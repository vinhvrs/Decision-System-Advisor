import api from "../libs/api";

class HeatmapService {
    async getHeatmapData(params?: { date?: string; sector?: string; }) {
        try {
            const response = await api.get('/heatmap/daily', { params });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching heatmap data:', error);
            throw error;
        }
    }
}

const heatmapService = new HeatmapService();
export default heatmapService;