import type { NexradSite, RadarFrame, RadarProductId } from '../types/radar';
import { fetchWithRetry } from './fetchClient';

export async function fetchNexradSites(): Promise<NexradSite[]> {
  const res = await fetchWithRetry('https://mesonet.agron.iastate.edu/geojson/network.py?network=NEXRAD');
  const data = await res.json();
  return data.features.map((f: { properties: { sid: string; sname: string; state: string }; geometry: { coordinates: [number, number] } }) => ({
    id: f.properties.sid,
    name: f.properties.sname,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    state: f.properties.state,
  }));
}

export async function fetchRadarFrames(siteId: string, count: number = 10, product: RadarProductId = 'N0B'): Promise<RadarFrame[]> {
  const end = new Date();
  const start = new Date(end.getTime() - count * 5 * 60 * 1000);
  const apiSiteId = siteId.replace(/^K/, '');
  const url = `https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=${apiSiteId}&product=${product}&start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data.scans) return [];
  return data.scans.map((s: { ts: string }) => ({
    url: getRadarTileUrl(siteId, product, s.ts),
    timestamp: s.ts,
    product,
  }));
}

export function getRadarTileUrl(siteId: string, product: RadarProductId = 'N0B', timestamp?: string): string {
  const ridgeSiteId = siteId.replace(/^K/, '');
  const ts = timestamp ? timestamp.replace(/\D/g, '').slice(0, 12) : '0';
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeSiteId}-${product}-${ts}/{z}/{x}/{y}.png`;
}

/** Minutes-ago values for mosaic history layers: 5, 10, 15, ... 55 */
export const MOSAIC_MINUTES_AGO = [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0] as const;

export function getMosaicTileUrl(minutesAgo: number = 0): string {
  if (minutesAgo === 0) {
    return 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
  }
  // Use predefined IEM mosaic history layers: m05m, m10m, ... m55m
  const mm = String(minutesAgo).padStart(2, '0');
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-m${mm}m-900913/{z}/{x}/{y}.png`;
}
