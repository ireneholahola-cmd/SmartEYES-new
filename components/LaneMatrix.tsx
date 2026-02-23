import React from 'react';
import { LaneData, SystemStats } from '../types';

interface LaneMatrixProps {
  lanes: LaneData[];
  stats: SystemStats;
  optimizedParams?: Array<{
    laneId: string;
    suggestedTraffic: number;
    suggestedSpeed: number;
    expectedQueue: number;
    optimizationRate: number;
  }>;
  onTriggerAI: () => void;
  onLaneClick: (lane: LaneData) => void;
  aiStatus: 'analyzing' | 'idle' | 'complete';
  onMinimize?: () => void;
}

const LaneMatrix: React.FC<LaneMatrixProps> = ({ lanes, stats, optimizedParams, onTriggerAI, onLaneClick, aiStatus, onMinimize }) => {
  return (
    <div className="h-full backdrop-blur-panel tech-border rounded-lg overflow-hidden flex flex-col bg-panel-dark/40">
      <header className="glass-header p-4 border-b border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">grid_view</span>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-primary">车道数据矩阵</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></div>
          {onMinimize && (
            <button onClick={onMinimize} className="material-symbols-outlined text-sm text-slate-500 hover:text-white">remove</button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
        {/* Section 1: Real-time Monitoring */}
        <div className="p-4 border-b border-white/10">
          <h3 className="text-[10px] font-bold text-primary mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">monitor_heart</span>
            实时监控测量信息
          </h3>
          
          <div className="grid grid-cols-5 gap-2 pb-2 mb-2 border-b border-white/5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <div className="col-span-1">车道</div>
            <div className="text-right">流量</div>
            <div className="text-right">速度</div>
            <div className="text-right">排队</div>
            <div className="text-right">占有率</div>
          </div>

          <div className="space-y-1.5">
            {lanes.map((lane) => (
              <div 
                key={lane.id}
                onClick={() => onLaneClick(lane)}
                className={`grid grid-cols-5 items-center gap-2 p-2 rounded transition-all duration-300 border border-transparent cursor-pointer ${
                  lane.occupancy > 70 
                  ? 'bg-accent-red/5 border-accent-red/20 alert-breathing hover:bg-accent-red/10' 
                  : 'bg-white/5 hover:bg-primary/10 hover:border-primary/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1 h-3 rounded-full ${
                    lane.occupancy < 40 ? 'bg-accent-green' :
                    lane.occupancy < 70 ? 'bg-accent-yellow' :
                    'bg-accent-red'
                  }`}></span>
                  <span className="font-mono text-[10px] text-slate-300 whitespace-nowrap">{lane.id}</span>
                </div>
                <div className="font-mono text-[11px] text-right text-slate-100">{lane.traffic}</div>
                <div className={`font-mono text-[11px] text-right ${
                  lane.speed > 60 ? 'text-accent-green' :
                  lane.speed > 30 ? 'text-accent-yellow' : 'text-accent-red'
                }`}>{lane.speed}</div>
                <div className={`font-mono text-[11px] text-right ${
                  lane.queue > 50 ? 'text-accent-red font-bold' : 'text-slate-400'
                }`}>{lane.queue}</div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden self-center relative">
                  <div 
                    className={`h-full transition-all duration-700 ${
                      lane.occupancy < 40 ? 'bg-accent-green' :
                      lane.occupancy < 70 ? 'bg-accent-yellow' : 'bg-accent-red'
                    }`}
                    style={{ width: `${lane.occupancy}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Guidance Suggestions */}
        <div className="p-4 bg-primary/5 flex-1 min-h-[200px]">
          <h3 className="text-[10px] font-bold text-accent-green mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">alt_route</span>
            诱导建议交通流参数
          </h3>
          
          <div className="grid grid-cols-5 gap-2 pb-2 mb-2 border-b border-white/5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
            <div className="col-span-1">建议车道</div>
            <div className="text-right">建议流量</div>
            <div className="text-right">建议速度</div>
            <div className="text-right">预期排队</div>
            <div className="text-right">优化率</div>
          </div>

          {optimizedParams && optimizedParams.length > 0 ? (
            <div className="space-y-1.5">
              {optimizedParams.map((param) => (
                <div 
                  key={param.laneId}
                  className="grid grid-cols-5 items-center gap-2 p-2 rounded bg-accent-green/5 border border-accent-green/10"
                >
                  <div className="font-mono text-[10px] text-accent-green font-bold">{param.laneId}</div>
                  <div className="font-mono text-[11px] text-right text-slate-100">{param.suggestedTraffic}</div>
                  <div className="font-mono text-[11px] text-right text-accent-green">{param.suggestedSpeed}</div>
                  <div className="font-mono text-[11px] text-right text-slate-400">{param.expectedQueue}</div>
                  <div className="text-right">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green font-bold">
                      +{(param.optimizationRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 opacity-50 gap-2 border border-dashed border-white/10 rounded">
               <span className="material-symbols-outlined text-2xl animate-pulse">pending</span>
               <span className="text-[10px]">等待 KGIN 诱导计算...</span>
            </div>
          )}
        </div>
      </div>

      <footer className="p-4 bg-white/[0.02] border-t border-white/5 space-y-4 shrink-0">
        <button 
          onClick={onTriggerAI}
          disabled={aiStatus === 'analyzing'}
          className="w-full py-2.5 rounded border border-primary/30 flex items-center justify-center gap-2 transition-all hover:bg-primary/10"
        >
          <span className="material-symbols-outlined text-base">neurology</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">执行 全局诊断</span>
        </button>
      </footer>
    </div>
  );
};

export default LaneMatrix;
