import { useEffect, useState, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';

const WEBCAM_PANE = 'overlay-webcams';
const API_BASE = 'https://api.windy.com/webcams/api/v3/webcams';
const API_KEY = 'UlXJnAObpAOI3zAO9IpxKfmENnwZW7PY';

interface Webcam {
  webcamId: number;
  title: string;
  location: { latitude: number; longitude: number; city: string; region: string };
  images: {
    current: { preview: string; thumbnail: string };
    daylight: { preview: string; thumbnail: string };
  };
}

export function WebcamLayer() {
  const { state } = useApp();
  const cfg = state.refLayers.webcams;
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  const fetchingRef = useRef(false);
  const lastBoundsRef = useRef<string>('');

  // Create pane
  useEffect(() => {
    if (!map.getPane(WEBCAM_PANE)) {
      const pane = map.createPane(WEBCAM_PANE);
      pane.style.zIndex = '490';
    }
    layerGroupRef.current = L.layerGroup([], { pane: WEBCAM_PANE }).addTo(map);
    return () => { layerGroupRef.current?.remove(); };
  }, [map]);

  const fetchWebcams = useCallback(async () => {
    if (!cfg?.enabled || fetchingRef.current) return;

    const bounds = map.getBounds();
    const center = bounds.getCenter();
    // Calculate radius in km from bounds
    const ne = bounds.getNorthEast();
    const radiusKm = Math.min(Math.round(center.distanceTo(ne) / 1000), 250);

    // Skip if viewport hasn't moved much
    const boundsKey = `${center.lat.toFixed(1)},${center.lng.toFixed(1)},${radiusKm}`;
    if (boundsKey === lastBoundsRef.current) return;
    lastBoundsRef.current = boundsKey;

    // Don't fetch at very wide zoom (too many results, too sparse)
    if (map.getZoom() < 6) {
      layerGroupRef.current?.clearLayers();
      setWebcams([]);
      return;
    }

    fetchingRef.current = true;
    try {
      const url = `${API_BASE}?nearby=${center.lat.toFixed(4)},${center.lng.toFixed(4)},${radiusKm}&limit=50&include=location,images`;
      const res = await fetch(url, {
        headers: { 'x-windy-api-key': API_KEY },
      });
      if (!res.ok) return;
      const data = await res.json();
      setWebcams(data.webcams ?? []);
    } catch (err) {
      console.error('[wxhq] Webcam fetch failed:', err);
    } finally {
      fetchingRef.current = false;
    }
  }, [map, cfg?.enabled]);

  // Fetch on map move
  useEffect(() => {
    if (!cfg?.enabled) {
      layerGroupRef.current?.clearLayers();
      return;
    }

    fetchWebcams();
    const onMoveEnd = () => fetchWebcams();
    map.on('moveend', onMoveEnd);
    return () => { map.off('moveend', onMoveEnd); };
  }, [map, cfg?.enabled, fetchWebcams]);

  // Render markers
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group || !cfg?.enabled) return;

    group.clearLayers();
    for (const cam of webcams) {
      const icon = L.divIcon({
        html: `<span style="font-size:16px;cursor:pointer;">📷</span>`,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([cam.location.latitude, cam.location.longitude], {
        icon,
        pane: WEBCAM_PANE,
      });

      marker.on('click', () => {
        // Fetch fresh image URL (they expire after 10 min)
        fetch(`${API_BASE}/${cam.webcamId}?include=images,location`, {
          headers: { 'x-windy-api-key': API_KEY },
        })
          .then(r => r.json())
          .then(data => {
            const w = data as Webcam;
            const imgUrl = w.images?.current?.preview || cam.images?.current?.preview;
            const popup = L.popup({ maxWidth: 420, className: 'webcam-popup' })
              .setLatLng([cam.location.latitude, cam.location.longitude])
              .setContent(`
                <div style="text-align:center;">
                  <div style="font-weight:bold;font-size:12px;margin-bottom:4px;color:#e0e0e0;">${cam.title}</div>
                  <div style="font-size:10px;color:#999;margin-bottom:6px;">${cam.location.city || ''}, ${cam.location.region || ''}</div>
                  <img src="${imgUrl}" style="max-width:400px;border-radius:4px;border:1px solid #333;" />
                  <div style="margin-top:4px;font-size:10px;"><a href="https://www.windy.com/webcams/${cam.webcamId}" target="_blank" style="color:#00f0ff;">View on Windy</a></div>
                </div>
              `)
              .openOn(map);
          })
          .catch(() => {
            // Fallback: use cached image
            L.popup({ maxWidth: 420 })
              .setLatLng([cam.location.latitude, cam.location.longitude])
              .setContent(`
                <div style="text-align:center;">
                  <div style="font-weight:bold;font-size:12px;margin-bottom:4px;">${cam.title}</div>
                  <img src="${cam.images?.current?.preview}" style="max-width:400px;border-radius:4px;" />
                </div>
              `)
              .openOn(map);
          });
      });

      marker.addTo(group);
    }
  }, [webcams, cfg?.enabled, map]);

  return null;
}
