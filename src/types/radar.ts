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

/** Available NEXRAD Level III products */
export const RADAR_PRODUCTS = [
  { id: 'N0B', name: 'Base Refl (Super-Res)', description: '0.5° reflectivity, 250m gates' },
  { id: 'N0Q', name: 'Base Reflectivity', description: '0.5° reflectivity, 1km gates' },
  { id: 'N0U', name: 'Base Velocity', description: '0.5° radial velocity' },
  { id: 'N0S', name: 'Storm Rel Velocity', description: '0.5° storm-relative velocity' },
  { id: 'N0X', name: 'Diff Reflectivity', description: '0.5° ZDR' },
  { id: 'N0C', name: 'Correlation Coeff', description: '0.5° CC' },
  { id: 'N0K', name: 'Specific Diff Phase', description: '0.5° KDP' },
  { id: 'N0H', name: 'Hydrometeor Class', description: '0.5° HCA' },
  { id: 'EET', name: 'Echo Tops', description: 'Enhanced echo tops' },
  { id: 'DVL', name: 'Vert Integ Liquid', description: 'Vertically integrated liquid' },
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
