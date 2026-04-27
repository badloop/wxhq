import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
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
  const { frames, animationSpeed, frameCount } = state.radarState;
  const { currentFrame, isPlaying, play, pause, stepForward, stepBack } = useRadarAnimation(frames, animationSpeed);

  const ts = frames[currentFrame]?.timestamp ?? '—';

  return (
    <div style={bar}>
      <button style={btn} onClick={stepBack} title="Step back">⏮</button>
      <button style={btn} onClick={isPlaying ? pause : play}>
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button style={btn} onClick={stepForward} title="Step forward">⏭</button>

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

      <span style={{ color: '#00f0ff', fontSize: 12, minWidth: 140, textAlign: 'center' }}>
        {frames.length > 0 ? `${currentFrame + 1}/${frames.length} — ${ts}` : 'No frames loaded'}
      </span>
    </div>
  );
}
