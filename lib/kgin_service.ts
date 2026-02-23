import axios from 'axios';

const KGIN_API_URL = 'http://localhost:8000';

export interface TrafficAdvice {
    input_traffic_id: number;
    recommended_routes: number[];
    scores: number[];
    explanation?: string;
}

export const kginService = {
    /**
     * Get traffic advice from KGIN algorithm
     * @param roadId The ID of the road/traffic condition
     * @param k Number of recommendations to return
     */
    getTrafficAdvice: async (roadId: number, k: number = 5): Promise<TrafficAdvice> => {
        try {
            const response = await axios.post(`${KGIN_API_URL}/predict`, {
                user_id: roadId,
                k: k
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching traffic advice:', error);
            throw error;
        }
    }
};
