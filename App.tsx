import React, { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import LaneMatrix from './components/LaneMatrix';
import VideoGrid from './components/VideoGrid';
import KnowledgeGraph from './components/KnowledgeGraph';
import RealtimeGraph from './components/RealtimeGraph';
import AIAgent from './components/AIAgent';
import LaneDetailModal from './components/LaneDetailModal';
import Footer from './components/Footer';
import { LaneData, SystemStats, AIReport } from './types';
import { api, wsClient, neo4jWsClient } from './lib/api';

const App: React.FC = () => {
  // API 连接状态
  const [isConnected, setIsConnected] = useState(false);
  const [useLocalData, setUseLocalData] = useState(false);

  // 系统基础数据
  const [systemStats, setSystemStats] = useState<SystemStats>({
    globalDensity: 32.4, efficiency: 94.2, load: 24, latency: 8, timestamp: '14:22:05:88',
  });

  const [lanes, setLanes] = useState<LaneData[]>([
    { id: 'L-01', traffic: 428, speed: 72.4, queue: 0.0, occupancy: 12, status: 'normal' },
    { id: 'L-02', traffic: 385, speed: 68.1, queue: 2.5, occupancy: 18, status: 'normal' },
    { id: 'L-03', traffic: 512, speed: 42.5, queue: 14.0, occupancy: 45, status: 'delay' },
    { id: 'L-04', traffic: 124, speed: 18.2, queue: 142.0, occupancy: 88, status: 'critical' },
    { id: 'L-05', traffic: 240, speed: 55.0, queue: 4.1, occupancy: 32, status: 'delay' },
    { id: 'L-06', traffic: 311, speed: 69.9, queue: 0.0, occupancy: 22, status: 'normal' },
    { id: '应急', traffic: 12, speed: 0.0, queue: 0.0, occupancy: 2, status: 'emergency' },
  ]);

  // 窗口可见性状态
  const [visibleWindows, setVisibleWindows] = useState({
    matrix: true, ai: true, video: true, graph: true, neo4j: true
  });

  // 布局尺寸状态
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [leftSplit, setLeftSplit] = useState(50); // 百分比
  const [rightSplit, setRightSplit] = useState(60); // 百分比

  const [aiReport, setAiReport] = useState<AIReport>({ status: 'idle' });
  const [kginOptimizedParams, setKginOptimizedParams] = useState<any[]>([]);
  const [selectedLane, setSelectedLane] = useState<LaneData | null>(null);
  const [expandedId, setExpandedId] = useState<'video' | 'graph' | 'neo4j' | null>(null);

  // Neo4j 知识图谱数据
  const [neo4jGraphData, setNeo4jGraphData] = useState<{
    nodes: Array<{ id: string; name: string; type: string; speed?: number }>;
    links: Array<{ source: string; target: string }>;
  }>({ nodes: [], links: [] });

  // 拖拽调整逻辑
  const isResizing = useRef<string | null>(null);

  const startResizing = (type: string) => {
    isResizing.current = type;
    document.body.style.cursor = type === 'width' ? 'col-resize' : 'row-resize';
    document.body.classList.add('select-none');
  };

  // 初始化：从后端加载数据
  useEffect(() => {
    const initData = async () => {
      // 1. 建立 WebSocket 连接 (独立于 HTTP 状态)
      wsClient.connect().catch(console.error);
      neo4jWsClient.connect().catch(console.error);

      // 2. 设置 WebSocket 订阅
      wsClient.subscribe('lanes', (data) => {
        if (data.action === 'update' && data.lane) {
          setLanes(prev => prev.map(l => l.id === data.lane.id ? data.lane : l));
        } else if (data.action === 'batch_update' || data.action === 'scenario_applied') {
          api.lanes.getAll().then(setLanes).catch(() => { });
        }
      });

      wsClient.subscribe('stats', (data) => {
        if (data.stats) {
          setSystemStats({
            globalDensity: data.stats.global_density || 0,
            efficiency: data.stats.efficiency || 0,
            load: data.stats.load || 0,
            latency: data.stats.latency || 0,
            timestamp: data.stats.timestamp || new Date().toLocaleTimeString(),
          });
        }
      });

      wsClient.subscribe('ai', (data) => {
        if (data.action === 'diagnose_complete' && data.report) {
          setAiReport({
            status: 'complete',
            summary: data.report.summary,
            recommendations: data.report.recommendations,
            lastUpdate: data.report.last_update
          });
        }
      });

      // Neo4j 实时订阅
      const unsubNeo4j = neo4jWsClient.subscribe('neo4j', (data) => {
        // console.log('[App] Received Neo4j update:', data.action, data.nodes?.length); // Debug log
        if (data.nodes && data.links) {
          setNeo4jGraphData(prev => {
            const existingPositions = new Map<string, { x?: number; y?: number }>(
              prev.nodes.map(n => [n.id, { x: (n as any).x, y: (n as any).y }])
            );

            // 检查是否有实质性变化
            // const changedNode = data.nodes.find((n: any) => n.speed !== undefined);
            // if (changedNode) console.log('[App] Node update example:', changedNode.id, changedNode.speed);

            const newNodes = data.nodes.map((n: any) => {
              const existingPos = existingPositions.get(n.id);
              return {
                id: n.id as string,
                name: n.name as string,
                type: n.type as string,
                speed: n.speed as number | undefined,
                laneId: n.laneId as string | undefined, // 确保传递 laneId
                ...(existingPos ? { x: existingPos.x, y: existingPos.y } : {}),
              };
            });
            return { nodes: newNodes, links: data.links };
          });
        }
      });

      // 3. 加载主后端数据 (可能失败，需独立捕获)
      try {
        await api.health();
        setIsConnected(true);

        const lanesData = await api.lanes.getAll();
        if (lanesData && lanesData.length > 0) setLanes(lanesData);

        const statsData = await api.stats.getLatest();
        if (statsData) {
          setSystemStats({
            globalDensity: statsData.global_density || 0,
            efficiency: statsData.efficiency || 0,
            load: statsData.load || 0,
            latency: statsData.latency || 0,
            timestamp: statsData.timestamp || new Date().toLocaleTimeString(),
          });
        }

        const latestReport = await api.ai.getLatestReport();
        if (latestReport && latestReport.status === 'complete') {
          setAiReport({
            status: 'complete',
            summary: latestReport.summary,
            recommendations: latestReport.recommendations,
            lastUpdate: latestReport.last_update
          });
        }
      } catch (error) {
        console.warn('[App] Main Backend not available, using local data:', error);
        setUseLocalData(true);
      }

      // 4. 加载 Neo4j 初始数据 (独立尝试)
      try {
        const neo4jData = await api.neo4j.getGraph();
        if (neo4jData.nodes && neo4jData.nodes.length > 0) {
          setNeo4jGraphData(neo4jData);
        }
      } catch (neo4jError) {
        console.warn('[App] Neo4j data not available:', neo4jError);
      }
    };


    initData();

    return () => {
      wsClient.disconnect();
      neo4jWsClient.disconnect();
    };

  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      if (isResizing.current === 'width') {
        const newWidth = Math.max(300, Math.min(600, e.clientX - 10));
        setSidebarWidth(newWidth);
      } else if (isResizing.current === 'left-height') {
        const container = document.getElementById('left-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const pos = ((e.clientY - rect.top) / rect.height) * 100;
          setLeftSplit(Math.max(20, Math.min(80, pos)));
        }
      } else if (isResizing.current === 'right-height') {
        const container = document.getElementById('right-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const pos = ((e.clientY - rect.top) / rect.height) * 100;
          setRightSplit(Math.max(20, Math.min(80, pos)));
        }
      }
    };

    const handleMouseUp = () => {
      isResizing.current = null;
      document.body.style.cursor = 'default';
      document.body.classList.remove('select-none');
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const toggleWindow = (key: keyof typeof visibleWindows) => {
    setVisibleWindows(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const runAIDiagnostic = useCallback(async () => {
    setAiReport({ status: 'analyzing' });

    try {
      if (isConnected && !useLocalData) {
        // 使用后端 KGIN API (替代原有的 Gemini AI 诊断)
        const result = await api.kgin.recommend({ lanes, stats: systemStats });
        
        setAiReport({
          status: 'complete',
          summary: result.summary,
          recommendations: result.recommendations,
          lastUpdate: result.timestamp || new Date().toLocaleTimeString()
        });

        if (result.optimizedParams) {
          setKginOptimizedParams(result.optimizedParams);
        }

      } else {
        // 离线/演示模式：调用本地 Gemini API 模拟或直接生成 Mock 数据
        // 为了演示 KGIN 效果，这里我们优先尝试调用后端 mock (如果后端 API 可达)，
        // 或者直接在前端生成 Mock 数据
        
        try {
          // 尝试调用后端(即使是本地 mock)
          const result = await api.kgin.recommend({ lanes, stats: systemStats });
           setAiReport({
            status: 'complete',
            summary: result.summary,
            recommendations: result.recommendations,
            lastUpdate: result.timestamp || new Date().toLocaleTimeString()
          });
          if (result.optimizedParams) setKginOptimizedParams(result.optimizedParams);

        } catch (e) {
          // 彻底离线时的 Mock (前端 fallback)
          setAiReport({
            status: 'complete',
            summary: "离线演示模式：检测到 L-03 区域存在潜在拥堵风险，KGIN 算法建议进行流量分流。",
            recommendations: [
               "建议在 L-03 上游实施分流诱导",
               "建议将 L-04 限速调整为 60km/h",
               "建议开启应急车道临时通行权限"
            ],
            lastUpdate: new Date().toLocaleTimeString()
          });
          setKginOptimizedParams(lanes.map(l => ({
             laneId: l.id,
             suggestedTraffic: Math.floor(l.traffic * 0.9),
             suggestedSpeed: l.speed,
             expectedQueue: Math.max(0, l.queue - 5),
             optimizationRate: 0.1
          })));
        }
      }
    } catch (error) {
      console.error('[KGIN Diagnose Error]', error);
      setAiReport({ status: 'idle' });
    }
  }, [lanes, isConnected, useLocalData, systemStats]);

  // 数据模拟更新 (仅在未连接后端时使用)
  useEffect(() => {
    if (isConnected && !useLocalData) return; // 使用后端数据时不模拟

    const interval = setInterval(() => {
      setLanes(prev => prev.map(lane => ({
        ...lane,
        traffic: Math.max(0, lane.traffic + Math.floor(Math.random() * 5 * (Math.random() > 0.5 ? 1 : -1))),
      })));
      setSystemStats(prev => ({ ...prev, timestamp: new Date().toLocaleTimeString(), latency: 5 + Math.floor(Math.random() * 5) }));
    }, 2000);
    return () => clearInterval(interval);
  }, [isConnected, useLocalData]);

  return (
    <div className="flex flex-col h-screen bg-background-dark text-slate-100 overflow-hidden">
      <Header stats={systemStats} />

      {/* 连接状态指示器 */}
      {!isConnected && (
        <div className="absolute top-16 right-4 z-50 px-3 py-1.5 bg-accent-yellow/20 border border-accent-yellow/40 rounded-lg text-[10px] text-accent-yellow font-mono">
          ⚠ 离线模式 - 使用本地模拟数据
        </div>
      )}

      <main className="flex-1 flex overflow-hidden p-3 gap-0 relative">
        {/* 左侧面板 */}
        <div
          id="left-container"
          className={`flex flex-col transition-all duration-300 ${(!visibleWindows.matrix && !visibleWindows.ai) ? 'w-0 opacity-0 pointer-events-none' : ''}`}
          style={{ width: visibleWindows.matrix || visibleWindows.ai ? sidebarWidth : 0 }}
        >
          {visibleWindows.matrix && (
            <div className="flex flex-col overflow-hidden" style={{ height: visibleWindows.ai ? `${leftSplit}%` : '100%' }}>
              <LaneMatrix 
                lanes={lanes} 
                stats={systemStats} 
                optimizedParams={kginOptimizedParams}
                onTriggerAI={runAIDiagnostic} 
                onLaneClick={setSelectedLane} 
                aiStatus={aiReport.status} 
                onMinimize={() => toggleWindow('matrix')} 
              />
            </div>
          )}

          {visibleWindows.matrix && visibleWindows.ai && (
            <div className="h-2 w-full cursor-row-resize hover:bg-primary/20 transition-colors shrink-0" onMouseDown={() => startResizing('left-height')} />
          )}

          {visibleWindows.ai && (
            <div className="flex-1 flex flex-col overflow-hidden" style={{ height: visibleWindows.matrix ? `${100 - leftSplit}%` : '100%' }}>
              <AIAgent report={aiReport} onMinimize={() => toggleWindow('ai')} />
            </div>
          )}
        </div>

        {/* 垂直调整手柄 */}
        {(visibleWindows.matrix || visibleWindows.ai) && (visibleWindows.video || visibleWindows.graph) && (
          <div className="w-3 cursor-col-resize flex items-center justify-center group shrink-0" onMouseDown={() => startResizing('width')}>
            <div className="w-px h-12 bg-white/10 group-hover:bg-primary/40 group-hover:h-full transition-all duration-300" />
          </div>
        )}

        {/* 右侧面板 */}
        <div
          id="right-container"
          className="flex-1 flex flex-col overflow-hidden"
        >
          {visibleWindows.video && (
            <div
              className={`transition-all duration-500 overflow-hidden ${expandedId === 'video' ? 'fixed inset-0 z-[150]' : ''}`}
              style={{ height: expandedId === 'video' ? '100%' : (visibleWindows.neo4j ? `${rightSplit}%` : '100%') }}
            >
              <VideoGrid isExpanded={expandedId === 'video'} onToggleExpand={() => setExpandedId(expandedId === 'video' ? null : 'video')} onMinimize={() => toggleWindow('video')} />
            </div>
          )}

          {visibleWindows.video && visibleWindows.neo4j && (
            <div className="h-2 w-full cursor-row-resize hover:bg-primary/20 transition-colors shrink-0" onMouseDown={() => startResizing('right-height')} />
          )}

          {visibleWindows.neo4j && (
            <div
              className={`transition-all duration-500 overflow-hidden ${expandedId === 'neo4j' ? 'fixed inset-0 z-[150]' : ''}`}
              style={{ height: expandedId === 'neo4j' ? '100%' : (visibleWindows.video ? `${100 - rightSplit}%` : '100%') }}
            >
              <RealtimeGraph
                graphData={neo4jGraphData}
                isExpanded={expandedId === 'neo4j'}
                onToggleExpand={() => setExpandedId(expandedId === 'neo4j' ? null : 'neo4j')}
                onMinimize={() => toggleWindow('neo4j')}
              />
            </div>
          )}
        </div>
      </main>

      {/* 底部唤醒 Dock */}
      {Object.values(visibleWindows).some(v => !v) && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-3 bg-panel-dark/80 backdrop-blur-xl border border-white/10 rounded-2xl z-[200] animate-in slide-in-from-bottom-10 shadow-2xl">
          {!visibleWindows.matrix && <DockItem icon="grid_view" label="数据矩阵" onClick={() => toggleWindow('matrix')} color="text-primary" />}
          {!visibleWindows.ai && <DockItem icon="psychology" label="智能诱导" onClick={() => toggleWindow('ai')} color="text-accent-green" />}
          {!visibleWindows.video && <DockItem icon="videocam" label="监控矩阵" onClick={() => toggleWindow('video')} color="text-accent-yellow" />}
          {!visibleWindows.neo4j && <DockItem icon="hub" label="Neo4j图谱" onClick={() => toggleWindow('neo4j')} color="text-accent-green" />}
        </div>
      )}

      <Footer />
      {selectedLane && <LaneDetailModal lane={selectedLane} onClose={() => setSelectedLane(null)} />}
    </div>
  );
};

const DockItem: React.FC<{ icon: string, label: string, onClick: () => void, color: string }> = ({ icon, label, onClick, color }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 group"
  >
    <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/10 group-hover:border-primary/40 transition-all ${color}`}>
      <span className="material-symbols-outlined">{icon}</span>
    </div>
    <span className="text-[8px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">{label}</span>
  </button>
);

export default App;