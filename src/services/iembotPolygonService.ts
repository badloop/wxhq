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

// Human-readable event names for VTEC phenomena+significance combos
const vtecEventNames: Record<string, Record<string, string>> = {
  TO: { W: 'Tornado Warning', A: 'Tornado Watch' },
  SV: { W: 'Severe Thunderstorm Warning', A: 'Severe Thunderstorm Watch' },
  FF: { W: 'Flash Flood Warning', A: 'Flash Flood Watch' },
  FL: { W: 'Flood Warning', A: 'Flood Watch', Y: 'Flood Advisory' },
  FA: { W: 'Areal Flood Warning', Y: 'Areal Flood Advisory' },
  MA: { W: 'Special Marine Warning' },
  SC: { Y: 'Small Craft Advisory' },
  EW: { W: 'Extreme Wind Warning' },
  BZ: { W: 'Blizzard Warning', A: 'Blizzard Watch' },
  WS: { W: 'Winter Storm Warning', A: 'Winter Storm Watch' },
  IS: { W: 'Ice Storm Warning' },
  WW: { Y: 'Winter Weather Advisory' },
  HU: { W: 'Hurricane Warning', A: 'Hurricane Watch' },
  TR: { W: 'Tropical Storm Warning', A: 'Tropical Storm Watch' },
  FG: { Y: 'Dense Fog Advisory' },
  HW: { W: 'High Wind Warning', A: 'High Wind Watch' },
  WI: { Y: 'Wind Advisory' },
  HT: { Y: 'Heat Advisory', W: 'Excessive Heat Warning' },
  EH: { W: 'Excessive Heat Warning', A: 'Excessive Heat Watch' },
  FW: { W: 'Red Flag Warning', A: 'Fire Weather Watch' },
  SE: { A: 'Hazardous Seas Watch', W: 'Hazardous Seas Warning' },
  CF: { W: 'Coastal Flood Warning', A: 'Coastal Flood Watch', Y: 'Coastal Flood Advisory' },
  SU: { W: 'High Surf Warning', Y: 'High Surf Advisory' },
  TS: { Y: 'Tsunami Advisory', W: 'Tsunami Warning', A: 'Tsunami Watch' },
};

/**
 * Fetch VTEC polygon from IEM GeoJSON API.
 * Works for warnings (W) and advisories (Y) — returns county/zone or storm-based polygons.
 * Watches (A) from SPC typically return 0 features per-WFO (issued nationally, not per-WFO).
 */
async function fetchVTECPolygon(messageHtml: string): Promise<IEMBotPolygon | null> {
  // Extract IEM VTEC URL: /vtec/f/YYYY-O-ACTION-KWFO-PH-SIG-ETN_timestamp
  const vtecMatch = messageHtml.match(
    /href='https:\/\/mesonet\.agron\.iastate\.edu\/vtec\/f\/(\d{4})-O-(\w+)-K(\w{3})-(\w{2})-(\w)-(\d{4})/
  );
  if (!vtecMatch) return null;

  const [, year, , wfo, phenomena, significance, etn] = vtecMatch;
  const id = `vtec-${wfo}-${phenomena}-${significance}-${etn}`;
  const etnNum = parseInt(etn, 10);

  const iemUrl = `https://mesonet.agron.iastate.edu/vtec/#${year}-O-NEW-K${wfo}-${phenomena}-${significance}-${etn}`;

  try {
    // IEM GeoJSON API: sbw=0 returns county/zone polygons (needed for watches/advisories),
    // sbw=1 returns storm-based warning polygons. Use sbw=0 for everything to get geometry.
    const apiUrl = `https://mesonet.agron.iastate.edu/geojson/vtec_event.py?wfo=${wfo}&year=${year}&phenomena=${phenomena}&significance=${significance}&etn=${etnNum}&sbw=0&lsrs=0`;
    const res = await fetchWithRetry(apiUrl, {}, 1);
    const data = await res.json();

    if (!data.features?.length) {
      console.warn(`[wxhq] IEM returned 0 features for VTEC ${id}`);
      return null;
    }

    // Convert each feature's outer ring to Leaflet [lat, lon] format
    const rings: [number, number][][] = [];
    for (const feature of data.features) {
      const geom = feature.geometry;
      if (!geom?.coordinates) continue;
      for (const polygon of geom.coordinates) {
        const outerRing = polygon[0] as [number, number][];
        const leafletRing = closeRing(
          outerRing.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number])
        );
        rings.push(leafletRing);
      }
    }

    if (rings.length === 0) return null;

    const eventName = vtecEventNames[phenomena]?.[significance] || `${phenomena}.${significance}`;
    const label = `${wfo} ${eventName}`;

    return {
      id,
      // Single ring: flatten for backward compat; multi-ring: keep as array of rings
      coordinates: rings.length === 1 ? rings[0] : rings,
      label,
      concerning: data.features[0]?.properties?.headline || eventName,
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
