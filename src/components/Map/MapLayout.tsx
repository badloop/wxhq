import { useApp } from '../../context/AppContext';
import { RadarPane } from './RadarPane';
import type { RadarProductId } from '../../types/radar';

export function MapLayout() {
  const { state, dispatch } = useApp();
  const { layout, paneProducts } = state;

  if (layout === 1) {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <RadarPane
          paneIndex={0}
          radarProduct={paneProducts[0] || 'N0B'}
          onProductChange={(p: RadarProductId) => dispatch({ type: 'SET_PANE_PRODUCT', payload: { pane: 0, product: p } })}
          showControls={false}
        />
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gridTemplateRows: layout === 4 ? '1fr 1fr' : '1fr',
      gap: 0,
    }}>
      {Array.from({ length: layout }, (_, i) => (
        <div key={i} style={{
          position: 'relative',
          overflow: 'hidden',
          borderRight: i % 2 === 0 ? '1px solid rgba(0,240,255,0.3)' : undefined,
          borderBottom: i < 2 && layout === 4 ? '1px solid rgba(0,240,255,0.3)' : undefined,
        }}>
          <RadarPane
            paneIndex={i}
            radarProduct={paneProducts[i] || 'N0B'}
            onProductChange={(p: RadarProductId) => dispatch({ type: 'SET_PANE_PRODUCT', payload: { pane: i, product: p } })}
          />
        </div>
      ))}
    </div>
  );
}
