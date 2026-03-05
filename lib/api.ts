/**
 * API 客户端配置
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
// Port updated to 8002
const NEO4J_WS_URL = import.meta.env.VITE_NEO4J_WS_URL || 'ws://127.0.0.1:8002/ws/neo4j';
const NEO4J_API_URL = import.meta.env.VITE_NEO4J_API_URL || 'http://127.0.0.1:8002/api';
const DEIM_API_URL = import.meta.env.VITE_DEIM_API_URL || 'http://localhost:8000';


// HTTP 请求封装
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}


// Neo4j 专用请求封装
async function neo4jRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${NEO4J_API_URL}${endpoint}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

// API 方法

export const api = {
    // 车道数据
    lanes: {
        getAll: () => request<any[]>('/lanes'),
        get: (id: string) => request<any>(`/lanes/${id}`),
        update: (id: string, data: any) => request<any>(`/lanes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        create: (data: any) => request<any>('/lanes', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id: string) => request<void>(`/lanes/${id}`, { method: 'DELETE' }),
        batchUpdate: (lanes: any[]) => request<any[]>('/lanes/batch', { method: 'POST', body: JSON.stringify({ lanes }) }),
    },

    // 摄像头
    cameras: {
        getAll: () => request<any[]>('/cameras'),
        get: (id: string) => request<any>(`/cameras/${id}`),
        update: (id: string, data: any) => request<any>(`/cameras/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        create: (data: any) => request<any>('/cameras', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id: string) => request<void>(`/cameras/${id}`, { method: 'DELETE' }),
    },

    // 拓扑图
    graph: {
        getAll: () => request<{ nodes: any[], links: any[] }>('/graph'),
        getNodes: () => request<any[]>('/graph/nodes'),
        getLinks: () => request<any[]>('/graph/links'),
        createNode: (data: any) => request<any>('/graph/nodes', { method: 'POST', body: JSON.stringify(data) }),
        updateNode: (id: string, data: any) => request<any>(`/graph/nodes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        deleteNode: (id: string) => request<void>(`/graph/nodes/${id}`, { method: 'DELETE' }),
        createLink: (data: any) => request<any>('/graph/links', { method: 'POST', body: JSON.stringify(data) }),
        deleteLink: (id: string) => request<void>(`/graph/links/${id}`, { method: 'DELETE' }),
        sync: (data: { nodes: any[], links: any[] }) => request<any>('/graph/sync', { method: 'POST', body: JSON.stringify(data) }),
    },

    // 场景
    scenarios: {
        getAll: () => request<any[]>('/scenarios'),
        get: (id: string) => request<any>(`/scenarios/${id}`),
        create: (data: any) => request<any>('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => request<any>(`/scenarios/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<void>(`/scenarios/${id}`, { method: 'DELETE' }),
        activate: (id: string) => request<any>(`/scenarios/${id}/activate`, { method: 'POST' }),
        snapshot: (data: { name?: string, description?: string }) => request<any>('/scenarios/snapshot', { method: 'POST', body: JSON.stringify(data) }),
    },

    // AI 诊断
    ai: {
        diagnose: () => request<any>('/ai/diagnose', { method: 'POST' }),
        getReports: (limit = 10) => request<any[]>(`/ai/reports?limit=${limit}`),
        getLatestReport: () => request<any>('/ai/reports/latest'),
        query: (question: string, context?: any) => request<any>('/ai/query', { method: 'POST', body: JSON.stringify({ question, context }) }),
    },

    // KGIN 算法
    kgin: {
        inference: async (data: any) => {
            const res = await fetch('http://127.0.0.1:8000/kgin/inference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        }
    },

    // 历史数据
    history: {
        getLaneHistory: (laneId: string, options?: { limit?: number, from?: string, to?: string }) => {
            const params = new URLSearchParams();
            if (options?.limit) params.set('limit', options.limit.toString());
            if (options?.from) params.set('from', options.from);
            if (options?.to) params.set('to', options.to);
            return request<any[]>(`/history/lanes/${laneId}?${params}`);
        },
        getAllLanesHistory: (hours = 24) => request<Record<string, any[]>>(`/history/lanes?hours=${hours}`),
        createSnapshot: () => request<any>('/history/snapshot', { method: 'POST' }),
        getSummary: (hours = 24) => request<any>(`/history/summary?hours=${hours}`),
    },

    // 用户权限
    users: {
        getAll: (role?: string) => request<any[]>(`/users${role ? `?role=${role}` : ''}`),
        get: (id: string) => request<any>(`/users/${id}`),
        getByUserId: (userId: string) => request<any>(`/users/by-user-id/${userId}`),
        create: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: any) => request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
        checkPermission: (data: { user_id: string, action: string, resource_type?: string, resource_id?: string }) =>
            request<any>('/users/check-permission', { method: 'POST', body: JSON.stringify(data) }),
    },

    // 系统统计
    stats: {
        getLatest: () => request<any>('/stats/latest'),
        getHistory: (options?: { limit?: number, hours?: number }) => {
            const params = new URLSearchParams();
            if (options?.limit) params.set('limit', options.limit.toString());
            if (options?.hours) params.set('hours', options.hours.toString());
            return request<any[]>(`/stats/history?${params}`);
        },
        record: (data: any) => request<any>('/stats', { method: 'POST', body: JSON.stringify(data) }),
        calculate: () => request<any>('/stats/calculate', { method: 'POST' }),
    },

    // Neo4j 知识图谱
    neo4j: {
        getGraph: async () => {
            // Direct call to Neo4j Browser or Backend Proxy
            return { nodes: [], links: [] }; // Mock for now to prevent crash
        }
    },

    // DEIM 视频分析
    video: {
        upload: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            // Use absolute URL to avoid port conflict (Electron on 3000, Backend on 8000)
            const res = await fetch('http://127.0.0.1:8000/upload', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            return await res.json();
        },
        getTaskStatus: async (taskId: string) => {
            const res = await fetch(`http://127.0.0.1:8000/tasks/${taskId}`);
            if (!res.ok) throw new Error('Fetch status failed');
            return await res.json();
        }
    },

    // 健康检查
    health: () => request<any>('/health'),
};

// WebSocket 连接状态
export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

// WebSocket 连接管理（增强版：心跳检测 + 指数退避重连）
export class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private listeners: Map<string, Set<(data: any) => void>> = new Map();
    private statusListeners: Set<(status: WebSocketStatus) => void> = new Set();
    private isConnecting = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private baseReconnectDelay = 1000; // 基础重连延迟 1 秒
    private maxReconnectDelay = 30000; // 最大重连延迟 30 秒
    private heartbeatInterval = 30000; // 心跳间隔 30 秒
    private lastPongTime = 0;

    constructor(url: string) {
        this.url = url;
    }

    // 获取当前连接状态
    get status(): WebSocketStatus {
        if (this.isConnecting) return 'connecting';
        if (this.reconnectTimer) return 'reconnecting';
        if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
        return 'disconnected';
    }

    // 订阅连接状态变化
    onStatusChange(callback: (status: WebSocketStatus) => void) {
        this.statusListeners.add(callback);
        return () => this.statusListeners.delete(callback);
    }

    private notifyStatusChange() {
        const currentStatus = this.status;
        this.statusListeners.forEach(cb => cb(currentStatus));
    }

    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            if (this.isConnecting) {
                resolve();
                return;
            }

            this.isConnecting = true;
            this.notifyStatusChange();

            try {
                this.ws = new WebSocket(this.url);

                this.ws.onopen = () => {
                    console.log('[WS] Connected');
                    this.isConnecting = false;
                    this.reconnectAttempts = 0; // 重置重连计数
                    this.lastPongTime = Date.now();

                    // 订阅所有频道
                    this.ws?.send(JSON.stringify({
                        type: 'subscribe',
                        channels: ['lanes', 'cameras', 'graph', 'stats', 'ai', 'scenarios', 'video_detection', 'neo4j']
                    }));

                    // 启动心跳检测
                    this.startHeartbeat();
                    this.notifyStatusChange();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);

                        // 处理心跳响应
                        if (message.type === 'pong') {
                            this.lastPongTime = Date.now();
                            return;
                        }

                        const channel = message.channel;

                        if (channel && this.listeners.has(channel)) {
                            this.listeners.get(channel)?.forEach(callback => callback(message.data));
                        }

                        // 通知所有通用监听器
                        if (this.listeners.has('*')) {
                            this.listeners.get('*')?.forEach(callback => callback(message));
                        }
                    } catch (e) {
                        console.error('[WS] Parse error:', e);
                    }
                };

                this.ws.onclose = (event) => {
                    console.log('[WS] Disconnected, code:', event.code);
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    this.notifyStatusChange();

                    // 非正常关闭时自动重连（使用指数退避）
                    if (event.code !== 1000) {
                        this.scheduleReconnect();
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('[WS] Error:', error);
                    this.isConnecting = false;
                    this.notifyStatusChange();
                    reject(error);
                };
            } catch (error) {
                this.isConnecting = false;
                this.notifyStatusChange();
                reject(error);
            }
        });
    }

    // 指数退避重连
    private scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[WS] Max reconnect attempts reached');
            return;
        }

        // 计算重连延迟（指数退避 + 随机抖动）
        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
            this.maxReconnectDelay
        );

        console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch(() => {
                // 连接失败时会触发 onclose，自动调度下一次重连
            });
        }, delay);

        this.notifyStatusChange();
    }

    // 启动心跳检测
    private startHeartbeat() {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                // 检查上次心跳响应时间
                if (Date.now() - this.lastPongTime > this.heartbeatInterval * 2) {
                    console.warn('[WS] Heartbeat timeout, reconnecting...');
                    this.ws.close();
                    return;
                }

                // 发送心跳
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.heartbeatInterval);
    }

    // 停止心跳检测
    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close(1000); // 正常关闭
            this.ws = null;
        }
        this.notifyStatusChange();
    }

    subscribe(channel: string, callback: (data: any) => void) {
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, new Set());
        }
        this.listeners.get(channel)?.add(callback);

        // 返回取消订阅函数
        return () => {
            this.listeners.get(channel)?.delete(callback);
        };
    }

    unsubscribe(channel: string, callback?: (data: any) => void) {
        if (callback) {
            this.listeners.get(channel)?.delete(callback);
        } else {
            this.listeners.delete(channel);
        }
    }

    // 手动发送消息
    send(data: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        } else {
            console.warn('[WS] Cannot send: not connected');
        }
    }
}

// 创建单例实例
export const wsClient = new WebSocketClient(WS_URL);
export const neo4jWsClient = new WebSocketClient(NEO4J_WS_URL);

export default api;

