import { MapContainer, TileLayer } from 'react-leaflet';
import { NexradMarkers } from './NexradMarkers';
import { NexradMosaic } from './NexradMosaic';
import { SingleSiteRadar } from './SingleSiteRadar';
import { OverlayLayers } from '../Overlays/OverlayLayers';
import { ReferenceLayers } from './ReferenceLayers';
import { MapPoints } from './MapPoints';
import { MapClickHandler } from '../../hooks/useMapClick';
import { RADAR_PRODUCTS } from '../../types/radar';
import type { RadarProductId } from '../../types/radar';
import type { CSSProperties } from 'react';
import 'leaflet/dist/leaflet.css';

interface RadarPaneProps {
  paneIndex: number;
  radarProduct: RadarProductId;
  onProductChange: (product: RadarProductId) => void;
  showControls?: boolean;
}

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 1000,
  background: 'rgba(26, 26, 46, 0.85)',
  border: '1px solid rgba(0, 240, 255, 0.4)',
  color: '#00f0ff',
  fontSize: 11,
  fontFamily: 'monospace',
  padding: '3px 6px',
  borderRadius: 3,
  cursor: 'pointer',
  pointerEvents: 'auto',
};

export function RadarPane({ paneIndex, radarProduct, onProductChange, showControls = true }: RadarPaneProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[39.8, -98.5]}
        zoom={5}
        style={{ width: '100%', height: '100%' }}
        zoomControl={paneIndex === 0}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          maxZoom={19}
        />
        <NexradMosaic />
        <SingleSiteRadar productOverride={radarProduct} />
        <ReferenceLayers />
        <OverlayLayers />
        <MapPoints />
        <NexradMarkers />
        <MapClickHandler />
      </MapContainer>
      {showControls && (
        <select
          value={radarProduct}
          onChange={e => onProductChange(e.target.value as RadarProductId)}
          style={dropdownStyle}
          title={`Pane ${paneIndex + 1} product`}
        >
          {RADAR_PRODUCTS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
