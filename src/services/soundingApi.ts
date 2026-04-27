import type { RAOBStation, SoundingProfile } from '../types/sounding';
import { fetchWithRetry } from './fetchClient';

/** Fetch all RAOB upper-air stations from IEM */
export async function fetchRAOBStations(): Promise<RAOBStation[]> {
  const res = await fetchWithRetry('https://mesonet.agron.iastate.edu/geojson/network.py?network=RAOB');
  const data = await res.json();
  return (data.features || []).map((f: { properties: { sid: string; sname: string; state: string }; geometry: { coordinates: [number, number] } }) => ({
    id: f.properties.sid,
    name: f.properties.sname,
    state: f.properties.state,
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
  }));
}

/** Get the most recent 00Z or 12Z timestamp string (YYYYMMDDHHmm) */
function getLatestSoundingTime(): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const hour = utcHour >= 12 ? '12' : '00';
  return `${y}${m}${d}${hour}00`;
}

/** Fetch the most recent sounding for a station */
export async function fetchSounding(stationId: string): Promise<SoundingProfile | null> {
  const ts = getLatestSoundingTime();
  const url = `https://mesonet.agron.iastate.edu/json/raob.py?station=${encodeURIComponent(stationId)}&ts=${ts}`;
  const res = await fetchWithRetry(url);
  const data = await res.json();

  if (!data.profiles || data.profiles.length === 0) return null;

  const p = data.profiles[0];
  const levels = (p.profile || []).filter(
    (l: { pres: number | null; hght: number | null }) => l.pres != null && l.hght != null
  );

  return {
    station: p.station,
    valid: p.valid,
    levels,
  };
}
