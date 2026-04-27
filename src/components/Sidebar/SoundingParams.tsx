import type { CSSProperties } from 'react';
import type { SoundingProfileLevel } from '../../types/sounding';
import { calcCAPE, calcSRH, calcBulkShear, calcBunkersMotion } from '../../utils/soundingCalc';

interface SoundingParamsProps {
  levels: SoundingProfileLevel[];
}

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '6px 12px',
  padding: '8px 0',
};

const label: CSSProperties = {
  color: '#00f0ff',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const value: CSSProperties = {
  color: '#e0e0e0',
  fontSize: 14,
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
};

function Param({ name, val, unit }: { name: string; val: number | string; unit: string }) {
  return (
    <div>
      <div style={label}>{name}</div>
      <div style={value}>
        {typeof val === 'number' ? Math.round(val) : val}
        <span style={{ fontSize: 10, color: '#a0a0b0', marginLeft: 2 }}>{unit}</span>
      </div>
    </div>
  );
}

export function SoundingParams({ levels }: SoundingParamsProps) {
  if (levels.length < 3) {
    return <div style={{ color: '#a0a0b0', fontSize: 12, fontFamily: 'var(--font-mono)', padding: '8px 0' }}>Insufficient data</div>;
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
