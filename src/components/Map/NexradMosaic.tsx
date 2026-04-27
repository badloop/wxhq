import { TileLayer } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import { getMosaicTileUrl } from '../../services/radarApi';

export function NexradMosaic() {
  const { state } = useApp();
  const { isAnimating } = state.radarState;

  if (isAnimating) return null; // animation handled elsewhere

  return (
    <TileLayer
      url={getMosaicTileUrl()}
      opacity={0.7}
      maxZoom={12}
      attribution="NEXRAD mosaic © Iowa Environmental Mesonet"
      key="mosaic-current"
    />
  );
}
