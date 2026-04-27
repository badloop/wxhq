import { useState, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useApp } from '../../context/AppContext';
import { CustomOverlayInput } from './CustomOverlayInput';
import { MapPointInput, MapPointList } from '../Map/MapPointInput';
import type { LayerGroup } from '../../types/overlays';

const sliderStyle: CSSProperties = {
  width: '100%',
  height: 4,
  appearance: 'none' as const,
  background: 'rgba(0, 240, 255, 0.15)',
  borderRadius: 2,
  outline: 'none',
  cursor: 'pointer',
};

function LayerGroupRow({
  group,
  isFirst,
  isLast,
  children,
}: {
  group: LayerGroup;
  isFirst: boolean;
  isLast: boolean;
  children: React.ReactNode;
}) {
  const { dispatch } = useApp();
  const dragRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div
      ref={dragRef}
      style={{
        padding: '6px 12px',
        borderBottom: '1px solid rgba(0, 240, 255, 0.1)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: collapsed ? 0 : 4, cursor: 'pointer' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => dispatch({ type: 'MOVE_GROUP', payload: { id: group.id, direction: 'up' } })}
            disabled={isLast}
            style={{
              background: 'none', border: 'none',
              color: isLast ? '#333' : '#00f0ff',
              fontSize: 9, cursor: isLast ? 'default' : 'pointer',
              padding: 0, lineHeight: 1, fontFamily: 'monospace',
            }}
            title="Move up (renders on top)"
          >▲</button>
          <button
            onClick={() => dispatch({ type: 'MOVE_GROUP', payload: { id: group.id, direction: 'down' } })}
            disabled={isFirst}
            style={{
              background: 'none', border: 'none',
              color: isFirst ? '#333' : '#00f0ff',
              fontSize: 9, cursor: isFirst ? 'default' : 'pointer',
              padding: 0, lineHeight: 1, fontFamily: 'monospace',
            }}
            title="Move down (renders below)"
          >▼</button>
        </div>

        <span style={{ color: '#00f0ff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          {group.name}
        </span>
        <span style={{ color: '#606070', fontSize: 11 }}>{Math.round(group.opacity * 100)}%</span>
        <span style={{ color: '#606070', fontSize: 9 }}>{collapsed ? '▶' : '▼'}</span>
      </div>

      {!collapsed && (
        <>
          <div style={{ marginBottom: 6 }}>
            <input
              type="range" min={0} max={100}
              value={Math.round(group.opacity * 100)}
              onChange={e => dispatch({
                type: 'SET_GROUP_OPACITY',
                payload: { id: group.id, opacity: parseInt(e.target.value) / 100 },
              })}
              style={sliderStyle}
            />
          </div>
          {children}
        </>
      )}
    </div>
  );
}

const REF_LAYER_DEFS = [
  { key: 'stateLines', label: 'State Lines' },
  { key: 'countyLines', label: 'County Lines' },
  { key: 'radarSites', label: 'Radar Sites' },
  { key: 'iembot', label: 'IEMBot' },
] as const;

function RefLayerSection() {
  const { state, dispatch } = useApp();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(0, 240, 255, 0.15)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: collapsed ? 0 : 6 }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{ color: '#00f0ff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          Reference
        </span>
        <span style={{ color: '#606070', fontSize: 9 }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && REF_LAYER_DEFS.map(ref => {
        const cfg = state.refLayers[ref.key];
        if (!cfg) return null;
        return (
          <div key={ref.key} style={{ marginBottom: 6, paddingLeft: 20 }}>
            <label style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: '#e0e0e0', fontSize: 12, cursor: 'pointer', marginBottom: 3,
            }}>
              <input
                type="checkbox" checked={cfg.enabled}
                onChange={() => dispatch({ type: 'TOGGLE_REF_LAYER', payload: ref.key })}
                style={{ accentColor: cfg.color }}
              />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
              {ref.label}
            </label>
            {cfg.enabled && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 20, marginTop: 2 }}>
                <input
                  type="color" value={cfg.color}
                  onChange={e => dispatch({ type: 'SET_REF_LAYER_STYLE', payload: { id: ref.key, key: 'color', value: e.target.value } })}
                  title="Stroke color"
                  style={{ width: 20, height: 16, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#808090', fontSize: 10 }}>
                  W
                  <input type="range" min={0.5} max={5} step={0.5} value={cfg.weight}
                    onChange={e => dispatch({ type: 'SET_REF_LAYER_STYLE', payload: { id: ref.key, key: 'weight', value: parseFloat(e.target.value) } })}
                    style={{ width: 50, height: 3, accentColor: '#00f0ff' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#808090', fontSize: 10 }}>
                  Op
                  <input type="range" min={0} max={100}
                    value={Math.round(cfg.opacity * 100)}
                    onChange={e => dispatch({ type: 'SET_REF_LAYER_STYLE', payload: { id: ref.key, key: 'opacity', value: parseInt(e.target.value) / 100 } })}
                    style={{ width: 50, height: 3, accentColor: '#00f0ff' }}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PointsSection() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div style={{ borderTop: '1px solid rgba(0, 240, 255, 0.15)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 12px' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span style={{ color: '#00f0ff', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          Points
        </span>
        <span style={{ color: '#606070', fontSize: 9 }}>{collapsed ? '▶' : '▼'}</span>
      </div>
      {!collapsed && (
        <>
          <MapPointList />
          <MapPointInput />
        </>
      )}
    </div>
  );
}

/** Layers panel content — rendered inside the unified sidebar */
export function LayersPanel() {
  const { state, dispatch } = useApp();
  const groupsTopDown = [...state.layerGroups].reverse();

  return (
    <div>
      {groupsTopDown.map((group, idx) => {
        const isFirst = idx === groupsTopDown.length - 1;
        const isLast = idx === 0;

        if (group.id === 'radar') {
          return (
            <LayerGroupRow key={group.id} group={group} isFirst={isFirst} isLast={isLast}>
              <div style={{ color: '#a0a0b0', fontSize: 11, paddingLeft: 20 }}>
                Mosaic / Site radar
              </div>
            </LayerGroupRow>
          );
        }

        const overlays = state.overlays.filter(o => o.category === group.id);
        if (overlays.length === 0 && group.id !== 'custom') return null;

        return (
          <LayerGroupRow key={group.id} group={group} isFirst={isFirst} isLast={isLast}>
            {overlays.map(o => (
              <div key={o.id} style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 20,
              }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  color: '#e0e0e0', fontSize: 12, cursor: 'pointer', flex: 1,
                }}>
                  <input
                    type="checkbox" checked={o.enabled}
                    onChange={() => dispatch({ type: 'TOGGLE_OVERLAY', payload: o.id })}
                    style={{ accentColor: o.color }}
                  />
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.color, display: 'inline-block', flexShrink: 0 }} />
                  {o.name}
                </label>
                {o.enabled && (
                  <button
                    onClick={() => dispatch({
                      type: 'SET_OVERLAY_FILL_MODE',
                      payload: { id: o.id, fillMode: o.fillMode === 'fill' ? 'outline' : 'fill' },
                    })}
                    title={o.fillMode === 'fill' ? 'Switch to outline only' : 'Switch to filled'}
                    style={{
                      background: 'none',
                      border: `1px solid ${o.fillMode === 'fill' ? 'rgba(0,240,255,0.3)' : 'rgba(0,240,255,0.15)'}`,
                      color: o.fillMode === 'fill' ? '#00f0ff' : '#606070',
                      fontSize: 10, padding: '1px 5px', borderRadius: 3,
                      cursor: 'pointer', fontFamily: 'monospace', flexShrink: 0,
                    }}
                  >
                    {o.fillMode === 'fill' ? '■' : '□'}
                  </button>
                )}
              </div>
            ))}
            {group.id === 'custom' && <CustomOverlayInput />}
          </LayerGroupRow>
        );
      })}

      <RefLayerSection />
      <PointsSection />
    </div>
  );
}
