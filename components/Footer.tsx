
import React, { useState, useEffect } from 'react';

const Footer: React.FC = () => {
  const [uptime, setUptime] = useState('142:12:05');

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const hours = Math.floor(142 + diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      setUptime(`${hours.toString().padStart(3, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="h-10 border-t border-white/10 bg-background-dark flex items-center justify-between px-6 text-[9px] text-slate-500 font-mono shrink-0">
      <div className="flex gap-6">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-primary rounded-sm shadow-[0_0_8px_rgba(0,229,255,0.4)]"></span> 
          网络: 稳定
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-accent-orange rounded-sm"></span> 
          同步缓冲中...
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1">
          <div className="w-0.5 h-3 bg-primary/20"></div>
          <div className="w-0.5 h-3 bg-primary/40"></div>
          <div className="w-0.5 h-3 bg-primary/60"></div>
          <div className="w-0.5 h-3 bg-primary"></div>
        </div>
        <span>数据链路: 加密 [RSA-4096]</span>
        <span className="text-slate-700">|</span>
        <span>运行时间: {uptime}</span>
      </div>
    </footer>
  );
};

export default Footer;
