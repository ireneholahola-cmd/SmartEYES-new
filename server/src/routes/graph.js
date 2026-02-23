/**
 * 拓扑图数据路由 - 节点和连接
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';
import { broadcast } from '../index.js';

const router = Router();

// ==================== 节点操作 ====================

// 获取所有节点
router.get('/nodes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('graph_nodes')
            .select('*')
            .order('id');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个节点
router.get('/nodes/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('graph_nodes')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Node not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新节点
router.post('/nodes', async (req, res) => {
    try {
        const { id, type = 'sensor', status = 'active', details, weight = 50, threshold = 50, position_x = 0, position_y = 0 } = req.body;

        const { data, error } = await supabase
            .from('graph_nodes')
            .insert({ id, type, status, details, weight, threshold, position_x, position_y, lanes: [], last_sync: '0ms' })
            .select()
            .single();

        if (error) throw error;

        broadcast('graph', { action: 'node_created', node: data });

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新节点
router.put('/nodes/:id', async (req, res) => {
    try {
        const { type, status, details, weight, threshold, position_x, position_y, lanes, last_sync } = req.body;

        const updateData = {};
        if (type !== undefined) updateData.type = type;
        if (status !== undefined) updateData.status = status;
        if (details !== undefined) updateData.details = details;
        if (weight !== undefined) updateData.weight = weight;
        if (threshold !== undefined) updateData.threshold = threshold;
        if (position_x !== undefined) updateData.position_x = position_x;
        if (position_y !== undefined) updateData.position_y = position_y;
        if (lanes !== undefined) updateData.lanes = lanes;
        if (last_sync !== undefined) updateData.last_sync = last_sync;

        const { data, error } = await supabase
            .from('graph_nodes')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        broadcast('graph', { action: 'node_updated', node: data });

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除节点
router.delete('/nodes/:id', async (req, res) => {
    try {
        // 先删除相关的连接
        await supabase
            .from('graph_links')
            .delete()
            .or(`source_id.eq.${req.params.id},target_id.eq.${req.params.id}`);

        const { error } = await supabase
            .from('graph_nodes')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        broadcast('graph', { action: 'node_deleted', nodeId: req.params.id });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 连接操作 ====================

// 获取所有连接
router.get('/links', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('graph_links')
            .select('*');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新连接
router.post('/links', async (req, res) => {
    try {
        const { id, source_id, target_id } = req.body;

        // 检查连接是否已存在
        const { data: existing } = await supabase
            .from('graph_links')
            .select('id')
            .or(`and(source_id.eq.${source_id},target_id.eq.${target_id}),and(source_id.eq.${target_id},target_id.eq.${source_id})`);

        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'Link already exists' });
        }

        const linkId = id || `link-${Date.now()}`;

        const { data, error } = await supabase
            .from('graph_links')
            .insert({ id: linkId, source_id, target_id })
            .select()
            .single();

        if (error) throw error;

        broadcast('graph', { action: 'link_created', link: data });

        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除连接
router.delete('/links/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('graph_links')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        broadcast('graph', { action: 'link_deleted', linkId: req.params.id });

        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 完整图数据 ====================

// 获取完整的图数据 (节点 + 连接)
router.get('/', async (req, res) => {
    try {
        const [nodesResult, linksResult] = await Promise.all([
            supabase.from('graph_nodes').select('*').order('id'),
            supabase.from('graph_links').select('*')
        ]);

        if (nodesResult.error) throw nodesResult.error;
        if (linksResult.error) throw linksResult.error;

        res.json({
            nodes: nodesResult.data,
            links: linksResult.data
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 批量同步图数据
router.post('/sync', async (req, res) => {
    try {
        const { nodes, links } = req.body;

        // 更新所有节点
        if (nodes && nodes.length > 0) {
            for (const node of nodes) {
                await supabase
                    .from('graph_nodes')
                    .upsert({
                        id: node.id,
                        type: node.type,
                        status: node.status,
                        details: node.details,
                        weight: node.weight,
                        threshold: node.threshold,
                        position_x: node.position_x || node.x,
                        position_y: node.position_y || node.y,
                        lanes: node.lanes || [],
                        last_sync: new Date().toISOString()
                    });
            }
        }

        // 同步连接 - 先获取现有连接
        if (links) {
            const { data: existingLinks } = await supabase.from('graph_links').select('id');
            const existingIds = new Set(existingLinks?.map(l => l.id) || []);
            const newIds = new Set(links.map(l => l.id));

            // 删除不在新列表中的连接
            for (const existing of existingLinks || []) {
                if (!newIds.has(existing.id)) {
                    await supabase.from('graph_links').delete().eq('id', existing.id);
                }
            }

            // 添加/更新新连接
            for (const link of links) {
                await supabase
                    .from('graph_links')
                    .upsert({
                        id: link.id,
                        source_id: link.source_id || link.source,
                        target_id: link.target_id || link.target
                    });
            }
        }

        broadcast('graph', { action: 'full_sync' });

        res.json({ success: true, message: 'Graph synchronized' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
