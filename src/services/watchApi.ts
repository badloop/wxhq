import type { FeatureCollection, Feature, MultiPolygon } from 'geojson';
import { fetchWithRetry } from './fetchClient';

/**
 * Fetch active NWS watches with county/zone polygon geometry.
 *
 * Strategy:
 * 1. Query NWS API for active watches (no geometry included)
 * 2. Parse VTEC strings to get unique WFO/phenomena/significance/ETN combos
 * 3. Fetch county polygons from IEM's vtec_event.py endpoint per WFO segment
 * 4. Merge into a single GeoJSON FeatureCollection with watch metadata
 */
export async function fetchActiveWatches(): Promise<FeatureCollection> {
  const features: Feature[] = [];

  try {
    // Step 1: Get active watches from NWS API
    const nwsUrl = 'https://api.weather.gov/alerts/active?event=Tornado%20Watch,Severe%20Thunderstorm%20Watch&status=actual';
    const res = await fetchWithRetry(nwsUrl, {}, 1);
    const data = await res.json();

    if (!data.features?.length) {
      return { type: 'FeatureCollection', features: [] };
    }

    // Step 2: Parse VTEC strings and group by unique watch (WFO + ETN combo)
    interface WatchSegment {
      wfo: string;
      phenomena: string;
      significance: string;
      etn: string;
      year: string;
      event: string;
      headline: string;
    }

    const segments: WatchSegment[] = [];
    const currentYear = new Date().getFullYear().toString();
    for (const f of data.features) {
      const vtecs: string[] = f.properties?.parameters?.VTEC || [];
      for (const v of vtecs) {
        // VTEC format: /O.ACTION.KWFO.PH.SIG.ETN.startZ-endZ/
        const m = v.match(/\/O\.\w+\.K(\w{3})\.(\w{2})\.(\w)\.(\d{4})\./);
        if (m) {
          segments.push({
            year: currentYear,
            wfo: m[1],
            phenomena: m[2],
            significance: m[3],
            etn: m[4],
            event: f.properties?.event || '',
            headline: f.properties?.headline || '',
          });
        }
      }
    }

    // Deduplicate — same WFO+phenomena+sig+ETN can appear multiple times
    const seen = new Set<string>();
    const uniqueSegments = segments.filter(s => {
      const key = `${s.wfo}-${s.phenomena}-${s.significance}-${s.etn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Step 3: Fetch county polygons from IEM for each WFO segment
    const results = await Promise.allSettled(
      uniqueSegments.map(async (seg) => {
        const etnNum = parseInt(seg.etn, 10);
        const url = `https://mesonet.agron.iastate.edu/geojson/vtec_event.py?wfo=${seg.wfo}&year=${seg.year}&phenomena=${seg.phenomena}&significance=${seg.significance}&etn=${etnNum}&sbw=0&lsrs=0`;
        const iemRes = await fetchWithRetry(url, {}, 1);
        const iemData = await iemRes.json();
        return { seg, iemData };
      })
    );

    // Step 4: Build features from IEM county polygons
    // Group by watch number (ETN + phenomena) so all WFO segments merge
    const watchGroups = new Map<string, { seg: WatchSegment; polygons: MultiPolygon['coordinates'] }>();

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { seg, iemData } = result.value;
      const watchKey = `${seg.phenomena}-${seg.significance}-${seg.etn}`;

      if (!watchGroups.has(watchKey)) {
        watchGroups.set(watchKey, { seg, polygons: [] });
      }
      const group = watchGroups.get(watchKey)!;

      for (const f of iemData.features || []) {
        if (f.geometry?.coordinates) {
          // MultiPolygon coordinates — push each polygon
          for (const poly of f.geometry.coordinates) {
            group.polygons.push(poly);
          }
        }
      }
    }

    // Build final features
    const watchColors: Record<string, string> = {
      'TO': '#ff0000',  // Tornado Watch — red
      'SV': '#ffa500',  // Severe Thunderstorm Watch — orange
    };

    for (const [, group] of watchGroups) {
      if (group.polygons.length === 0) continue;

      const { seg } = group;
      const color = watchColors[seg.phenomena] || '#ffff00';

      features.push({
        type: 'Feature',
        properties: {
          event: seg.event,
          headline: seg.headline,
          phenomena: seg.phenomena,
          significance: seg.significance,
          etn: seg.etn,
          stroke: color,
          fill: color,
        },
        geometry: {
          type: 'MultiPolygon',
          coordinates: group.polygons,
        },
      });
    }
  } catch (err) {
    console.error('[wxhq] Failed to fetch active watches:', err);
  }

  return { type: 'FeatureCollection', features };
}
