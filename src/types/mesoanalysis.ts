/**
 * SPC mesoanalysis parameters, rendered as georeferenced raster overlays of the
 * Storm Prediction Center's own hourly analysis graphics.
 *
 * SPC publishes these fields only as pre-rendered Lambert-Conformal GIFs (no
 * vector/gridded feed), but they are CORS-enabled, key-less, hourly, and carry
 * SPC's official color scales baked in. We overlay the CONUS-sector image with
 * an approximate lat/lon bounding box (see mesoanalysisApi / MesoanalysisLayer).
 *
 * Each product maps to an SPC parameter "code" — the path segment in
 * https://www.spc.noaa.gov/exper/mesoanalysis/s19/{code}/{code}.gif
 */

export interface MesoProduct {
  id: string;
  /** Short label for the toggle list. */
  name: string;
  /** SPC parameter code (URL path segment). */
  code: string;
  /** Longer description shown as a tooltip. */
  description: string;
}

/**
 * Curated set of the most useful SPC mesoanalysis parameters. Unlike the prior
 * Open-Meteo approach, this includes true storm-relative helicity (SRH), which
 * SPC computes directly. CIN is intentionally omitted — SPC has no standalone
 * CIN panel (it is folded into other composite products).
 */
export const MESO_PRODUCTS: MesoProduct[] = [
  { id: 'sbcp', name: 'SB CAPE', code: 'sbcp', description: 'Surface-based CAPE (J/kg)' },
  { id: 'mlcp', name: 'ML CAPE', code: 'mlcp', description: 'Mixed-layer (100 mb) CAPE (J/kg)' },
  { id: 'mucp', name: 'MU CAPE', code: 'mucp', description: 'Most-unstable CAPE (J/kg)' },
  { id: 'dcape', name: 'DCAPE', code: 'dcape', description: 'Downdraft CAPE (J/kg)' },
  { id: 'srh1', name: 'SRH 0–1 km', code: 'srh1', description: 'Storm-relative helicity, 0–1 km (m²/s²)' },
  { id: 'srh3', name: 'SRH 0–3 km', code: 'srh3', description: 'Storm-relative helicity, 0–3 km (m²/s²)' },
  { id: 'eshr', name: 'Eff. Bulk Shear', code: 'eshr', description: 'Effective bulk wind difference (kt)' },
  { id: 'shr6', name: '0–6 km Shear', code: 'shr6', description: 'Bulk wind difference, 0–6 km (kt)' },
  { id: 'shr1', name: '0–1 km Shear', code: 'shr1', description: 'Bulk wind difference, 0–1 km (kt)' },
  { id: 'laps', name: 'Mid Lapse Rate', code: 'laps', description: '700–500 mb lapse rate (°C/km)' },
  { id: 'lllr', name: 'Low Lapse Rate', code: 'lllr', description: '0–3 km lapse rate (°C/km)' },
  { id: 'scp', name: 'Supercell Comp.', code: 'scp', description: 'Supercell composite parameter' },
  { id: 'stpc', name: 'Sig. Tornado', code: 'stpc', description: 'Significant tornado parameter (effective layer)' },
  { id: 'ehi1', name: 'EHI 0–1 km', code: 'ehi1', description: 'Energy-helicity index, 0–1 km' },
  { id: 'pwtr', name: 'Precip. Water', code: 'pwtr', description: 'Precipitable water (in)' },
];

export type MesoProductId = (typeof MESO_PRODUCTS)[number]['id'];

/** Look up a product by id, falling back to the first. */
export function getMesoProduct(id: string): MesoProduct {
  return MESO_PRODUCTS.find((p) => p.id === id) ?? MESO_PRODUCTS[0];
}
