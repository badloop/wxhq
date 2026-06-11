import { useEffect, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { useApp } from '../../context/AppContext';
import { fetchMesoField, type MesoField } from '../../services/mesoanalysisApi';
import { MESO_PRODUCTS } from '../../types/mesoanalysis';

const MESO_PANE = 'overlay-mesoanalysis';

/** Open-Meteo data is hourly; refetch every 30 min while enabled. */
const REFRESH_MS = 30 * 60 * 1000;

/**
 * One contoured mesoanalysis product (CAPE, CIN, shear, …) as filled GeoJSON
 * bands. Each enabled product mounts its own instance so it fetches, contours,
 * and refreshes independently. Band opacity comes from the `mesoanalysis`
 * layer-group opacity passed in.
 */
function MesoProductField({ productId, groupOpacity }: { productId: string; groupOpacity: number }) {
  const [field, setField] = useState<MesoField | null>(null);
  const [revision, setRevision] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await fetchMesoField(productId);
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
  }, [productId]);

  if (!field || field.geojson.features.length === 0) return null;

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
      key={`meso-${productId}-${revision}-${groupOpacity}`}
      data={field.geojson}
      style={style}
      pane={MESO_PANE}
    />
  );
}

/**
 * Renders every enabled SPC-style mesoanalysis product as dynamically-contoured
 * filled GeoJSON, stacked in catalog order in a low pane (so radar and vector
 * overlays draw on top). Enabled set lives in state.mesoProducts.
 */
export function MesoanalysisLayer() {
  const { state } = useApp();
  const { mesoProducts, layerGroups } = state;
  const map = useMap();

  const groupIdx = layerGroups.findIndex((g) => g.id === 'mesoanalysis');
  const zIndex = 400 + (groupIdx >= 0 ? groupIdx : 0) * 10;
  const groupOpacity = layerGroups.find((g) => g.id === 'mesoanalysis')?.opacity ?? 0.5;

  // Ensure the pane exists with the group-derived z-index (mirrors MCDPolygons).
  if (!map.getPane(MESO_PANE)) {
    const pane = map.createPane(MESO_PANE);
    pane.style.zIndex = String(zIndex);
  } else {
    const pane = map.getPane(MESO_PANE);
    if (pane) pane.style.zIndex = String(zIndex);
  }

  if (mesoProducts.length === 0) return null;

  // Render in catalog order (not click order) for a stable stack.
  const ordered = MESO_PRODUCTS.filter((p) => mesoProducts.includes(p.id));

  return (
    <>
      {ordered.map((p) => (
        <MesoProductField key={p.id} productId={p.id} groupOpacity={groupOpacity} />
      ))}
    </>
  );
}
