import { useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { RadarPane } from './RadarPane';
import { MapSync } from './MapSyncContext';
import type { MapSyncContext } from './MapSyncContext';
import type { RadarProductId } from '../../types/radar';
import type { Map as LeafletMap } from 'leaflet';
import { useIsMobile } from '../../hooks/useIsMobile';

export function MapLayout() {
  const { state, dispatch } = useApp();
  const { layout, paneProducts } = state;
  const mobile = useIsMobile();
  const effectiveLayout = mobile ? 1 : layout;
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
        gridTemplateColumns: effectiveLayout >= 2 ? '1fr 1fr' : '1fr',
        gridTemplateRows: effectiveLayout === 4 ? '1fr 1fr' : '1fr',
        gap: 0,
      }}>
        {Array.from({ length: effectiveLayout }, (_, i) => (
          <div key={i} style={{
            position: 'relative',
            overflow: 'hidden',
            borderRight: i % 2 === 0 && effectiveLayout >= 2 ? '1px solid rgba(0,240,255,0.3)' : undefined,
            borderBottom: i < 2 && effectiveLayout === 4 ? '1px solid rgba(0,240,255,0.3)' : undefined,
          }}>
            <RadarPane
              paneIndex={i}
              radarProduct={paneProducts[i] || 'sr_bref'}
              onProductChange={(p: RadarProductId) => dispatch({ type: 'SET_PANE_PRODUCT', payload: { pane: i, product: p } })}
              showControls={effectiveLayout > 1}
            />
          </div>
        ))}
      </div>
    </MapSync.Provider>
  );
}
