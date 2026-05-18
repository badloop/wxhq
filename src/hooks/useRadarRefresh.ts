import { useState, useEffect } from 'react';

/**
 * Returns a cache-busting token that updates on a fixed interval.
 * Used to force Leaflet tile layers to reload when new radar scans
 * are released. The token is a floored timestamp so all tiles in a
 * reload cycle share the same value (consistent cache key).
 *
 * @param intervalMs How often to refresh (default 150s = 2.5 min,
 *   half the typical 5-min NEXRAD volume scan cycle)
 */
export function useRadarRefresh(intervalMs = 150_000): number {
  const [token, setToken] = useState(() => Math.floor(Date.now() / intervalMs));

  useEffect(() => {
    const id = setInterval(() => {
      setToken(Math.floor(Date.now() / intervalMs));
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return token;
}
