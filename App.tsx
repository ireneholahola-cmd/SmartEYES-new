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

  // Initial Data Load
  useEffect(() => {
    initDemoData(); // Load demo.json on start
    
    const init = async () => {
      try {
        await neo4jWsClient.connect();
        const unsub = neo4jWsClient.subscribe('neo4j', (data) => {
           if (data.nodes && data.links) setNeo4jGraphData(data);
        });
        
        // Load initial graph
        const g = await api.neo4j.getGraph();
        if (g.nodes) setNeo4jGraphData(g);
        
        return () => {
            unsub();
            neo4jWsClient.disconnect();
        }
      } catch (e) {
        console.warn("Neo4j init failed", e);
      }
    };
    init();
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
        <div className="h-48 border-t border-slate-800 pt-2 flex flex-col">
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
