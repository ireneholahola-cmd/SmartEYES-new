/**
 * AI 诊断路由 - 集成 Gemini API
 */

import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import supabase from '../config/supabase.js';
import { broadcast } from '../index.js';

const router = Router();

// 初始化 Gemini AI
const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

// 执行 AI 全局诊断
router.post('/diagnose', async (req, res) => {
    try {
        const ai = getAI();
        if (!ai) {
            return res.status(503).json({
                error: 'AI service not configured',
                hint: 'Set GEMINI_API_KEY in .env'
            });
        }

        // 获取当前车道数据
        const { data: lanes } = await supabase
            .from('lanes')
            .select('*');

        // 获取最新系统统计
        const { data: stats } = await supabase
            .from('system_stats')
            .select('*')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();

        // 构建 AI 提示
        const prompt = `
你是一个智能交通分析专家。请分析以下车道数据和系统状态，提供诊断报告。

车道数据:
${JSON.stringify(lanes, null, 2)}

系统统计:
${JSON.stringify(stats, null, 2)}

请提供:
1. 一段简短的状况综述 (summary)
2. 3-5条具体的优化建议 (recommendations)

以 JSON 格式返回:
{
  "summary": "综述内容...",
  "recommendations": ["建议1", "建议2", "建议3"]
}
`;

        // 调用 Gemini API
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });

        const result = JSON.parse(response.text || '{}');

        // 保存诊断报告到数据库
        const { data: report, error } = await supabase
            .from('ai_reports')
            .insert({
                status: 'complete',
                summary: result.summary,
                recommendations: result.recommendations,
                last_update: new Date().toISOString(),
                input_data: { lanes, stats }
            })
            .select()
            .single();

        if (error) throw error;

        // 广播诊断完成
        broadcast('ai', { action: 'diagnose_complete', report });

        res.json(report);
    } catch (error) {
        console.error('[AI Diagnose Error]', error);

        // 保存失败状态
        await supabase
            .from('ai_reports')
            .insert({
                status: 'idle',
                summary: `诊断失败: ${error.message}`
            });

        res.status(500).json({ error: error.message });
    }
});

// 获取诊断历史
router.get('/reports', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const { data, error } = await supabase
            .from('ai_reports')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取最新诊断报告
router.get('/reports/latest', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ai_reports')
            .select('*')
            .eq('status', 'complete')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (!data) {
            return res.json({ status: 'idle' });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 自定义 AI 查询
router.post('/query', async (req, res) => {
    try {
        const ai = getAI();
        if (!ai) {
            return res.status(503).json({
                error: 'AI service not configured',
                hint: 'Set GEMINI_API_KEY in .env'
            });
        }

        const { question, context } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // 获取上下文数据（如果需要）
        let contextData = context || {};
        if (!context) {
            const { data: lanes } = await supabase.from('lanes').select('*');
            contextData = { lanes };
        }

        const prompt = `
你是一个智能交通系统的AI助手。请根据以下数据回答用户的问题。

系统数据:
${JSON.stringify(contextData, null, 2)}

用户问题: ${question}

请用中文简洁地回答。
`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt
        });

        res.json({
            question,
            answer: response.text,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Python 视频检测结果接收 (供 Python 服务调用)
router.post('/video-detection', async (req, res) => {
    try {
        const { camera_id, detection_results, timestamp } = req.body;

        // 将检测结果广播给前端
        broadcast('video_detection', {
            camera_id,
            results: detection_results,
            timestamp: timestamp || new Date().toISOString()
        });

        // 可选：根据检测结果更新车道状态
        if (detection_results) {
            // 这里可以添加逻辑根据视频检测结果更新车道数据
            // 例如：检测到拥堵，更新车道状态
        }

        res.json({ success: true, message: 'Detection results received' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
