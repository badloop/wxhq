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

  // When animating with frames, show the historical frame tile
  if (isAnimating && frames.length > 0) {
    const frame = frames[currentFrame] || frames[0];
    return (
      <TileLayer
        url={frame.url}
        opacity={0.8}
        maxZoom={12}
        attribution={`RIDGE ${site.id} © IEM`}
        key={`ridge-${site.id}-frame-${currentFrame}`}
      />
    );
  }

  // Default: show current/live radar for selected site
  const ridgeSiteId = site.id.replace(/^K/, '');
  const url = `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeSiteId}-N0B-0/{z}/{x}/{y}.png`;

  return (
    <TileLayer
      url={url}
      opacity={0.8}
      maxZoom={12}
      attribution={`RIDGE ${site.id} © IEM`}
      key={`ridge-${site.id}-live`}
    />
  );
}
