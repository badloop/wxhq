import { MapContainer, TileLayer } from 'react-leaflet';
import { NexradMarkers } from './NexradMarkers';
import { NexradMosaic } from './NexradMosaic';
import { SingleSiteRadar } from './SingleSiteRadar';
import { OverlayLayers } from '../Overlays/OverlayLayers';
import { MapPoints } from './MapPoints';
import { MapClickHandler } from '../../hooks/useMapClick';
import 'leaflet/dist/leaflet.css';

export function RadarMap() {
  return (
    <MapContainer
      center={[39.8, -98.5]}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />
      <NexradMosaic />
      <SingleSiteRadar />
      <OverlayLayers />
      <MapPoints />
      <NexradMarkers />
      <MapClickHandler />
    </MapContainer>
  );
}
