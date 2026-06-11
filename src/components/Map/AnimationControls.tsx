import { useApp } from '../../context/AppContext';
import { RADAR_PRODUCTS } from '../../types/radar';
import { fetchSingleSiteFrames } from '../../services/radarApi';
import type { RadarProductId } from '../../types/radar';
import type { CSSProperties } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';

/**
 * Base styles for controls. The cardinal rule for this bar: nothing may change
 * the position of any other control when it is clicked. We achieve that with
 * fixed-size buttons, reserved slots for conditional elements, and a stable
 * three-zone (left / center / right) desktop layout.
 */

/** Fixed-size square icon button — every icon-only control uses this so they're
 *  visually uniform and never resize based on glyph width. */
const iconBtn: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(0, 240, 255, 0.6)',
  color: '#00f0ff',
  width: 34,
  height: 32,
  borderRadius: 4,
  fontSize: 15,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: 0,
};

/** Select styled to match the icon buttons (consistent height/border). */
const selectStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(0, 240, 255, 0.6)',
  color: '#00f0ff',
  height: 32,
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  padding: '0 6px',
  flexShrink: 0,
};

const spinnerStyle: CSSProperties = {
  width: 16,
  height: 16,
  border: '2px solid rgba(0, 240, 255, 0.2)',
  borderTopColor: '#00f0ff',
  borderRadius: '50%',
  animation: 'wxhq-spin 0.8s linear infinite',
};

const labelStyle: CSSProperties = {
  color: '#8a8a9a',
  fontSize: 9,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
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

  const statusText = selectedSite
    ? (frames.length > 0 ? `${currentFrame + 1}/${frames.length} — ${ts}` : `${selectedSite.id} — No frames`)
    : (isAnimating ? `${currentFrame + 1}/${totalFrames} — ${ts}` : 'Mosaic — Current');

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

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  };

  // --- Mobile layout -------------------------------------------------------
  // Two fixed rows. Transport buttons are equal-width and centered; the spinner
  // occupies a reserved slot so toggling play never shifts the row.
  if (mobile) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(26, 26, 46, 0.95)',
        borderTop: '1px solid rgba(0, 240, 255, 0.3)',
        boxShadow: '0 -2px 12px rgba(0, 240, 255, 0.15)',
        zIndex: 1000, fontFamily: 'var(--font-mono)',
        display: 'flex', flexDirection: 'column', gap: 6,
        padding: '6px 8px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
      }}>
        {/* Row 1: status */}
        <div style={{ textAlign: 'center', color: '#00f0ff', fontSize: 11, height: 14, lineHeight: '14px' }}>
          {statusText}
        </div>
        {/* Row 2: transport + settings, evenly distributed */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          {/* Left reserved spinner slot keeps transport centered */}
          <div style={{ width: 34, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
            {showSpinner && <div style={spinnerStyle} title="Loading radar tiles..." />}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button style={iconBtn} onClick={() => step(-1)} title="Step back">⏮</button>
            <button style={iconBtn} onClick={togglePlay} title={isAnimating ? 'Pause' : 'Play'}>{isAnimating ? '⏸' : '▶'}</button>
            <button style={iconBtn} onClick={() => step(1)} title="Step forward">⏭</button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <select value={frameCount} onChange={e => handleFrameCountChange(Number(e.target.value))} style={selectStyle} title="Frames">
              {frameCounts.map(n => <option key={n} value={n}>{n}f</option>)}
            </select>
            <select
              value={radarProduct}
              onChange={e => handleProductChange(e.target.value as RadarProductId)}
              style={{ ...selectStyle, opacity: selectedSite ? 1 : 0.4 }}
              disabled={!selectedSite}
              title="Radar product (site mode)"
            >
              {RADAR_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.id}</option>)}
            </select>
            <button style={iconBtn} onClick={toggleFullscreen} title="Fullscreen">⛶</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Desktop layout ------------------------------------------------------
  // Three zones with equal flex so the center transport group stays centered
  // and zones never reflow into each other when their contents change.
  const sideZone: CSSProperties = { flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 56,
      background: 'rgba(26, 26, 46, 0.92)',
      borderTop: '1px solid rgba(0, 240, 255, 0.3)',
      boxShadow: '0 -2px 12px rgba(0, 240, 255, 0.15)',
      display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 16px', zIndex: 1000, fontFamily: 'var(--font-mono)',
    }}>
      {/* LEFT: spinner (reserved) + status (fixed width) */}
      <div style={{ ...sideZone, justifyContent: 'flex-start', gap: 10 }}>
        <div style={{ width: 16, height: 16, flexShrink: 0 }}>
          {showSpinner && <div style={spinnerStyle} title="Loading radar tiles..." />}
        </div>
        <span style={{ color: '#00f0ff', fontSize: 12, width: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {statusText}
        </span>
      </div>

      {/* CENTER: transport + speed (fixed, always centered) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button style={iconBtn} onClick={() => step(-1)} title="Step back">⏮</button>
        <button style={iconBtn} onClick={togglePlay} title={isAnimating ? 'Pause' : 'Play'}>{isAnimating ? '⏸' : '▶'}</button>
        <button style={iconBtn} onClick={() => step(1)} title="Step forward">⏭</button>
        <label style={{ ...labelStyle, flexDirection: 'row', gap: 6 }}>
          Speed
          <input type="range" min={100} max={1500} step={100} value={1600 - animationSpeed}
            onChange={e => dispatch({ type: 'SET_ANIMATION_SPEED', payload: 1600 - Number(e.target.value) })}
            style={{ width: 80, accentColor: '#00f0ff' }}
          />
        </label>
      </div>

      {/* RIGHT: settings + layout + fullscreen */}
      <div style={{ ...sideZone, justifyContent: 'flex-end', gap: 8 }}>
        <label style={labelStyle}>
          Loop
          <select value={loopDelay} onChange={e => dispatch({ type: 'SET_LOOP_DELAY', payload: Number(e.target.value) })}
            style={{ ...selectStyle, height: 24, fontSize: 11 }}>
            <option value={500}>0.5s</option>
            <option value={1000}>1s</option>
            <option value={1500}>1.5s</option>
          </select>
        </label>

        <label style={labelStyle}>
          Frames
          <select value={frameCount} onChange={e => handleFrameCountChange(Number(e.target.value))}
            style={{ ...selectStyle, height: 24, fontSize: 11 }}>
            {frameCounts.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Product
          <select
            value={radarProduct}
            onChange={e => handleProductChange(e.target.value as RadarProductId)}
            style={{ ...selectStyle, height: 24, fontSize: 11, opacity: selectedSite ? 1 : 0.4, maxWidth: 120 }}
            disabled={!selectedSite}
            title={selectedSite ? 'Radar product' : 'Select a site to change product'}
          >
            {RADAR_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          Layout
          <div style={{ display: 'flex', gap: 4 }}>
            {([1, 2, 4] as const).map(n => (
              <button key={n}
                style={{
                  ...iconBtn, width: 26, height: 24,
                  background: layout === n ? 'rgba(0,240,255,0.18)' : 'transparent',
                }}
                onClick={() => dispatch({ type: 'SET_LAYOUT', payload: n })}
                title={`${n} pane${n > 1 ? 's' : ''}`}
              >
                <span style={{
                  display: 'grid',
                  gridTemplateColumns: n >= 2 ? '1fr 1fr' : '1fr',
                  gridTemplateRows: n === 4 ? '1fr 1fr' : '1fr',
                  gap: 1.5, width: 14, height: 11,
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
        </label>

        <button style={iconBtn} onClick={toggleFullscreen} title="Toggle fullscreen">⛶</button>
      </div>
    </div>
  );
}
