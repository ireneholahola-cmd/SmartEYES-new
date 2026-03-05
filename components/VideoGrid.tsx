import React, { useState, useEffect, useRef } from 'react';
import { useStore, Feed } from '../src/store/useStore';

interface VideoGridProps {
  // Props removed as they are no longer used
}

const VideoGrid: React.FC = () => {
  const { feeds, addFeed, updateFeed, pollTaskStatus } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);

  // State for active single-view feed (click to expand)
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
  const activeFeed = feeds.find(f => f.id === activeFeedId);

  // This will be triggered by other components
  const triggerOtherModules = () => {
    // In a real app, you'd use a state management library (like Zustand, which you have)
    // or a custom event system to notify other components.
    console.log("Triggering other modules to start their simulated tasks.");
    window.dispatchEvent(new Event('start-simulations'));
  };

  const handleSimulatedUpload = () => {
    setUploading(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setUploadProgress(progress); // 进度条数字跳动
      if (progress >= 100) {
        clearInterval(interval);
        setUploading(false);
        setVideoReady(true); // 进度条跑完，显示视频画面
        console.log("模拟：视频处理完成，开始播放并通知其他模块");
        triggerOtherModules(); // 触发联动
      }
    }, 100);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const tempId = Date.now().toString();
      
      // 1. Create a placeholder feed immediately
      const newFeed: Feed = {
          id: tempId,
          name: file.name,
          url: '', // Will be updated after upload/processing
          type: 'analysis',
          status: 'uploading'
      };
      addFeed(newFeed);
      handleSimulatedUpload();
    }
  };

  // If no feeds, show empty state
  if (feeds.length === 0 && !uploading && !videoReady) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/30 border-2 border-dashed border-slate-700 rounded-lg p-8 group hover:border-cyan-500/50 transition-colors">
            {/* Empty State Content */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-10 rounded-full animate-pulse"></div>
                <span className="material-symbols-outlined text-6xl text-slate-600 group-hover:text-cyan-400 transition-colors relative z-10">
                    movie
                </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-400 mb-2 group-hover:text-cyan-300">准备开始模拟</h3>
            <p className="text-xs text-slate-500 max-w-xs text-center mb-6">
                点击下方按钮，开始模拟视频上传、处理和多模块联动效果。
            </p>
            
            <button 
                onClick={handleSimulatedUpload}
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded shadow-lg shadow-cyan-500/20 transition-all active:scale-95 flex items-center gap-2"
            >
                <span className="material-symbols-outlined text-sm">play_circle</span>
                开始模拟
            </button>
        </div>
      );
  }

  if (uploading) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/30 border-2 border-dashed border-slate-700 rounded-lg p-8">
          <div className="relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
              <span className="text-xl font-bold text-cyan-400">{uploadProgress}%</span>
          </div>
          
          <div className="text-center space-y-2 mt-6">
              <h3 className="text-lg font-bold text-white tracking-widest uppercase">
                  模拟上传中...
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                  正在模拟视频文件上传到服务器
              </p>
          </div>
          
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-6">
              <div 
                 className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-300 ease-out"
                 style={{ width: `${uploadProgress}%` }}
              ></div>
          </div>
      </div>
    );
  }

  if (videoReady) {
    return (
        <div className="w-full h-full relative rounded-lg overflow-hidden border border-primary/40 bg-black group flex flex-col items-center justify-center">
            <video 
                src="/assets/demo.mp4" 
                controls 
                autoPlay 
                loop 
                muted 
                className="w-full h-full object-contain"
            />
            <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-xs font-bold text-primary backdrop-blur-sm border border-primary/20">
                模拟视频.mp4
            </div>
        </div>
    );
  }

  return (
    <div className="h-full backdrop-blur-panel tech-border rounded-lg overflow-hidden flex flex-col bg-panel-dark/40">
      {/* 头部 */}
      <header className="glass-header px-4 py-3 border-b border-white/10 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">videocam</span>
          <h2 className="text-[10px] font-bold tracking-widest uppercase text-slate-200">智能实时监控区</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/50 rounded transition-all group"
          >
            <span className="material-symbols-outlined text-sm text-slate-400 group-hover:text-cyan-300">add</span>
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-cyan-300">添加视频</span>
          </button>
        </div>
      </header>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="video/*" 
        onChange={handleFileChange} 
      />

      {/* Grid Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Active Feed View */}
        {activeFeedId && (
          <div className="absolute inset-0 z-10 p-2 bg-background-dark animate-in fade-in zoom-in-95">
             {feeds.filter(f => f.id === activeFeedId).map(feed => (
                 <ActiveFeedView key={feed.id} feed={feed} onClose={() => setActiveFeedId(null)} />
             ))}
          </div>
        )}

        {/* Grid View */}
        <div className={`grid gap-2 grid-cols-1 md:grid-cols-2 h-full`}>
          {feeds.map((feed) => (
            <div 
              key={feed.id} 
              onClick={() => setActiveFeedId(feed.id)} 
              className="relative bg-black rounded border border-white/10 overflow-hidden group cursor-pointer hover:border-primary transition-all flex flex-col"
              style={{ minHeight: '120px' }}
            >
               <FeedContent feed={feed} />
               
               <div className="h-6 bg-white/5 border-t border-white/5 flex items-center px-2 justify-between shrink-0">
                <span className="text-[9px] font-bold text-slate-200 uppercase tracking-wider">{feed.name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${feed.status === 'online' ? 'bg-accent-red animate-pulse' : feed.status === 'processing' ? 'bg-primary animate-pulse' : 'bg-slate-500'}`}></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ActiveFeedView: React.FC<{ feed: Feed; onClose: () => void }> = ({ feed, onClose }) => {
    const { setFrame, play, pause, data, currentFrame } = useStore();
    const [progress, setProgress] = useState(0);

    // Polling for progress when status is 'processing'
    useEffect(() => {
        if (feed.status === 'processing' && feed.taskId) {
            const interval = setInterval(async () => {
                try {
                   const res = await fetch(`http://localhost:8000/tasks/${feed.taskId}`);
                   if (res.ok) {
                       const json = await res.json();
                       if (json.progress) setProgress(json.progress);
                   }
                } catch (e) {
                    console.error("Progress poll error", e);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [feed.status, feed.taskId]);

    return (
        <div className="w-full h-full relative rounded-lg overflow-hidden border border-primary/40 bg-black group flex flex-col items-center justify-center">
            {feed.type === 'analysis' && feed.status === 'completed' ? (
                <>
                <video 
                    src={feed.url} 
                    controls 
                    autoPlay 
                    loop 
                    muted 
                    className="w-full h-full object-contain"
                    onPlay={() => play()}
                    onPause={() => pause()}
                    onTimeUpdate={(e) => {
                        const frame = Math.floor(e.currentTarget.currentTime * 30);
                        setFrame(frame);
                    }}
                />
                
                {/* Debug Status Overlay */}
                <div className="absolute top-2 left-2 bg-black/70 text-[9px] text-green-400 font-mono p-1 rounded border border-green-500/30 backdrop-blur-sm pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div>FRAME: {currentFrame}</div>
                    <div>DATA: {data ? 'LOADED' : 'WAITING'}</div>
                    <div>EVENTS: {data?.frames[currentFrame]?.events.length || 0}</div>
                </div>
                </>
            ) : (
                // Processing / Uploading State
                <div className="w-full max-w-md p-8 flex flex-col items-center justify-center gap-6">
                     <div className="relative w-24 h-24 flex items-center justify-center">
                         <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                         <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
                         <span className="text-xl font-bold text-cyan-400">{progress}%</span>
                     </div>
                     
                     <div className="text-center space-y-2">
                         <h3 className="text-lg font-bold text-white tracking-widest uppercase">
                             {feed.status === 'uploading' ? 'UPLOADING VIDEO...' : 'DEIM ENGINE PROCESSING...'}
                         </h3>
                         <p className="text-xs text-slate-400 font-mono">
                             {feed.status === 'uploading' 
                                 ? 'Sending file to inference server' 
                                 : `Task ID: ${feed.taskId || 'Initializing...'}`}
                         </p>
                     </div>
                     
                     {/* Progress Bar Visual */}
                     <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                         <div 
                            className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)] transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                         ></div>
                     </div>
                </div>
            )}
             <div className="absolute top-4 left-4 bg-black/60 px-3 py-1 rounded text-xs font-bold text-primary backdrop-blur-sm border border-primary/20">
                  {feed.name}
             </div>
             <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center hover:bg-accent-red transition-all">
                  <span className="material-symbols-outlined text-sm">close</span>
             </button>
        </div>
    );
}

const FeedContent: React.FC<{ feed: Feed }> = ({ feed }) => {
    if (feed.type === 'analysis') {
        return (
            <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
                 {feed.status === 'completed' && feed.url ? (
                     <video src={feed.url} muted loop autoPlay className="w-full h-full object-cover" />
                 ) : (
                     <div className="flex flex-col items-center justify-center animate-pulse text-primary/60">
                         <span className="material-symbols-outlined text-3xl mb-1">
                             {feed.status === 'uploading' ? 'cloud_upload' : 'memory'}
                         </span>
                         <span className="text-[8px] uppercase font-bold tracking-widest">
                             {feed.status === 'uploading' ? 'UPLOADING' : 'PROCESSING'}
                         </span>
                     </div>
                 )}
            </div>
        )
    }
    return (
        <div className="flex-1 relative overflow-hidden bg-black">
            <img src={feed.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105" />
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/50">
                    <span className="material-symbols-outlined text-primary text-lg">play_arrow</span>
                </div>
             </div>
        </div>
    )
}

export default VideoGrid;
