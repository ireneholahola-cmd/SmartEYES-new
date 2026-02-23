/**
 * 场景管理路由
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { broadcast } from '../index.js';

const router = Router();

// 获取所有场景
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个场景
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Scenario not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新场景
router.post('/', async (req, res) => {
    try {
        const { name, description, lanes_config, system_stats_config, is_active = false } = req.body;

        const { data, error } = await supabase
            .from('scenarios')
            .insert({ name, description, lanes_config, system_stats_config, is_active })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新场景
router.put('/:id', async (req, res) => {
    try {
        const { name, description, lanes_config, system_stats_config, is_active } = req.body;

        const { data, error } = await supabase
            .from('scenarios')
            .update({ name, description, lanes_config, system_stats_config, is_active })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 激活场景 - 将场景配置应用到系统
router.post('/:id/activate', async (req, res) => {
    try {
        // 获取场景配置
        const { data: scenario, error: fetchError } = await supabase
            .from('scenarios')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;
        if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

        // 将其他场景设为非激活
        await supabase
            .from('scenarios')
            .update({ is_active: false })
            .neq('id', req.params.id);

        // 激活当前场景
        await supabase
            .from('scenarios')
            .update({ is_active: true })
            .eq('id', req.params.id);

        // 应用车道配置
        if (scenario.lanes_config && Array.isArray(scenario.lanes_config)) {
            for (const laneConfig of scenario.lanes_config) {
                await supabase
                    .from('lanes')
                    .update({
                        traffic: laneConfig.traffic,
                        speed: laneConfig.speed,
                        queue: laneConfig.queue,
                        occupancy: laneConfig.occupancy,
                        status: laneConfig.status
                    })
                    .eq('id', laneConfig.id);
            }
        }

        // 应用系统统计配置
        if (scenario.system_stats_config) {
            await supabase
                .from('system_stats')
                .insert({
                    global_density: scenario.system_stats_config.globalDensity,
                    efficiency: scenario.system_stats_config.efficiency,
                    load: scenario.system_stats_config.load,
                    latency: scenario.system_stats_config.latency,
                    timestamp: new Date().toLocaleTimeString()
                });
        }

        // 广播场景切换
        broadcast('scenarios', { action: 'activated', scenario });
        broadcast('lanes', { action: 'scenario_applied' });

        res.json({ success: true, message: `Scenario "${scenario.name}" activated`, scenario });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除场景
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('scenarios')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 从当前状态创建场景快照
router.post('/snapshot', async (req, res) => {
    try {
        const { name, description } = req.body;

        // 获取当前车道数据
        const { data: lanes } = await supabase.from('lanes').select('id, traffic, speed, queue, occupancy, status');

        // 获取最新系统统计
        const { data: stats } = await supabase
            .from('system_stats')
            .select('global_density, efficiency, load, latency')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();

        const { data, error } = await supabase
            .from('scenarios')
            .insert({
                name: name || `快照 ${new Date().toLocaleString()}`,
                description: description || '从当前状态自动创建',
                lanes_config: lanes,
                system_stats_config: stats ? {
                    globalDensity: stats.global_density,
                    efficiency: stats.efficiency,
                    load: stats.load,
                    latency: stats.latency
                } : null
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
