import { Component, useEffect, useState, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import type { RAOBStation, SoundingProfile } from '../../types/sounding';
import { fetchRAOBStations, fetchSounding } from '../../services/soundingApi';
import { findNearestStation, haversine } from '../../utils/geoUtils';
import { Hodograph } from './Hodograph';
import { SoundingParams } from './SoundingParams';
import { OverlayDetails } from './OverlayDetails';

/** Prevent child render errors from blanking the entire app */
class SidebarErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) { return { error: err.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, color: '#ff4444', fontFamily: 'monospace', fontSize: 13 }}>
          Render error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

const FONT = "monospace";
const BASE_SIZE = 13;
const MAX_STATION_DIST_KM = 200;

const panelBase: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 56,
  width: 420,
  background: 'rgba(10, 10, 15, 0.95)',
  borderLeft: '1px solid rgba(0, 240, 255, 0.3)',
  boxShadow: '-4px 0 20px rgba(0, 240, 255, 0.1)',
  zIndex: 1001,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: FONT,
  fontSize: BASE_SIZE,
  transition: 'transform 0.3s ease',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
  flexShrink: 0,
};

const closeBtn: CSSProperties = {
  background: 'none',
  border: '1px solid rgba(255, 0, 170, 0.4)',
  color: '#ff00aa',
  width: 28,
  height: 28,
  cursor: 'pointer',
  fontSize: BASE_SIZE,
  fontFamily: FONT,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const scrollArea: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px 16px',
};

const sectionHeader: CSSProperties = {
  color: '#00f0ff',
  fontSize: BASE_SIZE,
  fontFamily: FONT,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: 8,
  paddingBottom: 4,
  borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
};

export function ContextSidebar() {
  const { state, dispatch } = useApp();
  const { sidebarOpen, sidebarLatLon, overlays, overlayGeoJSON } = state;

  const stationsRef = useRef<RAOBStation[]>([]);
  const [station, setStation] = useState<RAOBStation | null>(null);
  const [stationDist, setStationDist] = useState(0);
  const [sounding, setSounding] = useState<SoundingProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Load RAOB stations once
  useEffect(() => {
    fetchRAOBStations()
      .then(s => { stationsRef.current = s; })
      .catch(err => console.error('Failed to load RAOB stations:', err));
  }, []);

  // Fetch sounding when sidebar opens or location changes
  useEffect(() => {
    if (!sidebarOpen || !sidebarLatLon) {
      setSounding(null);
      setStation(null);
      return;
    }

    const [lat, lon] = sidebarLatLon;
    const nearest = findNearestStation(lat, lon, stationsRef.current);
    if (!nearest) {
      setStation(null);
      setSounding(null);
      return;
    }

    const dist = haversine(lat, lon, nearest.lat, nearest.lon);
    setStation(nearest);
    setStationDist(dist);

    if (dist > MAX_STATION_DIST_KM) {
      setSounding(null);
      return;
    }

    setLoading(true);
    fetchSounding(nearest.id)
      .then(s => setSounding(s))
      .catch(err => {
        console.error('Sounding fetch failed:', err);
        setSounding(null);
      })
      .finally(() => setLoading(false));
  }, [sidebarOpen, sidebarLatLon]);

  if (!sidebarOpen || !sidebarLatLon) return null;

  const [lat, lon] = sidebarLatLon;
  const sfcHeight = sounding?.levels?.[0]?.hght ?? 0;
  const hasValidSounding = sounding && sounding.levels.length > 3 && stationDist <= MAX_STATION_DIST_KM;

  return (
    <div style={{ ...panelBase, transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)' }}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <div style={{ color: '#00f0ff', fontSize: BASE_SIZE + 1, fontFamily: FONT }}>
            {lat.toFixed(3)}°, {lon.toFixed(3)}°
          </div>
          {station && (
            <div style={{ color: '#a0a0b0', fontSize: BASE_SIZE - 1, fontFamily: FONT, marginTop: 2 }}>
              {station.name}, {station.state} ({Math.round(stationDist)} km)
            </div>
          )}
        </div>
        <button style={closeBtn} onClick={() => dispatch({ type: 'CLOSE_SIDEBAR' })}>✕</button>
      </div>

      {/* Scrollable content */}
      <div style={scrollArea}>
        <SidebarErrorBoundary>
        {/* Hodograph section */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionHeader}>Hodograph</div>
          {loading && (
            <div style={{ color: '#a0a0b0', fontSize: BASE_SIZE, fontFamily: FONT, textAlign: 'center', padding: 20 }}>
              Loading sounding...
            </div>
          )}
          {!loading && hasValidSounding && (
            <>
              <Hodograph levels={sounding!.levels} sfcHeight={sfcHeight} />
              <div style={{ color: '#a0a0b0', fontSize: BASE_SIZE - 1, fontFamily: FONT, textAlign: 'center', marginTop: 4 }}>
                {sounding!.valid}
              </div>
            </>
          )}
          {!loading && !hasValidSounding && (
            <div style={{ color: '#a0a0b0', fontSize: BASE_SIZE, fontFamily: FONT, textAlign: 'center', padding: 20 }}>
              {stationDist > MAX_STATION_DIST_KM
                ? `Nearest station too far (${Math.round(stationDist)} km)`
                : 'No sounding data available'}
            </div>
          )}
        </div>

        {/* Sounding parameters */}
        {hasValidSounding && (
          <div style={{ marginBottom: 16 }}>
            <div style={sectionHeader}>Parameters</div>
            <SoundingParams levels={sounding!.levels} />
          </div>
        )}

        {/* Overlay details */}
        <OverlayDetails
          lat={lat}
          lon={lon}
          overlays={overlays}
          overlayData={overlayGeoJSON}
        />
        </SidebarErrorBoundary>
      </div>
    </div>
  );
}
