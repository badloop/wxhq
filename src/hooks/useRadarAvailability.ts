import { useEffect, useState } from 'react';
import { fetchRadarAvailability } from '../services/radarApi';

/**
 * Out-of-band poller for NEXRAD site availability.
 *
 * Polls the NWS radar-status API on mount and every `intervalMs` thereafter and
 * returns a `siteId -> available` map used to colour the site markers
 * (blue = available, red = unavailable). This runs independently of any user
 * action; selecting/clicking a site is unaffected.
 *
 * Sites missing from the map (not yet loaded, or absent from the NWS feed) are
 * treated as "unknown" by the caller.
 *
 * @param intervalMs refresh cadence in ms (default 5 min — radar status changes
 *   slowly and the feed lists ~160 stations, so frequent polling adds no value)
 */
export function useRadarAvailability(intervalMs = 300_000): Record<string, boolean> {
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const map = await fetchRadarAvailability();
        if (!cancelled) setAvailability(map);
      } catch {
        // fetchClient already surfaces network/timeout failures to the global
        // error overlay; on failure we simply keep the previous map (or empty),
        // which renders as "unknown" rather than a misleading all-up/all-down.
      }
    };

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return availability;
}
