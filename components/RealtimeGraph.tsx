import React, { useRef, useEffect, useCallback, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d';
import { kginService, TrafficAdvice } from '../lib/kgin_service';
import { useStore } from '../src/store/useStore';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  speed?: number;
  laneId?: string;
  // react-force-graph 会自动添加的属性
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface RealtimeGraphProps {
  graphData: GraphData;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onMinimize?: () => void;
  onNodeClick?: (node: GraphNode) => void; // 节点点击回调，用于联动其他面板
}

const RealtimeGraph: React.FC<RealtimeGraphProps> = ({
  graphData,
  isExpanded,
  onToggleExpand,
  onMinimize,
  onNodeClick
}) => {
  const fgRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevNodeCountRef = useRef(0);

  // 选中的节点
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  // 悬停的节点
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  // 统计信息
  const [stats, setStats] = useState({ vehicles: 0, roads: 0, avgSpeed: 0 });
  // KGIN 诱导信息
  const [trafficAdvice, setTrafficAdvice] = useState<TrafficAdvice | null>(null);
  const [recommendedNodes, setRecommendedNodes] = useState<Set<string>>(new Set());
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Measure container size
  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);
  
  // Phase 3: Visual Tracking & Simulation Focus
  useEffect(() => {
    if (!fgRef.current) return;

    const currentCount = graphData.nodes.length;
    const prevCount = prevNodeCountRef.current;

    if (currentCount > prevCount) {
      const newNode = graphData.nodes[graphData.nodes.length - 1];
      
      // The key fix: Wait for the physics engine to assign coordinates
      setTimeout(() => {
        if (newNode && typeof newNode.x === 'number' && typeof newNode.y === 'number') {
          fgRef.current?.centerAt(newNode.x, newNode.y, 800);
          fgRef.current?.zoom(3, 800);
        }
      }, 100); // A small delay is often enough
    }

    prevNodeCountRef.current = currentCount;

  }, [graphData.nodes]);

  useEffect(() => {
    const handleFinalFocus = (e: any) => {
        const node = e.detail;
        if (node && fgRef.current) {
            setTimeout(() => {
                if (typeof node.x === 'number' && typeof node.y === 'number') {
                    fgRef.current?.centerAt(node.x, node.y, 1200);
                    fgRef.current?.zoom(1, 1200);
                }
            }, 100);
        }
    };

    window.addEventListener('final-focus', handleFinalFocus);
    return () => window.removeEventListener('final-focus', handleFinalFocus);
  }, []);

  // 动态缩放：当节点数量变化较大时自动调整视图
  useEffect(() => {
    const currentCount = graphData.nodes.length;
    const prevCount = prevNodeCountRef.current;

    // 当节点数量变化超过 20% 或首次加载时，自动缩放
    if (currentCount > 0 && (prevCount === 0 || Math.abs(currentCount - prevCount) / prevCount > 0.2)) {
      setTimeout(() => {
        fgRef.current?.zoomToFit(400, 60);
      }, 300);
    }

    prevNodeCountRef.current = currentCount;
  }, [graphData.nodes.length]);

  // 配置力导向引擎：添加碰撞检测
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;

      // 获取底层 D3 力仿真引擎
      const d3Force = (fg as any).d3Force;
      if (d3Force) {
        // 添加碰撞力，防止节点重叠
        d3Force('collision',
          (window as any).d3?.forceCollide?.((node: any) => {
            // 车辆节点半径较小，路段节点半径较大
            return node.type === 'Vehicle' ? 12 : 18;
          })
        );

        // 调整链接力的距离
        d3Force('link')?.distance((link: any) => {
          return 80; // 链接长度
        });

        // 调整中心力强度
        d3Force('center')?.strength(0.05);

        // 调整电荷力（节点间排斥力）
        d3Force('charge')?.strength(-100);
      }
    }
  }, [graphData]);

  // 节点颜色映射
  const getNodeColor = useCallback((node: any, isSelected: boolean, isHovered: boolean, isRecommended: boolean) => {
    if (isSelected) return '#ff4d4f'; // 选中状态 - 红色
    if (node.status === 'critical') return '#ef4444'; // 严重警示 - 亮红色
    if (node.status === 'warning') return '#facc15'; // 普通警示 - 黄色
    if (isRecommended) return '#00ff9d'; // 推荐路线 - 亮绿色
    if (isHovered) return '#ffd700'; // 悬停状态 - 金色

    const typeColors: Record<string, string> = {
      Vehicle: '#4ade80',       // 绿色 - 车辆
      Road: '#3b82f6',          // 蓝色 - 路段
      RoadSegment: '#3b82f6',   // 蓝色 - 路段
      Lane: '#60a5fa',          // 浅蓝 - 车道
      Intersection: '#f59e0b',  // 橙色 - 交叉口
      Camera: '#8b5cf6',        // 紫色 - 摄像头
      Sensor: '#06b6d4',        // 青色 - 传感器
      default: '#00E5FF',
    };
    return typeColors[node.type] || typeColors.default;
  }, []);

  // 自定义节点绘制（增强版）
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode?.id === node.id;
    const isRecommended = recommendedNodes.has(node.id);
    const label = node.name || node.id;
    const fontSize = Math.max(10 / globalScale, 2);
    const baseSize = node.type === 'Vehicle' ? 5 : 8;

    // 呼吸动画效果
    const pulse = (node.type === 'Vehicle' || node.status === 'warning' || node.status === 'critical') 
        ? (1 + Math.sin(Date.now() / (node.status === 'critical' ? 80 : 150)) * 0.2) 
        : 1;
    const nodeSize = (isSelected || isHovered || isRecommended ? baseSize * 1.3 : baseSize) * pulse;

    const glowColor = getNodeColor(node, isSelected, isHovered, isRecommended);

    // 选中/悬停/推荐时的外圈光环
    if (isSelected || isHovered || isRecommended) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 4, 0, 2 * Math.PI, false);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 发光效果
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isSelected ? 25 : isRecommended ? 20 : isHovered ? 20 : 15;

    // 绘制节点
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
    ctx.fillStyle = glowColor;
    ctx.fill();

    // 车辆速度指示（小圆点内的速度条）
    if (node.type === 'Vehicle' && node.speed !== undefined) {
      ctx.shadowBlur = 0;
      const speedRatio = Math.min(node.speed / 120, 1); // 假设最高速度 120km/h
      const barWidth = nodeSize * 1.5;
      const barHeight = 2;

      // 背景条
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(node.x - barWidth / 2, node.y + nodeSize + 3, barWidth, barHeight);

      // 速度条
      ctx.fillStyle = speedRatio > 0.7 ? '#4ade80' : speedRatio > 0.3 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(node.x - barWidth / 2, node.y + nodeSize + 3, barWidth * speedRatio, barHeight);
    }

    // 重置阴影
    ctx.shadowBlur = 0;

    // 绘制标签
    if (globalScale > 0.4 || isSelected || isHovered || isRecommended) {
      ctx.font = `${isSelected || isHovered || isRecommended ? 'bold ' : ''}${fontSize}px 'Inter', sans-serif`;
      ctx.fillStyle = isSelected ? '#ff4d4f' : isRecommended ? '#00ff9d' : isHovered ? '#ffd700' : 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, node.x, node.y + nodeSize + 6);
    }
  }, [selectedNode, hoveredNode, recommendedNodes, getNodeColor]);

  // 节点点击处理
  const handleNodeClick = useCallback(async (node: any) => {
    const isNewNode = selectedNode?.id !== node.id;
    setSelectedNode(isNewNode ? node : null);
    setTrafficAdvice(null); // Reset advice
    
    if (onNodeClick) {
      onNodeClick(node);
    }

    // Call KGIN if it's a relevant node and newly selected
    if (isNewNode && (node.type === 'Road' || node.type === 'RoadSegment' || node.type === 'Intersection')) {
        // Try to parse ID as number, or use a hash/mock if string
        const nodeId = parseInt(node.id);
        if (!isNaN(nodeId)) {
            setIsLoadingAdvice(true);
            setRecommendedNodes(new Set()); // Clear previous recommendations
            try {
                const advice = await kginService.getTrafficAdvice(nodeId);
                setTrafficAdvice(advice);
                setRecommendedNodes(new Set(advice.recommended_routes.map(id => id.toString())));
            } catch (e) {
                console.error("Failed to get traffic advice", e);
            } finally {
                setIsLoadingAdvice(false);
            }
        }
    } else {
        setRecommendedNodes(new Set());
    }
  }, [onNodeClick, selectedNode]);

  // 节点悬停处理
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node || null);
    // 改变鼠标样式
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  // 链接样式
  const getLinkColor = useCallback((link: any) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    // 如果链接与选中节点相关，高亮显示
    if (selectedNode && (sourceId === selectedNode.id || targetId === selectedNode.id)) {
      return 'rgba(255, 77, 79, 0.6)';
    }
    return 'rgba(0, 229, 255, 0.25)';
  }, [selectedNode]);

  const getLinkWidth = useCallback((link: any) => {
    const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
    const targetId = typeof link.target === 'string' ? link.target : link.target.id;

    if (selectedNode && (sourceId === selectedNode.id || targetId === selectedNode.id)) {
      return 2.5;
    }
    return 1.5;
  }, [selectedNode]);

  return (
    <div
      ref={containerRef}
      className={`h-full tech-border rounded-lg overflow-hidden relative flex flex-col expand-transition ${isExpanded ? 'is-expanded' : 'bg-panel-dark/30'}`}
    >
      {/* 图谱画布 */}
      <div className="flex-1 relative" style={{ background: '#0b0f1a' }}>
        {/* Integrated Header Stats (Floating) */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-20 pointer-events-none">
            <div className="flex gap-4">
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-[#4ade80] shadow-[0_0_5px_rgba(74,222,128,0.6)]"></div>
                    <span className="text-[10px] text-slate-300">车辆: <span className="text-white font-bold">{stats.vehicles}</span></span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-[#3b82f6] shadow-[0_0_5px_rgba(59,130,246,0.6)]"></div>
                    <span className="text-[10px] text-slate-300">路段: <span className="text-white font-bold">{stats.roads}</span></span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_5px_rgba(245,158,11,0.6)]"></div>
                    <span className="text-[10px] text-slate-300">交叉口</span>
                </div>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded border border-slate-700 backdrop-blur-sm">
                <span className="text-[10px] text-slate-400">平均速度:</span>
                <span className="text-[10px] text-cyan-400 font-mono">{stats.avgSpeed} km/h</span>
            </div>
        </div>

        {graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2 opacity-30">share</span>
            <span className="text-xs">等待 Neo4j 数据...</span>
            <span className="text-[10px] text-slate-600 mt-1">确保后端服务已启动</span>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel=""
            nodeCanvasObject={drawNode}
            nodePointerAreaPaint={(node: any, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, 15, 0, 2 * Math.PI);
              ctx.fill();
            }}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            linkColor={getLinkColor}
            linkWidth={getLinkWidth}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkDirectionalParticleSpeed={0.008}
            linkDirectionalParticleColor={() => '#00E5FF'}
            backgroundColor="#0b0f1a"
            d3VelocityDecay={0.8} // 增加摩擦力，防止剧烈弹跳
            d3AlphaDecay={0.005}  // 极慢冷却，保持持续流动
            cooldownTicks={Infinity} // 永不停止，消除启停顿挫感
            warmupTicks={0}       // 无需预热，直接平滑过渡
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}

        {/* 节点详情浮窗 */}
        {selectedNode && (
          <div className="absolute top-4 left-4 w-56 bg-background-dark/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden z-20 animate-in slide-in-from-left">
            <div className="px-3 py-2 bg-white/5 border-b border-white/10 flex justify-between items-center">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">{selectedNode.id}</span>
              <button onClick={() => setSelectedNode(null)} className="material-symbols-outlined text-sm text-slate-500 hover:text-white">close</button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ color: getNodeColor(selectedNode, false, false) }}>
                  {selectedNode.type === 'Vehicle' ? 'directions_car' : 'road'}
                </span>
                <span className="text-xs text-slate-300">{selectedNode.type}</span>
              </div>
              <div className="text-[10px] text-slate-400">{selectedNode.name}</div>
              {selectedNode.speed !== undefined && (
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  <span className="material-symbols-outlined text-xs text-accent-green">speed</span>
                  <span className="text-xs text-accent-green font-mono">{selectedNode.speed} km/h</span>
                </div>
              )}
              {selectedNode.laneId && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xs text-primary">route</span>
                  <span className="text-xs text-primary font-mono">{selectedNode.laneId}</span>
                </div>
              )}
              
              {/* KGIN Advice Section */}
              {isLoadingAdvice && (
                <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-slate-400 animate-pulse flex items-center gap-2">
                   <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                   正在计算 KGIN 诱导策略...
                </div>
              )}
              
              {trafficAdvice && (
                <div className="mt-2 pt-2 border-t border-white/10 bg-white/5 rounded p-2">
                    <div className="flex items-center gap-1 mb-1">
                        <span className="material-symbols-outlined text-[10px] text-accent-green">lightbulb</span>
                        <span className="text-[10px] font-bold text-accent-green">KGIN 智能诱导</span>
                    </div>
                    <div className="text-[9px] text-slate-300 mb-2 leading-relaxed pl-3 border-l-2 border-accent-green/30">
                        {trafficAdvice.explanation}
                    </div>
                    <div className="text-[9px] text-slate-400">
                        <span className="text-slate-500 mr-1">推荐路线:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {trafficAdvice.recommended_routes.slice(0, 3).map((route, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-accent-green/10 text-accent-green rounded border border-accent-green/20">
                                    {route}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 图例 */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80]"></div>
            <span className="text-[8px] text-slate-500 uppercase">车辆</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]"></div>
            <span className="text-[8px] text-slate-500 uppercase">路段</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div>
            <span className="text-[8px] text-slate-500 uppercase">交叉口</span>
          </div>
          <div className="flex items-center gap-1.5 ml-4 pl-4 border-l border-white/10">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff4d4f]"></div>
            <span className="text-[8px] text-slate-500 uppercase">选中</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00ff9d]"></div>
            <span className="text-[8px] text-slate-500 uppercase">推荐</span>
          </div>
        </div>

        {/* 实时指示器 */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
          <span className="text-[9px] text-accent-green/80 font-mono">LIVE</span>
        </div>

        {/* 快捷键提示 */}
        <div className="absolute bottom-4 right-4 text-[8px] text-slate-600 pointer-events-none">
          滚轮缩放 | 拖拽平移 | 点击选择
        </div>
      </div>
    </div>
  );
};

export default RealtimeGraph;
