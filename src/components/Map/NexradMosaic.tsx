import { TileLayer } from 'react-leaflet';
import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getMosaicTileUrl, MOSAIC_MINUTES_AGO } from '../../services/radarApi';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';

/** Pre-built mosaic tile URLs for animation (55 min ago → current, 5-min steps) */
const MOSAIC_URLS = MOSAIC_MINUTES_AGO.map(m => getMosaicTileUrl(m));

export function NexradMosaic() {
  const { state, dispatch } = useApp();
  const { selectedSite, isAnimating, animationSpeed, currentFrame } = state.radarState;

  const onFrame = useCallback(
    (f: number) => dispatch({ type: 'SET_CURRENT_FRAME', payload: f }),
    [dispatch],
  );

  useRadarAnimation(
    !selectedSite && isAnimating,
    MOSAIC_URLS.length,
    animationSpeed,
    currentFrame,
    onFrame,
  );

  if (selectedSite) return null;

  if (isAnimating) {
    // Render ALL mosaic layers simultaneously — active one visible, rest hidden.
    // Leaflet caches loaded tiles so subsequent loops are instant.
    return (
      <>
        {MOSAIC_URLS.map((url, i) => (
          <TileLayer
            key={`mosaic-${i}`}
            url={url}
            opacity={i === currentFrame ? 0.7 : 0}
            maxZoom={12}
          />
        ))}
      </>
    );
  }

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
