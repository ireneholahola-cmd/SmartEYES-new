
import React from 'react';
import { SystemStats } from '../types';

interface HeaderProps {
  stats: SystemStats;
}

const Header: React.FC<HeaderProps> = ({ stats }) => {
  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-background-dark/80 backdrop-blur-md z-50">
      <div className="flex items-center gap-4">
        <div className="p-1.5 bg-primary/10 rounded">
          <span className="material-symbols-outlined text-primary text-xl block leading-none">hub</span>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">
            智能交通数字孪生系统 
            <span className="text-primary/50 text-[10px] font-mono ml-2 tracking-normal">v4.0.2-核心版</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-green rounded-full shadow-[0_0_8px_rgba(0,255,148,0.4)]"></span>
            <span className="text-[9px] uppercase tracking-widest text-accent-green font-mono">系统运行中</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 font-mono">
        <div className="text-right">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">流延迟</div>
          <div className="text-xs text-primary">{stats.latency}ms</div>
        </div>
        <div className="text-right border-l border-white/10 pl-8">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">区域 ID</div>
          <div className="text-xs text-slate-300">HWY-I405-N</div>
        </div>
        <div className="text-right border-l border-white/10 pl-8">
          <div className="text-[9px] text-slate-500 uppercase tracking-wider">时间戳</div>
          <div className="text-xs text-slate-300">{stats.timestamp}</div>
        </div>
      </div>
    </header>
  );
};

export default Header;
