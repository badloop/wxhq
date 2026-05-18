import type { AppState } from '../context/AppReducer';
import type { PersistableConfig } from '../context/AppReducer';

/** Extract persistable config from current app state */
export function extractConfig(state: AppState): PersistableConfig {
  return {
    overlays: state.overlays
      .filter(o => o.category !== 'custom')
      .map(o => ({ id: o.id, enabled: o.enabled, fillMode: o.fillMode })),
    customOverlays: state.overlays.filter(o => o.category === 'custom'),
    layerGroups: state.layerGroups,
    iembotRooms: state.iembotConfig.rooms,
    iembotTelegramNotify: state.iembotConfig.telegramNotify,
    iembotDesktopNotify: state.iembotConfig.desktopNotify,
    iembotLastSeqnums: state.iembotLastSeqnums,
    iembotDismissed: state.iembotDismissed,
    animationSpeed: state.radarState.animationSpeed,
    frameCount: state.radarState.frameCount,
    radarProduct: state.radarState.radarProduct,
    loopDelay: state.radarState.loopDelay,
    mapPoints: state.mapPoints,
    refLayers: state.refLayers,
    layout: state.layout,
    paneProducts: state.paneProducts,
  };
}

/** Save config to JSON file via dev server API */
export function saveConfig(state: AppState): void {
  try {
    const config = extractConfig(state);
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config, null, 2),
    }).catch(err => console.error('[wxhq] Failed to save config:', err));
  } catch (err) {
    console.error('[wxhq] Failed to save config:', err);
  }
}

/** Load config from JSON file via dev server API */
export async function loadConfig(): Promise<Partial<PersistableConfig> | null> {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return null;
    const config = await res.json() as Partial<PersistableConfig> | null;
    return config;
  } catch (err) {
    console.error('[wxhq] Failed to load config:', err);
    return null;
  }
}

const MESSAGES_KEY = 'wxhq-iembot-messages';
const POLYGONS_KEY = 'wxhq-iembot-polygons';

/** Save IEMBot messages to localStorage (separate from config to keep YAML lean) */
export function saveIEMBotMessages(messages: import('../types/iembot').IEMBotMessage[]): void {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
  } catch {
    // Storage full — silently fail
  }
}

/** Load persisted IEMBot messages */
export function loadIEMBotMessages(): import('../types/iembot').IEMBotMessage[] {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as import('../types/iembot').IEMBotMessage[];
  } catch {
    return [];
  }
}

/** Save IEMBot polygons to localStorage */
export function saveIEMBotPolygons(polygons: import('../context/AppReducer').IEMBotPolygon[]): void {
  try {
    localStorage.setItem(POLYGONS_KEY, JSON.stringify(polygons));
  } catch {
    // Storage full — silently fail
  }
}

/** Load persisted IEMBot polygons */
export function loadIEMBotPolygons(): import('../context/AppReducer').IEMBotPolygon[] {
  try {
    const raw = localStorage.getItem(POLYGONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as import('../context/AppReducer').IEMBotPolygon[];
  } catch {
    return [];
  }
}

/** Export config as downloadable JSON file */
export function exportConfig(state: AppState): void {
  const config = extractConfig(state);
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wxhq-config.json';
  a.click();
  URL.revokeObjectURL(url);
}
