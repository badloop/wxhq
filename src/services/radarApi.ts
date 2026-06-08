import type { NexradSite, RadarFrame, RadarProductId } from '../types/radar';
import { fetchWithRetry } from './fetchClient';
import { reportError } from './errorBus';

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

/**
 * A radar is considered "unavailable" if no Level II data has been received
 * within this window. NEXRAD volume scans complete every ~4-10 min, so 30 min
 * of silence reliably indicates the site is down/offline. (Observed data shows
 * a clean gap: live sites are seconds-fresh while down sites are >60 min stale.)
 */
const RADAR_STALE_MS = 30 * 60 * 1000;

/**
 * Out-of-band radar availability check.
 *
 * Fetches live WSR-88D station status from the NWS API and returns a map of
 * `siteId -> available`. A site is available when its RDA is reporting and it
 * has received Level II data within {@link RADAR_STALE_MS}. This is purely
 * informational — it drives the site marker colour (blue = available, red =
 * unavailable) and never changes what happens when a site is clicked.
 *
 * Note: `operabilityStatus` is deliberately ignored — many stations report
 * "Maintenance Action Mandatory/Required" while still broadcasting data, so
 * Level II freshness is the only reliable up/down signal.
 */
export async function fetchRadarAvailability(): Promise<Record<string, boolean>> {
  const res = await fetchWithRetry('https://api.weather.gov/radar/stations?stationType=WSR-88D');
  const data = await res.json();
  const now = Date.now();
  const map: Record<string, boolean> = {};
  const features = (data.features ?? []) as Array<{
    properties?: {
      id?: string;
      rda?: unknown;
      latency?: { levelTwoLastReceivedTime?: string };
    };
  }>;
  for (const f of features) {
    const p = f.properties ?? {};
    const id = p.id;
    if (!id) continue;
    const last = p.latency?.levelTwoLastReceivedTime;
    const lastMs = last ? Date.parse(last) : NaN;
    const fresh = Number.isFinite(lastMs) && now - lastMs < RADAR_STALE_MS;
    map[id] = Boolean(p.rda) && fresh;
  }
  return map;
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

/** Get the NCEP OpenGeo WMS URL for a single site (super-resolution Level II).
 *
 * This GeoServer endpoint also advertises a WMS TIME dimension (~2 hours of
 * volume scans, with `nearestValue="1"` snapping), so the *same* high-resolution
 * source powers both the live view and the animation frames — see
 * `SingleSiteRadar` / `TrackedWMSTileLayer`. Pass `&TIME=<iso8601>` on the GetMap
 * request to fetch a historical scan.
 */
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

/** Get the IEM RIDGE tile URL for a single site.
 *
 * NOTE: low-resolution fallback only (cached tiles capped at native zoom 8).
 * Single-site animation now uses the super-resolution NCEP WMS TIME dimension
 * (`getNcepWmsUrl` + `getNcepLayerName`); this is kept for fallback/reference.
 */
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
    reportError({
      source: 'Radar',
      message: `Could not load radar animation frames for ${siteId} (${product})`,
      detail: err instanceof Error ? err.message : String(err),
      severity: 'warning',
    });
    return [];
  }
}

/**
 * Fetch the authoritative list of volume-scan times for a single site directly
 * from the NCEP OpenGeo WMS GetCapabilities `time` dimension.
 *
 * This is the same super-resolution source used for the live view and the
 * animation frames, and the `time` dimension lists *every* scan the GeoServer
 * retains (~2 hours, typically 20+ scans). The IEM `radar.py` list endpoint, by
 * contrast, only reports scans inside a narrow `now`-anchored 2-hour window, so
 * an idle radar (latest scan older than `now`) returns just a handful of frames
 * — which is why "set 10, see 2-3" happened. Sourcing the times from NCEP fixes
 * both the frame-count shortfall and the resulting choppy/"rocking" loop.
 *
 * Frames come back oldest → newest; the last `count` are returned.
 */
export async function fetchNcepFrameTimes(
  siteId: string,
  count: number = 10,
  product: RadarProductId = 'N0B',
): Promise<RadarFrame[]> {
  const capsUrl = `${getNcepWmsUrl(siteId)}?service=WMS&version=1.3.0&request=GetCapabilities`;
  // Capabilities advertises each layer's <Name> *without* the workspace prefix
  // (e.g. "kvwx_sr_bref"), while GetMap wants the prefixed form
  // ("kvwx:kvwx_sr_bref"). Match on the bare name.
  const fullLayer = getNcepLayerName(siteId, product);
  const bareLayer = fullLayer.includes(':')
    ? fullLayer.slice(fullLayer.indexOf(':') + 1)
    : fullLayer;

  const res = await fetchWithRetry(capsUrl, {}, 2);
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Malformed NCEP WMS capabilities XML');
  }

  // Locate the <Layer> whose direct <Name> child matches our bare layer name,
  // then read its time <Dimension>. Namespace-agnostic lookups because the
  // capabilities document declares a default xmlns (http://www.opengis.net/wms).
  const layers = Array.from(doc.getElementsByTagNameNS('*', 'Layer'));
  const layer = layers.find(l =>
    Array.from(l.children).some(
      c => c.localName === 'Name' && c.textContent?.trim() === bareLayer,
    ),
  );
  const dim = layer
    ? Array.from(layer.getElementsByTagNameNS('*', 'Dimension')).find(
        d => (d.getAttribute('name') ?? '').toLowerCase() === 'time',
      )
    : undefined;

  const times = (dim?.textContent ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  if (times.length === 0) return [];

  // `timestamp` is what gets passed to the WMS TIME dimension on each frame
  // (see SingleSiteRadar / TrackedWMSTileLayer); `url` is unused for WMS frames.
  return times.slice(-count).map(t => ({ url: t, timestamp: t, product }));
}

/**
 * Fetch single-site animation frames, preferring the high-resolution NCEP WMS
 * `time` dimension (the authoritative scan list) and falling back to the IEM
 * RIDGE `radar.py` list endpoint only if NCEP returns nothing or errors.
 */
export async function fetchSingleSiteFrames(
  siteId: string,
  count: number = 10,
  product: RadarProductId = 'N0B',
): Promise<RadarFrame[]> {
  try {
    const ncep = await fetchNcepFrameTimes(siteId, count, product);
    if (ncep.length > 0) return ncep;
    console.warn(`[wxhq] NCEP advertised no scan times for ${siteId}/${product}; falling back to IEM`);
  } catch (err) {
    console.warn(`[wxhq] NCEP frame times failed for ${siteId}/${product}; falling back to IEM:`, err);
  }
  // fetchRadarFrames does its own error reporting / returns [] on failure.
  return fetchRadarFrames(siteId, count, product);
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
