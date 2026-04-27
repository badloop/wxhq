const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
}

/** Geocode an address string to lat/lng using Nominatim (OpenStreetMap) */
export async function geocodeAddress(query: string): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
    });
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': 'wxhq-weather-dashboard' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };
  } catch {
    return null;
  }
}
