import { useCallback } from 'react';
import { useMapEvents } from 'react-leaflet';
import { useApp } from '../context/AppContext';

export function MapClickHandler() {
  const { dispatch } = useApp();
  useMapEvents({
    click: useCallback((e: { latlng: { lat: number; lng: number } }) => {
      dispatch({ type: 'OPEN_SIDEBAR', payload: [e.latlng.lat, e.latlng.lng] });
    }, [dispatch]),
  });
  return null;
}
