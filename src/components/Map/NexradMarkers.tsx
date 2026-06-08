import { memo, useCallback, useMemo } from 'react';
import L from 'leaflet';
import { Marker, Tooltip, useMap } from 'react-leaflet';
import { nexradSites } from '../../data/nexradSites';
import { useApp } from '../../context/AppContext';
import { fetchSingleSiteFrames } from '../../services/radarApi';
import { useRadarAvailability } from '../../hooks/useRadarAvailability';
import type { NexradSite } from '../../types/radar';

const MARKER_PANE = 'nexrad-markers';
const MARKER_Z = 650; // Always above radar imagery (400-range)

type SiteStatus = 'available' | 'unavailable' | 'unknown';

/** Marker fill/border per availability. Blue = up, red = down, grey = unknown. */
const PALETTE: Record<SiteStatus, { bg: string; border: string }> = {
  available: { bg: '#1e80ff', border: '#7ab8ff' },
  unavailable: { bg: '#e23b3b', border: '#ff8a8a' },
  unknown: { bg: '#54546a', border: '#80809a' },
};

const STATUS_LABEL: Record<SiteStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  unknown: 'Status unknown',
};

/** Build a labelled, rounded-pill div icon for a NEXRAD site. */
function buildSiteIcon(label: string, status: SiteStatus, selected: boolean): L.DivIcon {
  const { bg, border } = PALETTE[status];
  // Selected sites get a bright white ring + glow so selection stays visible
  // regardless of the availability colour underneath.
  const ring = selected
    ? 'border:2px solid #fff;box-shadow:0 0 7px 2px rgba(255,255,255,0.75),0 0 0 1px rgba(0,0,0,0.45);'
    : `border:1px solid ${border};box-shadow:0 1px 3px rgba(0,0,0,0.55);`;
  const scale = selected ? 'transform:scale(1.18);' : '';
  const html = `<span class="wxhq-site-pill" style="background:${bg};${ring}${scale}">${label}</span>`;
  return L.divIcon({
    html,
    className: 'wxhq-site-marker',
    iconSize: [40, 18],
    iconAnchor: [20, 9],
  });
}

interface SiteMarkerProps {
  site: NexradSite;
  selected: boolean;
  status: SiteStatus;
  onSelect: (site: NexradSite, e: L.LeafletMouseEvent) => void;
}

/**
 * One NEXRAD site marker. Memoised so the (potentially ~160) markers don't
 * rebuild their icons on every animation tick — only when the site's selection
 * or availability status actually changes.
 */
const SiteMarker = memo(function SiteMarker({ site, selected, status, onSelect }: SiteMarkerProps) {
  const icon = useMemo(() => buildSiteIcon(site.id, status, selected), [site.id, status, selected]);
  return (
    <Marker
      position={[site.lat, site.lon]}
      icon={icon}
      pane={MARKER_PANE}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: (e) => onSelect(site, e) }}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        <strong>{site.id}</strong> — {site.name}, {site.state}
        <br />
        <span style={{ color: PALETTE[status].bg }}>● {STATUS_LABEL[status]}</span>
      </Tooltip>
    </Marker>
  );
});

export function NexradMarkers() {
  const { state, dispatch } = useApp();
  const selectedId = state.radarState.selectedSite?.id;
  const map = useMap();
  // Out-of-band availability poller (blue = up / red = down). Independent of
  // click handling — it only colours the markers.
  const availability = useRadarAvailability();

  const { frameCount, radarProduct } = state.radarState;

  const handleSelect = useCallback(
    async (site: NexradSite, e: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(e);
      dispatch({ type: 'SELECT_SITE', payload: site });
      dispatch({ type: 'SET_SIDEBAR_LATLON', payload: [site.lat, site.lon] });
      try {
        const frames = await fetchSingleSiteFrames(site.id, frameCount, radarProduct);
        dispatch({ type: 'SET_FRAMES', payload: { frames } });
      } catch (err) {
        console.error(`Failed to fetch radar frames for ${site.id}:`, err);
      }
    },
    [dispatch, frameCount, radarProduct],
  );

  // Ensure the marker pane exists (kept above radar imagery).
  if (!map.getPane(MARKER_PANE)) {
    const pane = map.createPane(MARKER_PANE);
    pane.style.zIndex = String(MARKER_Z);
  }

  if (!state.refLayers.radarSites?.enabled && !selectedId) return null;

  const showAll = state.refLayers.radarSites?.enabled;

  const statusFor = (id: string): SiteStatus =>
    id in availability ? (availability[id] ? 'available' : 'unavailable') : 'unknown';

  return (
    <>
      {nexradSites
        .filter(site => showAll || site.id === selectedId)
        .map(site => (
          <SiteMarker
            key={site.id}
            site={site}
            selected={site.id === selectedId}
            status={statusFor(site.id)}
            onSelect={handleSelect}
          />
        ))}
    </>
  );
}
