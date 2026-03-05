import React, { useEffect, useState } from 'react';

const UnityViewer: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [vehicleCount, setVehicleCount] = useState(0);

  useEffect(() => {
    const handleStart = () => setIsActive(true);
    window.addEventListener('start-simulations', handleStart);
    return () => window.removeEventListener('start-simulations', handleStart);
  }, []);

  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setVehicleCount(Math.floor(Math.random() * 15) + 5); // Simulate 5-20 vehicles
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <div className="h-full w-full bg-black/60 relative overflow-hidden flex flex-col items-center justify-center border border-slate-800 unity-container">
      {isActive ? (
        <div className="text-center animate-in fade-in">
          <span className="material-symbols-outlined text-6xl text-cyan-400 animate-pulse">view_in_ar</span>
          <h3 className="text-lg font-bold text-white mt-4">Unity 仿真同步中</h3>
          <p className="text-slate-400 text-sm">检测到 {vehicleCount} 辆车</p>
        </div>
      ) : (
        <div className="text-center text-slate-500">
          <span className="material-symbols-outlined text-6xl">view_in_ar</span>
          <h3 className="text-lg font-bold mt-4">等待算法数据输入...</h3>
        </div>
      )}
    </div>
  );
};

export default UnityViewer;
