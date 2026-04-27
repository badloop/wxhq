export interface OverlayConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  refreshInterval: number;
  color: string;
  category: 'spc' | 'nws' | 'custom';
}

export interface OverlayData {
  config: OverlayConfig;
  geojson: GeoJSON.FeatureCollection | null;
  lastFetched: Date | null;
  error: string | null;
}
