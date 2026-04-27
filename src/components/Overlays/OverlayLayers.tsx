import { useEffect, useState, useRef } from 'react';
import { GeoJSON } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { OverlayConfig } from '../../types/overlays';
import { useApp } from '../../context/AppContext';
import { fetchWithRetry } from '../../services/fetchClient';
import { fetchActiveMCDs } from '../../services/mcdApi';

function OverlayLayer({ config }: { config: OverlayConfig }) {
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
        } else {
          const res = await fetchWithRetry(config.url);
          const raw = await res.json();
          // NWS alerts API returns { features: [...] } but with extra wrapper properties
          // Normalize to a standard FeatureCollection
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

  // SPC outlook features have 'stroke' and 'fill' properties with correct risk-level colors
  // NWS warnings: color by event type
  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const props = feature?.properties;
    if (props?.stroke || props?.fill) {
      return {
        color: props.stroke || config.color,
        weight: 2,
        fillColor: props.fill || config.color,
        fillOpacity: 0.25,
      };
    }
    // NWS event-based coloring
    if (config.category === 'nws' && props?.event) {
      const evt = (props.event as string).toLowerCase();
      let c = config.color;
      if (evt.includes('tornado')) c = '#ff69b4';
      else if (evt.includes('thunderstorm')) c = '#ff0000';
      else if (evt.includes('flood')) c = '#00cc00';
      return { color: c, weight: 2, fillColor: c, fillOpacity: 0.2 };
    }
    return {
      color: config.color,
      weight: 2,
      fillColor: config.color,
      fillOpacity: 0.15,
    };
  };

  return <GeoJSON key={`${config.id}-${revision}`} data={geojson} style={style} />;
}

export function OverlayLayers() {
  const { state } = useApp();
  const enabled = state.overlays.filter(o => o.enabled);

  return (
    <>
      {enabled.map(config => (
        <OverlayLayer key={config.id} config={config} />
      ))}
    </>
  );
}
