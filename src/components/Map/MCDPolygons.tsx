import { Polygon, Tooltip } from 'react-leaflet';
import { useApp } from '../../context/AppContext';
import type { IEMBotPolygon } from '../../context/AppReducer';

/** Check if coordinates is multi-ring (array of arrays) vs single ring */
function isMultiRing(coords: IEMBotPolygon['coordinates']): coords is [number, number][][] {
  return Array.isArray(coords[0]) && Array.isArray(coords[0][0]);
}

export function MCDPolygons() {
  const { state } = useApp();
  const { mcdPolygons, refLayers } = state;
  const iembotLayer = refLayers.iembot;

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
          // Render each ring as a separate polygon
          return mcd.coordinates.map((ring, i) => (
            <Polygon key={`${mcd.id}-${i}`} positions={ring} pathOptions={pathOptions}>
              {i === 0 && tooltip}
            </Polygon>
          ));
        }

        return (
          <Polygon key={mcd.id} positions={mcd.coordinates} pathOptions={pathOptions}>
            {tooltip}
          </Polygon>
        );
      })}
    </>
  );
}
