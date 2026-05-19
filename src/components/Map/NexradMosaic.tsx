import { useEffect, useRef, useCallback } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import { getMosaicTileUrl, MOSAIC_MINUTES_AGO } from '../../services/radarApi';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';
import { useRadarRefresh } from '../../hooks/useRadarRefresh';
import { TrackedTileLayer } from './TrackedTileLayer';

const MOSAIC_URLS = MOSAIC_MINUTES_AGO.map(m => getMosaicTileUrl(m));

function ensureRadarPane(map: ReturnType<typeof useMap>, zIndex: number) {
  const name = 'radar-pane';
  if (!map.getPane(name)) {
    const pane = map.createPane(name);
    pane.style.zIndex = String(zIndex);
  } else {
    const pane = map.getPane(name);
    if (pane) pane.style.zIndex = String(zIndex);
  }
}

export function NexradMosaic({ paneIndex = 0 }: { paneIndex?: number }) {
  const { state, dispatch } = useApp();
  const { selectedSite, isAnimating, animationSpeed, currentFrame, loopDelay } = state.radarState;
  const { tilesLoading } = state;
  const refreshToken = useRadarRefresh();
  const map = useMap();

  const radarGroup = state.layerGroups.find(g => g.id === 'radar');
  const radarOpacity = radarGroup?.opacity ?? 0.7;
  const radarZIndex = 400 + state.layerGroups.findIndex(g => g.id === 'radar') * 10;

  ensureRadarPane(map, radarZIndex);

  // Track how many layers have loaded
  const loadedCountRef = useRef(0);
  const totalLayers = MOSAIC_URLS.length;

  // Reset counter when animation starts
  useEffect(() => {
    if (isAnimating && !selectedSite) {
      loadedCountRef.current = 0;
    }
  }, [isAnimating, selectedSite]);

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
    paneIndex === 0 && !selectedSite && isAnimating && !tilesLoading,
    MOSAIC_URLS.length,
    animationSpeed,
    currentFrame,
    onFrame,
    loopDelay,
  );

  if (selectedSite) return null;

  if (isAnimating) {
    return (
      <>
        {MOSAIC_URLS.map((url, i) => (
          <TrackedTileLayer
            key={`mosaic-${i}`}
            url={url}
            opacity={i === currentFrame ? radarOpacity : 0}
            maxZoom={12}
            pane="radar-pane"
            onLoaded={onLayerLoaded}
            gpuAccelerated
          />
        ))}
      </>
    );
  }

  return (
    <>
      <TileLayer
        url={`${getMosaicTileUrl()}?_t=${refreshToken}`}
        opacity={radarOpacity}
        maxZoom={12}
        attribution="NEXRAD mosaic &copy; Iowa Environmental Mesonet"
        key={`mosaic-current-${refreshToken}`}
        pane="radar-pane"
      />
    </>
  );
}
