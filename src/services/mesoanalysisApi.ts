import { contours } from 'd3-contour';
import { reportError } from './errorBus';
import {
  getMesoProduct,
  type MesoProduct,
  type MesoVariable,
} from '../types/mesoanalysis';

/**
 * Dynamically builds vector mesoanalysis fields (CAPE, CIN, shear, …) from
 * Open-Meteo point data:
 *
 *   1. Sample a regular CONUS lat/lon mesh (GRID_NLAT × GRID_NLON).
 *   2. POST the mesh to Open-Meteo (≤1000 points/request, so we tile it).
 *   3. Select the model hour nearest "now", reduce each point to the product's
 *      scalar (e.g. CAPE, or computed bulk shear).
 *   4. Contour the scalar grid with d3-contour → polygons in grid-index space.
 *   5. Transform grid indices → lat/lon → GeoJSON [lon, lat] for Leaflet.
 *
 * Open-Meteo is CORS-enabled and key-less, so this runs entirely client-side.
 * Backed by HRRR (3 km, CONUS) / GFS; we use gfs_seamless for uniform CONUS
 * coverage without the HRRR-domain edge fallback surprises.
 */

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

/** Open-Meteo hard cap is 1000 locations per POST. Stay safely under it. */
const MAX_POINTS_PER_REQUEST = 950;

/** CONUS sampling box. Slightly inset from absolute extremes to keep the mesh
 *  over land/coastal waters where the model is meaningful. */
const BOUNDS = { latMin: 24.5, latMax: 50.0, lonMin: -125.0, lonMax: -66.5 };

/**
 * Mesh resolution. 24×39 = 936 points fits in a single POST (cap 1000),
 * ~0.65° spacing, ~1.5 s. This is a synoptic/meso-alpha view (comparable to
 * SPC's coarser fields), not a 3 km rendering — fine for the contoured overlay
 * and keeps each product to one request to respect the rate limit.
 */
const GRID_NLAT = 24;
const GRID_NLON = 39;

/** Thrown when Open-Meteo returns HTTP 429 so callers can back off globally. */
class RateLimitError extends Error {
  constructor() {
    super('Open-Meteo rate limit (429)');
    this.name = 'RateLimitError';
  }
}

/** After a 429 we stop issuing requests for this long and serve stale cache. */
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;

export interface MesoField {
  productId: string;
  /** Model valid time (UTC ISO) for the contoured hour. */
  validTime: string;
  /** Styled GeoJSON: one Feature per filled contour band. */
  geojson: GeoJSON.FeatureCollection;
}

interface OpenMeteoPoint {
  latitude: number;
  longitude: number;
  hourly: Record<string, Array<number | null>> & { time: string[] };
}

/** Build the ascending lat / lon axes of the sampling mesh. */
function buildAxes(): { lats: number[]; lons: number[] } {
  const lats: number[] = [];
  const lons: number[] = [];
  for (let i = 0; i < GRID_NLAT; i++) {
    lats.push(BOUNDS.latMin + ((BOUNDS.latMax - BOUNDS.latMin) * i) / (GRID_NLAT - 1));
  }
  for (let j = 0; j < GRID_NLON; j++) {
    lons.push(BOUNDS.lonMin + ((BOUNDS.lonMax - BOUNDS.lonMin) * j) / (GRID_NLON - 1));
  }
  return { lats, lons };
}

/** Chunk the flat point list to respect Open-Meteo's per-request cap. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** POST one batch of points and return Open-Meteo's per-point array. */
async function fetchBatch(
  lat: number[],
  lon: number[],
  variables: MesoVariable[],
): Promise<OpenMeteoPoint[]> {
  const body = JSON.stringify({
    latitude: lat,
    longitude: lon,
    hourly: variables,
    models: ['gfs_seamless'],
    forecast_days: 1,
    // Explicit UTC so hourly.time is deterministic across the user's TZ.
    // In the POST/JSON API, timezone (like models) must be an array.
    timezone: ['GMT'],
  });

  const res = await fetch(OPEN_METEO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (res.status === 429) {
    // Rate limited — signal the caller to back off (handled in fetchMesoField).
    throw new RateLimitError();
  }
  if (!res.ok) throw new Error(`Open-Meteo ${res.status} ${res.statusText}`);

  const json = (await res.json()) as OpenMeteoPoint[] | { error: boolean; reason: string };
  if (!Array.isArray(json)) {
    throw new Error(`Open-Meteo error: ${(json as { reason?: string }).reason ?? 'unknown'}`);
  }
  return json;
}

/** Find the index of the hour nearest "now" in an ISO time array (UTC). */
function nearestHourIndex(times: string[]): number {
  const now = Date.now();
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < times.length; i++) {
    // Open-Meteo GMT times have no zone suffix; treat as UTC.
    const t = Date.parse(`${times[i]}:00Z`);
    const diff = Math.abs(t - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/**
 * Build (fetch + contour) one mesoanalysis product into styled GeoJSON.
 * Returns null if the field could not be built (network error, empty data).
 * This is the uncached worker; callers should use {@link fetchMesoField}.
 */
async function buildMesoField(productId: string): Promise<MesoField | null> {
  const product = getMesoProduct(productId);
  const { lats, lons } = buildAxes();

  // Flatten the mesh row-major (row = lat, col = lon) so grid index maps cleanly.
  const flatLat: number[] = [];
  const flatLon: number[] = [];
  for (let i = 0; i < lats.length; i++) {
    for (let j = 0; j < lons.length; j++) {
      flatLat.push(Number(lats[i].toFixed(4)));
      flatLon.push(Number(lons[j].toFixed(4)));
    }
  }

  // Tile the request to stay under the per-POST cap, preserving order.
  const latChunks = chunk(flatLat, MAX_POINTS_PER_REQUEST);
  const lonChunks = chunk(flatLon, MAX_POINTS_PER_REQUEST);
  const batches = await Promise.all(
    latChunks.map((lc, idx) => fetchBatch(lc, lonChunks[idx], product.variables)),
  );
  const points = batches.flat();

  if (points.length === 0 || !points[0]?.hourly?.time?.length) {
    return null;
  }

  const hourIdx = nearestHourIndex(points[0].hourly.time);
  const validTime = `${points[0].hourly.time[hourIdx]}:00Z`;

  // Reduce each point to the product scalar, in mesh order.
  const values = buildValueGrid(points, product, hourIdx);

  const geojson = contourToGeoJSON(values, lats, lons, product);
  return { productId, validTime, geojson };
}

interface CacheEntry {
  /** The model hour key (UTC, e.g. "2026-06-11T18") this field is valid for. */
  hourKey: string;
  field: MesoField;
}

/** Cached fields per product, plus in-flight promises for dedup. */
const fieldCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<MesoField | null>>();
/** Epoch ms until which we suppress requests after a 429. */
let cooldownUntil = 0;

/** Current model-hour bucket key in UTC (data refreshes hourly). */
function currentHourKey(): string {
  return new Date().toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
}

/**
 * Public entry point: fetch + contour a mesoanalysis product, with caching and
 * rate-limit protection. Open-Meteo throttles aggressively, so:
 *
 *   - Results are cached for the current UTC hour. A second request within the
 *     same hour (another pane, a toggle, the 30-min refresh) is served from
 *     cache with no network call.
 *   - Concurrent requests for the same product share one in-flight promise, so
 *     N panes mounting at once issue a single POST, not N.
 *   - On HTTP 429 we enter a cooldown and serve any stale cached field rather
 *     than hammering the API.
 *
 * Returns null only when there is no cache and the network attempt failed.
 */
export async function fetchMesoField(productId: string): Promise<MesoField | null> {
  const hourKey = currentHourKey();
  const cached = fieldCache.get(productId);

  // Fresh cache for this hour — no network needed.
  if (cached && cached.hourKey === hourKey) return cached.field;

  // Within a rate-limit cooldown: serve stale cache (if any) instead of calling.
  if (Date.now() < cooldownUntil) return cached?.field ?? null;

  // Coalesce concurrent callers onto one request.
  const existing = inFlight.get(productId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const field = await buildMesoField(productId);
      if (field) fieldCache.set(productId, { hourKey, field });
      return field ?? cached?.field ?? null;
    } catch (err) {
      if (err instanceof RateLimitError) {
        cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        reportError({
          source: 'Open-Meteo',
          message: 'Mesoanalysis rate-limited; pausing updates',
          detail: `Backing off ${RATE_LIMIT_COOLDOWN_MS / 60000} min. Serving last data if available.`,
          severity: 'warning',
        });
      } else {
        reportError({
          source: 'Open-Meteo',
          message: 'Mesoanalysis fetch failed',
          detail: `${getMesoProduct(productId).name} — ${err instanceof Error ? err.message : String(err)}`,
          severity: 'warning',
        });
      }
      // Fall back to stale cache on any failure.
      return cached?.field ?? null;
    } finally {
      inFlight.delete(productId);
    }
  })();

  inFlight.set(productId, promise);
  return promise;
}

/** Reduce the per-point variable arrays at `hourIdx` to a flat scalar grid. */
function buildValueGrid(points: OpenMeteoPoint[], product: MesoProduct, hourIdx: number): number[] {
  return points.map((pt) => {
    const vars = {} as Record<MesoVariable, number>;
    for (const v of product.variables) {
      const series = pt.hourly[v];
      const raw = series ? series[hourIdx] : null;
      vars[v] = raw == null ? NaN : raw;
    }
    const val = product.value(vars);
    // d3-contour cannot handle NaN/Inf; treat gaps as 0 (below all thresholds).
    return Number.isFinite(val) ? val : 0;
  });
}

/**
 * Run d3-contour on the scalar grid and convert the resulting MultiPolygons
 * (in grid-index coordinates) to lat/lon GeoJSON suitable for Leaflet, styling
 * each band by the product's color ramp.
 *
 * d3-contour x ∈ [0, nLon-1], y ∈ [0, nLat-1]. We map:
 *   lon = lons[0] + (lons[last]-lons[0]) * x/(nLon-1)
 *   lat = lats[0] + (lats[last]-lats[0]) * y/(nLat-1)
 */
function contourToGeoJSON(
  values: number[],
  lats: number[],
  lons: number[],
  product: MesoProduct,
): GeoJSON.FeatureCollection {
  const nLat = lats.length;
  const nLon = lons.length;

  const lonSpan = lons[nLon - 1] - lons[0];
  const latSpan = lats[nLat - 1] - lats[0];
  const toLon = (x: number) => lons[0] + (lonSpan * x) / (nLon - 1);
  const toLat = (y: number) => lats[0] + (latSpan * y) / (nLat - 1);

  const generator = contours()
    .size([nLon, nLat])
    .thresholds(product.thresholds);

  const polys = generator(values);

  const features: GeoJSON.Feature[] = [];
  polys.forEach((mp, bandIdx) => {
    if (!mp.coordinates.length) return;
    const color = product.colors[bandIdx] ?? product.colors[product.colors.length - 1];

    // Transform every ring vertex from grid space to [lon, lat].
    const coordinates = mp.coordinates.map((polygon) =>
      polygon.map((ring) => ring.map(([x, y]) => [toLon(x), toLat(y)] as [number, number])),
    );

    features.push({
      type: 'Feature',
      properties: {
        product: product.id,
        threshold: mp.value,
        color,
        label: `${product.name} ≥ ${mp.value} ${product.units}`,
      },
      geometry: { type: 'MultiPolygon', coordinates },
    });
  });

  return { type: 'FeatureCollection', features };
}
