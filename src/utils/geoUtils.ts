import type { RAOBStation } from '../types/sounding';

/** Haversine distance in km between two lat/lon points */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Ray-casting point-in-polygon test. polygon is array of [lon, lat] pairs. */
export function pointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; // [lon, lat]
    const [xj, yj] = polygon[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Find the nearest RAOB station to a given lat/lon */
export function findNearestStation(lat: number, lon: number, stations: RAOBStation[]): RAOBStation | null {
  if (stations.length === 0) return null;
  let best = stations[0];
  let bestDist = haversine(lat, lon, best.lat, best.lon);
  for (let i = 1; i < stations.length; i++) {
    const d = haversine(lat, lon, stations[i].lat, stations[i].lon);
    if (d < bestDist) {
      bestDist = d;
      best = stations[i];
    }
  }
  return best;
}
