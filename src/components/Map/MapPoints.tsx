import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import { useApp } from '../../context/AppContext';

function makeIcon(icon: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid rgba(255,255,255,0.8);
      box-shadow: 0 0 8px ${color}, 0 2px 6px rgba(0,0,0,0.5);
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    ">${icon}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export function MapPoints() {
  const { state, dispatch } = useApp();

  if (state.mapPoints.length === 0) return null;

  return (
    <>
      {state.mapPoints.map(pt => (
        <Marker key={pt.id} position={[pt.lat, pt.lng]} icon={makeIcon(pt.icon, pt.color)}>
          <Popup>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#0a0a0f' }}>
              <strong>{pt.label}</strong>
              <br />
              <span style={{ color: '#666' }}>
                {pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}
              </span>
              <br />
              <button
                onClick={() => dispatch({ type: 'REMOVE_MAP_POINT', payload: pt.id })}
                style={{
                  marginTop: 4,
                  background: '#ff4444',
                  color: '#fff',
                  border: 'none',
                  padding: '2px 8px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: 11,
                }}
              >
                Remove
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
