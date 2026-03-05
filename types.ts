export interface LaneData {
  id: string;
  traffic: number;
  speed: number;
  queue: number;
  occupancy: number;
  status: 'normal' | 'delay' | 'critical' | 'emergency';
}

export interface CameraFeed {
  id: string;
  name: string;
  status: 'online' | 'offline';
  url: string;
}

export interface SystemStats {
  globalDensity: number;
  efficiency: number;
  load: number;
  latency: number;
  timestamp: string;
}

export interface AIReport {
  status: 'analyzing' | 'idle' | 'complete';
  summary?: string;
  recommendations?: string[];
  lastUpdate?: string;
}

export interface GraphNodeData {
  id: string;
  type: 'hub' | 'sensor' | 'signal';
  status: 'active' | 'warning' | 'critical';
  lanes: string[];
  lastSync: string;
  details: string;
  weight?: number;
  threshold?: number;
}

// ─── Time-Series Protocol (Phase 1) ───

export interface TimeSeriesData {
  taskId: string;
  totalFrames: number;
  fps: number;
  duration: number;
  frames: FrameData[];
}

export interface FrameData {
  frameId: number;
  timestamp: number; // in seconds
  detections: Detection[];
  events: TrafficEvent[];
  stats: FrameStats;
}

export interface Detection {
  id: string; // track_id
  class: string; // car, bus, truck, etc.
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  // 3D mapping for Unity
  worldPos?: { x: number; y: number; z: number };
}

export interface TrafficEvent {
  id: string;
  type: 'accident' | 'congestion' | 'violation' | 'obstacle';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: { x: number; y: number };
  timestamp: string;
  nodeId?: string; // Associated Graph Node ID
}

export interface FrameStats {
  vehicleCount: number;
  averageSpeed?: number;
  density?: number;
}