import { useMemo } from 'react';
import { TileLayer, Pane } from 'react-leaflet';
import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
import { getRadarTileUrl } from '../../services/radarApi';
import type { RadarProductId } from '../../types/radar';

interface SingleSiteRadarProps {
  productOverride?: RadarProductId;
  paneIndex?: number;
}

export function SingleSiteRadar({ productOverride, paneIndex = 0 }: SingleSiteRadarProps) {
  const { state, dispatch } = useApp();
  const site = state.radarState.selectedSite;
  const { frames, animationSpeed, isAnimating, currentFrame, radarProduct: stateProduct } = state.radarState;
  const radarProduct = productOverride ?? stateProduct;

  const radarGroup = state.layerGroups.find(g => g.id === 'radar');
  const radarOpacity = radarGroup?.opacity ?? 0.7;
  const radarZIndex = 400 + state.layerGroups.findIndex(g => g.id === 'radar') * 10;

  const onFrame = useCallback(
    (f: number) => dispatch({ type: 'SET_CURRENT_FRAME', payload: f }),
    [dispatch],
  );

  // Only pane 0 drives the animation timer to avoid multiple hooks fighting
  useRadarAnimation(
    paneIndex === 0 && !!site && isAnimating,
    frames.length,
    animationSpeed,
    currentFrame,
    onFrame,
  );

  // Build tile URLs for this pane's product from shared timestamps
  const paneUrls = useMemo(() => {
    if (!site || frames.length === 0) return [];
    return frames.map(f => getRadarTileUrl(site.id, radarProduct, f.timestamp));
  }, [site, frames, radarProduct]);

  if (!site) return null;

  const ridgeSiteId = site.id.replace(/^K/, '');

  if (isAnimating && paneUrls.length > 0) {
    // Only render current frame + next frame (for preloading) instead of all frames
    const visibleIndices = new Set([currentFrame, (currentFrame + 1) % paneUrls.length]);

    return (
      <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
        {paneUrls.map((url, i) => {
          if (!visibleIndices.has(i)) return null;
          return (
            <TileLayer
              key={`ridge-${site.id}-${radarProduct}-${i}`}
              url={url}
              opacity={i === currentFrame ? radarOpacity : 0}
              maxZoom={18}
              maxNativeZoom={16}
              pane="radar-pane"
            />
          );
        })}
      </Pane>
    );
  }

  return (
    <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
      <TileLayer
        url={`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::${ridgeSiteId}-${radarProduct}-0/{z}/{x}/{y}.png`}
        opacity={radarOpacity}
        maxZoom={18}
        maxNativeZoom={16}
        attribution={`RIDGE ${site.id} ${radarProduct} &copy; IEM`}
        key={`ridge-${site.id}-${radarProduct}-live`}
        pane="radar-pane"
      />
    </Pane>
  );
}
