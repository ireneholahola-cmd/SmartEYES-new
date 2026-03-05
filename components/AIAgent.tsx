import React, { useEffect, useState } from 'react';

const AIAgent: React.FC<{graphData?: any}> = ({ graphData }) => {
  const [logs, setLogs] = useState<{time: string, msg: string, type: 'info' | 'warn' | 'action'}[]>([]);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    const handleStart = () => setIsStarted(true);
    window.addEventListener('start-simulations', handleStart);
    return () => window.removeEventListener('start-simulations', handleStart);
  }, []);

  useEffect(() => {
    if (isStarted) {
      const interval = setInterval(() => {
        generateMockAdvice();
      }, 3000); // Generate advice every 3 seconds
      return () => clearInterval(interval);
    }
  }, [isStarted]);

  const generateMockAdvice = () => {
    const nodeLabels = ['CAR_1', 'ROAD_A', 'JAM_1', 'CAR_2'];
    const randomNode = nodeLabels[Math.floor(Math.random() * nodeLabels.length)];

    const advices = [
      `检测到 ${randomNode}，建议调整红绿灯配时。`,
      `当前道路负荷较高，已自动诱导至替代路径。`,
      "道路情况正常，持续监控中..."
    ];
    const randomAdvice = advices[Math.floor(Math.random() * advices.length)];
    
    const newLog = {
        time: new Date().toLocaleTimeString(),
        msg: `[KGIN] ${randomAdvice}`,
        type: (randomAdvice.includes("建议") || randomAdvice.includes("诱导")) ? 'action' : 'info' as const
    };

    setLogs(prev => [newLog, ...prev].slice(0, 50));
  };

  return (
    <div className="h-full flex flex-col font-mono text-xs overflow-hidden relative">
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1 space-y-1">
          {logs.length === 0 && (
              <div className="text-slate-500 italic text-[10px] p-2">等待 KGIN 模拟启动...</div>
          )}
          {logs.map((log, i) => (
              <div key={i} className={`p-1.5 rounded border-l-2 flex gap-2 ${
                  log.type === 'warn' ? 'bg-yellow-900/10 border-yellow-500 text-yellow-200' :
                  log.type === 'action' ? 'bg-cyan-900/10 border-cyan-500 text-cyan-200' :
                  'border-slate-600 text-slate-400'
              }`}>
                  <span className="opacity-50 text-[9px]">{log.time}</span>
                  <span className="font-bold">{log.msg}</span>
              </div>
          ))}
      </div>
    </div>
  );
};

export default AIAgent;