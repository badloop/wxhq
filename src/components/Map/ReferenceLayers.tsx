import { useEffect, useState } from 'react';
import { GeoJSON } from 'react-leaflet';
import { useApp } from '../../context/AppContext';

const GEOJSON_URLS: Record<string, string> = {
  stateLines: 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
  countyLines: 'https://eric.clst.org/assets/wiki/uploads/Stuff/gz_2010_us_050_00_20m.json',
};

// Module-level cache so we don't refetch on HMR or re-render
const geoCache: Record<string, GeoJSON.FeatureCollection> = {};

export function ReferenceLayers() {
  const { state } = useApp();
  const [data, setData] = useState<Record<string, GeoJSON.FeatureCollection>>({});

  useEffect(() => {
    for (const [id, url] of Object.entries(GEOJSON_URLS)) {
      if (!state.refLayers[id]?.enabled) continue;
      if (geoCache[id]) {
        setData(prev => ({ ...prev, [id]: geoCache[id] }));
        continue;
      }
      fetch(url)
        .then(r => r.json())
        .then(geojson => {
          geoCache[id] = geojson;
          setData(prev => ({ ...prev, [id]: geojson }));
        })
        .catch(err => console.error(`[wxhq] Failed to fetch ${id}:`, err));
    }
  }, [state.refLayers.stateLines?.enabled, state.refLayers.countyLines?.enabled]);

  return (
    <>
      {Object.entries(GEOJSON_URLS).map(([id]) => {
        const cfg = state.refLayers[id];
        if (!cfg?.enabled || !data[id]) return null;
        return (
          <GeoJSON
            key={`${id}-${cfg.color}-${cfg.weight}-${cfg.opacity}`}
            data={data[id]}
            style={() => ({
              color: cfg.color,
              weight: cfg.weight,
              opacity: cfg.opacity,
              fill: false,
              interactive: false,
            })}
          />
        );
      })}
    </>
  );
}
