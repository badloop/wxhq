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

// Base font: 13px monospace, scales well on HiDPI
const FONT = "monospace";
const BASE_SIZE = 13;

function extractPolygons(feature: GeoJSON.Feature): [number, number][][] {
  const geom = feature.geometry;
  if (!geom) return [];
  if (geom.type === 'Polygon') return (geom as GeoJSON.Polygon).coordinates as [number, number][][];
  if (geom.type === 'MultiPolygon') return (geom as GeoJSON.MultiPolygon).coordinates.flat() as [number, number][][];
  return [];
}

function featureContainsPoint(feature: GeoJSON.Feature, lat: number, lon: number): boolean {
  const polys = extractPolygons(feature);
  return polys.some(ring => pointInPolygon(lat, lon, ring));
}

/** Convert ISO timestamp to readable CT string */
function formatTime(ts: string | undefined): string {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  } catch {
    return ts;
  }
}

/** Convert SPC YYYYMMDDHHNN or DDHHNNZ format to readable string */
function formatSPCTime(ts: string | undefined): string {
  if (!ts) return '';
  // Full ISO format from _ISO fields
  if (ts.includes('T')) return formatTime(ts);
  // YYYYMMDDHHMM format
  if (ts.length === 12) {
    const y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8);
    const h = ts.slice(8, 10), mn = ts.slice(10, 12);
    return formatTime(`${y}-${m}-${d}T${h}:${mn}:00Z`);
  }
  // DDHHMMZ format
  if (ts.length === 7 && ts.endsWith('Z')) {
    return ts;
  }
  return ts;
}

/** Strip HTML tags and decode entities for plain text display */
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || html;
}

/** Render a labeled field */
function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: multiline ? 8 : 4 }}>
      <span style={{ color: '#00f0ff', fontFamily: FONT, fontSize: BASE_SIZE - 1 }}>{label}: </span>
      {multiline ? (
        <div style={{
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#d0d0e0',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
          marginTop: 4,
          paddingLeft: 4,
          borderLeft: '2px solid rgba(0, 240, 255, 0.15)',
        }}>
          {value}
        </div>
      ) : (
        <span style={{ fontFamily: FONT, fontSize: BASE_SIZE, color: '#d0d0e0' }}>{value}</span>
      )}
    </div>
  );
}

/** NWS Alert detail (watches, warnings) */
function NWSDetail({ feature, color }: { feature: GeoJSON.Feature; color: string }) {
  const [open, setOpen] = useState(false);
  const p = feature.properties || {};

  const title = p.event || 'NWS Alert';
  const headline = p.headline ? stripHtml(p.headline) : '';
  const description = p.description ? stripHtml(p.description) : '';
  const instruction = p.instruction ? stripHtml(p.instruction) : '';
  const areaDesc = p.areaDesc || '';
  const wfo = p.senderName || '';
  const severity = p.severity || '';
  const urgency = p.urgency || '';

  return (
    <div style={{ marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(26, 26, 46, 0.8)',
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#e0e0e0',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: BASE_SIZE - 2, color: '#a0a0b0' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(10, 10, 15, 0.6)',
          borderLeft: `3px solid ${color}`,
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#c0c0d0',
          lineHeight: 1.5,
        }}>
          {headline && <Field label="Headline" value={headline} multiline />}
          <Field label="WFO" value={wfo} />
          <Field label="Severity" value={severity} />
          <Field label="Urgency" value={urgency} />
          <Field label="Onset" value={formatTime(p.onset)} />
          <Field label="Expires" value={formatTime(p.expires)} />
          {areaDesc && <Field label="Areas" value={areaDesc} multiline />}
          {description && <Field label="Description" value={description} multiline />}
          {instruction && <Field label="Instructions" value={instruction} multiline />}
        </div>
      )}
    </div>
  );
}

/** SPC Outlook detail */
function SPCDetail({ feature, color }: { feature: GeoJSON.Feature; color: string }) {
  const [open, setOpen] = useState(false);
  const p = feature.properties || {};

  const title = p.LABEL2 || p.LABEL || 'SPC Outlook';

  return (
    <div style={{ marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(26, 26, 46, 0.8)',
          borderLeft: `3px solid ${p.stroke || color}`,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#e0e0e0',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: BASE_SIZE - 2, color: '#a0a0b0' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(10, 10, 15, 0.6)',
          borderLeft: `3px solid ${p.stroke || color}`,
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#c0c0d0',
          lineHeight: 1.5,
        }}>
          <Field label="Category" value={p.LABEL || ''} />
          <Field label="Risk" value={p.LABEL2 || ''} />
          <Field label="Forecaster" value={p.FORECASTER || ''} />
          <Field label="Valid" value={formatSPCTime(p.VALID_ISO || p.VALID)} />
          <Field label="Expires" value={formatSPCTime(p.EXPIRE_ISO || p.EXPIRE)} />
          <Field label="Issued" value={formatSPCTime(p.ISSUE_ISO || p.ISSUE)} />
        </div>
      )}
    </div>
  );
}

/** MCD detail */
function MCDDetail({ feature, color }: { feature: GeoJSON.Feature; color: string }) {
  const [open, setOpen] = useState(false);
  const p = feature.properties || {};

  const title = p.id || `MD #${p.number}`;

  return (
    <div style={{ marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(26, 26, 46, 0.8)',
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#e0e0e0',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: BASE_SIZE - 2, color: '#a0a0b0' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(10, 10, 15, 0.6)',
          borderLeft: `3px solid ${color}`,
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#c0c0d0',
          lineHeight: 1.5,
        }}>
          <Field label="Valid" value={`${p.valid_start} - ${p.valid_end}`} />
          {p.areas && <Field label="Areas" value={p.areas} multiline />}
          {p.concerning && <Field label="Concerning" value={p.concerning} multiline />}
          {p.url && (
            <div style={{ marginTop: 6 }}>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00f0ff', fontFamily: FONT, fontSize: BASE_SIZE }}
              >
                View Full Discussion
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Watch detail (tornado/severe thunderstorm watches) */
function WatchDetail({ feature, color }: { feature: GeoJSON.Feature; color: string }) {
  const [open, setOpen] = useState(false);
  const p = feature.properties || {};

  const title = p.event || 'Watch';

  return (
    <div style={{ marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(26, 26, 46, 0.8)',
          borderLeft: `3px solid ${p.stroke || color}`,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#e0e0e0',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: BASE_SIZE - 2, color: '#a0a0b0' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(10, 10, 15, 0.6)',
          borderLeft: `3px solid ${p.stroke || color}`,
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#c0c0d0',
          lineHeight: 1.5,
        }}>
          {p.headline && <Field label="Headline" value={stripHtml(p.headline)} multiline />}
          <Field label="Watch #" value={p.etn ? String(parseInt(p.etn, 10)) : ''} />
          <Field label="Type" value={p.phenomena === 'TO' ? 'Tornado' : p.phenomena === 'SV' ? 'Severe Thunderstorm' : p.phenomena || ''} />
          {p.url && (
            <div style={{ marginTop: 6 }}>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#00f0ff', fontFamily: FONT, fontSize: BASE_SIZE }}
              >
                View Watch Details
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pick the right detail component based on overlay category */
function FeatureDetail({ feature, config }: { feature: GeoJSON.Feature; config: OverlayConfig }) {
  if (config.category === 'warnings') {
    return <NWSDetail feature={feature} color={config.color} />;
  }
  if (config.category === 'watches') {
    return <WatchDetail feature={feature} color={config.color} />;
  }
  if (config.id === 'mcd') {
    return <MCDDetail feature={feature} color={config.color} />;
  }
  if (config.category === 'spc') {
    return <SPCDetail feature={feature} color={config.color} />;
  }
  // Custom / fallback: dump all properties
  return <GenericDetail feature={feature} color={config.color} />;
}

/** Generic detail for custom overlays — show all properties */
function GenericDetail({ feature, color }: { feature: GeoJSON.Feature; color: string }) {
  const [open, setOpen] = useState(false);
  const p = feature.properties || {};
  const keys = Object.keys(p).filter(k => typeof p[k] === 'string' || typeof p[k] === 'number');
  const title = p.name || p.NAME || p.title || p.LABEL || 'Feature';

  return (
    <div style={{ marginBottom: 8, borderRadius: 4, overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(26, 26, 46, 0.8)',
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#e0e0e0',
        }}
      >
        <span>{String(title)}</span>
        <span style={{ fontSize: BASE_SIZE - 2, color: '#a0a0b0' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          padding: '10px 12px',
          background: 'rgba(10, 10, 15, 0.6)',
          borderLeft: `3px solid ${color}`,
          fontFamily: FONT,
          fontSize: BASE_SIZE,
          color: '#c0c0d0',
          lineHeight: 1.5,
        }}>
          {keys.map(k => (
            <Field key={k} label={k} value={String(p[k])} multiline={String(p[k]).length > 80} />
          ))}
        </div>
      )}
    </div>
  );
}

const sectionHeaderStyle: CSSProperties = {
  color: '#00f0ff',
  fontSize: BASE_SIZE,
  fontFamily: FONT,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: 8,
  paddingBottom: 4,
  borderBottom: '1px solid rgba(0, 240, 255, 0.2)',
};

/** SPC categorical risk severity order (highest index = highest severity) */
const SPC_SEVERITY_ORDER = ['TSTM', 'MRGL', 'SLGT', 'ENH', 'MDT', 'HIGH'];

function spcSeverityRank(feature: GeoJSON.Feature): number {
  const label = feature.properties?.LABEL || '';
  const idx = SPC_SEVERITY_ORDER.indexOf(label);
  return idx >= 0 ? idx : -1;
}

/** For SPC overlays, keep only the highest-severity matching feature */
function filterHighestSPCSeverity(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  if (features.length <= 1) return features;
  let maxRank = -1;
  let best: GeoJSON.Feature | null = null;
  for (const f of features) {
    const rank = spcSeverityRank(f);
    if (rank > maxRank) {
      maxRank = rank;
      best = f;
    }
  }
  return best ? [best] : features;
}

export function OverlayDetails({ lat, lon, overlays, overlayData }: OverlayDetailsProps) {
  const enabledOverlays = overlays.filter(o => o.enabled);
  const hits: { config: OverlayConfig; features: GeoJSON.Feature[] }[] = [];

  for (const config of enabledOverlays) {
    const fc = overlayData[config.id];
    if (!fc?.features) continue;
    let matching = fc.features.filter(f => featureContainsPoint(f, lat, lon));
    // For SPC outlooks, only show the highest severity level
    if (config.category === 'spc' && matching.length > 1) {
      matching = filterHighestSPCSeverity(matching);
    }
    if (matching.length > 0) hits.push({ config, features: matching });
  }

  if (hits.length === 0) return null;

  return (
    <div>
      <div style={sectionHeaderStyle}>Active Overlays</div>
      {hits.map(({ config, features }) => (
        <div key={config.id} style={{ marginBottom: 10 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
            fontFamily: FONT,
            fontSize: BASE_SIZE,
          }}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: config.color,
              display: 'inline-block',
              boxShadow: `0 0 4px ${config.color}`,
            }} />
            <span style={{ color: '#e0e0e0' }}>{config.name}</span>
          </div>
          {features.map((f, i) => (
            <FeatureDetail key={i} feature={f} config={config} />
          ))}
        </div>
      ))}
    </div>
  );
}
