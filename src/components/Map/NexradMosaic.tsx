import { useEffect } from 'react';
import { TileLayer, useMap, Pane } from 'react-leaflet';
import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getMosaicTileUrl, MOSAIC_MINUTES_AGO } from '../../services/radarApi';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';

const MOSAIC_URLS = MOSAIC_MINUTES_AGO.map(m => getMosaicTileUrl(m));

function useRadarPane(zIndex: number) {
  const map = useMap();
  useEffect(() => {
    const name = 'radar-pane';
    if (!map.getPane(name)) {
      const pane = map.createPane(name);
      pane.style.zIndex = String(zIndex);
    } else {
      const pane = map.getPane(name);
      if (pane) pane.style.zIndex = String(zIndex);
    }
  }, [map, zIndex]);
}

export function NexradMosaic() {
  const { state, dispatch } = useApp();
  const { selectedSite, isAnimating, animationSpeed, currentFrame } = state.radarState;

  const radarGroup = state.layerGroups.find(g => g.id === 'radar');
  const radarOpacity = radarGroup?.opacity ?? 0.7;
  const radarZIndex = 400 + state.layerGroups.findIndex(g => g.id === 'radar') * 10;

  useRadarPane(radarZIndex);

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
    return (
      <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
        {MOSAIC_URLS.map((url, i) => (
          <TileLayer
            key={`mosaic-${i}`}
            url={url}
            opacity={i === currentFrame ? radarOpacity : 0}
            maxZoom={12}
            pane="radar-pane"
          />
        ))}
      </Pane>
    );
  }

  return (
    <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
      <TileLayer
        url={getMosaicTileUrl()}
        opacity={radarOpacity}
        maxZoom={12}
        attribution="NEXRAD mosaic &copy; Iowa Environmental Mesonet"
        key="mosaic-current"
        pane="radar-pane"
      />
    </Pane>
  );
}
