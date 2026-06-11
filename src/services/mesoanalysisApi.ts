import type { LatLngBoundsLiteral } from 'leaflet';
import { getMesoProduct } from '../types/mesoanalysis';

/**
 * SPC mesoanalysis raster overlays. SPC publishes each parameter as an hourly,
 * Lambert-Conformal GIF for the CONUS sector (s19):
 *
 *   https://www.spc.noaa.gov/exper/mesoanalysis/s19/{code}/{code}.gif
 *
 * These are CORS-enabled and key-less (no rate limit), with SPC's official
 * color scale baked in. We overlay them with an approximate lat/lon bounding
 * box; because the source is Lambert-Conformal and the map is Web Mercator,
 * the center aligns well while edges drift somewhat (an accepted trade for
 * avoiding a full map-CRS change).
 */

const SPC_SECTOR = 's19'; // CONUS

const SPC_BASE = `https://www.spc.noaa.gov/exper/mesoanalysis/${SPC_SECTOR}`;

/**
 * Best-fit lat/lon rectangle for the SPC CONUS (s19) image. Derived from the
 * image's Lambert-Conformal extent (std parallels 35/45, central lon −98°) by
 * matching the lat/lon of each edge midpoint, which minimizes drift for a
 * rectangular Web-Mercator overlay. [[south, west], [north, east]].
 */
export const SPC_CONUS_BOUNDS: LatLngBoundsLiteral = [
  [25.0, -126.41],
  [52.06, -69.59],
];

/** The published valid-time text file for the sector (e.g. "06/11/26 18 UTC"). */
const SFC_TIME_URL = `${SPC_BASE}/sfctime.txt`;

/** URL of a product's parameter GIF. `bust` forces a refetch when the hour rolls. */
export function mesoImageUrl(productId: string, bust?: string): string {
  const { code } = getMesoProduct(productId);
  const url = `${SPC_BASE}/${code}/${code}.gif`;
  return bust ? `${url}?t=${encodeURIComponent(bust)}` : url;
}

/**
 * Fetch SPC's current analysis valid time for cache-busting. Returns a compact
 * key (e.g. "061118") or a local hour fallback if the request fails. SPC images
 * update hourly, so this only needs to change once per hour.
 */
export async function fetchMesoValidTime(): Promise<string> {
  try {
    const res = await fetch(SFC_TIME_URL, { cache: 'no-store' });
    if (res.ok) {
      const text = (await res.text()).trim(); // "MM/DD/YY HH UTC"
      const m = text.match(/(\d{2})\/(\d{2})\/(\d{2})\s+(\d{2})/);
      if (m) return `${m[1]}${m[2]}${m[4]}`; // MMDDHH
    }
  } catch {
    // fall through to local-hour fallback
  }
  return new Date().toISOString().slice(0, 13).replace(/[-T]/g, '');
}
