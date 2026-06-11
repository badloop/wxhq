import { fetchWithRetry } from './fetchClient';
import { parseMCDPolygon } from './mcdApi';
import type { IEMBotPolygon } from '../context/AppReducer';

/** IEM raw NWS product text API — returns the exact issued product as text/plain. */
const NWSTEXT_API = 'https://mesonet.agron.iastate.edu/api/1/nwstext/';

/** A product id looks like "202606102058-KWNS-ACUS11-SWOMCD". */
const PID_RE = /^\d{12}-[A-Z0-9]{4}-[A-Z0-9]{6}-[A-Z0-9]{6}$/;

/**
 * Extract a polygon from an IEMBot message.
 *
 * Primary strategy: fetch the alert's own raw product text (which carries the
 * LAT...LON block) using its product id, and translate those coordinates into
 * a shape. This works uniformly for SPC discussions (MCD) and VTEC storm-based
 * warnings (SVR/TOR/FFW), and — unlike scraping the SPC web page — does not
 * depend on a secondary site publishing an HTML page first.
 *
 * Fallbacks (only if the text path yields no polygon):
 *   - SWOMCD  -> scrape the SPC mdXXXX.html page
 *   - VTEC    -> IEM vtec_event GeoJSON (county/zone geometry)
 *
 * Returns null if no polygon could be parsed by any path.
 */
export async function fetchPolygonFromMessage(
  messageHtml: string,
  productId: string,
): Promise<IEMBotPolygon | null> {
  const id = polygonIdForMessage(messageHtml, productId);
  if (!id) return null; // not a product we draw a shape for

  // 1. Primary: parse coordinates straight from the alert's raw text.
  if (PID_RE.test(productId)) {
    const fromText = await fetchPolygonFromProductText(productId, id, messageHtml);
    if (fromText) return fromText;
  }

  // 2. Fallbacks per product family.
  if (productId.includes('SWOMCD')) {
    return fetchMCDPolygon(messageHtml);
  }
  return fetchVTECPolygon(messageHtml);
}

/**
 * Compute the stable polygon id for a message. Must match extractPolygonId()
 * in AppReducer so dismissal removes the right shape. Returns null when the
 * message references no drawable product.
 */
export function polygonIdForMessage(messageHtml: string, productId: string): string | null {
  if (productId.includes('SWOMCD')) {
    const md = messageHtml.match(/md(\d+)\.html/);
    return md ? `mcd-${md[1]}` : null;
  }
  const vtec = messageHtml.match(
    /href='https:\/\/mesonet\.agron\.iastate\.edu\/vtec\/f\/\d{4}-O-\w+-K(\w{3})-(\w{2})-(\w)-(\d{4})/
  );
  if (vtec) {
    const [, wfo, phenomena, significance, etn] = vtec;
    return `vtec-${wfo}-${phenomena}-${significance}-${etn}`;
  }
  return null;
}

/**
 * Fetch the raw NWS product text for a product id and build a polygon from its
 * LAT...LON block. Metadata (label/concerning/discussion/areas) is derived from
 * the same text so the shape is fully self-describing without a second request.
 */
async function fetchPolygonFromProductText(
  productId: string,
  id: string,
  messageHtml: string,
): Promise<IEMBotPolygon | null> {
  const url = `${NWSTEXT_API}${encodeURIComponent(productId)}`;
  try {
    const res = await fetchWithRetry(url, {}, 2);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || !text.includes('LAT...LON')) return null;

    const polygon = parseMCDPolygon(text);
    if (!polygon || polygon.length < 3) return null;

    const ring = closeRing(polygon);
    const leafletCoords: [number, number][] = ring.map(([lon, lat]) => [lat, lon]);

    const isMCD = productId.includes('SWOMCD');
    if (isMCD) {
      const mdNum = (messageHtml.match(/md(\d+)\.html/) || [])[1] || id.replace('mcd-', '');
      const meta = parseMCDText(text);
      return {
        id,
        coordinates: leafletCoords,
        label: `MCD #${parseInt(mdNum, 10)}`,
        concerning: meta.concerning,
        url: `https://www.spc.noaa.gov/products/md/md${mdNum}.html`,
        timestamp: Date.now(),
        description: meta.description,
        areaDesc: meta.areaDesc,
      };
    }

    // VTEC warning: derive a friendly label + fields from the text.
    const meta = parseVTECText(text);
    return {
      id,
      coordinates: leafletCoords,
      label: meta.label || id,
      concerning: meta.concerning,
      url: `https://mesonet.agron.iastate.edu/p.php?pid=${encodeURIComponent(productId)}`,
      timestamp: Date.now(),
      description: meta.description,
      instruction: meta.instruction,
      areaDesc: meta.areaDesc,
      expires: meta.expires,
      wfo: meta.wfo,
    };
  } catch (err) {
    console.warn(`[wxhq] product-text polygon fetch failed for ${productId}:`, err);
    return null;
  }
}

/** Extract MCD metadata fields from raw SPC text. */
function parseMCDText(text: string): { concerning: string; description: string; areaDesc: string } {
  const concerning = (text.match(/Concerning\.\.\.(.*)/i)?.[1] || '').trim();

  const discMatch = text.match(/DISCUSSION\.\.\.([\s\S]*?)(?:\.\.[A-Z][a-z]+\/[A-Z]|ATTN\.\.\.|LAT\.\.\.LON)/);
  let description = discMatch?.[1]?.trim().replace(/\s+/g, ' ') || '';

  const wind = text.match(/MOST PROBABLE PEAK WIND GUST\.\.\.(.*)/);
  const hail = text.match(/MOST PROBABLE PEAK HAIL SIZE\.\.\.(.*)/);
  const extras: string[] = [];
  if (wind) extras.push(`Wind: ${wind[1].trim()}`);
  if (hail) extras.push(`Hail: ${hail[1].trim()}`);
  if (extras.length) description += `\n\n${extras.join(' | ')}`;

  const areas = (text.match(/Areas affected\.\.\.([\s\S]*?)(?:\n\s*\n|Concerning)/i)?.[1] || '')
    .trim()
    .replace(/\s+/g, ' ');
  const attn = (text.match(/ATTN\.\.\.WFO\.\.\.([\s\S]*?)(?:\n\s*\n|LAT)/)?.[1] || '')
    .trim()
    .replace(/\.\.\./g, ', ')
    .replace(/\s+/g, ' ');
  const areaDesc = areas || (attn ? `WFOs: ${attn}` : '');

  return { concerning, description, areaDesc };
}

/** Extract VTEC warning metadata fields from raw NWS text. */
function parseVTECText(text: string): {
  label: string;
  concerning: string;
  description: string;
  instruction: string;
  areaDesc: string;
  expires: string;
  wfo: string;
} {
  const lines = text.split('\n').map(l => l.trim());

  // Office line: e.g. "National Weather Service Paducah KY"
  const wfo = (text.match(/National Weather Service\s+(.+)/)?.[1] || '').trim();

  // Product headline (the warning type), e.g. "Severe Thunderstorm Warning".
  const label =
    lines.find(l => /\b(Warning|Watch|Advisory|Statement)\b/.test(l) && !/National Weather Service/.test(l)) ||
    '';

  // "* Until 630 PM CDT."
  const expires = (text.match(/\*\s*Until\s+(.+?)\./i)?.[1] || '').trim();

  // HAZARD / IMPACT / SOURCE lines summarize the threat.
  const hazard = (text.match(/HAZARD\.\.\.(.*)/)?.[1] || '').trim();
  const source = (text.match(/SOURCE\.\.\.(.*)/)?.[1] || '').trim();
  const impact = (text.match(/IMPACT\.\.\.(.*)/)?.[1] || '').trim();
  const concerning = hazard || label;

  // Affected area block after "Warning for..." up to the next blank line.
  const areaDesc = (text.match(/Warning for\.\.\.([\s\S]*?)\n\s*\n/i)?.[1] || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ');

  const descParts = [hazard && `Hazard: ${hazard}`, source && `Source: ${source}`, impact && `Impact: ${impact}`]
    .filter(Boolean);
  const description = descParts.join('\n');

  // Preparedness actions as instruction.
  const instruction = (text.match(/PRECAUTIONARY\/PREPAREDNESS ACTIONS\.\.\.([\s\S]*?)(?:&&|\$\$|LAT\.\.\.LON)/)?.[1] || '')
    .trim()
    .replace(/\s+/g, ' ');

  return { label, concerning, description, instruction, areaDesc, expires, wfo };
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

    // Extract discussion text between "DISCUSSION..." and "..Forecaster" or "ATTN" or "LAT...LON"
    const discussionMatch = html.match(/DISCUSSION\.\.\.([\s\S]*?)(?:\.\.[A-Z][a-z]+\/[A-Z]|ATTN\.\.\.|LAT\.\.\.LON)/);
    const discussion = discussionMatch?.[1]?.trim().replace(/\s+/g, ' ') || '';

    // Extract ATTN WFOs
    const attnMatch = html.match(/ATTN\.\.\.WFO\.\.\.(.*?)(?:\n\n|LAT)/s);
    const attn = attnMatch?.[1]?.trim().replace(/\.\.\./g, ', ').replace(/\s+/g, ' ') || '';

    // Extract peak wind/hail
    const windMatch = html.match(/MOST PROBABLE PEAK WIND GUST\.\.\.(.*)/);
    const hailMatch = html.match(/MOST PROBABLE PEAK HAIL SIZE\.\.\.(.*)/);
    const extras: string[] = [];
    if (windMatch) extras.push(`Wind: ${windMatch[1].trim()}`);
    if (hailMatch) extras.push(`Hail: ${hailMatch[1].trim()}`);

    return {
      id,
      coordinates: leafletCoords,
      label: `MCD #${parseInt(mdNum, 10)}`,
      concerning: concernMatch?.[1]?.trim() || '',
      url,
      timestamp: Date.now(),
      description: discussion + (extras.length ? `\n\n${extras.join(' | ')}` : ''),
      areaDesc: attn ? `WFOs: ${attn}` : '',
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
    const props = data.features[0]?.properties || {};

    return {
      id,
      // Single ring: flatten for backward compat; multi-ring: keep as array of rings
      coordinates: rings.length === 1 ? rings[0] : rings,
      label,
      concerning: props.headline || eventName,
      url: iemUrl,
      timestamp: Date.now(),
      description: props.product_text || props.description || '',
      instruction: props.instruction || '',
      areaDesc: props.areaDesc || props.area_desc || '',
      onset: props.onset || props.issue || '',
      expires: props.expires || props.expire || '',
      severity: props.severity || '',
      wfo,
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
