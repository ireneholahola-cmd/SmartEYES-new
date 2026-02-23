-- ============================================
-- 智能交通数字孪生系统 - Supabase 数据库 Schema
-- Smart Traffic Digital Twin Dashboard
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 车道数据表 (lanes)
-- ============================================
CREATE TABLE IF NOT EXISTS lanes (
    id TEXT PRIMARY KEY,
    traffic INTEGER DEFAULT 0,
    speed DECIMAL(10, 2) DEFAULT 0,
    queue DECIMAL(10, 2) DEFAULT 0,
    occupancy INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('normal', 'delay', 'critical', 'emergency')) DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始车道数据
INSERT INTO lanes (id, traffic, speed, queue, occupancy, status) VALUES
    ('L-01', 428, 72.4, 0.0, 12, 'normal'),
    ('L-02', 385, 68.1, 2.5, 18, 'normal'),
    ('L-03', 512, 42.5, 14.0, 45, 'delay'),
    ('L-04', 124, 18.2, 142.0, 88, 'critical'),
    ('L-05', 240, 55.0, 4.1, 32, 'delay'),
    ('L-06', 311, 69.9, 0.0, 22, 'normal'),
    ('应急', 12, 0.0, 0.0, 2, 'emergency')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. 车道历史数据表 (lane_history)
-- ============================================
CREATE TABLE IF NOT EXISTS lane_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lane_id TEXT REFERENCES lanes(id) ON DELETE CASCADE,
    traffic INTEGER,
    speed DECIMAL(10, 2),
    queue DECIMAL(10, 2),
    occupancy INTEGER,
    status TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为时间序列查询创建索引
CREATE INDEX IF NOT EXISTS idx_lane_history_lane_id ON lane_history(lane_id);
CREATE INDEX IF NOT EXISTS idx_lane_history_recorded_at ON lane_history(recorded_at DESC);

-- ============================================
-- 3. 摄像头数据表 (camera_feeds)
-- ============================================
CREATE TABLE IF NOT EXISTS camera_feeds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT CHECK (status IN ('online', 'offline')) DEFAULT 'online',
    url TEXT NOT NULL,
    location_x DECIMAL(10, 2),
    location_y DECIMAL(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始摄像头数据
INSERT INTO camera_feeds (id, name, url, status) VALUES
    ('CAM-01', '西北扇区', 'https://picsum.photos/seed/cam1/800/450', 'online'),
    ('CAM-02', '东北扇区', 'https://picsum.photos/seed/cam2/800/450', 'online'),
    ('CAM-03', '西南枢纽', 'https://picsum.photos/seed/cam3/800/450', 'online'),
    ('CAM-04', '东南隧道', 'https://picsum.photos/seed/cam4/800/450', 'online')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. 拓扑图节点表 (graph_nodes)
-- ============================================
CREATE TABLE IF NOT EXISTS graph_nodes (
    id TEXT PRIMARY KEY,
    type TEXT CHECK (type IN ('hub', 'sensor', 'signal')) DEFAULT 'sensor',
    status TEXT CHECK (status IN ('active', 'warning', 'critical')) DEFAULT 'active',
    lanes TEXT[] DEFAULT '{}',
    last_sync TEXT DEFAULT '0ms',
    details TEXT,
    weight INTEGER DEFAULT 50,
    threshold INTEGER DEFAULT 50,
    position_x DECIMAL(10, 2) DEFAULT 0,
    position_y DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始节点数据
INSERT INTO graph_nodes (id, type, status, details, weight, threshold, position_x, position_y) VALUES
    ('HUB-CENTER', 'hub', 'active', '核心枢纽节点', 100, 0, 400, 200),
    ('NODE_01', 'sensor', 'active', '传感器节点 01', 50, 10, 200, 100)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. 拓扑图连接表 (graph_links)
-- ============================================
CREATE TABLE IF NOT EXISTS graph_links (
    id TEXT PRIMARY KEY,
    source_id TEXT REFERENCES graph_nodes(id) ON DELETE CASCADE,
    target_id TEXT REFERENCES graph_nodes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始连接数据
INSERT INTO graph_links (id, source_id, target_id) VALUES
    ('link-1', 'HUB-CENTER', 'NODE_01')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. 系统统计表 (system_stats)
-- ============================================
CREATE TABLE IF NOT EXISTS system_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    global_density DECIMAL(10, 2) DEFAULT 0,
    efficiency DECIMAL(10, 2) DEFAULT 0,
    load INTEGER DEFAULT 0,
    latency INTEGER DEFAULT 0,
    timestamp TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始系统统计
INSERT INTO system_stats (global_density, efficiency, load, latency, timestamp) VALUES
    (32.4, 94.2, 24, 8, '14:22:05:88');

-- ============================================
-- 7. AI 诊断报告表 (ai_reports)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT CHECK (status IN ('analyzing', 'idle', 'complete')) DEFAULT 'idle',
    summary TEXT,
    recommendations TEXT[],
    last_update TIMESTAMPTZ,
    input_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. 交通工况场景表 (scenarios)
-- ============================================
CREATE TABLE IF NOT EXISTS scenarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    lanes_config JSONB NOT NULL,
    system_stats_config JSONB,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 预设场景示例
INSERT INTO scenarios (name, description, lanes_config, system_stats_config) VALUES
    ('正常工况', '所有车道正常运行', 
     '[{"id":"L-01","traffic":400,"speed":70,"queue":0,"occupancy":15,"status":"normal"}]'::jsonb,
     '{"globalDensity":30,"efficiency":95,"load":20,"latency":5}'::jsonb),
    ('高峰拥堵', '早晚高峰拥堵场景',
     '[{"id":"L-01","traffic":800,"speed":20,"queue":150,"occupancy":90,"status":"critical"}]'::jsonb,
     '{"globalDensity":85,"efficiency":45,"load":95,"latency":50}'::jsonb),
    ('事故应急', '交通事故应急场景',
     '[{"id":"L-04","traffic":50,"speed":5,"queue":500,"occupancy":98,"status":"emergency"}]'::jsonb,
     '{"globalDensity":70,"efficiency":30,"load":100,"latency":100}'::jsonb)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. 用户/设备权限表 (user_profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE,
    username TEXT NOT NULL,
    role TEXT CHECK (role IN ('admin', 'operator', 'viewer', 'device')) DEFAULT 'viewer',
    permissions JSONB DEFAULT '{"canEdit": false, "canDelete": false, "canViewAll": true}'::jsonb,
    associated_nodes TEXT[] DEFAULT '{}',
    associated_cameras TEXT[] DEFAULT '{}',
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 默认管理员用户
INSERT INTO user_profiles (user_id, username, role, permissions) VALUES
    ('admin-001', '系统管理员', 'admin', '{"canEdit": true, "canDelete": true, "canViewAll": true}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为所有需要的表添加触发器
DROP TRIGGER IF EXISTS update_lanes_updated_at ON lanes;
CREATE TRIGGER update_lanes_updated_at BEFORE UPDATE ON lanes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_camera_feeds_updated_at ON camera_feeds;
CREATE TRIGGER update_camera_feeds_updated_at BEFORE UPDATE ON camera_feeds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_graph_nodes_updated_at ON graph_nodes;
CREATE TRIGGER update_graph_nodes_updated_at BEFORE UPDATE ON graph_nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scenarios_updated_at ON scenarios;
CREATE TRIGGER update_scenarios_updated_at BEFORE UPDATE ON scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 启用 Realtime (实时订阅)
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE lanes;
ALTER PUBLICATION supabase_realtime ADD TABLE camera_feeds;
ALTER PUBLICATION supabase_realtime ADD TABLE graph_nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE graph_links;
ALTER PUBLICATION supabase_realtime ADD TABLE system_stats;

-- ============================================
-- Row Level Security (RLS) - 基础策略
-- ============================================
-- 为简化起见，这里设置为公开访问
-- 生产环境中应根据 user_profiles 配置更严格的策略

ALTER TABLE lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE camera_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE lane_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 公开读取策略
CREATE POLICY "Public read access" ON lanes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON camera_feeds FOR SELECT USING (true);
CREATE POLICY "Public read access" ON graph_nodes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON graph_links FOR SELECT USING (true);
CREATE POLICY "Public read access" ON system_stats FOR SELECT USING (true);
CREATE POLICY "Public read access" ON ai_reports FOR SELECT USING (true);
CREATE POLICY "Public read access" ON scenarios FOR SELECT USING (true);
CREATE POLICY "Public read access" ON lane_history FOR SELECT USING (true);

-- Service role 完全访问 (用于后端API)
CREATE POLICY "Service role full access" ON lanes FOR ALL USING (true);
CREATE POLICY "Service role full access" ON camera_feeds FOR ALL USING (true);
CREATE POLICY "Service role full access" ON graph_nodes FOR ALL USING (true);
CREATE POLICY "Service role full access" ON graph_links FOR ALL USING (true);
CREATE POLICY "Service role full access" ON system_stats FOR ALL USING (true);
CREATE POLICY "Service role full access" ON ai_reports FOR ALL USING (true);
CREATE POLICY "Service role full access" ON scenarios FOR ALL USING (true);
CREATE POLICY "Service role full access" ON lane_history FOR ALL USING (true);
CREATE POLICY "Service role full access" ON user_profiles FOR ALL USING (true);
