import { useRef, useEffect } from 'react';
import type { SoundingProfileLevel } from '../../types/sounding';
import { windComponents } from '../../utils/soundingCalc';

interface HodographProps {
  levels: SoundingProfileLevel[];
  sfcHeight: number;
}

const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_KNOTS = 100;
const RINGS = [20, 40, 60, 80, 100];

const HEIGHT_COLORS: [number, string][] = [
  [1000, '#ff4444'],   // 0-1km red
  [3000, '#39ff14'],   // 1-3km green
  [6000, '#00f0ff'],   // 3-6km cyan
  [9000, '#ff00aa'],   // 6-9km magenta
  [Infinity, '#888888'], // 9+km gray
];

function getColor(hAgl: number): string {
  for (const [threshold, color] of HEIGHT_COLORS) {
    if (hAgl <= threshold) return color;
  }
  return '#888888';
}

function knotsToPixel(knots: number): number {
  return (knots / MAX_KNOTS) * (SIZE / 2 - 20);
}

export function Hodograph({ levels, sfcHeight }: HodographProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid rings
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.textAlign = 'center';

    for (const ring of RINGS) {
      const r = knotsToPixel(ring);
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`${ring}`, CENTER + r + 2, CENTER - 4);
    }

    // Crosshairs
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(CENTER, 0); ctx.lineTo(CENTER, SIZE);
    ctx.moveTo(0, CENTER); ctx.lineTo(SIZE, CENTER);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText('N', CENTER, 12);
    ctx.fillText('S', CENTER, SIZE - 4);
    ctx.textAlign = 'left';
    ctx.fillText('E', SIZE - 14, CENTER - 4);
    ctx.textAlign = 'right';
    ctx.fillText('W', 14, CENTER - 4);

    // Filter valid wind levels
    const wl = levels.filter(l => l.drct != null && l.sknt != null);
    if (wl.length < 2) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
      ctx.textAlign = 'center';
      ctx.font = '12px "Share Tech Mono", monospace';
      ctx.fillText('No wind data', CENTER, CENTER);
      return;
    }

    // Plot wind trace
    const heightMarkers = [1000, 3000, 6000, 9000];

    for (let i = 0; i < wl.length - 1; i++) {
      const hAgl = wl[i].hght - sfcHeight;
      const w0 = windComponents(wl[i].drct!, wl[i].sknt!);
      const w1 = windComponents(wl[i + 1].drct!, wl[i + 1].sknt!);

      const x0 = CENTER + knotsToPixel(w0.u);
      const y0 = CENTER - knotsToPixel(w0.v);
      const x1 = CENTER + knotsToPixel(w1.u);
      const y1 = CENTER - knotsToPixel(w1.v);

      ctx.strokeStyle = getColor(hAgl);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Height markers
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    for (const hm of heightMarkers) {
      const targetH = sfcHeight + hm;
      // Find closest level
      let closest = wl[0];
      let closestDist = Math.abs(wl[0].hght - targetH);
      for (const l of wl) {
        const d = Math.abs(l.hght - targetH);
        if (d < closestDist) { closest = l; closestDist = d; }
      }
      if (closestDist > 500) continue;

      const w = windComponents(closest.drct!, closest.sknt!);
      const x = CENTER + knotsToPixel(w.u);
      const y = CENTER - knotsToPixel(w.v);

      ctx.fillStyle = getColor(hm);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`${hm / 1000}km`, x + 6, y + 3);
    }

    // Legend
    const legendY = SIZE - 12;
    ctx.font = '9px "Share Tech Mono", monospace';
    const labels = ['0-1', '1-3', '3-6', '6-9', '9+'];
    const colors = ['#ff4444', '#39ff14', '#00f0ff', '#ff00aa', '#888888'];
    let lx = 8;
    for (let i = 0; i < labels.length; i++) {
      ctx.fillStyle = colors[i];
      ctx.fillRect(lx, legendY - 6, 8, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(labels[i], lx + 10, legendY + 1);
      lx += 46;
    }
  }, [levels, sfcHeight]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: SIZE, height: SIZE, display: 'block', margin: '0 auto' }}
    />
  );
}
