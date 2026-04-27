import { fetchWithRetry } from './fetchClient';
import { parseMCDPolygon } from './mcdApi';
import type { MCDPolygon } from '../context/AppReducer';

/**
 * Extract MCD URL from an IEMBot message HTML and fetch the polygon.
 * Returns null if no polygon could be parsed.
 */
export async function fetchMCDFromMessage(messageHtml: string): Promise<MCDPolygon | null> {
  // Extract SPC MCD URL from message
  const urlMatch = messageHtml.match(/href='(https:\/\/www\.spc\.noaa\.gov\/products\/md\/\d+\/md(\d+)\.html)'/);
  if (!urlMatch) return null;

  const url = urlMatch[1];
  const mdNum = urlMatch[2];
  const id = `MD${mdNum}`;

  try {
    const res = await fetchWithRetry(url, {}, 1);
    const html = await res.text();

    const polygon = parseMCDPolygon(html);
    if (!polygon || polygon.length < 3) return null;

    // Close the ring
    const ring = [...polygon];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first]);
    }

    // polygon is [lon, lat] (GeoJSON), convert to [lat, lng] for Leaflet
    const leafletCoords: [number, number][] = ring.map(([lon, lat]) => [lat, lon]);

    // Extract metadata
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
