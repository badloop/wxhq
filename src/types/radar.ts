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

/** Available NEXRAD Level III products (IEM RIDGE tiles) */
export const RADAR_PRODUCTS = [
  { id: 'N0B', name: 'Base Refl', description: 'Super-res base reflectivity' },
  { id: 'N0G', name: 'Base Refl (legacy)', description: 'Legacy base reflectivity' },
  { id: 'N0S', name: 'Storm Rel Vel', description: 'Storm-relative velocity' },
  { id: 'N0X', name: 'Diff Refl', description: 'Differential reflectivity (ZDR)' },
  { id: 'N0C', name: 'Corr Coeff', description: 'Correlation coefficient (CC)' },
  { id: 'N0K', name: 'Spec Diff Phase', description: 'Specific differential phase (KDP)' },
  { id: 'N0H', name: 'Hydrometeor', description: 'Hydrometeor classification' },
] as const;

export type RadarProductId = typeof RADAR_PRODUCTS[number]['id'];

export interface RadarState {
  selectedSite: NexradSite | null;
  frames: RadarFrame[];
  currentFrame: number;
  isAnimating: boolean;
  animationSpeed: number;
  frameCount: number;
  radarProduct: RadarProductId;
  loopDelay: number;
}
