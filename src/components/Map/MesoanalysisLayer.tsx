import { useEffect, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { useApp } from '../../context/AppContext';
import { fetchMesoField, type MesoField } from '../../services/mesoanalysisApi';

const MESO_PANE = 'overlay-mesoanalysis';

/** Open-Meteo data is hourly; refetch every 30 min while enabled. */
const REFRESH_MS = 30 * 60 * 1000;

/**
 * Renders the selected SPC-style mesoanalysis product (CAPE, CIN, shear, …) as
 * dynamically-contoured filled GeoJSON bands. Data + contouring come from
 * mesoanalysisApi (Open-Meteo → d3-contour). Sits in a low pane so radar and
 * vector overlays draw on top.
 *
 * Enabled state lives in refLayers.mesoanalysis; band opacity comes from the
 * `mesoanalysis` layer group's opacity.
 */
export function MesoanalysisLayer() {
  const { state } = useApp();
  const { mesoProduct, refLayers, layerGroups } = state;
  const map = useMap();

  const enabled = refLayers.mesoanalysis?.enabled ?? false;
  const groupIdx = layerGroups.findIndex((g) => g.id === 'mesoanalysis');
  const zIndex = 400 + (groupIdx >= 0 ? groupIdx : 0) * 10;
  const groupOpacity = layerGroups.find((g) => g.id === 'mesoanalysis')?.opacity ?? 0.5;

  const [field, setField] = useState<MesoField | null>(null);
  const [revision, setRevision] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ensure the pane exists with the group-derived z-index (mirrors MCDPolygons).
  if (!map.getPane(MESO_PANE)) {
    const pane = map.createPane(MESO_PANE);
    pane.style.zIndex = String(zIndex);
  } else {
    const pane = map.getPane(MESO_PANE);
    if (pane) pane.style.zIndex = String(zIndex);
  }

  // Fetch + contour when enabled or product changes; refresh on an interval.
  // While disabled we simply skip loading; the render guard below prevents any
  // stale field from drawing, so no synchronous state reset is needed here.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const result = await fetchMesoField(mesoProduct);
      if (cancelled) return;
      setField(result);
      setRevision((r) => r + 1);
    };

    load();
    timerRef.current = setInterval(load, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, mesoProduct]);

  if (!enabled || !field || field.geojson.features.length === 0) return null;

  // Each feature carries its own band color; group opacity scales fill + stroke.
  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const color = (feature?.properties?.color as string) ?? '#d6391f';
    return {
      color,
      weight: 0.5,
      opacity: Math.min(1, groupOpacity + 0.2),
      fillColor: color,
      fillOpacity: groupOpacity,
      fill: true,
    };
  };

  return (
    <GeoJSON
      key={`meso-${mesoProduct}-${revision}-${groupOpacity}`}
      data={field.geojson}
      style={style}
      pane={MESO_PANE}
    />
  );
}
