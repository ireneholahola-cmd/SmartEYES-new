import React, { useEffect } from 'react';
import VideoGrid from './components/VideoGrid';
import LaneMatrix from './components/LaneMatrix';
import RealtimeGraph from './components/RealtimeGraph';
import UnityViewer from './components/UnityViewer';
import { useStore } from './src/store/useStore';
import AIAgent from './components/AIAgent';
import { api, neo4jWsClient } from './lib/api';

const App: React.FC = () => {
  const { loadTaskResult, pollTaskStatus, initDemoData } = useStore();
  const [neo4jGraphData, setNeo4jGraphData] = React.useState<{
    nodes: any[];
    links: any[];
  }>({ nodes: [], links: [] });

  // Mock simulation logic
  useEffect(() => {
    const mockNodes = [
        { id: '路口_A', type: 'intersection', status: 'active', details: '学院路口', x: 0, y: 0 },
        { id: '路口_B', type: 'intersection', status: 'active', details: '工业路口', x: 200, y: -50 },
        { id: '路段_AB', type: 'road', status: 'active', details: '学院路-工业路', x: 100, y: -25 },
        { id: '车辆_1', type: 'vehicle', status: 'active', details: '京A-12345', x: 50, y: -10 },
        { id: '车辆_2', type: 'vehicle', status: 'active', details: '京B-67890', x: 150, y: -40 },
        { id: '车辆_3', type: 'vehicle', status: 'active', details: '京C-54321', x: 20, y: 20 },
        { id: '路口_C', type: 'intersection', status: 'active', details: '幸福路口', x: -100, y: 150 },
        { id: '路段_AC', type: 'road', status: 'active', details: '学院路-幸福路', x: -50, y: 75 },
        { id: '车辆_4', type: 'vehicle', status: 'active', details: '京D-09876', x: -80, y: 120 },
        { id: '车辆_5', type: 'vehicle', status: 'active', details: '京E-11223', x: -30, y: 50 },
        { id: '车辆_6', type: 'vehicle', status: 'active', details: '京F-AABB', x: -60, y: 90 },
        { id: '交通事故_1', type: 'event', status: 'critical', details: '严重碰撞', x: -40, y: 65 },
        { id: '车辆_7', type: 'vehicle', status: 'active', details: '京G-CCDD', x: 220, y: 10 },
        { id: '车辆_8', type: 'vehicle', status: 'active', details: '京H-EEFF', x: 80, y: 180 },
        { id: '路口_D', type: 'intersection', status: 'active', details: '和平路口', x: 150, y: 200 },
        { id: '车辆_9', type: 'vehicle', status: 'active', details: '京I-GGHH', x: 160, y: 150 },
        { id: '车辆_10', type: 'vehicle', status: 'active', details: '京J-IIJJ', x: 130, y: 220 },
    ];

    const mockLinks = [
        { source: '路口_A', target: '路段_AB' }, { source: '路段_AB', target: '路口_B' },
        { source: '路口_A', target: '路段_AC' }, { source: '路段_AC', target: '路口_C' },
        { source: '车辆_1', target: '路段_AB' }, { source: '车辆_2', target: '路段_AB' }, 
        { source: '车辆_3', target: '路口_A' },
        { source: '车辆_4', target: '路段_AC' }, { source: '车辆_5', target: '路段_AC' },
        { source: '车辆_6', target: '路段_AC' },
        { source: '交通事故_1', target: '路段_AC' },
        { source: '车辆_7', target: '路口_B' },
        { source: '车辆_8', target: '路口_D' }, { source: '车辆_9', target: '路口_D' }, { source: '车辆_10', target: '路口_D' },
        { source: '路口_B', target: '路口_D' },
    ];

    const handleStart = () => {
      console.log("App simulation started");
      let count = 0;
      const timer = setInterval(() => {
        if (count < mockNodes.length) {
          const newNode = mockNodes[count];
          const newLinks = mockLinks.filter(l => l.source === newNode.id || l.target === newNode.id);
          
          setNeo4jGraphData(prev => ({
              nodes: [...prev.nodes, newNode],
              links: [...prev.links, ...newLinks]
          }));

          count++;
        } else {
          clearInterval(timer);
          // All nodes are out, now focus on the accident
          const accidentNode = mockNodes.find(n => n.id === '交通事故_1');
          if (accidentNode) {
              const event = new CustomEvent('final-focus', { detail: accidentNode });
              window.dispatchEvent(event);
          }
        }
      }, 400); // Faster!
    };

    window.addEventListener('start-simulations', handleStart);
    return () => window.removeEventListener('start-simulations', handleStart);
  }, []);

  return (
    <main className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden p-2 grid grid-cols-12 grid-rows-6 gap-2">
      
      {/* 1. Core Video Area (Center) 8x4 */}
      <section className="col-span-8 row-span-4 bg-black border border-slate-800 rounded-sm relative overflow-hidden">
        <VideoGrid />
      </section>

      {/* 2. Compact Data Matrix (Right Side) 4x4 */}
      <aside className="col-span-4 row-span-4 bg-slate-900/50 border border-slate-800 p-2 flex flex-col backdrop-blur-sm overflow-hidden">
        <div className="border-l-2 border-cyan-500 pl-2 mb-2 text-sm font-bold uppercase text-slate-100 flex justify-between items-center">
            <span>实时流量统计</span>
            <span className="text-[10px] text-cyan-500 animate-pulse">LIVE DATA</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar mb-2">
           <LaneMatrix />
        </div>
        
        {/* KGIN Agent (Embedded in Sidebar) */}
        <div className="h-32 border-t border-slate-800 pt-2 flex flex-col">
             <div className="border-l-2 border-primary pl-2 mb-1 text-xs font-bold uppercase text-primary flex items-center gap-1">
                 <span className="material-symbols-outlined text-xs">psychology</span>
                 KGIN 决策大脑
             </div>
             <div className="flex-1 bg-black/40 rounded overflow-hidden">
                <AIAgent graphData={neo4jGraphData} />
             </div>
        </div>
      </aside>

      {/* 3. Neo4j Knowledge Graph (Bottom Left) 6x2 */}
      <section className="col-span-6 row-span-2 bg-slate-900/50 border border-slate-800 p-2 backdrop-blur-sm overflow-hidden flex flex-col">
        <div className="text-sm font-bold mb-1 border-l-2 border-cyan-500 pl-2 text-slate-100">地理信息图谱</div>
        <div className="flex-1 relative">
            <RealtimeGraph graphData={neo4jGraphData} />
        </div>
      </section>

      {/* 4. Unity Digital Twin (Bottom Right) 6x2 */}
      <section className="col-span-6 row-span-2 bg-slate-900/50 border border-slate-800 p-2 backdrop-blur-sm overflow-hidden flex flex-col">
         <div className="text-sm font-bold mb-1 border-l-2 border-cyan-500 pl-2 text-slate-100">Unity 数字孪生</div>
         <div className="flex-1 relative">
            <UnityViewer />
         </div>
      </section>

    </main>
  );
};

export default App;
