import { createContext, useContext } from 'react';
import type { Map as LeafletMap } from 'leaflet';

/** Shared registry for syncing multiple Leaflet map instances */
export interface MapSyncContext {
  register: (index: number, map: LeafletMap) => void;
  unregister: (index: number) => void;
  syncFrom: (sourceIndex: number) => void;
}

export const MapSync = createContext<MapSyncContext | null>(null);

export function useMapSync() {
  return useContext(MapSync);
}
