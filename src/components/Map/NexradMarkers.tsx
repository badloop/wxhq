import L from 'leaflet';
import { CircleMarker, Tooltip, Pane, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { nexradSites } from '../../data/nexradSites';
import { useApp } from '../../context/AppContext';
import { fetchRadarFrames } from '../../services/radarApi';
import type { NexradSite } from '../../types/radar';

const MARKER_PANE = 'nexrad-markers';
const MARKER_Z = 650; // Always above radar imagery (400-range)

export function NexradMarkers() {
  const { state, dispatch } = useApp();
  const selectedId = state.radarState.selectedSite?.id;
  const map = useMap();

  useEffect(() => {
    if (!map.getPane(MARKER_PANE)) {
      const pane = map.createPane(MARKER_PANE);
      pane.style.zIndex = String(MARKER_Z);
    }
  }, [map]);

  if (!state.refLayers.radarSites?.enabled && !selectedId) return null;

  const showAll = state.refLayers.radarSites?.enabled;

  const handleClick = async (site: NexradSite, e: L.LeafletMouseEvent) => {
    L.DomEvent.stopPropagation(e);
    dispatch({ type: 'SELECT_SITE', payload: site });
    dispatch({ type: 'SET_SIDEBAR_LATLON', payload: [site.lat, site.lon] });
    try {
      const frames = await fetchRadarFrames(site.id, state.radarState.frameCount, state.radarState.radarProduct);
      dispatch({ type: 'SET_FRAMES', payload: { frames } });
    } catch (err) {
      console.error(`Failed to fetch radar frames for ${site.id}:`, err);
    }
  };

  return (
    <Pane name={MARKER_PANE} style={{ zIndex: MARKER_Z }}>
      {nexradSites
        .filter(site => showAll || site.id === selectedId)
        .map(site => (
          <CircleMarker
            key={site.id}
            center={[site.lat, site.lon]}
            radius={site.id === selectedId ? 7 : 4}
            pathOptions={{
              color: site.id === selectedId ? '#ff00aa' : '#00f0ff',
              fillColor: site.id === selectedId ? '#ff00aa' : '#00f0ff',
              fillOpacity: site.id === selectedId ? 0.9 : 0.6,
              weight: site.id === selectedId ? 2 : 1,
            }}
            pane={MARKER_PANE}
            eventHandlers={{ click: (e) => handleClick(site, e) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{site.id}</strong> — {site.name}, {site.state}
            </Tooltip>
          </CircleMarker>
        ))}
    </Pane>
  );
}
