/**
 * SPC-style mesoanalysis parameters rendered as dynamically-contoured vector
 * overlays. Unlike SPC's pre-rendered Lambert-Conformal GIFs, these fields are
 * built in the browser: we sample a regular CONUS lat/lon mesh from Open-Meteo
 * (HRRR/GFS-backed, CORS-friendly, no API key), contour the resulting value
 * grid with d3-contour, and emit GeoJSON polygons. See mesoanalysisApi.ts.
 *
 * Each product declares:
 *   - the Open-Meteo `hourly` variables it needs,
 *   - how to reduce those variables to a single scalar per grid point,
 *   - the contour thresholds (filled bands) and a SPC-like color ramp.
 */

/** Open-Meteo hourly variable names this app may request. */
export type MesoVariable =
  | 'cape'
  | 'convective_inhibition'
  | 'lifted_index'
  | 'wind_speed_10m'
  | 'wind_direction_10m'
  | 'wind_speed_850hPa'
  | 'wind_direction_850hPa'
  | 'wind_speed_500hPa'
  | 'wind_direction_500hPa';

/**
 * How to turn the per-point variable arrays (already reduced to the chosen
 * hour) into the scalar that gets contoured. `vars` maps each requested
 * variable to its value at this point/hour; missing values are NaN.
 */
export type MesoValueFn = (vars: Record<MesoVariable, number>) => number;

export interface MesoProduct {
  id: string;
  /** Short label for the dropdown. */
  name: string;
  /** Longer description shown as a tooltip / legend subtitle. */
  description: string;
  /** Units label shown in the legend (e.g. "J/kg", "kt"). */
  units: string;
  /** Open-Meteo hourly variables required to compute this product. */
  variables: MesoVariable[];
  /** Reduce the point's variables to the contoured scalar. */
  value: MesoValueFn;
  /**
   * Ascending contour thresholds. d3-contour produces one filled polygon per
   * threshold (area >= threshold). Pair 1:1 with `colors` (colors[i] fills the
   * band starting at thresholds[i]).
   */
  thresholds: number[];
  /** Hex fill colors, one per threshold (ascending = increasing intensity). */
  colors: string[];
}

const KMH_TO_KT = 0.539957;

/** Vector magnitude (kt) of the difference between two wind layers given as
 *  speed (km/h) + meteorological direction (deg, "from"). This is the standard
 *  "bulk shear" between two levels used in convective forecasting. */
function bulkShearKt(
  spdLoKmh: number,
  dirLo: number,
  spdHiKmh: number,
  dirHi: number,
): number {
  if ([spdLoKmh, dirLo, spdHiKmh, dirHi].some((v) => Number.isNaN(v))) return NaN;
  // Meteorological "from" direction -> math vector the wind blows TOWARD.
  const toRad = (d: number) => ((270 - d) * Math.PI) / 180;
  const uLo = spdLoKmh * Math.cos(toRad(dirLo));
  const vLo = spdLoKmh * Math.sin(toRad(dirLo));
  const uHi = spdHiKmh * Math.cos(toRad(dirHi));
  const vHi = spdHiKmh * Math.sin(toRad(dirHi));
  const du = uHi - uLo;
  const dv = vHi - vLo;
  return Math.hypot(du, dv) * KMH_TO_KT;
}

/**
 * SPC-flavored sequential ramps. Kept short (5–6 bands) so the contoured map
 * reads cleanly and the legend stays compact. Low values are cool/transparent-
 * feeling, high values hot.
 */
const CAPE_COLORS = ['#2b3a67', '#3d7a3d', '#cfd43a', '#e89b1d', '#d6391f', '#b51a8c'];
const CAPE_THRESHOLDS = [250, 500, 1000, 2000, 3000, 4000];

// CIN is negative-energy (inhibition). We contour its magnitude; bigger = more
// capping. Ascending magnitude thresholds in J/kg.
const CIN_COLORS = ['#cfe8ff', '#7fb3e6', '#3d7ac4', '#274c8c', '#15264d'];
const CIN_THRESHOLDS = [25, 50, 100, 200, 400];

// Lifted Index: more negative = more unstable. We contour -LI so higher bands
// mean more instability (LI <= -2, -4, -6, -8, -10).
const LI_COLORS = ['#3d7a3d', '#cfd43a', '#e89b1d', '#d6391f', '#b51a8c'];
const LI_THRESHOLDS = [2, 4, 6, 8, 10];

const SHEAR_COLORS = ['#2b3a67', '#2f6f8f', '#3d9a6f', '#cfd43a', '#e89b1d', '#d6391f'];
const SHEAR_THRESHOLDS = [20, 30, 40, 50, 60, 75]; // knots

/**
 * The selectable mesoanalysis products. SRH (storm-relative helicity) is
 * intentionally absent: Open-Meteo does not expose it. The shear products below
 * are the closest kinematic proxies available without standing up a proxied
 * gridded-RAP pipeline.
 */
export const MESO_PRODUCTS: MesoProduct[] = [
  {
    id: 'sbcape',
    name: 'SB CAPE',
    description: 'Surface-based convective available potential energy',
    units: 'J/kg',
    variables: ['cape'],
    value: (v) => v.cape,
    thresholds: CAPE_THRESHOLDS,
    colors: CAPE_COLORS,
  },
  {
    id: 'cin',
    name: 'CIN',
    description: 'Convective inhibition (capping strength)',
    units: 'J/kg',
    variables: ['convective_inhibition'],
    // Open-Meteo reports CIN as a negative (or zero) value; contour magnitude.
    value: (v) => Math.abs(v.convective_inhibition),
    thresholds: CIN_THRESHOLDS,
    colors: CIN_COLORS,
  },
  {
    id: 'li',
    name: 'Lifted Index',
    description: 'Lifted index instability (more negative = more unstable)',
    units: '°C',
    variables: ['lifted_index'],
    // Contour -LI so larger bands = greater instability.
    value: (v) => -v.lifted_index,
    thresholds: LI_THRESHOLDS,
    colors: LI_COLORS,
  },
  {
    id: 'shear_0_6',
    name: '0–6 km Bulk Shear',
    description: 'Deep-layer bulk wind difference (10 m → 500 hPa)',
    units: 'kt',
    variables: ['wind_speed_10m', 'wind_direction_10m', 'wind_speed_500hPa', 'wind_direction_500hPa'],
    value: (v) =>
      bulkShearKt(v.wind_speed_10m, v.wind_direction_10m, v.wind_speed_500hPa, v.wind_direction_500hPa),
    thresholds: SHEAR_THRESHOLDS,
    colors: SHEAR_COLORS,
  },
  {
    id: 'shear_0_1',
    name: '0–1.5 km Bulk Shear',
    description: 'Low-level bulk wind difference (10 m → 850 hPa)',
    units: 'kt',
    variables: ['wind_speed_10m', 'wind_direction_10m', 'wind_speed_850hPa', 'wind_direction_850hPa'],
    value: (v) =>
      bulkShearKt(v.wind_speed_10m, v.wind_direction_10m, v.wind_speed_850hPa, v.wind_direction_850hPa),
    thresholds: [15, 20, 25, 30, 40],
    colors: ['#2b3a67', '#2f6f8f', '#3d9a6f', '#cfd43a', '#d6391f'],
  },
];

export type MesoProductId = (typeof MESO_PRODUCTS)[number]['id'];

export const DEFAULT_MESO_PRODUCT: MesoProductId = 'sbcape';

/** Look up a product by id, falling back to the default. */
export function getMesoProduct(id: string): MesoProduct {
  return MESO_PRODUCTS.find((p) => p.id === id) ?? MESO_PRODUCTS[0];
}

/** All distinct variables across the catalog (handy for tests / preflight). */
export const ALL_MESO_VARIABLES: MesoVariable[] = Array.from(
  new Set(MESO_PRODUCTS.flatMap((p) => p.variables)),
) as MesoVariable[];
