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

/** Build the NCEP GeoServer WMS workspace name from site ID (e.g. KLSX -> klsx) */
function ncepWorkspace(siteId: string): string {
  return siteId.toLowerCase();
}

/** Build the NCEP WMS layer name for a given site and product */
export function ncepLayerName(siteId: string, product: RadarProductId): string {
  return `${ncepWorkspace(siteId)}_${product}`;
}

/** NCEP GeoServer WMS base URL for a site */
export function ncepWmsUrl(siteId: string): string {
  return `https://opengeo.ncep.noaa.gov/geoserver/${ncepWorkspace(siteId)}/ows`;
}

/**
 * Fetch available radar frames from NCEP GeoServer WMS GetCapabilities.
 * Parses the TIME dimension extent for the given product layer.
 */
export async function fetchRadarFrames(siteId: string, count: number = 10, product: RadarProductId = 'sr_bref'): Promise<RadarFrame[]> {
  const ws = ncepWorkspace(siteId);
  const layer = `${ws}_${product}`;
  const url = `https://opengeo.ncep.noaa.gov/geoserver/${ws}/ows?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetCapabilities`;

  try {
    const res = await fetchWithRetry(url, {}, 1);
    const text = await res.text();

    // Find the layer section and extract TIME extent
    const layerIdx = text.indexOf(layer);
    if (layerIdx < 0) return [];

    const chunk = text.slice(layerIdx, layerIdx + 3000);
    const timeMatch = chunk.match(/<Extent name="time"[^>]*>([^<]+)<\/Extent>/);
    if (!timeMatch) return [];

    const allTimes = timeMatch[1].split(',').map(t => t.trim());
    // Take the last N frames
    const frames = allTimes.slice(-count);

    return frames.map(ts => ({
      url: ts, // We'll use the timestamp directly with WMS TIME param
      timestamp: ts,
      product,
    }));
  } catch (err) {
    console.error(`[wxhq] Failed to fetch NCEP radar frames for ${siteId}/${product}:`, err);
    return [];
  }
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
