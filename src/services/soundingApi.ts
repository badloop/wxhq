import type { RAOBStation, SoundingProfile } from '../types/sounding';
import { fetchWithRetry } from './fetchClient';

/** Fetch all RAOB upper-air stations from IEM */
export async function fetchRAOBStations(): Promise<RAOBStation[]> {
  const res = await fetchWithRetry('https://mesonet.agron.iastate.edu/geojson/network.py?network=RAOB');
  const data = await res.json();
  return (data.features || [])
    .filter((f: { properties: { archive_end: string | null; country: string } }) =>
      !f.properties.archive_end && f.properties.country === 'US'
    )
    .map((f: { properties: { sid: string; sname: string; state: string }; geometry: { coordinates: [number, number] } }) => ({
      id: f.properties.sid.replace(/^_/, 'K'),
      name: f.properties.sname,
      state: f.properties.state,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
    }));
}

/** Get recent sounding timestamps to try (most recent first) */
function getRecentSoundingTimes(): string[] {
  const now = new Date();
  const times: string[] = [];

  // Generate last 4 sounding times (00Z and 12Z)
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getTime() - i * 12 * 60 * 60 * 1000);
    const utcHour = d.getUTCHours();
    const hour = utcHour >= 12 ? '12' : '00';
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const ts = `${y}${m}${day}${hour}00`;
    if (!times.includes(ts)) times.push(ts);
  }
  return times;
}

/** Fetch the most recent sounding for a station */
export async function fetchSounding(stationId: string): Promise<SoundingProfile | null> {
  const timestamps = getRecentSoundingTimes();

  for (const ts of timestamps) {
    try {
      const url = `https://mesonet.agron.iastate.edu/json/raob.py?station=${encodeURIComponent(stationId)}&ts=${ts}`;
      const res = await fetchWithRetry(url);
      const data = await res.json();

      if (!data.profiles || data.profiles.length === 0) continue;

      const p = data.profiles[0];
      const levels = (p.profile || []).filter(
        (l: { pres: number | null; hght: number | null }) => l.pres != null && l.hght != null
      );

      // Need at least some wind data for hodograph
      const hasWind = levels.some((l: { drct: number | null; sknt: number | null }) => l.drct != null && l.sknt != null);
      if (levels.length > 0 && hasWind) {
        return {
          station: p.station,
          valid: p.valid,
          levels,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}
