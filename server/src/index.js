/**
 * Smart Traffic Digital Twin Dashboard - Backend API Server
 * Express.js 主入口文件
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import expressWs from 'express-ws';

// 路由导入
import lanesRouter from './routes/lanes.js';
import camerasRouter from './routes/cameras.js';
import graphRouter from './routes/graph.js';
import scenariosRouter from './routes/scenarios.js';
import aiRouter from './routes/ai.js';
import kginRouter from './routes/kgin.js';
import historyRouter from './routes/history.js';
import usersRouter from './routes/users.js';
import statsRouter from './routes/stats.js';

// 创建 Express 应用并启用 WebSocket
const app = express();
const wsInstance = expressWs(app);

// 中间件配置
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// API 路由
app.use('/api/lanes', lanesRouter);
app.use('/api/cameras', camerasRouter);
app.use('/api/graph', graphRouter);
app.use('/api/scenarios', scenariosRouter);
app.use('/api/ai', aiRouter);
app.use('/api/kgin', kginRouter);
app.use('/api/history', historyRouter);
app.use('/api/users', usersRouter);
app.use('/api/stats', statsRouter);

// WebSocket 实时数据推送端点
const wsClients = new Set();

app.ws('/ws', (ws, req) => {
    console.log('[WS] Client connected');
    wsClients.add(ws);

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            console.log('[WS] Received:', data.type);

            // 处理客户端消息
            if (data.type === 'subscribe') {
                ws.subscriptions = data.channels || [];
            }
        } catch (e) {
            console.error('[WS] Parse error:', e);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        wsClients.delete(ws);
    });

    // 发送欢迎消息
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
});

// 广播函数 - 供其他模块使用
export function broadcast(channel, data) {
    const message = JSON.stringify({ channel, data, timestamp: new Date().toISOString() });
    wsClients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
            // 检查订阅
            if (!client.subscriptions || client.subscriptions.includes(channel)) {
                client.send(message);
            }
        }
    });
}

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
            supabase: 'connected',
            websocket: 'ready',
            pythonBridge: process.env.PYTHON_VIDEO_SERVICE_URL ? 'configured' : 'not configured'
        }
    });
});

// Python 视频检测服务集成端点 (预留)
app.post('/api/video/detect', async (req, res) => {
    const pythonServiceUrl = process.env.PYTHON_VIDEO_SERVICE_URL;

    if (!pythonServiceUrl) {
        return res.status(503).json({
            error: 'Python video detection service not configured',
            hint: 'Set PYTHON_VIDEO_SERVICE_URL in .env'
        });
    }

    try {
        // 转发请求到 Python 服务
        const response = await fetch(`${pythonServiceUrl}/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const result = await response.json();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to connect to Python service', details: error.message });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Smart Traffic Digital Twin - Backend API Server       ║
╠═══════════════════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}                           ║
║  📡 WebSocket ready at ws://localhost:${PORT}/ws              ║
║  🔗 Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Not configured'}                               ║
║  🐍 Python Service: ${process.env.PYTHON_VIDEO_SERVICE_URL ? 'Configured' : 'Not configured'}                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
