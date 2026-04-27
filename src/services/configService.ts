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
    animationSpeed: state.radarState.animationSpeed,
    frameCount: state.radarState.frameCount,
    radarProduct: state.radarState.radarProduct,
    mapPoints: state.mapPoints,
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
