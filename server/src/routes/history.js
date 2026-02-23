/**
 * 历史数据路由
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';

const router = Router();

// 获取车道历史数据
router.get('/lanes/:laneId', async (req, res) => {
    try {
        const { laneId } = req.params;
        const { limit = 100, from, to } = req.query;

        let query = supabase
            .from('lane_history')
            .select('*')
            .eq('lane_id', laneId)
            .order('recorded_at', { ascending: false })
            .limit(parseInt(limit));

        if (from) {
            query = query.gte('recorded_at', from);
        }
        if (to) {
            query = query.lte('recorded_at', to);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取所有车道的历史数据聚合 (用于趋势图)
router.get('/lanes', async (req, res) => {
    try {
        const { hours = 24, interval = '1h' } = req.query;

        // 计算时间范围
        const fromDate = new Date();
        fromDate.setHours(fromDate.getHours() - parseInt(hours));

        const { data, error } = await supabase
            .from('lane_history')
            .select('lane_id, traffic, speed, queue, occupancy, status, recorded_at')
            .gte('recorded_at', fromDate.toISOString())
            .order('recorded_at', { ascending: true });

        if (error) throw error;

        // 按车道分组
        const groupedData = {};
        for (const record of data || []) {
            if (!groupedData[record.lane_id]) {
                groupedData[record.lane_id] = [];
            }
            groupedData[record.lane_id].push(record);
        }

        res.json(groupedData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 记录当前车道状态快照
router.post('/snapshot', async (req, res) => {
    try {
        // 获取当前所有车道数据
        const { data: lanes, error: lanesError } = await supabase
            .from('lanes')
            .select('*');

        if (lanesError) throw lanesError;

        // 批量插入历史记录
        const historyRecords = lanes.map(lane => ({
            lane_id: lane.id,
            traffic: lane.traffic,
            speed: lane.speed,
            queue: lane.queue,
            occupancy: lane.occupancy,
            status: lane.status
        }));

        const { data, error } = await supabase
            .from('lane_history')
            .insert(historyRecords)
            .select();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: `Recorded ${historyRecords.length} lane snapshots`,
            count: historyRecords.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取统计摘要
router.get('/summary', async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const fromDate = new Date();
        fromDate.setHours(fromDate.getHours() - parseInt(hours));

        // 获取历史数据
        const { data, error } = await supabase
            .from('lane_history')
            .select('lane_id, traffic, speed, occupancy')
            .gte('recorded_at', fromDate.toISOString());

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.json({
                period_hours: parseInt(hours),
                total_records: 0,
                averages: {}
            });
        }

        // 计算统计
        const summary = {
            period_hours: parseInt(hours),
            total_records: data.length,
            averages: {
                traffic: Math.round(data.reduce((s, r) => s + (r.traffic || 0), 0) / data.length),
                speed: Math.round(data.reduce((s, r) => s + (r.speed || 0), 0) / data.length * 10) / 10,
                occupancy: Math.round(data.reduce((s, r) => s + (r.occupancy || 0), 0) / data.length)
            },
            peaks: {
                max_traffic: Math.max(...data.map(r => r.traffic || 0)),
                min_speed: Math.min(...data.filter(r => r.speed > 0).map(r => r.speed)),
                max_occupancy: Math.max(...data.map(r => r.occupancy || 0))
            }
        };

        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 清理旧历史数据
router.delete('/cleanup', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

        const { error, count } = await supabase
            .from('lane_history')
            .delete()
            .lt('recorded_at', cutoffDate.toISOString());

        if (error) throw error;

        res.json({
            success: true,
            message: `Cleaned up records older than ${days} days`,
            deleted_count: count
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
