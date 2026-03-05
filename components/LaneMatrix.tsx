import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../src/store/useStore';

const LaneMatrix: React.FC = () => {
  const { currentFrame, data, fps } = useStore();
  const [isStarted, setIsStarted] = useState(false);
  const [laneData, setLaneData] = useState({ flow: 45, speed: 60, density: 22, events: 0, car: 30, truck: 10, bus: 5 });

  useEffect(() => {
    const handleStart = () => setIsStarted(true);
    window.addEventListener('start-simulations', handleStart);
    return () => window.removeEventListener('start-simulations', handleStart);
  }, []);

  useEffect(() => {
    if (isStarted) {
      const interval = setInterval(() => {
        setLaneData(prev => ({
          flow: Math.max(20, prev.flow + Math.floor((Math.random() - 0.5) * 3)),
          speed: parseFloat(Math.max(30, prev.speed + (Math.random() - 0.5) * 1.5).toFixed(1)),
          density: parseFloat(Math.max(10, prev.density + (Math.random() - 0.5) * 2).toFixed(1)),
          events: Math.random() > 0.9 ? Math.floor(Math.random() * 2) + 1 : 0,
          car: Math.max(15, prev.car + Math.floor((Math.random() - 0.5) * 3)),
          truck: Math.max(5, prev.truck + Math.floor((Math.random() - 0.5) * 2)),
          bus: Math.max(2, prev.bus + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
        }));
      }, 500); // 0.5秒更新一次
      return () => clearInterval(interval);
    }
  }, [isStarted]);

  const timeStr = useMemo(() => {
      if (!isStarted) return "00:00:00";
      const totalSeconds = Date.now() / 1000;
      const m = new Date(totalSeconds * 1000).getMinutes().toString().padStart(2, '0');
      const s = new Date(totalSeconds * 1000).getSeconds().toString().padStart(2, '0');
      const ms = (new Date(totalSeconds * 1000).getMilliseconds() / 10).toFixed(0).padStart(2, '0');
      return `${m}:${s}:${ms}`;
  }, [laneData]); // Update with laneData to re-render

  if (!isStarted) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
            <span className="material-symbols-outlined text-4xl mb-2">query_stats</span>
            <span className="text-xs">等待视频分析启动...</span>
        </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {/* Time Panel */}
      <div className="col-span-2 bg-slate-800/50 p-2 rounded border border-slate-700 flex justify-between items-center">
         <span className="text-[10px] text-slate-400 font-bold uppercase">System Time</span>
         <span className="font-mono text-cyan-400 text-sm font-bold">{timeStr}</span>
      </div>

      {/* Metric Cards - Grid Layout */}
      <MetricCard label="TOTAL VEHICLES" value={laneData.flow} unit="VEH" color="text-white" />
      <MetricCard label="AVG SPEED" value={laneData.speed.toFixed(1)} unit="KM/H" color="text-accent-green" />
      <MetricCard label="DENSITY" value={laneData.density.toFixed(1)} unit="PCU/KM" color="text-accent-yellow" />
      <MetricCard label="EVENTS" value={laneData.events} unit="ALERTS" color={laneData.events > 0 ? "text-accent-red animate-pulse" : "text-slate-400"} />

      {/* Class Distribution */}
      <div className="col-span-2 mt-2">
         <div className="text-[9px] text-slate-500 font-bold uppercase mb-1 pl-1 border-l-2 border-slate-600">Class Distribution</div>
         <div className="grid grid-cols-3 gap-1">
            <MiniStat label="CAR" value={laneData.car} />
            <MiniStat label="TRUCK" value={laneData.truck} />
            <MiniStat label="BUS" value={laneData.bus} />
         </div>
      </div>
      
      {/* Event Log */}
      <div className="col-span-2 mt-2 flex-1 min-h-0 flex flex-col">
         <div className="text-[9px] text-slate-500 font-bold uppercase mb-1 pl-1 border-l-2 border-slate-600">Realtime Events</div>
         <div className="space-y-1">
             {laneData.events > 0 && Array.from({ length: laneData.events }).map((_, i) => (
                 <div key={i} className="bg-red-900/20 border border-red-500/30 p-1.5 rounded flex items-center gap-2 animate-in fade-in">
                     <span className="material-symbols-outlined text-xs text-red-500">warning</span>
                     <div className="flex flex-col">
                         <span className="text-[9px] text-red-400 font-bold uppercase">Simulated Event</span>
                         <span className="text-[8px] text-red-300/70 truncate w-32">A random event occurred.</span>
                     </div>
                 </div>
             ))}
             {laneData.events === 0 && (
                 <div className="text-[9px] text-slate-600 italic p-1">No active events</div>
             )}
         </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ label: string, value: string | number, unit: string, color: string }> = ({ label, value, unit, color }) => (
    <div className="bg-slate-800/30 border border-slate-700/50 p-2 rounded flex flex-col items-center justify-center h-16">
        <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
        <span className={`text-lg font-mono font-bold ${color} leading-tight`}>{value}</span>
        <span className="text-[8px] text-slate-600 font-bold uppercase">{unit}</span>
    </div>
);

const MiniStat: React.FC<{ label: string, value: number }> = ({ label, value }) => (
    <div className="bg-slate-800/30 border border-slate-700/50 p-1 rounded flex flex-col items-center">
        <span className="text-[8px] text-slate-500 font-bold uppercase">{label}</span>
        <span className="text-xs font-mono text-slate-300">{value}</span>
    </div>
);

export default LaneMatrix;
