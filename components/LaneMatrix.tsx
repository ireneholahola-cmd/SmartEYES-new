import React, { useMemo, useState, useEffect } from 'react';
import { useStore } from '../src/store/useStore';

const LaneMatrix: React.FC = () => {
  const { currentFrame, data, fps } = useStore();
  const [isStarted, setIsStarted] = useState(false);
  const [laneData, setLaneData] = useState({
    flow: 45,
    speed: 60,
    density: 22,
    queueLength: 15,
    events: 0,
    car: 30,
    truck: 10,
    bus: 5,
    recommendedSpeed: 65,
    recommendedDensity: 20,
    recommendedQueueLength: 10,
  });

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
          queueLength: Math.max(5, prev.queueLength + Math.floor((Math.random() - 0.5) * 2)),
          events: Math.random() > 0.9 ? Math.floor(Math.random() * 2) + 1 : 0,
          car: Math.max(15, prev.car + Math.floor((Math.random() - 0.5) * 3)),
          truck: Math.max(5, prev.truck + Math.floor((Math.random() - 0.5) * 2)),
          bus: Math.max(2, prev.bus + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
          recommendedSpeed: Math.max(50, prev.recommendedSpeed + (Math.random() - 0.5) * 1),
          recommendedDensity: Math.max(15, prev.recommendedDensity + (Math.random() - 0.5) * 1),
          recommendedQueueLength: Math.max(8, prev.recommendedQueueLength + (Math.random() - 0.5) * 1),
        }));
      }, 500); // 0.5秒更新一次
      return () => clearInterval(interval);
    }
  }, [isStarted]);

  const [systemTime, setSystemTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timerId = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  if (!isStarted) {
    return (
        <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
            <span className="material-symbols-outlined text-4xl mb-2">query_stats</span>
            <span className="text-xs">等待视频分析启动...</span>
        </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-1 gap-1">
      {/* Time Panel */}
      <div className="bg-slate-800/50 p-1.5 rounded border border-slate-700 flex justify-between items-center shrink-0">
         <span className="text-xs text-slate-300 font-bold">系统时间</span>
         <span className="font-mono text-cyan-400 text-sm font-bold">{systemTime}</span>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-1">
          <div className="bg-slate-800/30 border border-slate-700/50 p-1 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">总车流量</span>
              <span className={`text-lg font-mono font-bold text-white leading-tight`}>{laneData.flow}</span>
              <span className="text-[8px] text-slate-500 font-bold">辆</span>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 p-1 rounded flex flex-col items-center justify-center">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">实时事件</span>
              <span className={`text-lg font-mono font-bold ${laneData.events > 0 ? "text-accent-red animate-pulse" : "text-slate-400"} leading-tight`}>{laneData.events}</span>
              <span className="text-[8px] text-slate-500 font-bold">个</span>
          </div>
      </div>

      {/* Comparison Stats */}
      <div className="flex flex-col gap-1">
        <ComparisonStatCard 
          label="平均速度 (km/h)" 
          detectedValue={laneData.speed.toFixed(1)} 
          recommendedValue={laneData.recommendedSpeed.toFixed(1)}
        />
        <ComparisonStatCard 
          label="交通密度 (pcu/km)" 
          detectedValue={laneData.density.toFixed(1)} 
          recommendedValue={laneData.recommendedDensity.toFixed(1)}
        />
        <ComparisonStatCard 
          label="排队长度 (m)" 
          detectedValue={laneData.queueLength}
          recommendedValue={laneData.recommendedQueueLength.toFixed(0)}
        />
      </div>

      {/* Class Distribution */}
      <div className="mt-1">
         <div className="text-[9px] text-slate-400 font-bold mb-0.5 pl-1">车辆类型分布</div>
         <div className="grid grid-cols-3 gap-1">
            <MiniStat label="轿车" value={laneData.car} />
            <MiniStat label="货车" value={laneData.truck} />
            <MiniStat label="公交" value={laneData.bus} />
         </div>
      </div>
    </div>
  );
};

const ComparisonStatCard: React.FC<{ label: string, detectedValue: string | number, recommendedValue: string | number }> = ({ label, detectedValue, recommendedValue }) => (
  <div className="bg-slate-800/30 border border-slate-700/50 p-1.5 rounded">
    <div className="text-[9px] text-slate-400 font-bold mb-1 text-center">{label}</div>
    <div className="grid grid-cols-2 gap-1">
      <div className="flex flex-col items-center bg-black/20 p-0.5 rounded">
        <span className="text-[8px] text-slate-500 font-bold uppercase">检测值</span>
        <span className="text-sm font-mono font-bold text-white">{detectedValue}</span>
      </div>
      <div className="flex flex-col items-center bg-black/20 p-0.5 rounded">
        <span className="text-[8px] text-green-500 font-bold uppercase">建议值</span>
        <span className="text-sm font-mono font-bold text-accent-green">{recommendedValue}</span>
      </div>
    </div>
  </div>
);

const MiniStat: React.FC<{ label: string, value: number }> = ({ label, value }) => (
    <div className="bg-slate-800/30 border border-slate-700/50 p-1 rounded flex flex-col items-center">
        <span className="text-[9px] text-slate-400 font-bold">{label}</span>
        <span className="text-xs font-mono text-slate-200">{value}</span>
    </div>
);

export default LaneMatrix;
