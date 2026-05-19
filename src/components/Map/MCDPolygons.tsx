import { Polygon, Tooltip, useMap } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import type { IEMBotPolygon } from '../../context/AppReducer';

const IEMBOT_PANE = 'overlay-iembot';

/** Check if coordinates is multi-ring (array of arrays) vs single ring */
function isMultiRing(coords: IEMBotPolygon['coordinates']): coords is [number, number][][] {
  return Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
}

export function MCDPolygons() {
  const { state } = useApp();
  const { mcdPolygons, refLayers, layerGroups } = state;
  const iembotLayer = refLayers.iembot;
  const map = useMap();

  // Compute z-index from layer group ordering (same scheme as OverlayLayers)
  const groupIdx = layerGroups.findIndex(g => g.id === 'iembot');
  const zIndex = 400 + (groupIdx >= 0 ? groupIdx : 5) * 10;

  // Ensure pane exists (create only if missing, update zIndex)
  if (!map.getPane(IEMBOT_PANE)) {
    const pane = map.createPane(IEMBOT_PANE);
    pane.style.zIndex = String(zIndex);
  } else {
    const pane = map.getPane(IEMBOT_PANE);
    if (pane) pane.style.zIndex = String(zIndex);
  }

  if (!iembotLayer?.enabled || mcdPolygons.length === 0) return null;

  const pathOptions = {
    color: iembotLayer.color,
    weight: iembotLayer.weight,
    opacity: iembotLayer.opacity,
    dashArray: '8 6',
    fill: false,
    interactive: true,
  };

  return (
    <>
      {mcdPolygons.map(mcd => {
        const tooltip = (
          <Tooltip sticky>
            <strong>{mcd.label}</strong>
            {mcd.concerning && <><br />{mcd.concerning}</>}
          </Tooltip>
        );

        if (isMultiRing(mcd.coordinates)) {
          return mcd.coordinates.map((ring, i) => (
            <Polygon key={`${mcd.id}-${i}`} positions={ring} pathOptions={pathOptions} pane={IEMBOT_PANE}>
              {i === 0 && tooltip}
            </Polygon>
          ));
        }

        return (
          <Polygon key={mcd.id} positions={mcd.coordinates} pathOptions={pathOptions} pane={IEMBOT_PANE}>
            {tooltip}
          </Polygon>
        );
      })}
    </>
  );
}
