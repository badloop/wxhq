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

/** Strip the leading K/P/T prefix to get the 3-letter IEM site ID */
function iemSiteId(siteId: string): string {
  // Most CONUS sites are K + 3 letters, Alaska P + 3, Pacific T + 3
  return siteId.length === 4 ? siteId.slice(1) : siteId;
}

/** Map our product IDs to IEM RIDGE product codes */
const PRODUCT_TO_RIDGE: Record<RadarProductId, string> = {
  'N0B': 'N0B',
  'N0G': 'N0G',
  'N0S': 'N0S',
  'N0X': 'N0X',
  'N0C': 'N0C',
  'N0K': 'N0K',
  'N0H': 'N0H',
};

/** Get the NCEP OpenGeo WMS URL for a single site (super-resolution Level II) */
export function getNcepWmsUrl(siteId: string): string {
  const site = siteId.toLowerCase();
  return `https://opengeo.ncep.noaa.gov/geoserver/${site}/wms`;
}

/** Get the NCEP WMS layer name for a product */
export function getNcepLayerName(siteId: string, product: RadarProductId): string {
  const site = siteId.toLowerCase();
  // Map our product IDs to NCEP layer suffixes
  const layerMap: Partial<Record<RadarProductId, string>> = {
    'N0B': 'sr_bref',
    'N0G': 'sr_bref',
    'N0S': 'sr_bvel',
    'N0X': 'sr_bref',
    'N0C': 'sr_bref',
    'N0K': 'sr_bref',
    'N0H': 'sr_bref',
  };
  const suffix = layerMap[product] ?? 'sr_bref';
  return `${site}:${site}_${suffix}`;
}

/** Get the IEM RIDGE WMS URL for a single site (fallback) */
export function getRidgeWmsUrl(): string {
  return 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/ridge.cgi';
}

/** Get the IEM RIDGE tile URL for a single site */
export function getRidgeTileUrl(siteId: string, product: RadarProductId, timestamp?: string): string {
  const site = iemSiteId(siteId);
  const ridge = PRODUCT_TO_RIDGE[product] ?? 'N0B';
  const timePart = timestamp ?? '0'; // 0 = current
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${site}-${ridge}-${timePart}/{z}/{x}/{y}.png`;
}

/**
 * Fetch available radar scan timestamps from IEM.
 * Returns the last `count` scans for the given site/product.
 */
export async function fetchRadarFrames(siteId: string, count: number = 10, product: RadarProductId = 'N0B'): Promise<RadarFrame[]> {
  const site = iemSiteId(siteId);
  const ridge = PRODUCT_TO_RIDGE[product] ?? 'N0B';

  // Query last 2 hours of scans
  const end = new Date();
  const start = new Date(end.getTime() - 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/\.\d+Z$/, 'Z');
  const url = `https://mesonet.agron.iastate.edu/json/radar.py?operation=list&radar=${site}&product=${ridge}&start=${fmt(start)}&end=${fmt(end)}`;

  try {
    const res = await fetchWithRetry(url, {}, 2);
    const data = await res.json();
    const scans: { ts: string }[] = data.scans ?? [];

    // Take the last N scans
    const recent = scans.slice(-count);

    return recent.map(s => {
      // ts format: "2026-05-05T15:22Z" -> "202605051522"
      const clean = s.ts.replace(/[-T:Z]/g, '').slice(0, 12);
      return {
        url: clean,
        timestamp: s.ts,
        product,
      };
    });
  } catch (err) {
    console.error(`[wxhq] Failed to fetch IEM radar frames for ${siteId}/${product}:`, err);
    return [];
  }
}

/** Minutes-ago values for mosaic history layers: 5, 10, 15, ... 55 */
export const MOSAIC_MINUTES_AGO = [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0] as const;

export function getMosaicTileUrl(minutesAgo: number = 0): string {
  if (minutesAgo === 0) {
    return 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png';
  }
  const mm = String(minutesAgo).padStart(2, '0');
  return `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-m${mm}m-900913/{z}/{x}/{y}.png`;
}
