
import React from 'react';
import { LaneData } from '../types';

interface LaneDetailModalProps {
  lane: LaneData;
  onClose: () => void;
}

const LaneDetailModal: React.FC<LaneDetailModalProps> = ({ lane, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-panel-dark tech-border rounded-xl shadow-[0_0_50px_rgba(0,229,255,0.15)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <header className="glass-header px-6 py-4 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] ${
              lane.occupancy > 70 ? 'text-accent-red bg-accent-red' : 'text-primary bg-primary'
            }`}></div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              车道 {lane.id} 实时详情
              <span className="text-[10px] font-mono text-primary/60 border border-primary/20 px-1.5 py-0.5 rounded uppercase">Live Feed</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors group"
          >
            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">close</span>
          </button>
        </header>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Simulation Chart */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">流速实时波动 (24H)</h3>
            <div className="h-40 bg-black/40 rounded border border-white/5 relative overflow-hidden grid-bg">
              <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                <path 
                  d="M0 80 Q 50 20, 100 60 T 200 40 T 300 90 T 400 30 T 500 70 T 600 50 L 600 160 L 0 160 Z" 
                  fill="url(#grad1)" 
                  className="animate-[pulse_4s_infinite]"
                />
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(0, 229, 255, 0.2)" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-2 left-2 text-[10px] font-mono text-primary">{lane.speed} km/h</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="p-2 bg-white/5 rounded border border-white/5">
                <div className="text-slate-500 mb-1">峰值速度</div>
                <div className="text-white">88.4 km/h</div>
              </div>
              <div className="p-2 bg-white/5 rounded border border-white/5">
                <div className="text-slate-500 mb-1">平均负载</div>
                <div className="text-white">{lane.occupancy}%</div>
              </div>
            </div>
          </div>

          {/* Right: Detailed Metrics */}
          <div className="flex flex-col gap-6">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">核心指标监控</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">当前流量</div>
                  <div className="text-2xl font-mono text-white">{lane.traffic} <span className="text-xs text-slate-500">pcu/h</span></div>
                </div>
                <div className="text-[9px] text-accent-green">+2.4% vs 昨同期</div>
              </div>

              <div className="flex justify-between items-end border-b border-white/5 pb-2">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase">队列长度</div>
                  <div className={`text-2xl font-mono ${lane.queue > 50 ? 'text-accent-red' : 'text-white'}`}>
                    {lane.queue} <span className="text-xs text-slate-500">meters</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-[9px] text-slate-500 uppercase mb-1">信号状态</div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-accent-green shadow-[0_0_10px_#00FF94]"></div>
                    <span className="text-[10px] font-bold text-accent-green uppercase">Green Phase</span>
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-500 uppercase mb-1">健康评分</div>
                  <div className="text-xl font-mono text-primary">A+</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="bg-white/[0.02] p-4 flex justify-end border-t border-white/5">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-primary text-background-dark text-[10px] font-bold uppercase tracking-widest rounded hover:bg-white transition-colors"
          >
            确认并返回
          </button>
        </footer>
      </div>
    </div>
  );
};

export default LaneDetailModal;
