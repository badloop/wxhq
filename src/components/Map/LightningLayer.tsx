import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../context/AppContext';

const LIGHTNING_PANE = 'overlay-lightning';
const FETCH_URL = 'https://www.freelightning.com/glm/glm(Flashes).php';
const REFRESH_MS = 40_000;

function parseFlashes(text: string): [number, number][] {
  const flashes: [number, number][] = [];
  const regex = /<flash>([\d.-]+),([\d.-]+)<\/flash>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    flashes.push([parseFloat(match[1]), parseFloat(match[2])]);
  }
  return flashes;
}

export function LightningLayer() {
  const { state } = useApp();
  const cfg = state.refLayers.lightning;
  const map = useMap();
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create pane once
  useEffect(() => {
    if (!map.getPane(LIGHTNING_PANE)) {
      const pane = map.createPane(LIGHTNING_PANE);
      pane.style.zIndex = '480';
    }
    layerGroupRef.current = L.layerGroup([], { pane: LIGHTNING_PANE }).addTo(map);
    return () => {
      layerGroupRef.current?.remove();
    };
  }, [map]);

  // Fetch and render
  useEffect(() => {
    if (!cfg?.enabled) {
      layerGroupRef.current?.clearLayers();
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(FETCH_URL);
        const text = await res.text();
        if (text.startsWith('Rate limited')) return; // keep existing data
        const flashes = parseFlashes(text);
        const group = layerGroupRef.current;
        if (!group) return;
        group.clearLayers();
        for (const [lat, lng] of flashes) {
        const icon = L.divIcon({
          html: `<span style="color:${cfg.color};font-size:14px;text-shadow:0 0 3px #fff;">⚡</span>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        L.marker([lat, lng], { icon, pane: LIGHTNING_PANE }).addTo(group);
        }
      } catch (err) {
        console.error('[wxhq] Lightning fetch failed:', err);
      }
    };

    load();
    intervalRef.current = setInterval(load, REFRESH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cfg?.enabled, cfg?.color, cfg?.opacity]);

  return null;
}
