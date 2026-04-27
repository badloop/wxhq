import { TileLayer } from 'react-leaflet';
import { useApp } from '../../context/AppContext';

export function ReferenceLayers() {
  const { state } = useApp();

  return (
    <>
      {state.refLayers.stateLines && (
        <TileLayer
          url="https://mesonet.agron.iastate.edu/c/tile.py/1.0.0/usstates/{z}/{x}/{y}.png"
          opacity={0.6}
          maxZoom={18}
          zIndex={450}
        />
      )}
      {state.refLayers.countyLines && (
        <TileLayer
          url="https://mesonet.agron.iastate.edu/c/tile.py/1.0.0/uscounties/{z}/{x}/{y}.png"
          opacity={0.4}
          maxZoom={18}
          zIndex={451}
        />
      )}
    </>
  );
}
