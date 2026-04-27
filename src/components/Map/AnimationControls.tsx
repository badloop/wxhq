import { useApp } from '../../context/AppContext';
import { RADAR_PRODUCTS } from '../../types/radar';
import { fetchRadarFrames } from '../../services/radarApi';
import type { RadarProductId } from '../../types/radar';
import type { CSSProperties } from 'react';

const bar: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: 56,
  background: 'rgba(26, 26, 46, 0.92)',
  borderTop: '1px solid rgba(0, 240, 255, 0.3)',
  boxShadow: '0 -2px 12px rgba(0, 240, 255, 0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '0 16px',
  zIndex: 1000,
  fontFamily: 'var(--font-mono)',
};

const btn: CSSProperties = {
  background: 'transparent',
  border: '1px solid #00f0ff',
  color: '#00f0ff',
  padding: '6px 14px',
  borderRadius: 3,
  fontSize: 14,
  cursor: 'pointer',
};

const frameCounts = [5, 10, 15, 20];

export function AnimationControls() {
  const { state, dispatch } = useApp();
  const { frames, animationSpeed, frameCount, currentFrame, isAnimating, selectedSite, radarProduct } = state.radarState;
  const { layout } = state;

  // For display: show site frames if site selected, otherwise mosaic frame info
  const displayFrames = selectedSite ? frames : [];
  const totalFrames = selectedSite ? frames.length : 12; // 12 mosaic history steps
  const ts = selectedSite
    ? (displayFrames[currentFrame]?.timestamp ?? '—')
    : (isAnimating ? `${55 - currentFrame * 5} min ago` : 'Current');

  const togglePlay = () => dispatch({ type: 'SET_ANIMATING', payload: !isAnimating });

  const step = (dir: 1 | -1) => {
    const max = selectedSite ? frames.length : 12;
    if (max === 0) return;
    dispatch({ type: 'SET_CURRENT_FRAME', payload: ((currentFrame + dir) % max + max) % max });
  };

  const handleProductChange = async (product: RadarProductId) => {
    dispatch({ type: 'SET_RADAR_PRODUCT', payload: product });
    dispatch({ type: 'SET_PANE_PRODUCT', payload: { pane: 0, product } });
    if (selectedSite) {
      try {
        const newFrames = await fetchRadarFrames(selectedSite.id, frameCount, product);
        dispatch({ type: 'SET_FRAMES', payload: { frames: newFrames } });
      } catch (err) {
        console.error(`Failed to fetch ${product} frames:`, err);
      }
    }
  };

  return (
    <div style={bar}>
      <button style={btn} onClick={() => step(-1)} title="Step back">⏮</button>
      <button style={btn} onClick={togglePlay}>
        {isAnimating ? '⏸' : '▶'}
      </button>
      <button style={btn} onClick={() => step(1)} title="Step forward">⏭</button>

      <label style={{ color: '#a0a0b0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        Speed
        <input
          type="range"
          min={100}
          max={1500}
          step={100}
          value={animationSpeed}
          onChange={e => dispatch({ type: 'SET_ANIMATION_SPEED', payload: Number(e.target.value) })}
          style={{ width: 80, accentColor: '#00f0ff' }}
        />
      </label>

      <select
        value={frameCount}
        onChange={e => dispatch({ type: 'SET_FRAME_COUNT', payload: Number(e.target.value) })}
        style={{ ...btn, padding: '4px 8px' }}
      >
        {frameCounts.map(n => <option key={n} value={n}>{n} frames</option>)}
      </select>

      {selectedSite && (
        <select
          value={radarProduct}
          onChange={e => handleProductChange(e.target.value as RadarProductId)}
          style={{ ...btn, padding: '4px 8px' }}
          title="Radar product"
        >
          {RADAR_PRODUCTS.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      <span style={{ color: '#00f0ff', fontSize: 12, minWidth: 180, textAlign: 'center' }}>
        {selectedSite
          ? (frames.length > 0 ? `${currentFrame + 1}/${frames.length} — ${ts}` : `${selectedSite.id} — No frames`)
          : (isAnimating ? `${currentFrame + 1}/${totalFrames} — ${ts}` : 'Mosaic — Current')
        }
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <span style={{ color: '#606070', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Layout</span>
        {([1, 2, 4] as const).map(n => (
          <button
            key={n}
            style={{
              ...btn,
              padding: 4,
              width: 28,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: layout === n ? 'rgba(0,240,255,0.15)' : 'transparent',
            }}
            onClick={() => dispatch({ type: 'SET_LAYOUT', payload: n })}
            title={`${n} pane${n > 1 ? 's' : ''}`}
          >
            <span style={{
              display: 'grid',
              gridTemplateColumns: n >= 2 ? '1fr 1fr' : '1fr',
              gridTemplateRows: n === 4 ? '1fr 1fr' : '1fr',
              gap: 1.5,
              width: 16,
              height: 12,
            }}>
              {Array.from({ length: n }, (_, i) => (
                <span key={i} style={{
                  background: layout === n ? '#00f0ff' : 'rgba(0,240,255,0.4)',
                  borderRadius: 1,
                }} />
              ))}
            </span>
          </button>
        ))}
      </div>

      <button
        style={{ ...btn, marginLeft: 8 }}
        onClick={() => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
        }}
        title="Toggle fullscreen"
      >
        ⛶
      </button>
    </div>
  );
}
