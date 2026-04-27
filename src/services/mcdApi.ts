import type { FeatureCollection, Feature, Polygon } from 'geojson';
import { fetchWithRetry } from './fetchClient';

const SPC_MD_INDEX = 'https://www.spc.noaa.gov/products/md/';

/**
 * Fetch active SPC Mesoscale Discussions and build a GeoJSON FeatureCollection
 * by scraping the active MD index page and each individual MD page for LAT...LON polygons.
 */
export async function fetchActiveMCDs(): Promise<FeatureCollection> {
  const features: Feature<Polygon>[] = [];

  try {
    // Step 1: Get the active MD page and extract MD numbers
    const indexRes = await fetchWithRetry(SPC_MD_INDEX);
    const indexHtml = await indexRes.text();
    const mdNumbers = [...indexHtml.matchAll(/md(\d+)\.html/g)].map(m => m[1]);
    const unique = [...new Set(mdNumbers)];

    // Step 2: Fetch each active MD page and parse LAT...LON polygon
    const results = await Promise.allSettled(
      unique.map(async (num) => {
        const url = `${SPC_MD_INDEX}md${num}.html`;
        const res = await fetchWithRetry(url, {}, 1);
        const html = await res.text();
        return { num, html };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { num, html } = result.value;

      const polygon = parseMCDPolygon(html);
      if (!polygon || polygon.length < 3) continue;

      // Close the ring if needed
      const ring = [...polygon];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([...first]);
      }

      // Extract metadata
      const validMatch = html.match(/Valid\s+(\d{6}Z)\s*-\s*(\d{6}Z)/i);
      const areasMatch = html.match(/Areas affected\.\.\.(.*)/i);
      const concernMatch = html.match(/Concerning\.\.\.(.*)/i);

      features.push({
        type: 'Feature',
        properties: {
          id: `MD${num}`,
          number: parseInt(num, 10),
          url: `https://www.spc.noaa.gov/products/md/md${num}.html`,
          valid_start: validMatch?.[1] || '',
          valid_end: validMatch?.[2] || '',
          areas: areasMatch?.[1]?.trim() || '',
          concerning: concernMatch?.[1]?.trim() || '',
          stroke: '#4444ff',
          fill: '#4444ff',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      });
    }
  } catch (err) {
    console.error('Failed to fetch active MCDs:', err);
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Parse a LAT...LON block from SPC MCD HTML.
 * Format: "LAT...LON  38119068 38389265 ..." where each 8-digit group
 * is 4-digit lat (hundredths) + 4-digit lon (hundredths, west negative).
 */
function parseMCDPolygon(html: string): [number, number][] | null {
  const lines = html.split('\n');
  let capture = false;
  const coordParts: string[] = [];

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped.includes('LAT...LON')) {
      capture = true;
      const after = stripped.split('LAT...LON')[1]?.trim();
      if (after) coordParts.push(after);
      continue;
    }
    if (capture) {
      if (stripped === '' || stripped.includes('<')) break;
      coordParts.push(stripped);
    }
  }

  if (coordParts.length === 0) return null;

  const raw = coordParts.join(' ');
  const allDigits = raw.replace(/\D/g, '');
  const pairs: [number, number][] = [];

  for (let i = 0; i <= allDigits.length - 8; i += 8) {
    const lat = parseInt(allDigits.slice(i, i + 4), 10) / 100;
    const lon = -(parseInt(allDigits.slice(i + 4, i + 8), 10) / 100);
    pairs.push([lon, lat]); // GeoJSON is [lon, lat]
  }

  return pairs;
}
