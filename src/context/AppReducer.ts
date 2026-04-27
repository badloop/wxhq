import type { NexradSite, RadarState } from '../types/radar';
import type { OverlayConfig, LayerGroup } from '../types/overlays';
import type { IEMBotMessage, IEMBotConfig } from '../types/iembot';

export interface AppState {
  radarState: RadarState;
  overlays: OverlayConfig[];
  overlayGeoJSON: Record<string, GeoJSON.FeatureCollection>;
  layerGroups: LayerGroup[];
  sidebarOpen: boolean;
  sidebarLatLon: [number, number] | null;
  iembotMessages: IEMBotMessage[];
  iembotConfig: IEMBotConfig;
  iembotPanelOpen: boolean;
  iembotUnread: number;
}

export type AppAction =
  | { type: 'SELECT_SITE'; payload: NexradSite | null }
  | { type: 'SET_FRAMES'; payload: { frames: RadarState['frames'] } }
  | { type: 'SET_CURRENT_FRAME'; payload: number }
  | { type: 'SET_ANIMATING'; payload: boolean }
  | { type: 'SET_ANIMATION_SPEED'; payload: number }
  | { type: 'SET_FRAME_COUNT'; payload: number }
  | { type: 'TOGGLE_OVERLAY'; payload: string }
  | { type: 'SET_OVERLAY_FILL_MODE'; payload: { id: string; fillMode: 'fill' | 'outline' } }
  | { type: 'OPEN_SIDEBAR'; payload: [number, number] }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'ADD_IEMBOT_MSG'; payload: IEMBotMessage }
  | { type: 'CLEAR_IEMBOT' }
  | { type: 'TOGGLE_IEMBOT_PANEL' }
  | { type: 'MARK_IEMBOT_READ' }
  | { type: 'SET_IEMBOT_ROOMS'; payload: string[] }
  | { type: 'ADD_OVERLAY'; payload: OverlayConfig }
  | { type: 'SET_OVERLAY_GEOJSON'; payload: { id: string; geojson: GeoJSON.FeatureCollection } }
  | { type: 'SET_GROUP_OPACITY'; payload: { id: string; opacity: number } }
  | { type: 'MOVE_GROUP'; payload: { id: string; direction: 'up' | 'down' } }
  | { type: 'LOAD_CONFIG'; payload: Partial<PersistableConfig> };

/** The subset of state that gets persisted to YAML */
export interface PersistableConfig {
  overlays: Array<{ id: string; enabled: boolean; fillMode: 'fill' | 'outline' }>;
  customOverlays: OverlayConfig[];
  layerGroups: LayerGroup[];
  iembotRooms: string[];
  animationSpeed: number;
  frameCount: number;
}

export const defaultOverlays: OverlayConfig[] = [
  { id: 'day1', name: 'SPC Day 1 Outlook', url: 'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson', enabled: false, refreshInterval: 300000, color: '#39ff14', category: 'spc', fillMode: 'fill' },
  { id: 'day2', name: 'SPC Day 2 Outlook', url: 'https://www.spc.noaa.gov/products/outlook/day2otlk_cat.lyr.geojson', enabled: false, refreshInterval: 300000, color: '#39ff14', category: 'spc', fillMode: 'fill' },
  { id: 'day3', name: 'SPC Day 3 Outlook', url: 'https://www.spc.noaa.gov/products/outlook/day3otlk_cat.lyr.geojson', enabled: false, refreshInterval: 300000, color: '#39ff14', category: 'spc', fillMode: 'fill' },
  { id: 'warnings', name: 'NWS Warnings', url: 'https://api.weather.gov/alerts/active?status=actual&message_type=alert', enabled: false, refreshInterval: 30000, color: '#ff0000', category: 'nws', fillMode: 'fill' },
  { id: 'watches', name: 'NWS Watches', url: 'https://api.weather.gov/alerts/active?event=Tornado%20Watch,Severe%20Thunderstorm%20Watch&status=actual&message_type=alert', enabled: false, refreshInterval: 60000, color: '#ffff00', category: 'nws', fillMode: 'fill' },
  { id: 'mcd', name: 'Mesoscale Discussions', url: 'spc-mcd-custom', enabled: false, refreshInterval: 120000, color: '#4444ff', category: 'mcd', fillMode: 'fill' },
];

export const defaultLayerGroups: LayerGroup[] = [
  { id: 'spc', name: 'SPC Outlooks', opacity: 1 },
  { id: 'mcd', name: 'Mesoscale Disc.', opacity: 1 },
  { id: 'radar', name: 'Radar', opacity: 0.7 },
  { id: 'nws', name: 'NWS', opacity: 1 },
  { id: 'custom', name: 'Custom', opacity: 1 },
];

export const initialState: AppState = {
  radarState: {
    selectedSite: null,
    frames: [],
    currentFrame: 0,
    isAnimating: false,
    animationSpeed: 500,
    frameCount: 10,
  },
  overlays: defaultOverlays,
  overlayGeoJSON: {},
  layerGroups: defaultLayerGroups,
  sidebarOpen: false,
  sidebarLatLon: null,
  iembotMessages: [],
  iembotConfig: {
    rooms: ['botstalk'],
    pollInterval: 10000,
    enabled: true,
  },
  iembotPanelOpen: false,
  iembotUnread: 0,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SELECT_SITE':
      return { ...state, radarState: { ...state.radarState, selectedSite: action.payload, frames: [], currentFrame: 0, isAnimating: false } };
    case 'SET_FRAMES':
      return { ...state, radarState: { ...state.radarState, frames: action.payload.frames } };
    case 'SET_CURRENT_FRAME':
      return { ...state, radarState: { ...state.radarState, currentFrame: action.payload } };
    case 'SET_ANIMATING':
      return { ...state, radarState: { ...state.radarState, isAnimating: action.payload } };
    case 'SET_ANIMATION_SPEED':
      return { ...state, radarState: { ...state.radarState, animationSpeed: action.payload } };
    case 'SET_FRAME_COUNT':
      return { ...state, radarState: { ...state.radarState, frameCount: action.payload } };
    case 'TOGGLE_OVERLAY':
      return { ...state, overlays: state.overlays.map(o => o.id === action.payload ? { ...o, enabled: !o.enabled } : o) };
    case 'SET_OVERLAY_FILL_MODE':
      return { ...state, overlays: state.overlays.map(o => o.id === action.payload.id ? { ...o, fillMode: action.payload.fillMode } : o) };
    case 'OPEN_SIDEBAR':
      return { ...state, sidebarOpen: true, sidebarLatLon: action.payload };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarOpen: false, sidebarLatLon: null };
    case 'ADD_IEMBOT_MSG': {
      if (state.iembotMessages.some((m) => m.seqnum === action.payload.seqnum)) {
        return state;
      }
      return {
        ...state,
        iembotMessages: [action.payload, ...state.iembotMessages].slice(0, 500),
        iembotUnread: state.iembotPanelOpen ? state.iembotUnread : state.iembotUnread + 1,
      };
    }
    case 'CLEAR_IEMBOT':
      return { ...state, iembotMessages: [], iembotUnread: 0 };
    case 'TOGGLE_IEMBOT_PANEL':
      return { ...state, iembotPanelOpen: !state.iembotPanelOpen, iembotUnread: state.iembotPanelOpen ? state.iembotUnread : 0 };
    case 'MARK_IEMBOT_READ':
      return { ...state, iembotUnread: 0 };
    case 'SET_IEMBOT_ROOMS':
      return { ...state, iembotConfig: { ...state.iembotConfig, rooms: action.payload } };
    case 'ADD_OVERLAY':
      return { ...state, overlays: [...state.overlays, action.payload] };
    case 'SET_OVERLAY_GEOJSON':
      return { ...state, overlayGeoJSON: { ...state.overlayGeoJSON, [action.payload.id]: action.payload.geojson } };
    case 'SET_GROUP_OPACITY':
      return { ...state, layerGroups: state.layerGroups.map(g => g.id === action.payload.id ? { ...g, opacity: action.payload.opacity } : g) };
    case 'MOVE_GROUP': {
      const groups = [...state.layerGroups];
      const idx = groups.findIndex(g => g.id === action.payload.id);
      if (idx < 0) return state;
      const swapIdx = action.payload.direction === 'up' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= groups.length) return state;
      [groups[idx], groups[swapIdx]] = [groups[swapIdx], groups[idx]];
      return { ...state, layerGroups: groups };
    }
    case 'LOAD_CONFIG': {
      const cfg = action.payload;
      let newState = { ...state };

      if (cfg.layerGroups) {
        newState.layerGroups = cfg.layerGroups;
      }
      if (cfg.iembotRooms) {
        newState.iembotConfig = { ...newState.iembotConfig, rooms: cfg.iembotRooms };
      }
      if (cfg.animationSpeed !== undefined) {
        newState.radarState = { ...newState.radarState, animationSpeed: cfg.animationSpeed };
      }
      if (cfg.frameCount !== undefined) {
        newState.radarState = { ...newState.radarState, frameCount: cfg.frameCount };
      }
      if (cfg.overlays) {
        // Merge saved overlay settings into default overlays
        newState.overlays = newState.overlays.map(o => {
          const saved = cfg.overlays!.find(s => s.id === o.id);
          if (saved) return { ...o, enabled: saved.enabled, fillMode: saved.fillMode };
          return o;
        });
      }
      if (cfg.customOverlays) {
        // Add custom overlays that don't already exist
        for (const custom of cfg.customOverlays) {
          if (!newState.overlays.some(o => o.id === custom.id)) {
            newState.overlays = [...newState.overlays, custom];
          }
        }
      }

      return newState;
    }
    default:
      return state;
  }
}
