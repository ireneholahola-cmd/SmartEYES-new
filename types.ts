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