import React from 'react';
import { AIReport } from '../types';

interface AIAgentProps {
  report: AIReport;
  onMinimize?: () => void;
}

const AIAgent: React.FC<AIAgentProps> = ({ report, onMinimize }) => {
  return (
    <div className="h-full backdrop-blur-panel tech-border rounded-lg overflow-hidden flex flex-col bg-panel-dark/40">
      <header className="glass-header p-3 border-b border-white/10 flex justify-between items-center bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base animate-pulse">psychology</span>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-primary">智能诱导建议</h2>
        </div>
        <div className="flex items-center gap-2">
          {onMinimize && (
            <button onClick={onMinimize} className="material-symbols-outlined text-sm text-slate-500 hover:text-white">remove</button>
          )}
        </div>
      </header>

      <div className="flex-1 p-4 font-mono overflow-y-auto relative">
        {report.status === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3 grayscale">
            <span className="material-symbols-outlined text-4xl">terminal</span>
            <p className="text-[10px] uppercase tracking-[0.2em]">等待诊断指令...</p>
          </div>
        )}

        {report.status === 'analyzing' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
              <p className="text-[11px] text-primary lowercase tracking-tight">正在拉取全量传感器数据...</p>
            </div>
            <div className="h-0.5 w-full bg-white/5 overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: '40%' }}></div>
            </div>
          </div>
        )}

        {report.status === 'complete' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="p-2.5 bg-primary/5 border-l-2 border-primary rounded-r">
              <h3 className="text-[9px] font-bold uppercase text-primary mb-1">状况综述</h3>
              <p className="text-[11px] text-slate-200 leading-relaxed">{report.summary}</p>
            </div>
            <div className="space-y-2">
              <h3 className="text-[9px] font-bold uppercase text-accent-green mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[10px]">auto_fix_high</span>
                建议
              </h3>
              {report.recommendations?.map((rec, i) => (
                <p key={i} className="text-[10px] text-slate-400">[{i+1}] {rec}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAgent;