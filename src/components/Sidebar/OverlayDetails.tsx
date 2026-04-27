import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { OverlayConfig } from '../../types/overlays';
import { pointInPolygon } from '../../utils/geoUtils';

interface OverlayDetailsProps {
  lat: number;
  lon: number;
  overlays: OverlayConfig[];
  overlayData: Record<string, GeoJSON.FeatureCollection>;
}

const sectionStyle: CSSProperties = {
  marginBottom: 6,
  borderRadius: 4,
  overflow: 'hidden',
};

const headerStyle = (color: string): CSSProperties => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 10px',
  background: 'rgba(26, 26, 46, 0.8)',
  borderLeft: `3px solid ${color}`,
  cursor: 'pointer',
  color: '#e0e0e0',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
});

const bodyStyle: CSSProperties = {
  padding: '6px 10px 6px 16px',
  background: 'rgba(10, 10, 15, 0.6)',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: '#c0c0d0',
  lineHeight: 1.5,
};

function extractPolygons(feature: GeoJSON.Feature): [number, number][][] {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') return (geom as GeoJSON.Polygon).coordinates as [number, number][][];
  if (geom.type === 'MultiPolygon') return (geom as GeoJSON.MultiPolygon).coordinates.flat() as [number, number][][];
  return [];
}

function featureContainsPoint(feature: GeoJSON.Feature, lat: number, lon: number): boolean {
  const polys = extractPolygons(feature);
  return polys.some(ring => pointInPolygon(lat, lon, ring));
}

function FeatureDetail({ feature, color }: { feature: GeoJSON.Feature; color: string }) {
  const [open, setOpen] = useState(false);
  const props = feature.properties || {};

  // Determine display name
  const name = props.LABEL2 || props.LABEL || props.event || props.headline || props.md_number || 'Feature';

  return (
    <div style={sectionStyle}>
      <div style={headerStyle(color)} onClick={() => setOpen(!open)}>
        <span>{name}</span>
        <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={bodyStyle}>
          {props.LABEL && <div><span style={{ color: '#00f0ff' }}>Label:</span> {props.LABEL}</div>}
          {props.LABEL2 && <div><span style={{ color: '#00f0ff' }}>Risk:</span> {props.LABEL2}</div>}
          {props.event && <div><span style={{ color: '#00f0ff' }}>Event:</span> {props.event}</div>}
          {props.headline && <div style={{ marginTop: 4 }}><span style={{ color: '#00f0ff' }}>Headline:</span> {props.headline}</div>}
          {props.description && (
            <div style={{ marginTop: 4 }}>
              <span style={{ color: '#00f0ff' }}>Details:</span>
              <div style={{ maxHeight: 120, overflow: 'auto', marginTop: 2 }}>{props.description}</div>
            </div>
          )}
          {props.senderName && <div><span style={{ color: '#00f0ff' }}>WFO:</span> {props.senderName}</div>}
          {props.onset && <div><span style={{ color: '#00f0ff' }}>Onset:</span> {props.onset}</div>}
          {props.expires && <div><span style={{ color: '#00f0ff' }}>Expires:</span> {props.expires}</div>}
          {props.EXPIRE && <div><span style={{ color: '#00f0ff' }}>Expires:</span> {props.EXPIRE}</div>}
          {props.VALID && <div><span style={{ color: '#00f0ff' }}>Valid:</span> {props.VALID}</div>}
          {props.concerning && <div style={{ marginTop: 4 }}><span style={{ color: '#00f0ff' }}>Concerning:</span> {props.concerning}</div>}
          {props.areas_affected && <div><span style={{ color: '#00f0ff' }}>Areas:</span> {props.areas_affected}</div>}
        </div>
      )}
    </div>
  );
}

export function OverlayDetails({ lat, lon, overlays, overlayData }: OverlayDetailsProps) {
  const enabledOverlays = overlays.filter(o => o.enabled);
  const hits: { config: OverlayConfig; features: GeoJSON.Feature[] }[] = [];

  for (const config of enabledOverlays) {
    const fc = overlayData[config.id];
    if (!fc?.features) continue;
    const matching = fc.features.filter(f => featureContainsPoint(f, lat, lon));
    if (matching.length > 0) hits.push({ config, features: matching });
  }

  if (hits.length === 0) return null;

  return (
    <div>
      <div style={{
        color: '#00f0ff',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: 6,
        paddingBottom: 4,
        borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
      }}>
        Active Overlays
      </div>
      {hits.map(({ config, features }) => (
        <div key={config.id} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: config.color, display: 'inline-block' }} />
            <span style={{ color: '#e0e0e0', fontSize: 12, fontFamily: 'var(--font-mono)' }}>{config.name}</span>
          </div>
          {features.map((f, i) => (
            <FeatureDetail key={i} feature={f} color={config.color} />
          ))}
        </div>
      ))}
    </div>
  );
}
