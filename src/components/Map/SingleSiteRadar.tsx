import { TileLayer } from 'react-leaflet';
import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';

export function SingleSiteRadar() {
  const { state, dispatch } = useApp();
  const site = state.radarState.selectedSite;
  const { frames, animationSpeed, isAnimating, currentFrame } = state.radarState;

  const onFrame = useCallback(
    (f: number) => dispatch({ type: 'SET_CURRENT_FRAME', payload: f }),
    [dispatch],
  );

  useRadarAnimation(
    !!site && isAnimating,
    frames.length,
    animationSpeed,
    currentFrame,
    onFrame,
  );

  if (!site) return null;

  const ridgeSiteId = site.id.replace(/^K/, '');

  if (isAnimating && frames.length > 0) {
    // Render ALL frame layers simultaneously — active one visible, rest hidden.
    // Tiles get cached by Leaflet/browser so subsequent loops are smooth.
    return (
      <>
        {frames.map((frame, i) => (
          <TileLayer
            key={`ridge-${site.id}-${i}`}
            url={frame.url}
            opacity={i === currentFrame ? 0.8 : 0}
            maxZoom={12}
          />
        ))}
      </>
    );
  }

  // Default: show current/live radar
  return (
    <TileLayer
      url={`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeSiteId}-N0B-0/{z}/{x}/{y}.png`}
      opacity={0.8}
      maxZoom={12}
      attribution={`RIDGE ${site.id} © IEM`}
      key={`ridge-${site.id}-live`}
    />
  );
}
