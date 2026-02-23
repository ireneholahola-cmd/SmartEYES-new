/**
 * 摄像头数据路由
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { broadcast } from '../index.js';

const router = Router();

// 获取所有摄像头
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('camera_feeds')
            .select('*')
            .order('id');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个摄像头
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('camera_feeds')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Camera not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新摄像头状态
router.put('/:id', async (req, res) => {
    try {
        const { name, status, url, location_x, location_y } = req.body;

        const { data, error } = await supabase
            .from('camera_feeds')
            .update({ name, status, url, location_x, location_y })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        broadcast('cameras', { action: 'update', camera: data });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新摄像头
router.post('/', async (req, res) => {
    try {
        const { id, name, status = 'online', url, location_x, location_y } = req.body;

        const { data, error } = await supabase
            .from('camera_feeds')
            .insert({ id, name, status, url, location_x, location_y })
            .select()
            .single();

        if (error) throw error;

        broadcast('cameras', { action: 'create', camera: data });

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除摄像头
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('camera_feeds')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        broadcast('cameras', { action: 'delete', cameraId: req.params.id });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
