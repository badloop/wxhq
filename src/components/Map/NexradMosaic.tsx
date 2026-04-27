import { TileLayer } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import { getMosaicTileUrl, MOSAIC_MINUTES_AGO } from '../../services/radarApi';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
import { useEffect } from 'react';
import type { RadarFrame } from '../../types/radar';

/** Synthetic frames for mosaic animation (55 min ago → current, 5-min steps) */
const MOSAIC_FRAMES: RadarFrame[] = MOSAIC_MINUTES_AGO.map(m => ({
  url: getMosaicTileUrl(m),
  timestamp: `${m} min ago`,
  product: 'N0Q-mosaic',
}));

export function NexradMosaic() {
  const { state, dispatch } = useApp();
  const { selectedSite, isAnimating } = state.radarState;

  const { currentFrame } = useRadarAnimation(
    !selectedSite && isAnimating ? MOSAIC_FRAMES : [],
    state.radarState.animationSpeed,
  );

  // Sync current frame back to global state for UI display
  useEffect(() => {
    if (!selectedSite && isAnimating) {
      dispatch({ type: 'SET_CURRENT_FRAME', payload: currentFrame });
    }
  }, [currentFrame, selectedSite, isAnimating, dispatch]);

  // When a site is selected, don't show mosaic
  if (selectedSite) return null;

  // During animation, show the frame corresponding to currentFrame
  if (isAnimating && MOSAIC_FRAMES.length > 0) {
    const frame = MOSAIC_FRAMES[currentFrame] || MOSAIC_FRAMES[0];
    return (
      <TileLayer
        url={frame.url}
        opacity={0.7}
        maxZoom={12}
        attribution="NEXRAD mosaic © Iowa Environmental Mesonet"
        key={`mosaic-anim-${currentFrame}`}
      />
    );
  }

  // Default: show current mosaic
  return (
    <TileLayer
      url={getMosaicTileUrl()}
      opacity={0.7}
      maxZoom={12}
      attribution="NEXRAD mosaic © Iowa Environmental Mesonet"
      key="mosaic-current"
    />
  );
}
