import type { CSSProperties } from 'react';
import type { SoundingProfileLevel } from '../../types/sounding';
import { calcCAPE, calcSRH, calcBulkShear, calcBunkersMotion } from '../../utils/soundingCalc';

interface SoundingParamsProps {
  levels: SoundingProfileLevel[];
}

const FONT = "'Share Tech Mono', monospace";
const BASE_SIZE = 13;

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px 12px',
  padding: '8px 0',
};

const labelStyle: CSSProperties = {
  color: '#00f0ff',
  fontSize: BASE_SIZE - 1,
  fontFamily: FONT,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const valueStyle: CSSProperties = {
  color: '#e0e0e0',
  fontSize: BASE_SIZE + 2,
  fontFamily: FONT,
  fontWeight: 600,
};

function Param({ name, val, unit }: { name: string; val: number | string; unit: string }) {
  return (
    <div>
      <div style={labelStyle}>{name}</div>
      <div style={valueStyle}>
        {typeof val === 'number' ? Math.round(val) : val}
        <span style={{ fontSize: BASE_SIZE - 2, color: '#a0a0b0', marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

export function SoundingParams({ levels }: SoundingParamsProps) {
  if (levels.length < 3) {
    return <div style={{ color: '#a0a0b0', fontSize: BASE_SIZE, fontFamily: FONT, padding: '8px 0' }}>Insufficient data</div>;
  }

  const { cape, cin, lcl } = calcCAPE(levels);
  const motion = calcBunkersMotion(levels);
  const srh1 = calcSRH(levels, 1000, motion);
  const srh3 = calcSRH(levels, 3000, motion);
  const shear6 = calcBulkShear(levels, 6000);

  return (
    <div style={grid}>
      <Param name="SBCAPE" val={cape} unit="J/kg" />
      <Param name="SBCIN" val={cin} unit="J/kg" />
      <Param name="0-1km SRH" val={srh1} unit="m²/s²" />
      <Param name="0-3km SRH" val={srh3} unit="m²/s²" />
      <Param name="0-6km Shear" val={shear6} unit="kt" />
      <Param name="LCL" val={lcl} unit="m AGL" />
    </div>
  );
}
