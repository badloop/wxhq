import { TileLayer, Pane } from 'react-leaflet';
import { useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useRadarAnimation } from '../../hooks/useRadarAnimation';

export function SingleSiteRadar() {
  const { state, dispatch } = useApp();
  const site = state.radarState.selectedSite;
  const { frames, animationSpeed, isAnimating, currentFrame, radarProduct } = state.radarState;

  const radarGroup = state.layerGroups.find(g => g.id === 'radar');
  const radarOpacity = radarGroup?.opacity ?? 0.7;
  const radarZIndex = 400 + state.layerGroups.findIndex(g => g.id === 'radar') * 10;

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
    return (
      <Pane name="radar-pane" style={{ zIndex: radarZIndex }}>
        {frames.map((frame, i) => (
          <TileLayer
            key={`ridge-${site.id}-${radarProduct}-${i}`}
            url={frame.url}
            opacity={i === currentFrame ? radarOpacity : 0}
            maxZoom={18}
            maxNativeZoom={16}
            pane="radar-pane"
          />
        ))}
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
