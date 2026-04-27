import { fetchWithRetry } from './fetchClient';
import { parseMCDPolygon } from './mcdApi';
import type { IEMBotPolygon } from '../context/AppReducer';

/**
 * Extract a polygon from an IEMBot message.
 * Handles:
 *   - SPC MCDs (SWOMCD) — fetches LAT...LON from SPC page
 *   - NWS VTEC warnings (SVR, TOR, etc.) — fetches polygon from NWS API
 * Returns null if no polygon could be parsed.
 */
export async function fetchPolygonFromMessage(
  messageHtml: string,
  productId: string,
): Promise<IEMBotPolygon | null> {
  // 1. Try SPC MCD
  if (productId.includes('SWOMCD')) {
    return fetchMCDPolygon(messageHtml);
  }

  // 2. Try NWS VTEC (SVR, TOR, FFW, etc.)
  const vtecResult = await fetchVTECPolygon(messageHtml);
  if (vtecResult) return vtecResult;

  return null;
}

/** Fetch MCD polygon from SPC page */
async function fetchMCDPolygon(messageHtml: string): Promise<IEMBotPolygon | null> {
  const urlMatch = messageHtml.match(/href='https:\/\/www\.spc\.noaa\.gov\/products\/md\/(?:\d+\/)?md(\d+)\.html'/);
  if (!urlMatch) return null;

  const mdNum = urlMatch[1];
  const url = `https://www.spc.noaa.gov/products/md/md${mdNum}.html`;
  const id = `mcd-${mdNum}`;

  try {
    const res = await fetchWithRetry(url, {}, 1);
    const html = await res.text();

    const polygon = parseMCDPolygon(html);
    if (!polygon || polygon.length < 3) return null;

    const ring = closeRing(polygon);
    const leafletCoords: [number, number][] = ring.map(([lon, lat]) => [lat, lon]);
    const concernMatch = html.match(/Concerning\.\.\.(.*)/i);

    return {
      id,
      coordinates: leafletCoords,
      label: `MCD #${parseInt(mdNum, 10)}`,
      concerning: concernMatch?.[1]?.trim() || '',
      url,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error(`[wxhq] Failed to fetch MCD polygon from ${url}:`, err);
    return null;
  }
}

// Cache the NWS active alerts response (refreshed at most every 30s)
let alertsCache: { data: any; fetchedAt: number } | null = null;
const ALERTS_CACHE_TTL = 30000;

async function getActiveAlerts(): Promise<any> {
  const now = Date.now();
  if (alertsCache && now - alertsCache.fetchedAt < ALERTS_CACHE_TTL) {
    return alertsCache.data;
  }
  const res = await fetchWithRetry('https://api.weather.gov/alerts/active?status=actual', {}, 1);
  const data = await res.json();
  alertsCache = { data, fetchedAt: now };
  return data;
}

/** Fetch VTEC warning polygon from NWS API */
async function fetchVTECPolygon(messageHtml: string): Promise<IEMBotPolygon | null> {
  // Extract IEM VTEC URL: /vtec/f/YYYY-O-ACTION-KWFO-PH-SIG-ETN_timestamp
  const vtecMatch = messageHtml.match(
    /href='https:\/\/mesonet\.agron\.iastate\.edu\/vtec\/f\/(\d{4})-O-(\w+)-K(\w{3})-(\w{2})-(\w)-(\d{4})/
  );
  if (!vtecMatch) return null;

  const [, , , wfo, phenomena, significance, etn] = vtecMatch;
  const id = `vtec-${wfo}-${phenomena}-${significance}-${etn}`;

  // Only warnings (significance W) have polygon geometry in NWS API.
  // Watches (A), advisories (Y), and statements (S) use county/zone areas without polygons.
  if (significance !== 'W') return null;

  // Build the IEM VTEC URL for reference
  const iemUrl = `https://mesonet.agron.iastate.edu/vtec/#${vtecMatch[0].split("'")[0].split('/vtec/f/')[1] || ''}`;

  try {
    // Query active alerts (cached) and search by VTEC string
    const data = await getActiveAlerts();

    // Match by WFO + phenomena + significance + ETN in the VTEC parameter
    const vtecPattern = `K${wfo}.${phenomena}.${significance}.${etn}`;
    const feature = data.features?.find((f: any) => {
      const vtecStrings: string[] = f.properties?.parameters?.VTEC || [];
      return vtecStrings.some((v: string) => v.includes(vtecPattern));
    });

    if (!feature?.geometry?.coordinates) {
      console.warn(`[wxhq] No NWS geometry found for VTEC ${id} (pattern: ${vtecPattern})`);
      return null;
    }

    const coords = feature.geometry.coordinates[0] as [number, number][];
    // NWS API returns [lon, lat], convert to [lat, lon] for Leaflet
    const leafletCoords: [number, number][] = coords.map(([lon, lat]) => [lat, lon]);

    const props = feature.properties;
    const label = `${wfo} ${props?.event || phenomena}`;

    return {
      id,
      coordinates: leafletCoords,
      label,
      concerning: props?.headline || props?.event || '',
      url: iemUrl,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error(`[wxhq] Failed to fetch VTEC polygon for ${id}:`, err);
    return null;
  }
}

/** Close a GeoJSON ring if not already closed */
function closeRing(coords: [number, number][]): [number, number][] {
  const ring = [...coords];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([...first] as [number, number]);
  }
  return ring;
}
