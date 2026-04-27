import L from 'leaflet';
import { CircleMarker, Tooltip } from 'react-leaflet';
import { nexradSites } from '../../data/nexradSites';
import { useApp } from '../../context/AppContext';
import { fetchRadarFrames } from '../../services/radarApi';
import type { NexradSite } from '../../types/radar';

export function NexradMarkers() {
  const { state, dispatch } = useApp();
  const selectedId = state.radarState.selectedSite?.id;

  if (!state.refLayers.radarSites?.enabled && !selectedId) return null;

  const showAll = state.refLayers.radarSites?.enabled;

  const handleClick = async (site: NexradSite, e: L.LeafletMouseEvent) => {
    // Stop the click from propagating to the map (which would open sidebar)
    L.DomEvent.stopPropagation(e);
    dispatch({ type: 'SELECT_SITE', payload: site });
    // Update sidebar data without opening it
    dispatch({ type: 'SET_SIDEBAR_LATLON', payload: [site.lat, site.lon] });
    try {
      const frames = await fetchRadarFrames(site.id, state.radarState.frameCount, state.radarState.radarProduct);
      dispatch({ type: 'SET_FRAMES', payload: { frames } });
    } catch (err) {
      console.error(`Failed to fetch radar frames for ${site.id}:`, err);
    }
  };

  return (
    <>
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
            eventHandlers={{ click: (e) => handleClick(site, e) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <strong>{site.id}</strong> — {site.name}, {site.state}
            </Tooltip>
          </CircleMarker>
        ))}
    </>
  );
}
