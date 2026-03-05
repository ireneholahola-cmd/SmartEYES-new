import { create } from 'zustand';
import { TimeSeriesData } from '../../types';
import { api } from '../../lib/api';

interface StoreState {
  // Global Clock
  currentFrame: number;
  isPlaying: boolean;
  fps: number;
  totalFrames: number;
  
  // Data
  data: TimeSeriesData | null;
  videoUrl: string | null;
  taskId: string | null;
  
  // Status
  loading: boolean;
  error: string | null;
  
  feeds: Feed[];
  
  initDemoData: () => Promise<void>;
  
  // Actions
  setData: (data: TimeSeriesData) => void;
  setVideoUrl: (url: string) => void;
  play: () => void;
  pause: () => void;
  setFrame: (frame: number) => void;
  nextFrame: () => void;
  reset: () => void;
  
  addFeed: (feed: Feed) => void;
  updateFeed: (id: string, updates: Partial<Feed>) => void;
  removeFeed: (id: string) => void;
  
  // Phase 4: Unity Mapping
  mapToUnity: (pixelX: number, pixelY: number) => { x: number, z: number };
  
  // Async Actions
  loadTaskResult: (taskId: string) => Promise<void>;
  uploadVideo: (file: File) => Promise<string>;
  pollTaskStatus: (taskId: string) => Promise<void>;
}

export interface Feed {
    id: string;
    name: string;
    url: string;
    type: 'monitor' | 'twin' | 'analysis';
    status: 'online' | 'offline' | 'uploading' | 'processing' | 'completed' | 'error';
    taskId?: string;
}

export const useStore = create<StoreState>((set, get) => ({
  currentFrame: 0,
  isPlaying: false,
  fps: 30, // Default
  totalFrames: 0,
  
  data: null,
  videoUrl: null,
  taskId: null,
  
  loading: false,
  error: null,
  
  feeds: [],
  
  // Auto-load demo data on init
  initDemoData: async () => {
      try {
          // Check if file exists first to avoid syntax error on 404 HTML response
          const response = await fetch('/assets/demo.json', { method: 'HEAD' });
          if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
              const res = await fetch('/assets/demo.json');
              const jsonData = await res.json();
              const timeSeriesData: TimeSeriesData = {
                  taskId: 'DEMO-TASK',
                  totalFrames: jsonData.total_frames || 1000,
                  fps: 30, 
                  duration: (jsonData.total_frames || 1000) / 30,
                  frames: jsonData.frames || []
              };
              set({ 
                  data: timeSeriesData,
                  totalFrames: timeSeriesData.totalFrames,
                  fps: 30,
                  videoUrl: '/assets/demo.mp4',
                  taskId: 'DEMO'
              });
              
              // Add Demo Feed automatically
              get().addFeed({
                  id: 'DEMO-FEED',
                  name: 'DEMO TRAFFIC (AUTO-LOADED)',
                  url: '/assets/demo.mp4',
                  type: 'analysis',
                  status: 'completed',
                  taskId: 'DEMO'
              });

              console.log("Demo data loaded:", timeSeriesData);
          } else {
              console.warn("Demo data not found or invalid format");
          }
      } catch (e) {
          console.warn("Failed to load demo.json", e);
      }
  },
  
  setData: (data) => set({ 
    data, 
    fps: data.fps || 30, 
    totalFrames: data.totalFrames,
    currentFrame: 0 
  }),
  
  setVideoUrl: (url) => set({ videoUrl: url }),
  
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  
  setFrame: (frame) => {
    const { totalFrames } = get();
    if (frame >= 0 && frame < totalFrames) {
      set({ currentFrame: frame });
    }
  },
  
  nextFrame: () => {
    const { currentFrame, totalFrames, isPlaying } = get();
    if (!isPlaying) return;
    
    if (currentFrame + 1 >= totalFrames) {
      set({ isPlaying: false, currentFrame: 0 }); // Loop
    } else {
      set({ currentFrame: currentFrame + 1 });
    }
  },
  
  reset: () => set({ 
    currentFrame: 0, 
    isPlaying: false, 
    data: null, 
    videoUrl: null, 
    taskId: null 
  }),

  addFeed: (feed) => set((state) => ({ feeds: [...state.feeds, feed] })),
  updateFeed: (id, updates) => set((state) => ({
      feeds: state.feeds.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  removeFeed: (id) => set((state) => ({ feeds: state.feeds.filter(f => f.id !== id) })),

  mapToUnity: (x, y) => {
      // Assuming 1920x1080 video -> Unity Plane 100x100
      return {
          x: (x / 1920) * 100 - 50,
          z: (y / 1080) * 100 - 50
      };
  },

  uploadVideo: async (file) => {
      set({ loading: true, error: null });
      try {
          const res = await api.video.upload(file);
          return res.task_id;
      } catch (e) {
          set({ error: (e as Error).message });
          throw e;
      } finally {
          set({ loading: false });
      }
  },

  pollTaskStatus: async (taskId) => {
       try {
           const status = await api.video.getTaskStatus(taskId);
           const { feeds, updateFeed, loadTaskResult } = get();
           const feed = feeds.find(f => f.taskId === taskId);
           if (feed) {
               if (status.status === 'done' || status.status === 'completed') {
                   updateFeed(feed.id, { status: 'completed', url: status.result_url || status.result_json?.video_url });
                   await loadTaskResult(taskId);
               } else if (status.status === 'failed') {
                   updateFeed(feed.id, { status: 'error' });
               } else {
                   updateFeed(feed.id, { status: 'processing' });
               }
           }
       } catch (e) {
           console.error("Poll error", e);
       }
  },
  
  loadTaskResult: async (taskId) => {
    set({ loading: true, error: null });
    try {
      const status = await api.video.getTaskStatus(taskId);
      if (status.status === 'done' || status.status === 'completed') {
          let jsonData = status.result_json;
          
          if (typeof jsonData === 'string') {
             const response = await fetch(jsonData);
             jsonData = await response.json();
          }
          
          const timeSeriesData: TimeSeriesData = {
              taskId: jsonData.task_id,
              totalFrames: jsonData.total_frames,
              fps: 30, // Default
              duration: jsonData.total_frames / 30,
              frames: jsonData.frames || []
          };

          set({ 
              data: timeSeriesData,
              videoUrl: status.result_url || jsonData.video_url,
              taskId: taskId,
              totalFrames: jsonData.total_frames,
              fps: 30
          });
      }
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  }
}));
