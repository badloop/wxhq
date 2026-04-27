export interface NexradSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  state: string;
}

export interface RadarFrame {
  url: string;
  timestamp: string;
  product: string;
}

export interface RadarState {
  selectedSite: NexradSite | null;
  frames: RadarFrame[];
  currentFrame: number;
  isAnimating: boolean;
  animationSpeed: number;
  frameCount: number;
}
