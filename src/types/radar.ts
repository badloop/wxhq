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

/** Available NEXRAD Level III products (NCEP GeoServer WMS) */
export const RADAR_PRODUCTS = [
  { id: 'sr_bref', name: 'Base Refl (Super-Res)', description: '0.5° super-res reflectivity' },
  { id: 'sr_bvel', name: 'Base Velocity (Super-Res)', description: '0.5° super-res radial velocity' },
  { id: 'bdhc', name: 'Hydrometeor Class', description: 'Dual-pol hydrometeor classification' },
  { id: 'bdsa', name: 'Diff Reflectivity', description: 'Dual-pol differential reflectivity' },
  { id: 'boha', name: '1-Hr Accumulation', description: 'One-hour precipitation accumulation' },
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
}
