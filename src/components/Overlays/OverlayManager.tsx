import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';

const panel: CSSProperties = {
  position: 'fixed',
  top: 10,
  right: 10,
  zIndex: 1000,
  minWidth: 220,
  fontFamily: 'var(--font-mono)',
};

const header: CSSProperties = {
  background: 'rgba(26, 26, 46, 0.95)',
  border: '1px solid rgba(0, 240, 255, 0.4)',
  boxShadow: '0 0 8px rgba(0, 240, 255, 0.2)',
  padding: '8px 12px',
  cursor: 'pointer',
  color: '#00f0ff',
  fontSize: 13,
  borderRadius: 4,
  display: 'flex',
  justifyContent: 'space-between',
};

const body: CSSProperties = {
  background: 'rgba(26, 26, 46, 0.95)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  borderTop: 'none',
  padding: '8px 12px',
  borderRadius: '0 0 4px 4px',
};

const categories = { spc: 'SPC', nws: 'NWS', custom: 'Custom' } as const;

export function OverlayManager() {
  const [open, setOpen] = useState(false);
  const { state, dispatch } = useApp();

  const grouped = Object.entries(categories).map(([key, label]) => ({
    label,
    overlays: state.overlays.filter(o => o.category === key),
  }));

  return (
    <div style={panel}>
      <div style={header} onClick={() => setOpen(!open)}>
        <span>⚡ Overlays</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={body}>
          {grouped.map(g => (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <div style={{ color: '#a0a0b0', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>{g.label}</div>
              {g.overlays.map(o => (
                <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e0e0e0', fontSize: 12, marginBottom: 4, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={o.enabled}
                    onChange={() => dispatch({ type: 'TOGGLE_OVERLAY', payload: o.id })}
                    style={{ accentColor: o.color }}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, display: 'inline-block' }} />
                  {o.name}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
