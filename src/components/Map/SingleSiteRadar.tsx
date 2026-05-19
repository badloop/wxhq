import { useMemo, useEffect, useRef, useCallback } from 'react';
import { WMSTileLayer } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
import { useRadarRefresh } from '../../hooks/useRadarRefresh';
import { getNcepWmsUrl, getNcepLayerName, getRidgeTileUrl } from '../../services/radarApi';
import { TrackedTileLayer } from './TrackedTileLayer';
import type { RadarProductId } from '../../types/radar';

interface SingleSiteRadarProps {
  productOverride?: RadarProductId;
  paneIndex?: number;
}

export function SingleSiteRadar({ productOverride, paneIndex = 0 }: SingleSiteRadarProps) {
  const { state, dispatch } = useApp();
  const site = state.radarState.selectedSite;
  const { frames, animationSpeed, isAnimating, currentFrame, radarProduct: stateProduct, loopDelay } = state.radarState;
  const { tilesLoading } = state;
  const radarProduct = productOverride ?? stateProduct;
  const refreshToken = useRadarRefresh();

  const radarGroup = state.layerGroups.find(g => g.id === 'radar');
  const radarOpacity = radarGroup?.opacity ?? 0.7;
  const radarZIndex = 400 + state.layerGroups.findIndex(g => g.id === 'radar') * 10;

  // Track how many layers have loaded
  const loadedCountRef = useRef(0);
  const totalLayers = frames.length;

  // Reset counter when animation starts or frames change
  useEffect(() => {
    if (isAnimating && site) {
      loadedCountRef.current = 0;
    }
  }, [isAnimating, site, frames]);

  const onLayerLoaded = useCallback(() => {
    loadedCountRef.current++;
    if (loadedCountRef.current >= totalLayers) {
      dispatch({ type: 'SET_TILES_LOADING', payload: false });
    }
  }, [totalLayers, dispatch]);

  const onFrame = useCallback(
    (f: number) => dispatch({ type: 'SET_CURRENT_FRAME', payload: f }),
    [dispatch],
  );

  // Only animate when tiles are done loading
  useRadarAnimation(
    paneIndex === 0 && !!site && isAnimating && !tilesLoading,
    frames.length,
    animationSpeed,
    currentFrame,
    onFrame,
    loopDelay,
  );

  // Build tile URLs for all frames
  const frameUrls = useMemo(() => {
    if (!site || frames.length === 0) return [];
    return frames.map(f => getRidgeTileUrl(site.id, radarProduct, f.url));
  }, [site, radarProduct, frames]);

  if (!site) return null;

  if (isAnimating && frameUrls.length > 0) {
    return (
      <>
        {frameUrls.map((url, i) => (
          <TrackedTileLayer
            key={`ridge-${site.id}-${radarProduct}-${i}`}
            url={url}
            opacity={i === currentFrame ? radarOpacity : 0}
            maxNativeZoom={8}
            maxZoom={12}
            pane="radar-pane"
            onLoaded={onLayerLoaded}
            gpuAccelerated
          />
        ))}
      </>
    );
  }

  // Live view — use NCEP OpenGeo WMS for super-resolution
  return (
    <>
      <WMSTileLayer
        url={getNcepWmsUrl(site.id)}
        layers={getNcepLayerName(site.id, radarProduct)}
        format="image/png"
        transparent
        version="1.1.1"
        opacity={radarOpacity}
        maxZoom={12}
        key={`ncep-wms-${site.id}-${radarProduct}-${refreshToken}`}
        pane="radar-pane"
      />
    </>
  );
}
