import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { geocodeAddress } from '../../services/geocodeService';
import type { MapPoint } from '../../types/mapPoints';

const ICON_OPTIONS = ['📍', '⚠️', '🏠', '🔴', '⭐', '🌪️', '📡', '🔵', '🟢', '🟡'];
const COLOR_OPTIONS = ['#ff00aa', '#00f0ff', '#39ff14', '#ff4444', '#ffaa00', '#aa44ff'];

const inputStyle: CSSProperties = {
  background: 'rgba(10, 10, 15, 0.8)',
  border: '1px solid rgba(0, 240, 255, 0.2)',
  color: '#e0e0e0',
  padding: '4px 6px',
  borderRadius: 3,
  fontFamily: 'monospace',
  fontSize: 11,
  width: '100%',
  boxSizing: 'border-box',
};

const btnStyle: CSSProperties = {
  background: 'rgba(0, 240, 255, 0.15)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  color: '#00f0ff',
  padding: '4px 10px',
  borderRadius: 3,
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 11,
};

export function MapPointInput() {
  const { dispatch } = useApp();
  const [input, setInput] = useState('');
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('📍');
  const [color, setColor] = useState('#ff00aa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!input.trim() || !label.trim()) return;
    setError('');
    setLoading(true);

    try {
      let lat: number;
      let lng: number;

      // Try parsing as lat,lng first
      const coordMatch = input.trim().match(/^(-?\d+\.?\d*)\s*[,\s]\s*(-?\d+\.?\d*)$/);
      if (coordMatch) {
        lat = parseFloat(coordMatch[1]);
        lng = parseFloat(coordMatch[2]);
      } else {
        // Geocode the address
        const result = await geocodeAddress(input.trim());
        if (!result) {
          setError('Address not found');
          setLoading(false);
          return;
        }
        lat = result.lat;
        lng = result.lng;
      }

      const point: MapPoint = {
        id: `pt-${Date.now()}`,
        lat,
        lng,
        label: label.trim(),
        icon,
        color,
      };

      dispatch({ type: 'ADD_MAP_POINT', payload: point });
      setInput('');
      setLabel('');
      setError('');
    } catch {
      setError('Geocoding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '6px 12px' }}>
      <div style={{ color: '#00f0ff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        Add Point
      </div>

      <input
        type="text"
        placeholder="Address or lat, lng"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        style={{ ...inputStyle, marginBottom: 4 }}
      />

      <input
        type="text"
        placeholder="Label"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        style={{ ...inputStyle, marginBottom: 6 }}
      />

      {/* Icon picker */}
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginBottom: 6 }}>
        {ICON_OPTIONS.map(i => (
          <button
            key={i}
            onClick={() => setIcon(i)}
            style={{
              background: icon === i ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
              border: icon === i ? '1px solid rgba(0, 240, 255, 0.5)' : '1px solid transparent',
              borderRadius: 3,
              fontSize: 14,
              cursor: 'pointer',
              padding: '2px 4px',
            }}
          >
            {i}
          </button>
        ))}
      </div>

      {/* Color picker */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center' }}>
        {COLOR_OPTIONS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid #fff' : '2px solid transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={handleAdd} disabled={loading} style={btnStyle}>
          {loading ? '...' : 'Add'}
        </button>
        {error && <span style={{ color: '#ff4444', fontSize: 10 }}>{error}</span>}
      </div>
    </div>
  );
}

export function MapPointList() {
  const { state, dispatch } = useApp();

  if (state.mapPoints.length === 0) return null;

  return (
    <div style={{ padding: '4px 12px' }}>
      {state.mapPoints.map(pt => (
        <div key={pt.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: '#e0e0e0',
          marginBottom: 2,
        }}>
          <span>{pt.icon}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pt.label}
          </span>
          <span style={{ color: '#606070', fontSize: 10 }}>
            {pt.lat.toFixed(2)},{pt.lng.toFixed(2)}
          </span>
          <button
            onClick={() => dispatch({ type: 'REMOVE_MAP_POINT', payload: pt.id })}
            style={{
              background: 'none',
              border: 'none',
              color: '#ff4444',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 10,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
