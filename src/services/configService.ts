import yaml from 'js-yaml';
import type { AppState } from '../context/AppReducer';
import type { PersistableConfig } from '../context/AppReducer';

const STORAGE_KEY = 'wxhq-config';

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
    iembotLastSeqnums: state.iembotLastSeqnums,
    iembotDismissed: state.iembotDismissed,
    animationSpeed: state.radarState.animationSpeed,
    frameCount: state.radarState.frameCount,
    radarProduct: state.radarState.radarProduct,
    mapPoints: state.mapPoints,
    refLayers: state.refLayers,
    layout: state.layout,
    paneProducts: state.paneProducts,
  };
}

/** Save config as YAML to localStorage */
export function saveConfig(state: AppState): void {
  try {
    const config = extractConfig(state);
    const yamlStr = yaml.dump(config, { indent: 2, lineWidth: 120, noRefs: true });
    localStorage.setItem(STORAGE_KEY, yamlStr);
  } catch (err) {
    console.error('[wxhq] Failed to save config:', err);
  }
}

/** Load config from localStorage YAML */
export function loadConfig(): Partial<PersistableConfig> | null {
  try {
    const yamlStr = localStorage.getItem(STORAGE_KEY);
    if (!yamlStr) return null;
    const config = yaml.load(yamlStr) as Partial<PersistableConfig>;
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

/** Export config as downloadable YAML file */
export function exportConfig(state: AppState): void {
  const config = extractConfig(state);
  const yamlStr = yaml.dump(config, { indent: 2, lineWidth: 120, noRefs: true });
  const blob = new Blob([yamlStr], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wxhq-config.yaml';
  a.click();
  URL.revokeObjectURL(url);
}
