import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';

/**
 * Quick on-map toggle for the NEXRAD radar-site markers, anchored top-left of
 * the map area. Mirrors the `radarSites` reference-layer state (also editable
 * in the Layers panel) so the two stay in sync. Fixed size so toggling never
 * shifts neighbouring controls.
 */
export function RadarSitesToggle() {
  const { state, dispatch } = useApp();
  const enabled = state.refLayers.radarSites?.enabled ?? false;

  const style: CSSProperties = {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 1000,
    height: 28,
    padding: '0 10px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: enabled ? 'rgba(0, 240, 255, 0.18)' : 'rgba(26, 26, 46, 0.85)',
    border: `1px solid ${enabled ? '#00f0ff' : 'rgba(0, 240, 255, 0.4)'}`,
    color: '#00f0ff',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    borderRadius: 4,
    cursor: 'pointer',
    pointerEvents: 'auto',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  };

  return (
    <button
      style={style}
      onClick={() => dispatch({ type: 'TOGGLE_REF_LAYER', payload: 'radarSites' })}
      title={enabled ? 'Hide radar sites' : 'Show radar sites'}
      aria-pressed={enabled}
    >
      <span
        style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: enabled ? '#1e80ff' : 'transparent',
          border: '1px solid #7ab8ff',
        }}
      />
      Sites
    </button>
  );
}
