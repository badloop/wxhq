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

      // Extract discussion text
      const discussionMatch = html.match(/DISCUSSION\.\.\.([\s\S]*?)(?:\.\.[A-Z][a-z]+\/[A-Z]|ATTN\.\.\.|LAT\.\.\.LON)/);
      const discussion = discussionMatch?.[1]?.trim().replace(/\s+/g, ' ') || '';

      // Extract ATTN WFOs
      const attnMatch = html.match(/ATTN\.\.\.WFO\.\.\.([\s\S]*?)(?:\n\s*\n|LAT)/);
      const attn = attnMatch?.[1]?.trim().replace(/\.\.\./g, ', ').replace(/\s+/g, ' ') || '';

      // Extract peak wind/hail
      const windMatch = html.match(/MOST PROBABLE PEAK WIND GUST\.\.\.(.*)/);
      const hailMatch = html.match(/MOST PROBABLE PEAK HAIL SIZE\.\.\.(.*)/);

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
          discussion,
          attn_wfos: attn,
          peak_wind: windMatch?.[1]?.trim() || '',
          peak_hail: hailMatch?.[1]?.trim() || '',
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
 * Parse a LAT...LON block from raw NWS product text (or HTML).
 *
 * Handles BOTH coordinate encodings used by NWS products:
 *
 *   1. SPC/WPC discussions (MCD, MPD): 8-digit packed groups, e.g.
 *        LAT...LON   44058790 44668619 ...
 *      Each group is 4-digit lat (hundredths) + 4-digit lon (hundredths, west).
 *
 *   2. VTEC storm-based warnings (SVR, TOR, FFW, SMW): space-separated
 *      4-digit tokens forming lat/lon PAIRS, e.g.
 *        LAT...LON 3819 8820 3809 8823 ...
 *      Each token is degrees*100; tokens alternate lat, lon (west).
 *
 * The block is terminated by the first line that is blank, begins an HTML
 * tag, or starts a following section. Critically, for warnings we must stop
 * at `TIME...MOT...LOC` — the coordinate on that line is the storm centroid,
 * NOT part of the polygon ring — and at the `$$`/`&&` product delimiters.
 *
 * Returns GeoJSON-order [lon, lat] pairs, or null if no block was found.
 */
export function parseMCDPolygon(text: string): [number, number][] | null {
  const lines = text.split('\n');
  let capture = false;
  const coordParts: string[] = [];

  for (const line of lines) {
    const stripped = line.trim();

    if (!capture) {
      if (stripped.includes('LAT...LON')) {
        capture = true;
        const after = stripped.split('LAT...LON')[1]?.trim();
        if (after) coordParts.push(after);
      }
      continue;
    }

    // Capturing continuation lines. Stop at any boundary marker.
    if (
      stripped === '' ||
      stripped.includes('<') ||
      stripped.startsWith('TIME...MOT...LOC') ||
      stripped.startsWith('$$') ||
      stripped.startsWith('&&') ||
      /^[A-Z][A-Z. ]*\.\.\./.test(stripped) // next "SECTION..." header
    ) {
      break;
    }
    coordParts.push(stripped);
  }

  if (coordParts.length === 0) return null;

  // Tokenize into numeric groups. The presence of 8-digit groups means the
  // packed MCD format; otherwise treat as space-separated 4-digit pairs.
  const tokens = coordParts.join(' ').trim().split(/\s+/).filter(t => /^\d+$/.test(t));
  if (tokens.length === 0) return null;

  const isPacked = tokens.some(t => t.length >= 8);
  const pairs: [number, number][] = [];

  if (isPacked) {
    // 8-digit packed: lat4 + lon4 per token.
    for (const tok of tokens) {
      if (tok.length < 8) continue;
      const lat = parseInt(tok.slice(0, 4), 10) / 100;
      const lon = -(parseInt(tok.slice(4, 8), 10) / 100);
      pairs.push([lon, lat]); // GeoJSON [lon, lat]
    }
  } else {
    // Space-separated 4-digit pairs: alternating lat, lon.
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      const lat = parseInt(tokens[i], 10) / 100;
      const lon = -(parseInt(tokens[i + 1], 10) / 100);
      pairs.push([lon, lat]); // GeoJSON [lon, lat]
    }
  }

  return pairs.length ? pairs : null;
}
