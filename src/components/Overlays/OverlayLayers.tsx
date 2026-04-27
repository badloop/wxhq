import { useEffect, useState, useRef } from 'react';
import { GeoJSON, useMap, Pane } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { OverlayConfig } from '../../types/overlays';
import { useApp } from '../../context/AppContext';
import { fetchWithRetry } from '../../services/fetchClient';
import { fetchActiveMCDs } from '../../services/mcdApi';
import { fetchActiveWatches } from '../../services/watchApi';

function OverlayLayer({ config, groupOpacity }: { config: OverlayConfig; groupOpacity: number }) {
  const { dispatch } = useApp();
  const [geojson, setGeojson] = useState<GeoJSON.FeatureCollection | null>(null);
  const [revision, setRevision] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        let data: GeoJSON.FeatureCollection;
        if (config.id === 'mcd') {
          data = await fetchActiveMCDs();
        } else if (config.id === 'watches') {
          data = await fetchActiveWatches();
        } else {
          const res = await fetchWithRetry(config.url);
          const raw = await res.json();
          if (raw.features) {
            data = { type: 'FeatureCollection', features: raw.features };
          } else {
            data = raw;
          }
        }
        if (!cancelled) {
          setGeojson(data);
          setRevision(r => r + 1);
          dispatch({ type: 'SET_OVERLAY_GEOJSON', payload: { id: config.id, geojson: data } });
        }
      } catch (err) {
        console.error(`Overlay fetch failed for ${config.id}:`, err);
      }
    };

    load();
    intervalRef.current = setInterval(load, config.refreshInterval);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [config.url, config.refreshInterval, config.id]);

  if (!geojson) return null;

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const props = feature?.properties;
    const noFill = config.fillMode === 'outline';

    if (props?.stroke || props?.fill) {
      return {
        color: props.stroke || config.color,
        weight: 2,
        fillColor: props.fill || config.color,
        fillOpacity: noFill ? 0 : 0.25 * groupOpacity,
        opacity: groupOpacity,
        fill: !noFill,
      };
    }
    if (config.category === 'warnings' && props?.event) {
      const evt = (props.event as string).toLowerCase();
      let c = config.color;
      if (evt.includes('tornado')) c = '#ff69b4';
      else if (evt.includes('thunderstorm')) c = '#ff0000';
      else if (evt.includes('flood')) c = '#00cc00';
      return { color: c, weight: 2, fillColor: c, fillOpacity: noFill ? 0 : 0.2 * groupOpacity, opacity: groupOpacity, fill: !noFill };
    }
    return {
      color: config.color,
      weight: 2,
      fillColor: config.color,
      fillOpacity: noFill ? 0 : 0.15 * groupOpacity,
      opacity: groupOpacity,
      fill: !noFill,
    };
  };

  return <GeoJSON key={`${config.id}-${revision}-${groupOpacity}-${config.fillMode}`} data={geojson} style={style} />;
}

/** Ensures a custom Leaflet pane exists with the given name and zIndex */
function usePane(name: string, zIndex: number) {
  const map = useMap();
  useEffect(() => {
    if (!map.getPane(name)) {
      const pane = map.createPane(name);
      pane.style.zIndex = String(zIndex);
    } else {
      const pane = map.getPane(name);
      if (pane) pane.style.zIndex = String(zIndex);
    }
  }, [map, name, zIndex]);
}

export function OverlayLayers() {
  const { state } = useApp();

  // Build a map of category -> zIndex based on layerGroups order
  // Index 0 = bottom, last = top. Base zIndex 400, step 10.
  const groupZIndex: Record<string, number> = {};
  const groupOpacity: Record<string, number> = {};
  state.layerGroups.forEach((g, i) => {
    groupZIndex[g.id] = 400 + i * 10;
    groupOpacity[g.id] = g.opacity;
  });

  return (
    <>
      {state.layerGroups.map((group) => {
        if (group.id === 'radar') return null; // radar handled separately
        const paneId = `overlay-${group.id}`;
        const enabled = state.overlays.filter(o => o.enabled && o.category === group.id);
        if (enabled.length === 0) return null;
        return (
          <OverlayPane
            key={group.id}
            paneName={paneId}
            zIndex={groupZIndex[group.id]}
            overlays={enabled}
            groupOpacity={groupOpacity[group.id]}
          />
        );
      })}
    </>
  );
}

function OverlayPane({
  paneName,
  zIndex,
  overlays,
  groupOpacity: opacity,
}: {
  paneName: string;
  zIndex: number;
  overlays: OverlayConfig[];
  groupOpacity: number;
}) {
  usePane(paneName, zIndex);

  return (
    <Pane name={paneName} style={{ zIndex }}>
      {overlays.map(config => (
        <OverlayLayer key={config.id} config={config} groupOpacity={opacity} />
      ))}
    </Pane>
  );
}
