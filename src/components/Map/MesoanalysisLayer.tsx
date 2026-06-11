import { useEffect, useRef, useState } from 'react';
import { ImageOverlay, useMap } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import { mesoImageUrl, fetchMesoValidTime, SPC_CONUS_BOUNDS } from '../../services/mesoanalysisApi';
import { MESO_PRODUCTS } from '../../types/mesoanalysis';

const MESO_PANE = 'overlay-mesoanalysis';

/** SPC images are hourly; re-check the valid time every 10 min. */
const REFRESH_MS = 10 * 60 * 1000;

/**
 * Renders every enabled SPC mesoanalysis product as a georeferenced raster
 * overlay (SPC's own hourly Lambert-Conformal GIF), stacked in catalog order in
 * a low pane so radar and vector overlays draw on top. Enabled set lives in
 * state.mesoProducts; per-image opacity comes from the `mesoanalysis` layer
 * group. A shared hourly "valid time" key cache-busts all images together.
 */
export function MesoanalysisLayer() {
  const { state } = useApp();
  const { mesoProducts, layerGroups } = state;
  const map = useMap();

  const groupIdx = layerGroups.findIndex((g) => g.id === 'mesoanalysis');
  const zIndex = 400 + (groupIdx >= 0 ? groupIdx : 0) * 10;
  const groupOpacity = layerGroups.find((g) => g.id === 'mesoanalysis')?.opacity ?? 0.5;

  const [validTime, setValidTime] = useState<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ensure the pane exists with the group-derived z-index (mirrors MCDPolygons).
  if (!map.getPane(MESO_PANE)) {
    const pane = map.createPane(MESO_PANE);
    pane.style.zIndex = String(zIndex);
  } else {
    const pane = map.getPane(MESO_PANE);
    if (pane) pane.style.zIndex = String(zIndex);
  }

  // Poll SPC's valid-time only while something is enabled (cheap text fetch).
  useEffect(() => {
    if (mesoProducts.length === 0) return;
    let cancelled = false;

    const refresh = async () => {
      const vt = await fetchMesoValidTime();
      if (!cancelled) setValidTime(vt);
    };

    refresh();
    timerRef.current = setInterval(refresh, REFRESH_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [mesoProducts.length]);

  if (mesoProducts.length === 0) return null;

  // Render in catalog order (not click order) for a stable stack.
  const ordered = MESO_PRODUCTS.filter((p) => mesoProducts.includes(p.id));

  return (
    <>
      {ordered.map((p) => (
        <ImageOverlay
          key={`meso-${p.id}-${validTime}`}
          url={mesoImageUrl(p.id, validTime)}
          bounds={SPC_CONUS_BOUNDS}
          opacity={groupOpacity}
          pane={MESO_PANE}
          // SPC images are designed to stack; let clicks pass to the map.
          interactive={false}
          crossOrigin
        />
      ))}
    </>
  );
}
