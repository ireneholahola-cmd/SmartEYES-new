/**
 * KGIN (Knowledge Graph Inductive Network) Algorithm Integration Route
 * 
 * This route handles requests for intelligent traffic guidance suggestions.
 * It acts as a bridge between the frontend dashboard and the KGIN algorithm service (Python).
 */

import { Router } from 'express';
import { broadcast } from '../index.js';

const router = Router();

// KGIN Service URL (should be configured in .env)
// Example: http://localhost:8000
const KGIN_SERVICE_URL = process.env.KGIN_SERVICE_URL || 'http://localhost:5000';

/**
 * POST /api/kgin/recommend
 * Generates traffic guidance recommendations based on current state.
 */
router.post('/recommend', async (req, res) => {
    try {
        const { lanes, stats } = req.body;

        if (!lanes || !stats) {
            return res.status(400).json({ error: 'Missing lanes or stats data' });
        }

        console.log(`[KGIN] Requesting recommendations from ${KGIN_SERVICE_URL}...`);

        let result;
        let isFallback = false;

        // Try to connect to the external KGIN Python service
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(`${KGIN_SERVICE_URL}/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lanes, stats }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (response.ok) {
                result = await response.json();
                console.log('[KGIN] Service response received successfully.');
            } else {
                throw new Error(`KGIN Service returned ${response.status}: ${response.statusText}`);
            }
        } catch (serviceError) {
            console.warn('[KGIN] Service unavailable, switching to Mock/Fallback mode:', serviceError.message);
            isFallback = true;
            
            // FALLBACK: Mock data generation (if service is not running)
            // This ensures the UI works for demonstration even without the Python backend
            result = generateMockKginResult(lanes);
        }

        // Add metadata to indicate source of data
        result._source = isFallback ? 'mock' : 'kgin_service';
        result.timestamp = new Date().toISOString();

        // Broadcast the result to all connected clients (if needed)
        broadcast('kgin', { action: 'recommendation_update', result });

        res.json(result);

    } catch (error) {
        console.error('[KGIN Error]', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Helper to generate mock data when KGIN service is offline
 */
function generateMockKginResult(lanes) {
    const recommendations = [
        "建议在 L-03 车道上游 500米 处开启分流诱导",
        "建议将 L-04 车道限速临时调整为 60km/h 以缓解拥堵",
        "检测到 L-02 存在潜在冲突风险，建议加强监控"
    ];

    const optimizedParams = lanes.map(lane => {
        const isCongested = lane.status === 'congestion' || lane.occupancy > 70;
        return {
            laneId: lane.id,
            suggestedSpeed: isCongested ? Math.min(lane.speed + 10, 80) : lane.speed,
            suggestedTraffic: isCongested ? Math.floor(lane.traffic * 0.8) : lane.traffic,
            expectedQueue: isCongested ? Math.max(0, lane.queue - 5) : 0,
            optimizationRate: isCongested ? 0.15 + Math.random() * 0.1 : 0
        };
    });

    return {
        summary: "当前为离线演示模式 (KGIN服务未连接)。监测到 L-03/L-04 区域存在局部拥堵风险，已生成模拟优化诱导方案。",
        recommendations,
        optimizedParams,
        timestamp: new Date().toISOString()
    };
}

export default router;
