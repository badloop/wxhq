import { Polygon, Tooltip } from 'react-leaflet';
import { useApp } from '../../context/AppContext';

export function MCDPolygons() {
  const { state } = useApp();
  const { mcdPolygons } = state;

  if (mcdPolygons.length === 0) return null;

  return (
    <>
      {mcdPolygons.map(mcd => (
        <Polygon
          key={mcd.id}
          positions={mcd.coordinates}
          pathOptions={{
            color: '#ffaa00',
            weight: 2,
            opacity: 0.8,
            dashArray: '8 6',
            fill: false,
            interactive: true,
          }}
        >
          <Tooltip sticky>
            <strong>{mcd.label}</strong>
            {mcd.concerning && <><br />{mcd.concerning}</>}
          </Tooltip>
        </Polygon>
      ))}
    </>
  );
}
