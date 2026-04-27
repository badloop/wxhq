export interface OverlayConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  refreshInterval: number;
  color: string;
  category: 'spc' | 'nws' | 'mcd' | 'custom';
  fillMode: 'fill' | 'outline';
}

export interface LayerGroup {
  id: string;        // 'radar' | 'spc' | 'nws' | 'custom'
  name: string;
  opacity: number;    // 0-1
}

export interface OverlayData {
  config: OverlayConfig;
  geojson: GeoJSON.FeatureCollection | null;
  lastFetched: Date | null;
  error: string | null;
}
