import { useApp } from '../../context/AppContext';
import { RADAR_PRODUCTS } from '../../types/radar';
import { fetchSingleSiteFrames } from '../../services/radarApi';
import type { RadarProductId } from '../../types/radar';
import type { CSSProperties } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

const btn: CSSProperties = {
  background: 'transparent',
  border: '1px solid #00f0ff',
  color: '#00f0ff',
  padding: '6px 14px',
  borderRadius: 3,
  fontSize: 14,
  cursor: 'pointer',
};

const spinnerStyle: CSSProperties = {
  width: 18,
  height: 18,
  border: '2px solid rgba(0, 240, 255, 0.2)',
  borderTopColor: '#00f0ff',
  borderRadius: '50%',
  animation: 'wxhq-spin 0.8s linear infinite',
  flexShrink: 0,
};

const frameCounts = [5, 10, 15, 20];

export function AnimationControls() {
  const { state, dispatch } = useApp();
  const { frames, animationSpeed, frameCount, currentFrame, isAnimating, selectedSite, radarProduct, loopDelay } = state.radarState;
  const { layout, tilesLoading } = state;
  const mobile = useIsMobile();
  const showSpinner = isAnimating && tilesLoading;

  const displayFrames = selectedSite ? frames : [];
  const totalFrames = selectedSite ? frames.length : 12;
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
        const newFrames = await fetchSingleSiteFrames(selectedSite.id, frameCount, product);
        dispatch({ type: 'SET_FRAMES', payload: { frames: newFrames } });
      } catch (err) {
        console.error(`Failed to fetch ${product} frames:`, err);
      }
    }
  };

  // Changing the frame count refetches so the new count takes effect live
  // (the reducer only stores the count; frames are pulled here on demand).
  const handleFrameCountChange = async (count: number) => {
    dispatch({ type: 'SET_FRAME_COUNT', payload: count });
    if (selectedSite) {
      try {
        const newFrames = await fetchSingleSiteFrames(selectedSite.id, count, radarProduct);
        dispatch({ type: 'SET_FRAMES', payload: { frames: newFrames } });
      } catch (err) {
        console.error(`Failed to refetch frames for count ${count}:`, err);
      }
    }
  };

  const mobileBtn: CSSProperties = { ...btn, padding: '8px 10px', fontSize: 16 };

  if (mobile) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(26, 26, 46, 0.95)',
        borderTop: '1px solid rgba(0, 240, 255, 0.3)',
        boxShadow: '0 -2px 12px rgba(0, 240, 255, 0.15)',
        zIndex: 1000, fontFamily: 'var(--font-mono)',
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '6px 8px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
      }}>
        {/* Row 1: timestamp / status */}
        <div style={{ textAlign: 'center', color: '#00f0ff', fontSize: 11 }}>
          {selectedSite
            ? (frames.length > 0 ? `${currentFrame + 1}/${frames.length} — ${ts}` : `${selectedSite.id} — No frames`)
            : (isAnimating ? `${currentFrame + 1}/${totalFrames} — ${ts}` : 'Mosaic — Current')
          }
        </div>
        {/* Row 2: transport + key controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
          {showSpinner && <div style={spinnerStyle} title="Loading radar tiles..." />}
          <button style={mobileBtn} onClick={() => step(-1)}>⏮</button>
          <button style={mobileBtn} onClick={togglePlay}>{isAnimating ? '⏸' : '▶'}</button>
          <button style={mobileBtn} onClick={() => step(1)}>⏭</button>

          <select value={frameCount}
            onChange={e => handleFrameCountChange(Number(e.target.value))}
            style={{ ...btn, padding: '6px 6px', fontSize: 12 }}
          >
            {frameCounts.map(n => <option key={n} value={n}>{n}f</option>)}
          </select>

          {selectedSite && (
            <select value={radarProduct}
              onChange={e => handleProductChange(e.target.value as RadarProductId)}
              style={{ ...btn, padding: '6px 6px', fontSize: 12 }}
            >
              {RADAR_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
            </select>
          )}

          <button style={{ ...btn, padding: '8px 10px', fontSize: 12 }}
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}>⛶</button>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 56,
      background: 'rgba(26, 26, 46, 0.92)',
      borderTop: '1px solid rgba(0, 240, 255, 0.3)',
      boxShadow: '0 -2px 12px rgba(0, 240, 255, 0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: '0 16px', zIndex: 1000, fontFamily: 'var(--font-mono)',
    }}>
      {showSpinner && <div style={spinnerStyle} title="Loading radar tiles..." />}
      <button style={btn} onClick={() => step(-1)} title="Step back">⏮</button>
      <button style={btn} onClick={togglePlay}>
        {isAnimating ? '⏸' : '▶'}
      </button>
      <button style={btn} onClick={() => step(1)} title="Step forward">⏭</button>

      <label style={{ color: '#a0a0b0', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        Speed
        <input type="range" min={100} max={1500} step={100} value={1600 - animationSpeed}
          onChange={e => dispatch({ type: 'SET_ANIMATION_SPEED', payload: 1600 - Number(e.target.value) })}
          style={{ width: 80, accentColor: '#00f0ff' }}
        />
      </label>

      <label style={{ color: '#a0a0b0', fontSize: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        Loop Delay
        <select value={loopDelay}
          onChange={e => dispatch({ type: 'SET_LOOP_DELAY', payload: Number(e.target.value) })}
          style={{ ...btn, padding: '4px 8px' }}
        >
          <option value={500}>0.5s</option>
          <option value={1000}>1s</option>
          <option value={1500}>1.5s</option>
        </select>
      </label>

      <select value={frameCount}
        onChange={e => handleFrameCountChange(Number(e.target.value))}
        style={{ ...btn, padding: '4px 8px' }}
      >
        {frameCounts.map(n => <option key={n} value={n}>{n} frames</option>)}
      </select>

      {selectedSite && (
        <select value={radarProduct}
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
          <button key={n}
            style={{
              ...btn, padding: 4, width: 28, height: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: layout === n ? 'rgba(0,240,255,0.15)' : 'transparent',
            }}
            onClick={() => dispatch({ type: 'SET_LAYOUT', payload: n })}
            title={`${n} pane${n > 1 ? 's' : ''}`}
          >
            <span style={{
              display: 'grid',
              gridTemplateColumns: n >= 2 ? '1fr 1fr' : '1fr',
              gridTemplateRows: n === 4 ? '1fr 1fr' : '1fr',
              gap: 1.5, width: 16, height: 12,
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

      <button style={{ ...btn, marginLeft: 8 }}
        onClick={() => {
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
        }}
        title="Toggle fullscreen"
      >⛶</button>
    </div>
  );
}
