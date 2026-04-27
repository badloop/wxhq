import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';

const PRESET_COLORS = ['#00f0ff', '#ff00aa', '#39ff14', '#ffff00', '#ff4444', '#aa44ff'];

const container: CSSProperties = {
  marginTop: 8,
  padding: '8px 0',
  borderTop: '1px solid rgba(0, 240, 255, 0.2)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  background: 'rgba(10, 10, 15, 0.8)',
  border: '1px solid rgba(0, 240, 255, 0.3)',
  color: '#e0e0e0',
  padding: '4px 8px',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  borderRadius: 3,
  marginBottom: 4,
  boxSizing: 'border-box',
};

const addBtn: CSSProperties = {
  background: 'rgba(0, 240, 255, 0.15)',
  border: '1px solid rgba(0, 240, 255, 0.4)',
  color: '#00f0ff',
  padding: '4px 12px',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  cursor: 'pointer',
  borderRadius: 3,
  width: '100%',
};

export function CustomOverlayInput() {
  const { dispatch } = useApp();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const handleAdd = () => {
    if (!url.trim() || !name.trim()) return;
    dispatch({
      type: 'ADD_OVERLAY',
      payload: {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        url: url.trim(),
        enabled: true,
        refreshInterval: 300000,
        color,
        category: 'custom',
        fillMode: 'fill',
      },
    });
    setUrl('');
    setName('');
  };

  return (
    <div style={container}>
      <div style={{ color: '#a0a0b0', fontSize: 10, marginBottom: 4, textTransform: 'uppercase' }}>Add Custom Overlay</div>
      <input
        style={inputStyle}
        placeholder="Display name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <input
        style={inputStyle}
        placeholder="GeoJSON / KML URL"
        value={url}
        onChange={e => setUrl(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {PRESET_COLORS.map(c => (
          <div
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 18,
              height: 18,
              borderRadius: 3,
              background: c,
              cursor: 'pointer',
              border: c === color ? '2px solid #fff' : '2px solid transparent',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>
      <button style={addBtn} onClick={handleAdd}>+ Add Overlay</button>
    </div>
  );
}
