import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { GraphNodeData } from '../types';
import { api, wsClient } from '../lib/api';

interface KnowledgeGraphProps {
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onMinimize?: () => void;
}

interface NodePosition {
  id: string;
  x: number;
  y: number;
}

interface Link {
  id: string;
  source: string;
  target: string;
}

type EditorTool = 'pointer' | 'add-node' | 'connect';

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ isExpanded, onToggleExpand, onMinimize }) => {
  // 后端连接状态
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // 核心数据状态
  const [localNodeData, setLocalNodeData] = useState<Record<string, GraphNodeData>>({
    'HUB-CENTER': { id: 'HUB-CENTER', type: 'hub', status: 'active', lanes: [], lastSync: '0ms', details: '核心枢纽节点', weight: 100, threshold: 0 },
    'NODE_01': { id: 'NODE_01', type: 'sensor', status: 'active', lanes: [], lastSync: '1ms', details: '传感器节点 01', weight: 50, threshold: 10 },
  });

  const [nodes, setNodes] = useState<NodePosition[]>([
    { id: 'HUB-CENTER', x: 400, y: 200 },
    { id: 'NODE_01', x: 200, y: 100 },
  ]);

  const [links, setLinks] = useState<Link[]>([
    { id: 'link-1', source: 'HUB-CENTER', target: 'NODE_01' },
  ]);

  // 从后端加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.graph.getAll();

        if (data.nodes && data.nodes.length > 0) {
          // 转换节点数据
          const nodeDataMap: Record<string, GraphNodeData> = {};
          const nodePositions: NodePosition[] = [];

          for (const node of data.nodes) {
            nodeDataMap[node.id] = {
              id: node.id,
              type: node.type,
              status: node.status,
              lanes: node.lanes || [],
              lastSync: node.last_sync || '0ms',
              details: node.details || '',
              weight: node.weight || 50,
              threshold: node.threshold || 50
            };
            nodePositions.push({
              id: node.id,
              x: node.position_x || 200,
              y: node.position_y || 200
            });
          }

          setLocalNodeData(nodeDataMap);
          setNodes(nodePositions);
        }

        if (data.links && data.links.length > 0) {
          setLinks(data.links.map((l: any) => ({
            id: l.id,
            source: l.source_id || l.source,
            target: l.target_id || l.target
          })));
        }
      } catch (error) {
        console.warn('[KnowledgeGraph] Failed to load from backend:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // 订阅实时更新
    const unsubscribe = wsClient.subscribe('graph', (data) => {
      if (data.action === 'full_sync') {
        loadData();
      }
    });

    return () => unsubscribe();
  }, []);

  // 保存到后端
  const saveToBackend = useCallback(async () => {
    setIsSaving(true);
    try {
      const nodesToSync = nodes.map(n => ({
        id: n.id,
        ...localNodeData[n.id],
        position_x: n.x,
        position_y: n.y
      }));

      const linksToSync = links.map(l => ({
        id: l.id,
        source_id: l.source,
        target_id: l.target
      }));

      await api.graph.sync({ nodes: nodesToSync, links: linksToSync });
    } catch (error) {
      console.error('[KnowledgeGraph] Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [nodes, links, localNodeData]);

  // 画布视口平移
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  // UI 交互状态
  const [appMode, setAppMode] = useState<'readonly' | 'edit'>('readonly');
  const [activeTool, setActiveTool] = useState<EditorTool>('pointer');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isEditingData, setIsEditingData] = useState(false);
  const [editBuffer, setEditBuffer] = useState<GraphNodeData | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // 获取受平移补偿后的精确 SVG 坐标
  const getSVGPoint = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const transformedPoint = point.matrixTransform(svg.getScreenCTM()?.inverse());
    return { x: transformedPoint.x, y: transformedPoint.y };
  }, []);

  // 键盘删除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        deleteElement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appMode, selectedNodeId, selectedLinkId]);

  const deleteElement = () => {
    if (appMode !== 'edit') return;
    if (selectedNodeId) {
      setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
      setLinks(prev => prev.filter(l => l.source !== selectedNodeId && l.target !== selectedNodeId));
      setSelectedNodeId(null);
    } else if (selectedLinkId) {
      setLinks(prev => prev.filter(l => l.id !== selectedLinkId));
      setSelectedLinkId(null);
    }
  };

  // 鼠标移动全局处理
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
        setPanOffset(prev => ({ x: prev.x - dx, y: prev.y - dy }));
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      const point = getSVGPoint(e.clientX, e.clientY);
      setMousePos(point);

      if (draggingNodeId && appMode === 'edit' && activeTool === 'pointer') {
        setNodes(prev => prev.map(n => n.id === draggingNodeId ? { ...n, x: point.x, y: point.y } : n));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsPanning(false);
      setDraggingNodeId(null);
      setConnectingSourceId(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, draggingNodeId, appMode, activeTool, getSVGPoint]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { // 中键
      e.preventDefault();
      setIsPanning(true);
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.button !== 0 || appMode !== 'edit') return;

    if (activeTool === 'add-node') {
      const point = getSVGPoint(e.clientX, e.clientY);
      const newId = `NODE_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      setNodes(prev => [...prev, { id: newId, x: point.x, y: point.y }]);
      setLocalNodeData(prev => ({
        ...prev,
        [newId]: { id: newId, type: 'sensor', status: 'active', lanes: [], lastSync: '0ms', details: '新传感器单元', weight: 50, threshold: 50 }
      }));
      setSelectedNodeId(newId);
      setActiveTool('pointer');
    } else {
      setSelectedNodeId(null);
      setSelectedLinkId(null);
      setIsEditingData(false);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedNodeId(id);
    setSelectedLinkId(null);
    if (appMode === 'edit') {
      if (activeTool === 'connect') setConnectingSourceId(id);
      else if (activeTool === 'pointer') setDraggingNodeId(id);
    }
  };

  const handleNodeMouseUp = (e: React.MouseEvent, targetId: string) => {
    if (appMode === 'edit' && activeTool === 'connect' && connectingSourceId && connectingSourceId !== targetId) {
      const exists = links.some(l => (l.source === connectingSourceId && l.target === targetId) || (l.source === targetId && l.target === connectingSourceId));
      if (!exists) {
        setLinks(prev => [...prev, { id: `link-${Date.now()}`, source: connectingSourceId, target: targetId }]);
      }
    }
  };

  const getPosition = (id: string) => nodes.find(n => n.id === id) || { x: 0, y: 0 };
  const selectedNode = selectedNodeId ? localNodeData[selectedNodeId] : null;

  return (
    <div className={`h-full tech-border rounded-lg overflow-hidden relative grid-bg flex flex-col expand-transition ${isExpanded ? 'is-expanded' : 'bg-panel-dark/30'}`}>
      <header className="glass-header px-4 py-2.5 border-b border-white/10 flex justify-between items-center shrink-0 z-50">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-base">architecture</span>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-slate-200">
            拓扑架构引擎 <span className="text-primary/40 font-normal ml-2 lowercase">[{appMode === 'edit' ? '编辑模式' : '视图模式'}]</span>
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {appMode === 'edit' && (
            <button
              onClick={saveToBackend}
              disabled={isSaving}
              className="px-3 py-1 rounded-md text-[9px] font-bold uppercase bg-accent-green/20 text-accent-green border border-accent-green/40 hover:bg-accent-green/30 disabled:opacity-50 transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">{isSaving ? 'sync' : 'cloud_upload'}</span>
              {isSaving ? '保存中...' : '保存'}
            </button>
          )}
          <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
            <button onClick={() => setAppMode('readonly')} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${appMode === 'readonly' ? 'bg-primary text-background-dark' : 'text-slate-500 hover:text-white'}`}>只读</button>
            <button onClick={() => setAppMode('edit')} className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${appMode === 'edit' ? 'bg-accent-orange text-background-dark shadow-[0_0_10px_rgba(255,145,0,0.3)]' : 'text-slate-500 hover:text-white'}`}>编辑</button>
          </div>
          <div className="h-4 w-px bg-white/10"></div>
          <button onClick={onToggleExpand} className="w-7 h-7 flex items-center justify-center border border-white/10 rounded bg-white/5 hover:border-primary transition-all">
            <span className="material-symbols-outlined text-base">{isExpanded ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
          {onMinimize && !isExpanded && (
            <button onClick={onMinimize} className="w-7 h-7 flex items-center justify-center border border-white/10 rounded hover:bg-white/5 transition-all">
              <span className="material-symbols-outlined text-sm text-slate-500">remove</span>
            </button>
          )}
        </div>
      </header>

      <div className={`flex-1 relative overflow-hidden ${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`} onMouseDown={handleCanvasMouseDown} onClick={handleCanvasClick}>
        {/* 编辑工具栏 */}
        {appMode === 'edit' && (
          <div className="absolute left-4 top-4 z-40 flex flex-col gap-2 animate-in slide-in-from-left duration-300">
            <button onClick={() => setActiveTool('pointer')} className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${activeTool === 'pointer' ? 'bg-primary border-primary text-background-dark' : 'bg-background-dark/80 border-white/10 text-slate-400 hover:border-primary'}`}><span className="material-symbols-outlined">near_me</span></button>
            <button onClick={() => setActiveTool('add-node')} className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${activeTool === 'add-node' ? 'bg-primary border-primary text-background-dark' : 'bg-background-dark/80 border-white/10 text-slate-400 hover:border-primary'}`}><span className="material-symbols-outlined">add_circle</span></button>
            <button onClick={() => setActiveTool('connect')} className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${activeTool === 'connect' ? 'bg-primary border-primary text-background-dark' : 'bg-background-dark/80 border-white/10 text-slate-400 hover:border-primary'}`}><span className="material-symbols-outlined">conversion_path</span></button>
            <div className="h-px w-6 mx-auto bg-white/10 my-1"></div>
            <button disabled={!selectedNodeId && !selectedLinkId} onClick={deleteElement} className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 bg-background-dark/80 text-slate-400 hover:bg-accent-red hover:text-white disabled:opacity-30 transition-all"><span className="material-symbols-outlined">delete</span></button>
          </div>
        )}

        {/* 画布本体 */}
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`${panOffset.x} ${panOffset.y} 800 400`}
          preserveAspectRatio="xMidYMid meet"
          onContextMenu={(e) => e.preventDefault()}
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="25" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(0,229,255,0.4)" />
            </marker>
          </defs>

          {connectingSourceId && (
            <line x1={getPosition(connectingSourceId).x} y1={getPosition(connectingSourceId).y} x2={mousePos.x} y2={mousePos.y} stroke="#00E5FF" strokeWidth="2" strokeDasharray="4,4" />
          )}

          {links.map(link => {
            const start = getPosition(link.source);
            const end = getPosition(link.target);
            const isSelected = selectedLinkId === link.id;
            return (
              <g key={link.id} onClick={(e) => { e.stopPropagation(); setSelectedLinkId(link.id); setSelectedNodeId(null); }}>
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="15" className="cursor-pointer" />
                <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={isSelected ? '#FF4D4F' : 'rgba(0,229,255,0.2)'} strokeWidth={isSelected ? 3 : 1.5} markerEnd="url(#arrow)" />
              </g>
            );
          })}

          {nodes.map(node => {
            const data = localNodeData[node.id];
            const isSelected = selectedNodeId === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onMouseUp={(e) => handleNodeMouseUp(e, node.id)}
                className="cursor-pointer group/node select-none"
              >
                {/* Hit Area - 防止抖动 */}
                <circle r="25" fill="transparent" />

                {/* 视觉圆点 */}
                <circle
                  r={data?.type === 'hub' ? 16 : 10}
                  fill={isSelected ? '#FF4D4F' : (data?.status === 'active' ? (data?.type === 'hub' ? '#00E5FF' : '#00FF94') : '#FF3D00')}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                  className={`transition-transform duration-300 ${draggingNodeId === node.id ? 'scale-110' : 'group-hover/node:scale-110'} ${isSelected ? 'stroke-white stroke-[3px] shadow-[0_0_15px_#FF4D4F]' : 'stroke-white/20'}`}
                />
                <text y={data?.type === 'hub' ? 32 : 28} textAnchor="middle" className={`text-[9px] font-mono pointer-events-none transition-all ${isSelected ? 'fill-accent-red font-bold' : 'fill-white/60'}`}>
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* 右侧属性面板 */}
        <div className={`absolute right-4 top-4 bottom-4 w-72 bg-background-dark/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl transition-all duration-500 transform flex flex-col z-30 ${selectedNode ? 'translate-x-0 opacity-100' : 'translate-x-[110%] opacity-0 pointer-events-none'}`}>
          {selectedNode && (
            <>
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">{selectedNodeId}</span>
                <button onClick={() => { setSelectedNodeId(null); setIsEditingData(false); }} className="material-symbols-outlined text-sm text-slate-500 hover:text-white">close</button>
              </div>

              <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                {isEditingData && appMode === 'edit' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">节点类型</label>
                      <select value={editBuffer?.type} onChange={e => setEditBuffer(p => p ? { ...p, type: e.target.value as any } : null)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none">
                        <option value="hub">核心枢纽</option>
                        <option value="sensor">感知单元</option>
                        <option value="signal">执行单元</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">详细描述</label>
                      <textarea rows={4} value={editBuffer?.details} onChange={e => setEditBuffer(p => p ? { ...p, details: e.target.value } : null)} className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none resize-none" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 p-3 bg-white/5 rounded border border-white/5">
                      <span className="material-symbols-outlined text-primary">{selectedNode.type === 'hub' ? 'dns' : 'sensors'}</span>
                      <div className="text-[10px] text-white font-bold uppercase">{selectedNode.type} UNIT</div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{selectedNode.details}</p>
                    <div className="pt-4 space-y-2">
                      <div className="flex justify-between text-[9px] uppercase tracking-wider text-slate-500"><span>系统负载</span><span className="text-primary">{selectedNode.weight}%</span></div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-primary" style={{ width: `${selectedNode.weight}%` }}></div></div>
                    </div>
                  </>
                )}
              </div>

              <div className="p-4 bg-white/5 border-t border-white/10">
                {appMode === 'edit' ? (
                  isEditingData ? (
                    <div className="flex gap-2">
                      <button onClick={() => setIsEditingData(false)} className="flex-1 py-2 text-[9px] font-bold text-slate-400 border border-white/10 rounded">取消</button>
                      <button onClick={() => {
                        if (editBuffer && selectedNodeId) {
                          setLocalNodeData(prev => ({ ...prev, [selectedNodeId]: editBuffer }));
                          setIsEditingData(false);
                        }
                      }} className="flex-2 py-2 bg-primary text-background-dark rounded text-[9px] font-bold uppercase tracking-widest">保存</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditBuffer({ ...selectedNode }); setIsEditingData(true); }} className="w-full py-2 bg-white/10 border border-white/20 text-white rounded text-[9px] font-bold uppercase hover:bg-white/20">编辑属性</button>
                  )
                ) : (
                  <button className="w-full py-2 bg-primary/10 border border-primary/40 text-primary rounded text-[9px] font-bold uppercase">全量同步</button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-none flex flex-col items-start gap-1 opacity-50">
          <div className="text-[8px] font-mono text-slate-500 uppercase">中键拖拽平移 | 拖拽边缘调整窗口</div>
          <div className="text-[8px] font-mono text-slate-500 uppercase">当前坐标: {Math.round(mousePos.x)}, {Math.round(mousePos.y)}</div>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;