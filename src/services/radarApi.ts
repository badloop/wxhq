import type { NexradSite, RadarFrame } from '../types/radar';
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

export async function fetchRadarFrames(siteId: string, count: number = 10): Promise<RadarFrame[]> {
  const end = new Date();
  const start = new Date(end.getTime() - count * 5 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);
  const url = `https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=${siteId}&product=N0B&start=${encodeURIComponent(fmt(start))}&end=${encodeURIComponent(fmt(end))}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data.scans) return [];
  return data.scans.map((s: { ts: string }) => ({
    url: getRadarTileUrl(siteId, s.ts),
    timestamp: s.ts,
    product: 'N0B',
  }));
}

export function getRadarTileUrl(siteId: string, timestamp?: string): string {
  const ts = timestamp ? timestamp.replace(/[- :]/g, '').slice(0, 12) : '0';
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${siteId}-N0B-${ts}/{z}/{x}/{y}.png`;
}

export function getMosaicTileUrl(minutesAgo: number = 0): string {
  if (minutesAgo === 0) {
    return 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
  }
  const d = new Date(Date.now() - minutesAgo * 60000);
  const ts = d.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-${ts}-900913/{z}/{x}/{y}.png`;
}
