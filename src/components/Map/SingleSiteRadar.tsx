import { TileLayer } from 'react-leaflet';
import { useApp } from '../../context/AppContext';

export function SingleSiteRadar() {
  const { state } = useApp();
  const site = state.radarState.selectedSite;

  if (!site) return null;

  const ridgeSiteId = site.id.replace(/^K/, '');
  const url = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeSiteId}-N0B-0/{z}/{x}/{y}.png`;

  return (
    <TileLayer
      url={url}
      opacity={0.8}
      maxZoom={12}
      attribution={`RIDGE ${site.id} © IEM`}
      key={`ridge-${site.id}`}
    />
  );
}
