import type { NexradSite, RadarState } from '../types/radar';
import type { OverlayConfig } from '../types/overlays';
import type { IEMBotMessage } from '../types/iembot';

export interface AppState {
  radarState: RadarState;
  overlays: OverlayConfig[];
  sidebarOpen: boolean;
  sidebarLatLon: [number, number] | null;
  iembotMessages: IEMBotMessage[];
}

export type AppAction =
  | { type: 'SELECT_SITE'; payload: NexradSite | null }
  | { type: 'SET_FRAMES'; payload: { frames: RadarState['frames'] } }
  | { type: 'SET_CURRENT_FRAME'; payload: number }
  | { type: 'SET_ANIMATING'; payload: boolean }
  | { type: 'SET_ANIMATION_SPEED'; payload: number }
  | { type: 'SET_FRAME_COUNT'; payload: number }
  | { type: 'TOGGLE_OVERLAY'; payload: string }
  | { type: 'OPEN_SIDEBAR'; payload: [number, number] }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'ADD_IEMBOT_MSG'; payload: IEMBotMessage }
  | { type: 'CLEAR_IEMBOT' };

export const initialState: AppState = {
  radarState: {
    selectedSite: null,
    frames: [],
    currentFrame: 0,
    isAnimating: false,
    animationSpeed: 500,
    frameCount: 10,
  },
  overlays: [
    { id: 'day1', name: 'SPC Day 1 Outlook', url: 'https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson', enabled: false, refreshInterval: 300000, color: '#39ff14', category: 'spc' },
    { id: 'day2', name: 'SPC Day 2 Outlook', url: 'https://www.spc.noaa.gov/products/outlook/day2otlk_cat.lyr.geojson', enabled: false, refreshInterval: 300000, color: '#39ff14', category: 'spc' },
    { id: 'day3', name: 'SPC Day 3 Outlook', url: 'https://www.spc.noaa.gov/products/outlook/day3otlk_cat.lyr.geojson', enabled: false, refreshInterval: 300000, color: '#39ff14', category: 'spc' },
    { id: 'warnings', name: 'NWS Warnings', url: 'https://api.weather.gov/alerts/active?status=actual&message_type=alert', enabled: false, refreshInterval: 30000, color: '#ff0000', category: 'nws' },
    { id: 'watches', name: 'NWS Watches', url: 'https://api.weather.gov/alerts/active?event=Tornado%20Watch,Severe%20Thunderstorm%20Watch&status=actual&message_type=alert', enabled: false, refreshInterval: 60000, color: '#ffff00', category: 'nws' },
    { id: 'mcd', name: 'Mesoscale Discussions', url: 'spc-mcd-custom', enabled: false, refreshInterval: 120000, color: '#4444ff', category: 'spc' },
  ],
  sidebarOpen: false,
  sidebarLatLon: null,
  iembotMessages: [],
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
    case 'OPEN_SIDEBAR':
      return { ...state, sidebarOpen: true, sidebarLatLon: action.payload };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarOpen: false, sidebarLatLon: null };
    case 'ADD_IEMBOT_MSG':
      return { ...state, iembotMessages: [action.payload, ...state.iembotMessages].slice(0, 100) };
    case 'CLEAR_IEMBOT':
      return { ...state, iembotMessages: [] };
    default:
      return state;
  }
}
