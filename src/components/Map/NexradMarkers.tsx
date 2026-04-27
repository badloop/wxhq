import { CircleMarker, Tooltip } from 'react-leaflet';
import { nexradSites } from '../../data/nexradSites';
import { useApp } from '../../context/AppContext';
import { fetchRadarFrames } from '../../services/radarApi';
import type { NexradSite } from '../../types/radar';

export function NexradMarkers() {
  const { state, dispatch } = useApp();
  const selectedId = state.radarState.selectedSite?.id;

  const handleClick = async (site: NexradSite) => {
    dispatch({ type: 'SELECT_SITE', payload: site });
    try {
      const frames = await fetchRadarFrames(site.id, state.radarState.frameCount, state.radarState.radarProduct);
      dispatch({ type: 'SET_FRAMES', payload: { frames } });
    } catch (err) {
      console.error(`Failed to fetch radar frames for ${site.id}:`, err);
    }
  };

  return (
    <>
      {nexradSites.map(site => (
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
          eventHandlers={{ click: () => handleClick(site) }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            <strong>{site.id}</strong> — {site.name}, {site.state}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
