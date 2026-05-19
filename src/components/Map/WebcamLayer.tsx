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

interface ActiveWebcam {
  cam: Webcam;
  imgUrl: string | null;
  fullscreen: boolean;
}

export function WebcamLayer() {
  const { state } = useApp();
  const cfg = state.refLayers.webcams;
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [webcams, setWebcams] = useState<Webcam[]>([]);
  const [active, setActive] = useState<ActiveWebcam | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
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
    const ne = bounds.getNorthEast();
    const radiusKm = Math.min(Math.round(center.distanceTo(ne) / 1000), 250);

    const boundsKey = `${center.lat.toFixed(1)},${center.lng.toFixed(1)},${radiusKm}`;
    if (boundsKey === lastBoundsRef.current) return;
    lastBoundsRef.current = boundsKey;

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
        // Show viewer immediately with spinner
        setImgLoaded(false);
        setPos(null);
        setActive({ cam, imgUrl: null, fullscreen: false });

        fetch(`${API_BASE}/${cam.webcamId}?include=images,location`, {
          headers: { 'x-windy-api-key': API_KEY },
        })
          .then(r => r.json())
          .then(data => {
            const w = data as Webcam;
            const url = w.images?.current?.preview || cam.images?.current?.preview;
            setActive(prev => prev ? { ...prev, imgUrl: url } : null);
          })
          .catch(() => {
            setActive(prev => prev ? { ...prev, imgUrl: cam.images?.current?.preview } : null);
          });
      });

      marker.addTo(group);
    }
  }, [webcams, cfg?.enabled]);

  // Viewer overlay
  if (!active) return null;

  const { cam, imgUrl, fullscreen } = active;
  const loading = !imgUrl || !imgLoaded;

  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = (e.target as HTMLElement).closest('[data-webcam-viewer]') as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.origX + (ev.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (ev.clientY - dragRef.current.startY),
      });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const viewerStyle: React.CSSProperties = fullscreen
    ? { position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }
    : pos
      ? { position: 'fixed', top: pos.y, left: pos.x, zIndex: 2000 }
      : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2000 };

  return (
    <div style={viewerStyle} data-webcam-viewer>
      {/* Backdrop (fullscreen only) */}
      {fullscreen && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)' }} onClick={() => { setActive(null); setImgLoaded(false); setPos(null); }} />
      )}

      {/* Image container */}
      <div
        style={{
          position: 'relative',
          width: fullscreen ? '95vw' : '500px',
          height: fullscreen ? '95vh' : '320px',
          maxWidth: fullscreen ? '95vw' : '500px',
          maxHeight: fullscreen ? '95vh' : '400px',
          borderRadius: fullscreen ? 0 : 6,
          overflow: 'hidden',
          boxShadow: fullscreen ? undefined : '0 0 30px rgba(0, 240, 255, 0.3), 0 4px 20px rgba(0,0,0,0.8)',
          border: fullscreen ? undefined : '1px solid rgba(0, 240, 255, 0.2)',
          background: '#0a0a0f',
        }}
      >
        {/* Spinner */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1,
          }}>
            <div style={{
              width: 32, height: 32,
              border: '3px solid rgba(0, 240, 255, 0.2)',
              borderTop: '3px solid #00f0ff',
              borderRadius: '50%',
              animation: 'webcam-spin 0.8s linear infinite',
            }} />
            <style>{`@keyframes webcam-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Image */}
        {imgUrl && (
          <img
            src={imgUrl}
            alt={cam.title}
            onLoad={() => setImgLoaded(true)}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          />
        )}

        {/* Top overlay bar — drag handle */}
        <div
          onMouseDown={onDragStart}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            padding: '8px 12px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            cursor: fullscreen ? undefined : 'grab',
          }}
        >
          <div>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              {cam.title}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: 'monospace' }}>
              {cam.location.city}{cam.location.region ? `, ${cam.location.region}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { setActive({ ...active, fullscreen: !fullscreen }); setPos(null); }}
              style={{
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                color: '#00f0ff',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? '⊡' : '⊞'}
            </button>
            <button
              onClick={() => { setActive(null); setImgLoaded(false); setPos(null); }}
              style={{
                background: 'rgba(255, 0, 100, 0.15)',
                border: '1px solid rgba(255, 0, 100, 0.4)',
                color: '#ff0064',
                borderRadius: 4,
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Bottom overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '6px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <a
            href={`https://www.windy.com/webcams/${cam.webcamId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#00f0ff',
              fontSize: 10,
              fontFamily: 'monospace',
              textDecoration: 'none',
              opacity: 0.7,
            }}
          >
            windy.com
          </a>
        </div>
      </div>
    </div>
  );
}
