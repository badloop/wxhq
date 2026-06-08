import { useEffect, useRef, useCallback } from 'react';
import { WMSTileLayer } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
import { useRadarRefresh } from '../../hooks/useRadarRefresh';
import { getNcepWmsUrl, getNcepLayerName } from '../../services/radarApi';
import { TrackedWMSTileLayer } from './TrackedWMSTileLayer';
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

  // Track how many frame layers have settled (loaded OR errored)
  const loadedCountRef = useRef(0);
  const totalLayers = frames.length;

  // Reset the loading gate only when an animation run begins (or its frames
  // change). The frame layers are mounted only while animating, so they fire a
  // fresh `load` event each time and the counter below can clear the gate.
  // (Previously this fired on every frames change even when idle, leaving
  // `tilesLoading` stuck true after play because already-mounted preloaded
  // layers never re-fired `load` — deadlocking the loop.)
  useEffect(() => {
    if (isAnimating && frames.length > 0 && site) {
      loadedCountRef.current = 0;
      dispatch({ type: 'SET_TILES_LOADING', payload: true });
    }
  }, [site, frames, isAnimating, dispatch]);

  // A frame "settles" on either a successful load or a tile error; once every
  // frame has settled, lift the loading gate so the animation can start.
  const onLayerSettled = useCallback(() => {
    loadedCountRef.current++;
    if (loadedCountRef.current >= totalLayers) {
      dispatch({ type: 'SET_TILES_LOADING', payload: false });
    }
  }, [totalLayers, dispatch]);

  // Safety net: never let a slow/stalled WMS frame hang the loop indefinitely.
  // If frames haven't all settled within 12s, lift the gate anyway.
  useEffect(() => {
    if (!isAnimating || !tilesLoading) return;
    const t = setTimeout(() => {
      dispatch({ type: 'SET_TILES_LOADING', payload: false });
    }, 12000);
    return () => clearTimeout(t);
  }, [isAnimating, tilesLoading, frames, dispatch]);

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

  // Hooks must run before any early return (Rules of Hooks).
  if (!site) return null;

  return (
    <>
      {/* Static super-resolution NCEP WMS layer. Shown when idle, and kept as a
          backdrop while animation frames are still loading (prevents a blank
          flash on first play). Hidden once frames are ready so the transparent
          frames don't ghost the latest scan underneath the loop. */}
      {(!isAnimating || tilesLoading) && (
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
      )}
      {/* Animation frame layers — super-resolution NCEP WMS pinned to each scan
          time via the WMS TIME dimension (same high-res source as the live
          view). Mounted only while animating so each run fires fresh load
          events and never hammers NCEP while idle. */}
      {isAnimating &&
        frames.map((f, i) => (
          <TrackedWMSTileLayer
            key={`ncep-frame-${site.id}-${radarProduct}-${i}`}
            url={getNcepWmsUrl(site.id)}
            layers={getNcepLayerName(site.id, radarProduct)}
            format="image/png"
            transparent
            version="1.1.1"
            time={f.timestamp}
            opacity={!tilesLoading && i === currentFrame ? radarOpacity : 0}
            maxZoom={12}
            pane="radar-pane"
            onLoaded={onLayerSettled}
            onError={onLayerSettled}
            errorLabel={`${site.id} ${radarProduct}`}
            gpuAccelerated
          />
        ))}
    </>
  );
}
