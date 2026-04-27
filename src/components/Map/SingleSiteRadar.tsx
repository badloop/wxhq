import { useMemo } from 'react';
import { WMSTileLayer, Pane } from 'react-leaflet';
import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
import { ncepWmsUrl, ncepLayerName } from '../../services/radarApi';
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

  const wmsUrl = useMemo(() => site ? ncepWmsUrl(site.id) : '', [site]);
  const layerName = useMemo(() => site ? ncepLayerName(site.id, radarProduct) : '', [site, radarProduct]);

  if (!site) return null;

  if (isAnimating && frames.length > 0) {
    // Only render current frame + next frame (for preloading) instead of all frames
    const visibleIndices = new Set([currentFrame, (currentFrame + 1) % frames.length]);

    return (
      <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
        {frames.map((frame, i) => {
          if (!visibleIndices.has(i)) return null;
          return (
            <WMSTileLayer
              key={`ncep-${site.id}-${radarProduct}-${i}`}
              url={wmsUrl}
              params={{
                layers: layerName,
                format: 'image/png',
                transparent: true,
                version: '1.1.1',
                time: frame.timestamp,
              } as any}
              opacity={i === currentFrame ? radarOpacity : 0}
              maxZoom={18}
              pane="radar-pane"
            />
          );
        })}
      </Pane>
    );
  }

  // Live view — no TIME param uses latest available
  return (
    <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
      <WMSTileLayer
        url={wmsUrl}
        params={{
          layers: layerName,
          format: 'image/png',
          transparent: true,
          version: '1.1.1',
        } as any}
        opacity={radarOpacity}
        maxZoom={18}
        attribution={`NCEP ${site.id} ${radarProduct}`}
        key={`ncep-${site.id}-${radarProduct}-live`}
        pane="radar-pane"
      />
    </Pane>
  );
}
