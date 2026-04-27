import { Component, useEffect, useState, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useApp } from '../../context/AppContext';
import type { RAOBStation, SoundingProfile } from '../../types/sounding';
import { fetchRAOBStations, fetchSounding } from '../../services/soundingApi';
import { findNearestStation, haversine } from '../../utils/geoUtils';
import { Hodograph } from './Hodograph';
import { SoundingParams } from './SoundingParams';
import { OverlayDetails } from './OverlayDetails';
import { LayersPanel } from '../Overlays/LayersPanel';
import { useIsMobile } from '../../hooks/useIsMobile';

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
const SIDEBAR_WIDTH = 420;

const panelBase: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 56,
  width: SIDEBAR_WIDTH,
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

const drawerHandle: CSSProperties = {
  position: 'fixed',
  top: '50%',
  zIndex: 1002,
  transform: 'translateY(-50%)',
  width: 24,
  height: 64,
  background: 'rgba(10, 10, 15, 0.95)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  borderRight: 'none',
  borderRadius: '4px 0 0 4px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#00f0ff',
  fontSize: 14,
  fontFamily: FONT,
  transition: 'right 0.3s ease',
};

const scrollArea: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 0,
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

/** Collapsible section wrapper */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{ ...sectionHeader, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span style={{ fontSize: 9, color: '#606070' }}>{open ? '▼' : '▶'}</span>
      </div>
      {open && children}
    </div>
  );
}

function LocationContext({ lat, lon }: { lat: number; lon: number }) {
  const { state } = useApp();
  const { overlays, overlayGeoJSON } = state;

  const stationsRef = useRef<RAOBStation[]>([]);
  const [station, setStation] = useState<RAOBStation | null>(null);
  const [stationDist, setStationDist] = useState(0);
  const [sounding, setSounding] = useState<SoundingProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRAOBStations()
      .then(s => { stationsRef.current = s; })
      .catch(err => console.error('Failed to load RAOB stations:', err));
  }, []);

  useEffect(() => {
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
  }, [lat, lon]);

  const sfcHeight = sounding?.levels?.[0]?.hght ?? 0;
  const hasValidSounding = sounding && sounding.levels.length > 3 && stationDist <= MAX_STATION_DIST_KM;

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0, 240, 255, 0.2)' }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#00f0ff', fontSize: BASE_SIZE + 1, fontFamily: FONT }}>
          {lat.toFixed(3)}°, {lon.toFixed(3)}°
        </div>
        {station && (
          <div style={{ color: '#a0a0b0', fontSize: BASE_SIZE - 1, fontFamily: FONT, marginTop: 2 }}>
            {station.name}, {station.state} ({Math.round(stationDist)} km)
          </div>
        )}
      </div>

      <SidebarErrorBoundary>
        <Section title="Hodograph">
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
        </Section>

        {hasValidSounding && (
          <Section title="Parameters">
            <SoundingParams levels={sounding!.levels} />
          </Section>
        )}

        <OverlayDetails
          lat={lat}
          lon={lon}
          overlays={overlays}
          overlayData={overlayGeoJSON}
        />
      </SidebarErrorBoundary>
    </div>
  );
}

export function ContextSidebar() {
  const { state, dispatch } = useApp();
  const { sidebarOpen, sidebarLatLon } = state;
  const mobile = useIsMobile();
  const width = mobile ? '100vw' : SIDEBAR_WIDTH;
  const barHeight = mobile ? 72 : 56;

  return (
    <>
      {/* Drawer handle — hidden on mobile when sidebar is open (full-screen overlay) */}
      {!(mobile && sidebarOpen) && (
        <div
          style={{
            ...drawerHandle,
            right: sidebarOpen ? SIDEBAR_WIDTH : 0,
            bottom: barHeight,
          }}
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? '›' : '‹'}
        </div>
      )}

      {/* Sidebar panel */}
      <div style={{
        ...panelBase,
        width: mobile ? '100vw' : SIDEBAR_WIDTH,
        bottom: barHeight,
        transform: sidebarOpen ? 'translateX(0)' : `translateX(${mobile ? '100vw' : `${SIDEBAR_WIDTH}px`})`,
      }}>
        {/* Mobile close bar */}
        {mobile && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', padding: '8px 12px',
            borderBottom: '1px solid rgba(0, 240, 255, 0.15)', flexShrink: 0,
          }}>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
              style={{
                background: 'none', border: '1px solid rgba(255,0,170,0.3)',
                color: '#ff00aa', padding: '4px 12px', borderRadius: 4,
                fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
              }}
            >✕ Close</button>
          </div>
        )}
        <div style={scrollArea}>
          <LayersPanel />
          {sidebarLatLon && (
            <LocationContext lat={sidebarLatLon[0]} lon={sidebarLatLon[1]} />
          )}
        </div>
      </div>

      {/* Sidebar panel */}
      <div style={{
        ...panelBase,
        width,
        bottom: barHeight,
        transform: sidebarOpen ? 'translateX(0)' : `translateX(${mobile ? '100vw' : `${SIDEBAR_WIDTH}px`})`,
      }}>
        <div style={scrollArea}>
          <LayersPanel />
          {sidebarLatLon && (
            <LocationContext lat={sidebarLatLon[0]} lon={sidebarLatLon[1]} />
          )}
        </div>
      </div>
    </>
  );
}
