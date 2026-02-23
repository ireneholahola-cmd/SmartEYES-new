/**
 * 系统统计路由
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { broadcast } from '../index.js';

const router = Router();

// 获取最新系统统计
router.get('/latest', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('system_stats')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json(data || {
            global_density: 0,
            efficiency: 0,
            load: 0,
            latency: 0,
            timestamp: new Date().toLocaleTimeString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取统计历史
router.get('/history', async (req, res) => {
    try {
        const { limit = 100, hours } = req.query;

        let query = supabase
            .from('system_stats')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(parseInt(limit));

        if (hours) {
            const fromDate = new Date();
            fromDate.setHours(fromDate.getHours() - parseInt(hours));
            query = query.gte('recorded_at', fromDate.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 记录新的系统统计
router.post('/', async (req, res) => {
    try {
        const { global_density, efficiency, load, latency, timestamp } = req.body;

        const { data, error } = await supabase
            .from('system_stats')
            .insert({
                global_density: global_density || 0,
                efficiency: efficiency || 0,
                load: load || 0,
                latency: latency || 0,
                timestamp: timestamp || new Date().toLocaleTimeString()
            })
            .select()
            .single();

        if (error) throw error;

        // 广播新统计
        broadcast('stats', { action: 'update', stats: data });

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 计算并记录实时统计 (基于当前车道数据)
router.post('/calculate', async (req, res) => {
    try {
        // 获取所有车道数据
        const { data: lanes, error: lanesError } = await supabase
            .from('lanes')
            .select('*');

        if (lanesError) throw lanesError;

        // 计算统计
        const totalLanes = lanes.length;
        const avgOccupancy = lanes.reduce((s, l) => s + (l.occupancy || 0), 0) / totalLanes;
        const avgSpeed = lanes.reduce((s, l) => s + (l.speed || 0), 0) / totalLanes;
        const criticalLanes = lanes.filter(l => l.status === 'critical' || l.status === 'emergency').length;

        const stats = {
            global_density: Math.round(avgOccupancy * 10) / 10,
            efficiency: Math.round((1 - criticalLanes / totalLanes) * 100 * 10) / 10,
            load: Math.round((avgOccupancy / 100) * 100),
            latency: 5 + Math.floor(Math.random() * 10), // 模拟延迟
            timestamp: new Date().toLocaleTimeString()
        };

        const { data, error } = await supabase
            .from('system_stats')
            .insert(stats)
            .select()
            .single();

        if (error) throw error;

        broadcast('stats', { action: 'calculated', stats: data });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
