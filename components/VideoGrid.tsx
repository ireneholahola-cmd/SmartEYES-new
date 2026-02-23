import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface VideoGridProps {
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onMinimize?: () => void;
}

interface CameraFeed {
  id: string;
  name: string;
  url: string;
  status?: string;
  type?: 'monitor' | 'twin' | 'analysis'; // Add type to distinguish feeds
  taskId?: string;
}

const VideoGrid: React.FC<VideoGridProps> = ({ isExpanded, onToggleExpand, onMinimize }) => {
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Initialize with 2 default feeds for the new layout
  const [feeds, setFeeds] = useState<CameraFeed[]>([
    { id: 'MONITOR-01', name: '智能实时监控区', url: 'https://picsum.photos/seed/cam1/800/450', type: 'monitor' },
    { id: 'TWIN-01', name: '数字孪生仿真区', url: 'https://picsum.photos/seed/twin1/800/450', type: 'twin' },
  ]);

  const pollTask = async (feedId: string, taskId: string) => {
    try {
        const data = await api.video.getTaskStatus(taskId);
        console.log(`[Poll] Task ${taskId}:`, data); // Add logging for debugging

        // data.status: 'processing' | 'completed' | 'failed' | 'done' (backend returns 'done')
        if ((data.status === 'completed' || data.status === 'done') && data.video_url) {
            setFeeds(prev => prev.map(f => f.id === feedId ? { 
                ...f, 
                status: 'completed', 
                url: data.video_url 
            } : f));
        } else if (data.status === 'failed') {
             setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, status: 'error' } : f));
        } else {
            // Continue polling
            setTimeout(() => pollTask(feedId, taskId), 2000);
        }
    } catch (e) {
        console.error("Polling error", e);
        setTimeout(() => pollTask(feedId, taskId), 5000);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Create a new feed item
    const newFeed: CameraFeed = {
        id: `DEIM-${Date.now().toString().slice(-4)}`,
        name: `AI分析-${file.name.slice(0, 10)}`,
        url: '',
        type: 'analysis',
        status: 'uploading'
    };

    setFeeds(prev => [...prev, newFeed]);

    try {
        const response = await api.video.upload(file);
        // response: { task_id: "...", status: "processing" }
        
        setFeeds(prev => prev.map(f => f.id === newFeed.id ? { 
            ...f, 
            status: 'processing', 
            taskId: response.task_id 
        } : f));

        pollTask(newFeed.id, response.task_id);
    } catch (error) {
        console.error("Upload failed", error);
        setFeeds(prev => prev.map(f => f.id === newFeed.id ? { ...f, status: 'error' } : f));
    }
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 从后端加载摄像头配置 (Optional: You might want to adjust this logic if the backend returns 4 cameras)
  // For now, let's keep the manual 2-feed structure as requested, or filter backend data.
  // If backend returns data, we might need to map it to these 2 slots or just stick to the requested structure.
  // Given the strict requirement "change to two areas", I will prioritize the layout change.
  // I will comment out the auto-load for now to strictly follow the UI requirement, 
  // or I could map the first 2 backend cameras to these slots if needed.
  // Let's stick to the static definition for stability unless the user asked for dynamic backend data for these specific zones.
  /* 
  useEffect(() => {
    const loadCameras = async () => {
      try {
        const data = await api.cameras.getAll();
        if (data && data.length > 0) {
           // Logic to map backend data to the 2 zones could go here
        }
      } catch (error) {
        console.warn('[VideoGrid] Using default camera feeds');
      }
    };
    loadCameras();
  }, []);
  */

  return (
    <div className={`h-full backdrop-blur-panel tech-border rounded-lg overflow-hidden flex flex-col expand-transition ${isExpanded ? 'is-expanded' : 'bg-panel-dark/40'}`}>
      <header className="glass-header p-4 border-b border-white/10 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-lg">videocam</span>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-primary">
            监控矩阵 {activeFeedId && <span className="text-white/40 ml-2">[{activeFeedId}]</span>}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="px-2 h-7 bg-primary/20 text-[9px] text-primary uppercase font-bold rounded flex items-center gap-1 hover:bg-primary/40 transition-all">
             <span className="material-symbols-outlined text-sm">upload</span> 
             AI分析
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileChange} />
          
          {activeFeedId && (
            <button onClick={() => setActiveFeedId(null)} className="px-2 h-7 bg-primary/20 text-[9px] text-primary uppercase font-bold rounded">返回矩阵</button>
          )}
          <button onClick={onToggleExpand} className="w-7 h-7 flex items-center justify-center border border-white/10 rounded hover:border-primary transition-all">
            <span className="material-symbols-outlined text-base">{isExpanded ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
          {onMinimize && !isExpanded && (
            <button onClick={onMinimize} className="w-7 h-7 flex items-center justify-center border border-white/10 rounded hover:bg-white/5 transition-all">
              <span className="material-symbols-outlined text-sm text-slate-500">remove</span>
            </button>
          )}
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 relative ${activeFeedId ? 'overflow-hidden' : ''}`}>
        {activeFeedId && (
          <div className="absolute inset-0 z-10 p-4 bg-background-dark animate-in fade-in zoom-in-95">
            {feeds.filter(f => f.id === activeFeedId).map(feed => (
              <div key={feed.id} className="w-full h-full relative rounded-lg overflow-hidden border border-primary/40 bg-black">
                {feed.type === 'analysis' && feed.status === 'completed' ? (
                   <video 
                     src={feed.url} 
                     controls 
                     autoPlay 
                     loop 
                     muted 
                     preload="metadata"
                     playsInline 
                     className="w-full h-full object-contain" 
                   />
                ) : feed.type === 'analysis' ? (
                   <div className="w-full h-full flex flex-col items-center justify-center text-primary animate-pulse">
                      <span className="material-symbols-outlined text-6xl mb-4">memory</span>
                      <span className="text-sm font-bold tracking-widest">MODEL PROCESSING...</span>
                   </div>
                ) : (
                   <img src={feed.url} className="w-full h-full object-cover" />
                )}
                <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-xs font-bold text-primary backdrop-blur-sm border border-primary/20">
                  {feed.name}
                </div>
                <button onClick={() => setActiveFeedId(null)} className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center hover:bg-accent-red transition-all">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Adjusted Grid Layout: 2 Columns (1x2) */}
        <div className={`grid gap-4 grid-cols-1 md:grid-cols-2 h-full`}>
          {feeds.map((feed) => (
            <div 
              key={feed.id} 
              onClick={() => setActiveFeedId(feed.id)} 
              className="relative bg-black rounded border border-white/10 overflow-hidden group cursor-pointer hover:border-primary transition-all flex flex-col"
              style={{ minHeight: '150px' }}
            >
              <div className="flex-1 relative overflow-hidden bg-black">
                 {feed.type === 'analysis' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-primary">
                        {feed.status === 'completed' && feed.url ? (
                            <video 
                              src={feed.url} 
                              muted 
                              loop 
                              autoPlay 
                              preload="metadata"
                              playsInline 
                              className="w-full h-full object-cover" 
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-4xl mb-2">
                                    {feed.status === 'uploading' ? 'cloud_upload' : 'memory'}
                                </span>
                                <span className="text-[10px] uppercase font-bold tracking-widest">
                                    {feed.status === 'uploading' ? 'UPLOADING...' : 'PROCESSING...'}
                                </span>
                            </div>
                        )}
                    </div>
                 ) : (
                    <img src={feed.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
                 )}
                 
                 {/* Overlay Icon based on type */}
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/50">
                        <span className="material-symbols-outlined text-primary">
                            {feed.type === 'monitor' ? 'videocam' : feed.type === 'analysis' ? 'smart_display' : 'view_in_ar'}
                        </span>
                    </div>
                 </div>
              </div>
              
              <div className="h-8 bg-white/5 border-t border-white/5 flex items-center px-3 justify-between shrink-0">
                <span className="text-[10px] font-bold text-slate-200 uppercase tracking-wider">{feed.name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${feed.type === 'monitor' ? 'bg-accent-red animate-pulse' : feed.type === 'analysis' ? 'bg-primary' : 'bg-accent-blue'}`}></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoGrid;
