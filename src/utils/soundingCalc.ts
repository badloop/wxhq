import type { SoundingProfileLevel } from '../types/sounding';

/** Convert wind direction (degrees) and speed (knots) to u/v components */
export function windComponents(drct: number, sknt: number): { u: number; v: number } {
  const rad = (drct * Math.PI) / 180;
  return { u: -sknt * Math.sin(rad), v: -sknt * Math.cos(rad) };
}

/** Interpolate height to get wind at a specific height AGL */
function interpWindAtHeight(
  levels: SoundingProfileLevel[],
  targetHght: number,
  sfcHght: number
): { u: number; v: number } | null {
  const target = sfcHght + targetHght;
  for (let i = 0; i < levels.length - 1; i++) {
    if (levels[i].hght <= target && levels[i + 1].hght >= target) {
      const frac = (target - levels[i].hght) / (levels[i + 1].hght - levels[i].hght);
      const w0 = windComponents(levels[i].drct!, levels[i].sknt!);
      const w1 = windComponents(levels[i + 1].drct!, levels[i + 1].sknt!);
      return { u: w0.u + frac * (w1.u - w0.u), v: w0.v + frac * (w1.v - w0.v) };
    }
  }
  return null;
}

/** Filter levels to those with valid wind data */
function validWindLevels(levels: SoundingProfileLevel[]): SoundingProfileLevel[] {
  return levels.filter(l => l.drct != null && l.sknt != null && l.hght != null);
}

/** Filter levels to those with valid temp/dwpc data */
function validThermoLevels(levels: SoundingProfileLevel[]): SoundingProfileLevel[] {
  return levels.filter(l => l.tmpc != null && l.dwpc != null && l.hght != null && l.pres != null);
}

/** Approximate Bunkers right-moving storm motion */
export function calcBunkersMotion(levels: SoundingProfileLevel[]): { cx: number; cy: number } {
  const wl = validWindLevels(levels);
  if (wl.length < 2) return { cx: 0, cy: 0 };
  const sfcHght = wl[0].hght;
  const top = sfcHght + 6000;

  // Mean 0-6km wind
  let uSum = 0, vSum = 0, count = 0;
  for (const l of wl) {
    if (l.hght > top) break;
    const w = windComponents(l.drct!, l.sknt!);
    uSum += w.u;
    vSum += w.v;
    count++;
  }
  if (count === 0) return { cx: 0, cy: 0 };
  const uMean = uSum / count;
  const vMean = vSum / count;

  // 0-6km shear vector
  const sfc = windComponents(wl[0].drct!, wl[0].sknt!);
  const top6 = interpWindAtHeight(wl, 6000, sfcHght);
  if (!top6) return { cx: uMean, cy: vMean };

  const shearU = top6.u - sfc.u;
  const shearV = top6.v - sfc.v;
  const mag = Math.sqrt(shearU ** 2 + shearV ** 2);
  if (mag === 0) return { cx: uMean, cy: vMean };

  // Deviation: 7.5 m/s perpendicular to shear (right-moving)
  const D = 7.5 * 1.944; // convert m/s to knots
  const devU = (D * shearV) / mag;
  const devV = (-D * shearU) / mag;

  return { cx: uMean + devU, cy: vMean + devV };
}

/** Calculate storm-relative helicity for a given depth (meters AGL) */
export function calcSRH(
  levels: SoundingProfileLevel[],
  depthMeters: number,
  stormMotion: { cx: number; cy: number }
): number {
  const wl = validWindLevels(levels);
  if (wl.length < 2) return 0;
  const sfcHght = wl[0].hght;
  const top = sfcHght + depthMeters;
  const { cx, cy } = stormMotion;

  let srh = 0;
  for (let i = 0; i < wl.length - 1; i++) {
    if (wl[i].hght > top) break;
    const h1 = Math.min(wl[i + 1].hght, top);
    if (h1 < wl[i].hght) continue;

    const w0 = windComponents(wl[i].drct!, wl[i].sknt!);
    const w1 = windComponents(wl[i + 1].drct!, wl[i + 1].sknt!);
    srh += (w1.u - cx) * (w0.v - cy) - (w0.u - cx) * (w1.v - cy);
  }
  return srh;
}

/** Calculate 0-depthMeters bulk shear magnitude in knots */
export function calcBulkShear(levels: SoundingProfileLevel[], depthMeters: number): number {
  const wl = validWindLevels(levels);
  if (wl.length < 2) return 0;
  const sfcHght = wl[0].hght;
  const sfc = windComponents(wl[0].drct!, wl[0].sknt!);
  const topW = interpWindAtHeight(wl, depthMeters, sfcHght);
  if (!topW) return 0;
  return Math.sqrt((topW.u - sfc.u) ** 2 + (topW.v - sfc.v) ** 2);
}

/** Simplified CAPE/CIN/LCL calculation from profile data */
export function calcCAPE(levels: SoundingProfileLevel[]): { cape: number; cin: number; lcl: number } {
  const tl = validThermoLevels(levels);
  if (tl.length < 3) return { cape: 0, cin: 0, lcl: 0 };

  const sfcT = tl[0].tmpc!;
  const sfcTd = tl[0].dwpc!;
  const sfcHght = tl[0].hght;

  // LCL estimate: Espy formula
  const lclHght = 125 * (sfcT - sfcTd); // meters AGL

  // Lift parcel dry-adiabatically to LCL, then moist-adiabatically above
  const dryLapse = 9.8; // K/km
  const moistLapse = 6.0; // K/km (rough average)

  let cape = 0;
  let cin = 0;
  let foundLFC = false;

  for (let i = 1; i < tl.length; i++) {
    const hAgl = tl[i].hght - sfcHght;
    const envT = tl[i].tmpc!;

    let parcelT: number;
    if (hAgl <= lclHght) {
      parcelT = sfcT - (dryLapse * hAgl) / 1000;
    } else {
      const tAtLcl = sfcT - (dryLapse * lclHght) / 1000;
      parcelT = tAtLcl - (moistLapse * (hAgl - lclHght)) / 1000;
    }

    const buoyancy = (parcelT - envT) / (envT + 273.15);
    const dz = tl[i].hght - tl[i - 1].hght;

    if (buoyancy > 0 && hAgl > lclHght) {
      cape += 9.81 * buoyancy * dz;
      foundLFC = true;
    } else if (!foundLFC && hAgl > lclHght) {
      cin += 9.81 * buoyancy * dz;
    }
  }

  return { cape: Math.round(cape), cin: Math.round(cin), lcl: Math.round(lclHght) };
}
