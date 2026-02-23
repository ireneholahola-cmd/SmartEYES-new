/**
 * 车道数据路由
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { broadcast } from '../index.js';

const router = Router();

// 获取所有车道数据
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('lanes')
            .select('*')
            .order('id');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个车道
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('lanes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Lane not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新车道数据
router.put('/:id', async (req, res) => {
    try {
        const { traffic, speed, queue, occupancy, status } = req.body;

        const { data, error } = await supabase
            .from('lanes')
            .update({ traffic, speed, queue, occupancy, status })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        // 广播更新
        broadcast('lanes', { action: 'update', lane: data });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 批量更新车道数据 (用于模拟或场景切换)
router.post('/batch', async (req, res) => {
    try {
        const { lanes } = req.body;

        const results = await Promise.all(
            lanes.map(lane =>
                supabase
                    .from('lanes')
                    .upsert(lane)
                    .select()
            )
        );

        const updatedLanes = results.flatMap(r => r.data || []);

        // 广播批量更新
        broadcast('lanes', { action: 'batch_update', lanes: updatedLanes });

        res.json(updatedLanes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新车道
router.post('/', async (req, res) => {
    try {
        const { id, traffic = 0, speed = 0, queue = 0, occupancy = 0, status = 'normal' } = req.body;

        const { data, error } = await supabase
            .from('lanes')
            .insert({ id, traffic, speed, queue, occupancy, status })
            .select()
            .single();

        if (error) throw error;

        broadcast('lanes', { action: 'create', lane: data });

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除车道
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('lanes')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        broadcast('lanes', { action: 'delete', laneId: req.params.id });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
