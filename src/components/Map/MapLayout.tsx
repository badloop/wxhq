import { useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { RadarPane } from './RadarPane';
import { MapSync } from './MapSyncContext';
import type { MapSyncContext } from './MapSyncContext';
import type { RadarProductId } from '../../types/radar';
import type { Map as LeafletMap } from 'leaflet';

export function MapLayout() {
  const { state, dispatch } = useApp();
  const { layout, paneProducts } = state;
  const mapsRef = useRef<Map<number, LeafletMap>>(new Map());
  const syncingRef = useRef(false);

  const register = useCallback((index: number, map: LeafletMap) => {
    mapsRef.current.set(index, map);
  }, []);

  const unregister = useCallback((index: number) => {
    mapsRef.current.delete(index);
  }, []);

  const syncFrom = useCallback((sourceIndex: number) => {
    if (syncingRef.current) return;
    const source = mapsRef.current.get(sourceIndex);
    if (!source) return;
    const center = source.getCenter();
    const zoom = source.getZoom();
    syncingRef.current = true;
    mapsRef.current.forEach((map, idx) => {
      if (idx !== sourceIndex) {
        map.setView(center, zoom, { animate: false });
      }
    });
    syncingRef.current = false;
  }, []);

  const ctx: MapSyncContext = { register, unregister, syncFrom };

  return (
    <MapSync.Provider value={ctx}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: layout >= 2 ? '1fr 1fr' : '1fr',
        gridTemplateRows: layout === 4 ? '1fr 1fr' : '1fr',
        gap: 0,
      }}>
        {Array.from({ length: layout }, (_, i) => (
          <div key={i} style={{
            position: 'relative',
            overflow: 'hidden',
            borderRight: i % 2 === 0 && layout >= 2 ? '1px solid rgba(0,240,255,0.3)' : undefined,
            borderBottom: i < 2 && layout === 4 ? '1px solid rgba(0,240,255,0.3)' : undefined,
          }}>
            <RadarPane
              paneIndex={i}
              radarProduct={paneProducts[i] || 'N0B'}
              onProductChange={(p: RadarProductId) => dispatch({ type: 'SET_PANE_PRODUCT', payload: { pane: i, product: p } })}
              showControls={layout > 1}
            />
          </div>
        ))}
      </div>
    </MapSync.Provider>
  );
}
