/**
 * 用户/设备权限路由
 */

import { Router } from 'express';
import supabase from '../config/supabase.js';

const router = Router();

// 获取所有用户
router.get('/', async (req, res) => {
    try {
        const { role } = req.query;

        let query = supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (role) {
            query = query.eq('role', role);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个用户
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'User not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 通过 user_id 获取用户
router.get('/by-user-id/:userId', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', req.params.userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return res.status(404).json({ error: 'User not found' });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建新用户/设备
router.post('/', async (req, res) => {
    try {
        const {
            user_id,
            username,
            role = 'viewer',
            permissions = { canEdit: false, canDelete: false, canViewAll: true },
            associated_nodes = [],
            associated_cameras = []
        } = req.body;

        if (!user_id || !username) {
            return res.status(400).json({ error: 'user_id and username are required' });
        }

        const { data, error } = await supabase
            .from('user_profiles')
            .insert({ user_id, username, role, permissions, associated_nodes, associated_cameras })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'User ID already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// 更新用户
router.put('/:id', async (req, res) => {
    try {
        const { username, role, permissions, associated_nodes, associated_cameras } = req.body;

        const updateData = {};
        if (username !== undefined) updateData.username = username;
        if (role !== undefined) updateData.role = role;
        if (permissions !== undefined) updateData.permissions = permissions;
        if (associated_nodes !== undefined) updateData.associated_nodes = associated_nodes;
        if (associated_cameras !== undefined) updateData.associated_cameras = associated_cameras;

        const { data, error } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 更新用户登录时间
router.post('/:id/login', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .update({ last_login: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除用户
router.delete('/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('user_profiles')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 检查用户权限
router.post('/check-permission', async (req, res) => {
    try {
        const { user_id, action, resource_type, resource_id } = req.body;

        const { data: user, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user_id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (!user) {
            return res.json({ allowed: false, reason: 'User not found' });
        }

        // 管理员拥有所有权限
        if (user.role === 'admin') {
            return res.json({ allowed: true, role: 'admin' });
        }

        // 检查具体权限
        const permissions = user.permissions || {};
        let allowed = false;

        switch (action) {
            case 'edit':
                allowed = permissions.canEdit === true;
                break;
            case 'delete':
                allowed = permissions.canDelete === true;
                break;
            case 'view':
                allowed = permissions.canViewAll === true;
                // 如果不能查看所有，检查是否关联了该资源
                if (!allowed && resource_type === 'node') {
                    allowed = (user.associated_nodes || []).includes(resource_id);
                }
                if (!allowed && resource_type === 'camera') {
                    allowed = (user.associated_cameras || []).includes(resource_id);
                }
                break;
            default:
                allowed = false;
        }

        res.json({
            allowed,
            role: user.role,
            permissions: user.permissions
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
